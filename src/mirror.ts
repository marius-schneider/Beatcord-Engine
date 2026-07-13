import { createLogger } from "./logger";

const log = createLogger("Mirror");

/**
 * "Link mirroring": Spotify, Apple Music, Tidal, Deezer & co. can't be streamed
 * directly (DRM — yt-dlp refuses them), so when a user drops one of their links we
 * read the public track metadata (title + artist) and play the matching track from
 * YouTube instead. This module ONLY resolves metadata; the YouTube match + download
 * is the caller's existing search path.
 *
 * Sources used (all public, no API key):
 *  - Single tracks (any platform): the Odesli/Songlink API — one stable endpoint
 *    instead of per-platform scraping. Free tier (~10 req/min) + our cache is
 *    plenty for pasted links; on failure we fall back to the per-platform paths.
 *  - Spotify albums/playlists: the embed page's JSON (it carries the track list —
 *    Odesli only resolves the album entity, not its tracks).
 *  - Apple Music albums/playlists: the iTunes Lookup API (`itunes.apple.com/lookup`).
 */

/** One resolved track to mirror — turned into a "title artist" YouTube query. */
export interface MirrorTrack {
    title: string;
    artist: string | null;
}

/** Cap how many tracks an album/playlist mirror expands to (lots of YT searches). */
const MAX_MIRROR_TRACKS = 50;

/** Is this a link we can mirror? (Used to branch before hitting yt-dlp.) */
export function isMirrorUrl(url: string): boolean {
    if (/(?:open\.spotify\.com|music\.apple\.com)/i.test(url)) return true;
    // Single-track links on platforms Odesli resolves for us (no album expansion).
    return /(?:tidal|deezer)\.com\/(?:[a-z-]+\/)*track\//i.test(url);
}

/** A YouTube search string from a mirror track ("Title Artist"). */
export function mirrorQuery(t: MirrorTrack): string {
    return t.artist ? `${t.title} ${t.artist}` : t.title;
}

/** Links that expand to MANY tracks — Odesli can't enumerate those, scrapers can. */
function isMultiTrackUrl(url: string): boolean {
    const spotify = url.match(SPOTIFY_RE);
    if (spotify) return spotify[1]!.toLowerCase() !== "track";
    if (/music\.apple\.com/i.test(url)) {
        // An album link WITHOUT ?i= (and any playlist) is a collection.
        return /\/playlist\//i.test(url) || (/\/album\//i.test(url) && !/[?&]i=\d+/.test(url));
    }
    return false;
}

/**
 * Resolve a streaming-platform URL to the track(s) it points at. Returns [] if
 * it's not a supported link or metadata can't be read (caller then falls back to
 * treating the input as a normal query/URL).
 */
export async function resolveMirror(url: string): Promise<MirrorTrack[]> {
    try {
        // Single tracks: Odesli first — one robust API instead of scraping embed
        // HTML that breaks whenever a platform redesigns. Falls through to the
        // platform-specific paths when it's down/rate-limited.
        if (!isMultiTrackUrl(url)) {
            const viaOdesli = await resolveOdesli(url);
            if (viaOdesli.length) return viaOdesli;
        }
        if (/open\.spotify\.com/i.test(url)) return await resolveSpotify(url);
        if (/music\.apple\.com/i.test(url)) return await resolveAppleMusic(url);
    } catch (err) {
        log.warn(`mirror resolve failed for ${url}: ${(err as Error).message}`);
    }
    return [];
}

// ── Odesli / Songlink ────────────────────────────────────────────────────────

/** Same link pasted twice shouldn't burn the (10/min) free tier — small LRU. */
const odesliCache = new Map<string, MirrorTrack[]>();
const ODESLI_CACHE_MAX = 200;

async function resolveOdesli(url: string): Promise<MirrorTrack[]> {
    const cached = odesliCache.get(url);
    if (cached) {
        // Refresh recency (Map preserves insertion order).
        odesliCache.delete(url);
        odesliCache.set(url, cached);
        return cached;
    }
    try {
        const api = `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(url)}`;
        const json = JSON.parse(await fetchText(api)) as {
            entityUniqueId?: string;
            entitiesByUniqueId?: Record<string, { title?: string; artistName?: string }>;
        };
        const entity = json.entityUniqueId ? json.entitiesByUniqueId?.[json.entityUniqueId] : undefined;
        const tracks: MirrorTrack[] = entity?.title ? [{ title: entity.title, artist: entity.artistName ?? null }] : [];
        if (tracks.length) {
            odesliCache.set(url, tracks);
            if (odesliCache.size > ODESLI_CACHE_MAX) {
                const oldest = odesliCache.keys().next().value;
                if (oldest !== undefined) odesliCache.delete(oldest);
            }
        }
        return tracks;
    } catch (err) {
        // Down / 429 / timeout → the platform-specific fallback takes over.
        log.debug(`Odesli failed for ${url}: ${(err as Error).message}`);
        return [];
    }
}

// ── Spotify ──────────────────────────────────────────────────────────────────

const SPOTIFY_RE = /open\.spotify\.com\/(?:intl-\w+\/)?(track|album|playlist)\/([A-Za-z0-9]+)/i;

async function resolveSpotify(url: string): Promise<MirrorTrack[]> {
    const m = url.match(SPOTIFY_RE);
    if (!m) return [];
    const [, kind, id] = m;

    // The embed page embeds a Next.js JSON blob with the full entity (title +
    // artists, and for album/playlist the track list). Far richer than oEmbed.
    const embed = `https://open.spotify.com/embed/${kind}/${id}`;
    const html = await fetchText(embed);
    const data = extractSpotifyData(html);
    if (!data) return [];

    if (kind === "track") {
        const t = spotifyEntityToTrack(data);
        return t ? [t] : [];
    }
    // album / playlist: the embed carries a trackList of {title, subtitle}.
    const list = (data.trackList ?? data.tracks?.items ?? []) as SpotifyTrackish[];
    const out: MirrorTrack[] = [];
    for (const item of list) {
        const t = spotifyEntityToTrack(item);
        if (t) out.push(t);
        if (out.length >= MAX_MIRROR_TRACKS) break;
    }
    return out;
}

interface SpotifyTrackish {
    title?: string;
    name?: string;
    subtitle?: string;
    artists?: { name: string }[];
    trackList?: SpotifyTrackish[];
    tracks?: { items?: SpotifyTrackish[] };
}

/** Pull the entity JSON out of the embed page's Next.js __NEXT_DATA__ blob. */
function extractSpotifyData(html: string): SpotifyTrackish | null {
    const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/s);
    if (!m) return null;
    try {
        const json = JSON.parse(m[1]!) as {
            props?: { pageProps?: { state?: { data?: { entity?: SpotifyTrackish } } } };
        };
        return json.props?.pageProps?.state?.data?.entity ?? null;
    } catch {
        return null;
    }
}

function spotifyEntityToTrack(e: SpotifyTrackish): MirrorTrack | null {
    const title = e.title ?? e.name;
    if (!title) return null;
    // Artist: explicit artists[] if present, else the "subtitle" (which Spotify
    // uses for the artist line in embeds).
    const artist = e.artists?.map((a) => a.name).join(", ") || e.subtitle || null;
    return { title, artist };
}

// ── Apple Music ──────────────────────────────────────────────────────────────

// .../album/<slug>/<albumId>?i=<trackId>  — ?i is a single track; without it, album.
const APPLE_RE = /music\.apple\.com\/[^/]+\/(album|playlist|song)\/[^/]+\/([A-Za-z0-9.]+)/i;

async function resolveAppleMusic(url: string): Promise<MirrorTrack[]> {
    const trackId = url.match(/[?&]i=(\d+)/)?.[1];
    const m = url.match(APPLE_RE);
    const pathId = m?.[2];
    // The URL path slug ("bohemian-rhapsody") is the song name on a track link.
    const slug = url.match(/music\.apple\.com\/[^/]+\/(?:album|song|playlist)\/([^/]+)\//i)?.[1];

    // The album/collection lookup (the path id) returns the artist + every track —
    // this is the reliable source. The `?i=` value is NOT an iTunes id (it doesn't
    // appear in the store data), so we can't look the track up directly.
    if (pathId) {
        const items = await itunesLookup(pathId, "song");
        const tracks = items.filter((i) => i.wrapperType === "track" && i.trackName);
        const artist = items.find((i) => i.wrapperType === "collection")?.artistName ?? tracks[0]?.artistName ?? null;

        // Single track link (?i=) → return just the matching song. Match by the URL
        // slug against the track names; fall back to the slug itself as the query.
        if (trackId) {
            const want = slug ? slugify(slug) : "";
            const hit = want
                ? tracks.find((t) => slugify(t.trackName!).includes(want) || want.includes(slugify(t.trackName!)))
                : undefined;
            if (hit) return [{ title: hit.trackName!, artist: hit.artistName ?? artist }];
            // No clean match → use the slug as the search title (artist from album).
            if (slug) return [{ title: slug.replace(/-/g, " "), artist }];
            return [];
        }

        // Album / playlist link → all tracks (capped).
        const out: MirrorTrack[] = [];
        for (const t of tracks) {
            out.push({ title: t.trackName!, artist: t.artistName ?? artist });
            if (out.length >= MAX_MIRROR_TRACKS) break;
        }
        return out;
    }
    return [];
}

/** Normalise a string for loose slug matching (lowercase, alnum + spaces). */
function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

interface ItunesItem {
    wrapperType?: string;
    trackName?: string;
    artistName?: string;
}

async function itunesLookup(id: string, entity?: string): Promise<ItunesItem[]> {
    const url = `https://itunes.apple.com/lookup?id=${id}&limit=${MAX_MIRROR_TRACKS + 1}${entity ? `&entity=${entity}` : ""}`;
    const text = await fetchText(url);
    try {
        const json = JSON.parse(text) as { results?: ItunesItem[] };
        return json.results ?? [];
    } catch {
        return [];
    }
}

// ── shared ───────────────────────────────────────────────────────────────────

async function fetchText(url: string): Promise<string> {
    const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Beatcord link mirror)" },
        signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
}
