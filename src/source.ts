// Source router — one place that decides WHERE a track comes from. TIDAL is the
// primary source when enabled + logged in (lossless FLAC); yt-dlp is the
// automatic fallback, per-operation and per-track, so nothing ever dead-ends:
//   • search  → TIDAL results; if TIDAL is off/errors/empty, yt-dlp search.
//   • download → by the track's own `source`; a failed TIDAL pull falls back to
//                finding the same song on YouTube.
//   • radio   → the seed's TIDAL track-mix; else yt-dlp radio.
// Everything downstream (analysis, mixing) is source-agnostic — it just gets a
// file path.
//
// TIDAL_STRICT turns every fallback off (`tidalStrict()`): the catalog is exactly
// TIDAL's and everything that plays is lossless. Operations TIDAL can't serve
// return empty rather than degrading to YouTube, so callers must handle an empty
// result as a normal outcome — see `strictNote()` for the user-facing reason.

import { BoundedCache } from "./bounded-cache";
import { config } from "./config";
import { createLogger } from "./logger";
import { replayGainFilter } from "./loudness";
import { isMirrorUrl, mirrorQuery, resolveMirror } from "./mirror";
import {
    type Explore,
    type HomeFeed,
    type PageFeed,
    type RichSearch,
    type TidalAlbum,
    type TidalArtist,
    type TidalCredit,
    type TidalPlaylist,
    type TidalStreamUrl,
    tidalAlbum,
    tidalArtist,
    tidalCachedPath,
    tidalCredits,
    tidalDownloadTrack,
    tidalEnabled,
    tidalExplore,
    tidalHome,
    tidalMix,
    tidalPage,
    tidalPlaylist,
    tidalRadio,
    tidalRichSearch,
    tidalSearch,
    tidalStrict,
    tidalStreamUrl,
    tidalTrack,
} from "./tidal";
import { downloadTrack, resolveQuery, resolveRadio, searchStream, type TrackInfo } from "./ytdlp";

export type {
    Explore,
    ExploreGroup,
    HomeFeed,
    HomeSection,
    PageFeed,
    RichSearch,
    TidalAlbum,
    TidalArtist,
    TidalCredit,
    TidalHealth,
    TidalMix,
    TidalPlaylist,
    TopHit,
} from "./tidal";
export { tidalEnabled, tidalHealth, tidalPing, tidalStrict } from "./tidal";
export type { TrackInfo } from "./ytdlp";

const log = createLogger("source");

/**
 * The track id in a native TIDAL link, else null. Covers the locale-prefixed and
 * `/browse/` forms TIDAL's own share sheet produces, e.g.
 * `tidal.com/browse/track/123`, `tidal.com/de/track/123?u=…`.
 */
export function tidalTrackId(url: string): string | null {
    return tidalPathId(url, "track", "\\d+");
}

/** The album id in a native TIDAL link, else null. */
export function tidalAlbumId(url: string): string | null {
    return tidalPathId(url, "album", "\\d+");
}

/** The playlist id (a uuid) in a native TIDAL link, else null. */
export function tidalPlaylistId(url: string): string | null {
    return tidalPathId(url, "playlist", "[0-9a-f-]{16,}");
}

/**
 * Shared shape of a tidal.com entity link. The host part is deliberately strict —
 * this decides whether a URL is treated as our own catalog, so `nottidal.com` and
 * `tidal.com.example.test` must not match.
 */
function tidalPathId(url: string, kind: string, idPattern: string): string | null {
    const re = new RegExp(
        `(?:^|//)(?:www\\.|listen\\.)?tidal\\.com/(?:[a-z]{2}(?:-[a-z]{2})?/)?(?:browse/)?${kind}/(${idPattern})`,
        "i",
    );
    return re.exec(url)?.[1] ?? null;
}

/**
 * Why a catalog call came back empty, as a line that can go straight to a user.
 * Null when TIDAL is live — then an empty result really means "nothing found".
 */
export function strictNote(): string | null {
    if (tidalEnabled()) return null;
    return "TIDAL is off — set TIDAL_ENABLED=true and sign in with `tiddl auth login`.";
}

// Cache the *effective* (TIDAL-or-fallback) search result, keyed by query, so a
// repeated or re-opened search skips the whole round-trip — the Python helper spawn
// and any yt-dlp fallback. The yt-dlp layer caches internally too; this caps the
// TIDAL primary path, which otherwise pays a fresh spawn every time. Same knobs as
// ytdlp.ts: short TTL keeps the catalog fresh, LRU size cap bounds memory.
const SEARCH_CACHE_MAX = 500;
const SEARCH_TTL_MS = 90_000;
const searchStreamCache = new BoundedCache<string, TrackInfo[]>(SEARCH_CACHE_MAX, SEARCH_TTL_MS);
const richSearchCache = new BoundedCache<string, RichSearch>(SEARCH_CACHE_MAX, SEARCH_TTL_MS);

/** Search: TIDAL first (lossless), yt-dlp as fallback. Returns the ranked list. */
export async function sourceSearchStream(
    query: string,
    count: number,
    onResult: (track: TrackInfo, rawIndex: number) => void,
): Promise<TrackInfo[]> {
    const key = `${count}:${query}`;
    const cached = searchStreamCache.get(key);
    if (cached) {
        // Replay through onResult so the NDJSON stream still fills — just instantly.
        cached.forEach((t, i) => {
            onResult(t, i);
        });
        return cached;
    }
    if (tidalEnabled()) {
        try {
            const tracks = await tidalSearch(query, count);
            if (tracks.length) {
                tracks.forEach((t, i) => {
                    onResult(t, i);
                });
                searchStreamCache.set(key, tracks);
                return tracks;
            }
            log.info(`tidal search empty for "${query}"${tidalStrict() ? "" : " — yt-dlp fallback"}`);
        } catch (err) {
            log.warn(`tidal search failed (${(err as Error).message})${tidalStrict() ? "" : " — yt-dlp fallback"}`);
        }
    }
    if (tidalStrict()) return [];
    const tracks = await searchStream(query, count, onResult);
    if (tracks.length) searchStreamCache.set(key, tracks);
    return tracks;
}

/** Structured search (top hit + tracks + artists + albums). TIDAL-first; yt-dlp
 *  gives a tracks-only result (empty shelves) when TIDAL is off or errors. */
export async function sourceRichSearch(query: string, limit = 25): Promise<RichSearch> {
    const key = `${limit}:${query}`;
    const cached = richSearchCache.get(key);
    if (cached) return cached;
    if (tidalEnabled()) {
        try {
            const r = await tidalRichSearch(query, limit);
            if (r.tracks.length || r.artists.length || r.albums.length || r.playlists.length) {
                richSearchCache.set(key, r);
                return r;
            }
        } catch (err) {
            log.warn(
                `tidal rich search failed (${(err as Error).message})${tidalStrict() ? "" : " — yt-dlp fallback"}`,
            );
        }
    }
    if (tidalStrict()) return { topHit: null, tracks: [], artists: [], albums: [], playlists: [] };
    const tracks: TrackInfo[] = [];
    await searchStream(query, limit, (t) => {
        tracks.push(t);
    }).catch(() => {});
    const result: RichSearch = {
        topHit: tracks[0] ? { kind: "track", track: tracks[0] } : null,
        tracks,
        artists: [],
        albums: [],
        playlists: [],
    };
    if (tracks.length) richSearchCache.set(key, result);
    return result;
}

// The home feed changes slowly (editorial + daily-ish personalization) and the
// page fetch is comparatively heavy (two TIDAL calls) — cache it a few minutes.
const HOME_TTL_MS = 5 * 60_000;
const homeCache = new BoundedCache<string, HomeFeed>(1, HOME_TTL_MS);

/** The start page (TIDAL editorial + personalized shelves). Empty when TIDAL is
 *  off or unauthenticated — there's no yt-dlp equivalent, so the client just shows
 *  its discovery fallback. */
export async function sourceHome(): Promise<HomeFeed> {
    if (!tidalEnabled()) return { sections: [] };
    const cached = homeCache.get("home");
    if (cached) return cached;
    try {
        const feed = await tidalHome();
        if (feed.sections.length) homeCache.set("home", feed);
        return feed;
    } catch (err) {
        log.warn(`tidal home failed (${(err as Error).message})`);
        return { sections: [] };
    }
}

// Explore/genre pages change slowly (editorial) — cache like the home feed.
const exploreCache = new BoundedCache<string, Explore>(1, HOME_TTL_MS);
const pageCache = new BoundedCache<string, PageFeed>(64, HOME_TTL_MS);

/** A mix / radio station's tracks. TIDAL-only (mix ids have no yt-dlp analogue). */
export async function sourceMix(mixId: string): Promise<{ tracks: TrackInfo[] }> {
    if (!tidalEnabled()) return { tracks: [] };
    return tidalMix(mixId);
}

/** Songs similar to a track — TIDAL's track radio/mix. Empty when TIDAL is off. */
export async function sourceSimilar(trackId: string): Promise<{ tracks: TrackInfo[] }> {
    if (!tidalEnabled()) return { tracks: [] };
    try {
        return { tracks: await tidalRadio(trackId, 25) };
    } catch (err) {
        log.warn(`tidal similar failed (${(err as Error).message})`);
        return { tracks: [] };
    }
}

/** A track's credits, grouped by role. Empty when TIDAL is off or errors. */
export async function sourceCredits(trackId: string): Promise<{ credits: TidalCredit[] }> {
    if (!tidalEnabled()) return { credits: [] };
    try {
        return await tidalCredits(trackId);
    } catch (err) {
        log.warn(`tidal credits failed (${(err as Error).message})`);
        return { credits: [] };
    }
}

/** The explore directory (browsable genres/moods/decades). Empty when TIDAL is off. */
export async function sourceExplore(): Promise<Explore> {
    if (!tidalEnabled()) return { groups: [], featured: [] };
    const cached = exploreCache.get("explore");
    if (cached) return cached;
    try {
        const ex = await tidalExplore();
        if (ex.groups.length) exploreCache.set("explore", ex);
        return ex;
    } catch (err) {
        log.warn(`tidal explore failed (${(err as Error).message})`);
        return { groups: [], featured: [] };
    }
}

/** A genre/mood/decade page (its shelves). Empty when TIDAL is off or errors. */
export async function sourcePage(path: string): Promise<PageFeed> {
    if (!tidalEnabled()) return { title: "", sections: [] };
    const cached = pageCache.get(path);
    if (cached) return cached;
    try {
        const p = await tidalPage(path);
        if (p.sections.length) pageCache.set(path, p);
        return p;
    } catch (err) {
        log.warn(`tidal page "${path}" failed (${(err as Error).message})`);
        return { title: "", sections: [] };
    }
}

// ── catalog detail (TIDAL-only by nature: these are all id-based) ──
//
// Guarded rather than re-exported raw, so "TIDAL is off" degrades to an empty
// result like every other call here instead of throwing at the caller.

/** An album and its tracks. Empty when TIDAL is off or the id doesn't resolve. */
export async function sourceAlbum(albumId: string): Promise<{ album: TidalAlbum | null; tracks: TrackInfo[] }> {
    if (!tidalEnabled()) return { album: null, tracks: [] };
    try {
        return await tidalAlbum(albumId);
    } catch (err) {
        log.warn(`tidal album ${albumId} failed (${(err as Error).message})`);
        return { album: null, tracks: [] };
    }
}

/** A playlist and its tracks. Empty when TIDAL is off or the id doesn't resolve. */
export async function sourcePlaylist(
    playlistId: string,
): Promise<{ playlist: TidalPlaylist | null; tracks: TrackInfo[] }> {
    if (!tidalEnabled()) return { playlist: null, tracks: [] };
    try {
        return await tidalPlaylist(playlistId);
    } catch (err) {
        log.warn(`tidal playlist ${playlistId} failed (${(err as Error).message})`);
        return { playlist: null, tracks: [] };
    }
}

/** An artist and their releases. Empty when TIDAL is off or the id doesn't resolve. */
export async function sourceArtist(artistId: string): Promise<{ artist: TidalArtist | null; albums: TidalAlbum[] }> {
    if (!tidalEnabled()) return { artist: null, albums: [] };
    try {
        return await tidalArtist(artistId);
    } catch (err) {
        log.warn(`tidal artist ${artistId} failed (${(err as Error).message})`);
        return { artist: null, albums: [] };
    }
}

// ── search cache priming (for type-ahead surfaces) ──

/**
 * Warm the search cache in the background so a subsequent search is instant.
 * Fire-and-forget: failures are swallowed, since this only ever pre-computes
 * something the real search would fetch anyway.
 */
export async function sourcePrefetchSearch(query: string, count: number): Promise<void> {
    if (searchStreamCache.get(`${count}:${query}`)) return;
    await sourceSearchStream(query, count, () => {}).catch(() => []);
}

/** Already-cached results for a query, or null. Synchronous — never fetches. */
export function sourcePeekSearch(query: string, count: number): TrackInfo[] | null {
    return searchStreamCache.get(`${count}:${query}`) ?? null;
}

/**
 * Mirror a Spotify/Apple-Music/… link onto TIDAL: read the public track metadata,
 * then find each track in the TIDAL catalog. The equivalent yt-dlp path mirrors
 * onto YouTube, which would quietly reintroduce lossy audio — so the source router
 * owns its own version. Album/playlist order is preserved; misses are dropped.
 */
async function mirrorOntoTidal(url: string): Promise<TrackInfo[]> {
    const mirror = await resolveMirror(url);
    if (!mirror.length) return [];

    const results: (TrackInfo | null)[] = new Array(mirror.length).fill(null);
    const CONCURRENCY = 4;
    let cursor = 0;
    async function worker(): Promise<void> {
        while (cursor < mirror.length) {
            const i = cursor++;
            const [best] = await tidalSearch(mirrorQuery(mirror[i]!), 1).catch(() => []);
            if (best) results[i] = best;
        }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, mirror.length) }, worker));
    const found = results.filter((t): t is TrackInfo => t != null);
    log.info(`mirrored ${found.length}/${mirror.length} track(s) from ${url} onto TIDAL`);
    return found;
}

/** What a caller can hand ffmpeg right now, plus the file that is on its way. */
export interface PlayableSource {
    /** Path or URL to decode. */
    path: string;
    /** True when `path` is the finished cache file — the normal, seekable case.
     *  False means `path` is a short-lived bootstrap URL: do not log or persist it. */
    resident: boolean;
    /** The cache file. Already resolved when `resident`; still downloading otherwise. */
    file: Promise<string>;
    /** Loudness filter to use until the real measurement lands. Only set while
     *  non-resident, where `measureLoudness` has no file to work with yet. */
    provisionalFilter: string | null;
}

/**
 * The fastest thing that can start making sound for this track.
 *
 * Normally that is the cache file, and this behaves exactly like
 * {@link sourceDownloadTrack}. With TIDAL_STREAM_BOOTSTRAP on, a cold TIDAL track
 * instead comes back as a playable URL while the download runs behind it — audio
 * starts in well under a second instead of after the whole file.
 *
 * Nothing ever switches mid-playback: the returned `path` stays valid for the whole
 * track, and `file` only changes what a LATER reader (restart, seek, crossfade,
 * analysis) gets handed. That is what keeps this out of splice-point territory.
 */
export async function sourcePlayable(track: TrackInfo): Promise<PlayableSource> {
    const resident = (path: string): PlayableSource => ({
        path,
        resident: true,
        file: Promise.resolve(path),
        provisionalFilter: null,
    });

    if (track.source !== "tidal" || !config.TIDAL_STREAM_BOOTSTRAP) {
        return resident(await sourceDownloadTrack(track));
    }

    // A cached file beats a stream every time — it needs no second fetch and it is
    // seekable. Only ask for a bootstrap URL when there is nothing on disk.
    const cached = await tidalCachedPath(track);
    if (cached) return resident(cached);

    let boot: TidalStreamUrl | null = null;
    try {
        boot = await tidalStreamUrl(track.id);
    } catch (err) {
        log.debug(`bootstrap lookup failed for ${track.id}: ${(err as Error).message}`);
    }
    if (!boot) return resident(await sourceDownloadTrack(track));

    // Start the real download now; the caller attaches it to the queue item so every
    // later reader gets the file rather than the URL.
    const file = sourceDownloadTrack(track);
    file.catch(() => {
        /* the caller owns this promise; an unhandled rejection here would be fatal */
    });
    return {
        path: boot.url,
        resident: false,
        file,
        provisionalFilter: replayGainFilter(boot.replayGain ?? track.replayGain ?? null, boot.peak ?? track.peak ?? null),
    };
}

/** Download: route by the track's source; a failed TIDAL pull falls back to YouTube. */
export async function sourceDownloadTrack(track: TrackInfo): Promise<string> {
    if (track.source === "tidal") {
        try {
            return await tidalDownloadTrack(track);
        } catch (err) {
            // Strict mode would rather fail loudly than hand back a lossy YouTube rip.
            if (tidalStrict()) throw err;
            log.warn(`tidal download failed for "${track.title}" (${(err as Error).message}) — yt-dlp fallback`);
            const q = [track.title, track.uploader].filter(Boolean).join(" ");
            const [alt] = q ? await resolveQuery(q, 1).catch(() => []) : [];
            if (alt) return downloadTrack(alt);
            throw err;
        }
    }
    // A non-TIDAL track can only exist in strict mode if it was queued before the
    // flag flipped (or restored from a snapshot) — re-resolve it on TIDAL instead
    // of playing the YouTube copy.
    if (tidalStrict()) {
        const q = [track.title, track.uploader].filter(Boolean).join(" ");
        const [alt] = q ? await tidalSearch(q, 1).catch(() => []) : [];
        if (!alt) throw new Error(`"${track.title}" is not available on TIDAL (strict mode)`);
        return tidalDownloadTrack(alt);
    }
    return downloadTrack(track);
}

/** Resolve a free-text query (or URL) to tracks: TIDAL first, yt-dlp fallback. */
export async function sourceResolveQuery(query: string, limit = 1): Promise<TrackInfo[]> {
    // A concrete URL should go to the extractor that owns it — only text queries
    // get the TIDAL-first treatment.
    const trimmed = query.trim();
    const isUrl = /^https?:\/\//i.test(trimmed);
    // A native TIDAL link is an id we already own — resolve it directly instead of
    // bouncing it through the mirror path's third-party metadata lookup.
    const nativeId = tidalEnabled() ? tidalTrackId(trimmed) : null;
    if (nativeId) {
        const track = await tidalTrack(nativeId).catch((err: Error) => {
            log.warn(`tidal track ${nativeId} failed (${err.message})`);
            return null;
        });
        if (track) return [track];
    }
    // A Spotify/Apple link carries metadata, not audio — mirror it onto TIDAL so the
    // link still works without dropping to a YouTube rip of the same song.
    if (isUrl && tidalEnabled() && isMirrorUrl(trimmed)) {
        const mirrored = await mirrorOntoTidal(trimmed).catch((err: Error) => {
            log.warn(`tidal mirror failed (${err.message})${tidalStrict() ? "" : " — yt-dlp fallback"}`);
            return [] as TrackInfo[];
        });
        // A partial match set is still the right answer; only a total miss falls through.
        if (mirrored.length) return mirrored;
    }
    if (tidalEnabled() && !isUrl) {
        try {
            const tracks = await tidalSearch(query, limit);
            if (tracks.length) return tracks;
        } catch (err) {
            log.warn(`tidal resolve failed (${(err as Error).message})${tidalStrict() ? "" : " — yt-dlp fallback"}`);
        }
    }
    // Strict mode has no extractor for foreign URLs and no YouTube fallback for
    // text, so both dead-end here rather than leaving TIDAL.
    if (tidalStrict()) return [];
    return resolveQuery(query, limit);
}

/** What a link turned out to point at. */
export interface ResolvedLink {
    /** The collection's own title when the link was an album/playlist, else null. */
    title: string | null;
    /** True when the link pointed at a collection rather than a single track. */
    collection: boolean;
    tracks: TrackInfo[];
}

/**
 * Resolve any link to its track(s), plus the collection title when there is one.
 * Native TIDAL album/playlist/track links resolve by id; everything else goes
 * through {@link sourceResolveQuery} (mirroring, and yt-dlp unless strict).
 *
 * This is what the library-style surfaces want: one call that handles "a link the
 * user pasted" without the caller having to guess whether it's a collection.
 */
export async function sourceResolveLink(url: string, max = 100): Promise<ResolvedLink> {
    const albumId = tidalEnabled() ? tidalAlbumId(url) : null;
    if (albumId) {
        const { album, tracks } = await sourceAlbum(albumId);
        return { title: album?.title ?? null, collection: true, tracks: tracks.slice(0, max) };
    }
    const playlistId = tidalEnabled() ? tidalPlaylistId(url) : null;
    if (playlistId) {
        const { playlist, tracks } = await sourcePlaylist(playlistId);
        return { title: playlist?.title ?? null, collection: true, tracks: tracks.slice(0, max) };
    }
    // Not a native TIDAL collection: mirroring and (unless strict) yt-dlp handle it.
    // A multi-track result means it was a collection even though we can't name it.
    const tracks = (await sourceResolveQuery(url, 1)).slice(0, max);
    return { title: null, collection: tracks.length > 1, tracks };
}

/** Endless-set candidates from a seed track: TIDAL track-mix first, else yt-dlp radio. */
export async function sourceResolveRadio(seed: TrackInfo, max = 25): Promise<TrackInfo[]> {
    if (tidalEnabled() && seed.source === "tidal") {
        try {
            const tracks = await tidalRadio(seed.id, max);
            if (tracks.length) return tracks;
            log.info(`tidal radio empty for ${seed.id} — trying same-artist fallback`);
            // Weak fallback: more from the same artist (keeps the source consistent).
            if (seed.uploader) {
                const more = await tidalSearch(seed.uploader, max).catch(() => []);
                if (more.length) return more.filter((t) => t.id !== seed.id);
            }
            return [];
        } catch (err) {
            log.warn(`tidal radio failed (${(err as Error).message})${tidalStrict() ? "" : " — yt-dlp fallback"}`);
        }
    }
    // youtube seed (or TIDAL fully failed): yt-dlp radio needs a YouTube id.
    if (seed.source === "tidal") return [];
    if (tidalStrict()) {
        // A non-TIDAL seed still deserves a station: find it on TIDAL, then use its mix.
        const q = [seed.title, seed.uploader].filter(Boolean).join(" ");
        const [match] = q ? await tidalSearch(q, 1).catch(() => []) : [];
        return match ? tidalRadio(match.id, max).catch(() => []) : [];
    }
    return resolveRadio(seed.id, max);
}
