// TIDAL source — lossless FLAC via the `tiddl` Python library, spawned exactly
// like yt-dlp. This module mirrors the slice of the yt-dlp surface the player
// actually uses (search, download, radio) and returns the same TrackInfo shape,
// so the source router (source.ts) can prefer TIDAL and fall back to yt-dlp per
// track. All TIDAL I/O funnels through scripts/tidal_helper.py.

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "./config";
import { createLogger } from "./logger";
import { limitFor, resources } from "./resources";
import { Semaphore } from "./semaphore";
import type { TrackInfo } from "./ytdlp";

const log = createLogger("tidal");

const cacheDir = resolve(process.cwd(), config.CACHE_DIR);

/** The bundled bridge script, resolved next to the engine source unless overridden. */
const helperPath = config.TIDAL_HELPER.trim()
    ? resolve(process.cwd(), config.TIDAL_HELPER.trim())
    : fileURLToPath(new URL("../scripts/tidal_helper.py", import.meta.url));

/** First python that exists from the configured candidates, else `python3`. */
function resolvePython(): string {
    const candidates = [config.TIDAL_PYTHON.trim(), (process.env.PYTHON ?? "").trim()].filter(Boolean);
    for (const c of candidates) {
        if (existsSync(resolve(process.cwd(), c)) || existsSync(c)) return c;
    }
    return "python3";
}
const python = resolvePython();

export function tidalEnabled(): boolean {
    return config.TIDAL_ENABLED;
}

/**
 * TIDAL-only mode — the source router drops its yt-dlp fallbacks. Requires
 * TIDAL_ENABLED: strict without an enabled source would leave nothing to play,
 * so that combination is treated as not-strict rather than as a dead end.
 */
export function tidalStrict(): boolean {
    return config.TIDAL_ENABLED && config.TIDAL_STRICT;
}

// ── helper process plumbing ──

interface HelperResult {
    error?: string;
    [k: string]: unknown;
}

/** Spawn the python helper, parse its single JSON line, throw on error. */
async function runHelper(args: string[], timeoutMs = 30_000): Promise<HelperResult> {
    const proc = Bun.spawn([python, helperPath, ...args], {
        stdout: "pipe",
        stderr: "pipe",
        env: process.env,
    });
    const timer = setTimeout(() => proc.kill(), timeoutMs);
    try {
        const [out, err, code] = await Promise.all([
            new Response(proc.stdout).text(),
            new Response(proc.stderr).text(),
            proc.exited,
        ]);
        const text = out.trim();
        if (!text) throw new Error(err.trim() || `tidal helper exited ${code} with no output`);
        let parsed: HelperResult;
        try {
            parsed = JSON.parse(text) as HelperResult;
        } catch {
            throw new Error(`tidal helper returned non-JSON: ${text.slice(0, 200)}`);
        }
        if (parsed.error) throw new Error(parsed.error);
        return parsed;
    } finally {
        clearTimeout(timer);
    }
}

// ── persistent metadata worker (optional; gated by TIDAL_PERSISTENT) ──
// One long-lived `helper serve` process keeps the TidalAPI session warm, so fast
// metadata calls skip the ~200-500ms python cold-start each one-shot spawn pays.
// Requests are newline-framed JSON, correlated by id. Downloads deliberately stay
// one-shot (network-bound; a long download must not head-of-line-block this pipe).

function spawnServe(pythonBin: string, helper: string) {
    return Bun.spawn([pythonBin, helper, "serve"], {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "inherit",
        // The pool size is a config value, not necessarily an env var, so pass it
        // explicitly — process.env alone would silently leave the helper on its own
        // default whenever the setting came from anywhere but the environment.
        env: { ...process.env, TIDAL_SERVE_WORKERS: String(config.TIDAL_SERVE_WORKERS) },
    });
}
type ServeProc = ReturnType<typeof spawnServe>;

interface Pending {
    resolve: (v: HelperResult) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
}

export class MetaWorker {
    #python: string;
    #helper: string;
    #proc: ServeProc | null = null;
    #pending = new Map<number, Pending>();
    #seq = 0;
    #buf = "";

    constructor(pythonBin: string, helper: string) {
        this.#python = pythonBin;
        this.#helper = helper;
    }

    /** Send one command; resolves with the helper's result object, rejects on error. */
    send(args: string[], timeoutMs = 30_000): Promise<HelperResult> {
        const proc = this.#ensure();
        const id = ++this.#seq;
        const [cmd, ...rest] = args;
        return new Promise<HelperResult>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.#pending.delete(id);
                reject(new Error(`tidal worker timeout for "${cmd}"`));
            }, timeoutMs);
            this.#pending.set(id, { resolve, reject, timer });
            try {
                proc.stdin.write(`${JSON.stringify({ id, cmd, args: rest })}\n`);
                proc.stdin.flush();
            } catch (err) {
                this.#pending.delete(id);
                clearTimeout(timer);
                reject(err as Error);
            }
        });
    }

    /** Stop the worker; closing stdin lets `serve` reach EOF and exit cleanly. */
    close(): void {
        const proc = this.#proc;
        if (!proc) return;
        this.#proc = null;
        try {
            proc.stdin.end();
        } catch {
            // already gone
        }
    }

    #ensure(): ServeProc {
        if (this.#proc) return this.#proc;
        const proc = spawnServe(this.#python, this.#helper);
        this.#proc = proc;
        this.#buf = "";
        void this.#read(proc);
        void proc.exited.then((code) => this.#down(proc, new Error(`tidal worker exited (${code})`)));
        return proc;
    }

    async #read(proc: ServeProc): Promise<void> {
        const decoder = new TextDecoder();
        try {
            for await (const chunk of proc.stdout as unknown as AsyncIterable<Uint8Array>) {
                this.#buf += decoder.decode(chunk, { stream: true });
                let nl = this.#buf.indexOf("\n");
                while (nl >= 0) {
                    const line = this.#buf.slice(0, nl).trim();
                    this.#buf = this.#buf.slice(nl + 1);
                    if (line) this.#handle(line);
                    nl = this.#buf.indexOf("\n");
                }
            }
        } catch {
            // stream error — proc.exited below rejects any stragglers
        }
    }

    #handle(line: string): void {
        let msg: { id?: number; result?: HelperResult; error?: string };
        try {
            msg = JSON.parse(line);
        } catch {
            return; // ignore any non-JSON noise on the response channel
        }
        if (typeof msg.id !== "number") return;
        const p = this.#pending.get(msg.id);
        if (!p) return;
        this.#pending.delete(msg.id);
        clearTimeout(p.timer);
        if (msg.error) p.reject(new Error(msg.error));
        else p.resolve(msg.result ?? {});
    }

    /** Worker died: reject everything in flight, drop it so the next send respawns.
     *  Guarded so a stale proc's late exit can't tear down a newer replacement
     *  (e.g. close() followed immediately by a send() that respawned). */
    #down(proc: ServeProc, err: Error): void {
        if (this.#proc !== proc) return;
        this.#proc = null;
        this.#buf = "";
        const pend = [...this.#pending.values()];
        this.#pending.clear();
        for (const p of pend) {
            clearTimeout(p.timer);
            p.reject(err);
        }
    }
}

const metaWorker = new MetaWorker(python, helperPath);

/**
 * Run a fast metadata command. With TIDAL_PERSISTENT it goes through the warm
 * worker; on any transport failure (worker died, timeout, spawn error) it falls
 * back to a one-shot spawn — so enabling persistence can never regress reliability.
 */
async function runMeta(args: string[], timeoutMs = 30_000): Promise<HelperResult> {
    const t0 = performance.now();
    if (config.TIDAL_PERSISTENT) {
        try {
            const res = await metaWorker.send(args, timeoutMs);
            log.debug(`${args[0]} ${Math.round(performance.now() - t0)}ms (warm)`);
            return res;
        } catch (err) {
            log.warn(`tidal worker failed (${(err as Error).message}) — one-shot fallback`);
        }
    }
    const res = await runHelper(args, timeoutMs);
    log.debug(`${args[0]} ${Math.round(performance.now() - t0)}ms (spawn)`);
    return res;
}

interface RawTrack {
    id: string;
    title: string;
    url: string;
    durationMs: number;
    uploader: string | null;
    thumbnail: string | null;
    album?: string | null;
    isLive?: boolean;
    tidalBpm?: number | null;
    isrc?: string | null;
    recordingId?: string | null;
    version?: TrackInfo["version"];
    discNumber?: number | null;
    trackNumber?: number | null;
    albumId?: string | null;
    gapless?: boolean;
    replayGain?: number | null;
    peak?: number | null;
}

function toTrackInfo(raw: RawTrack): TrackInfo {
    return {
        id: raw.id,
        title: raw.title,
        url: raw.url,
        durationMs: raw.durationMs,
        uploader: raw.uploader ?? null,
        thumbnail: raw.thumbnail ?? null,
        album: raw.album ?? null,
        isLive: raw.isLive ?? false,
        source: "tidal",
        bpm: raw.tidalBpm ?? null,
        ...(raw.isrc ? { isrc: raw.isrc } : {}),
        ...(raw.recordingId ? { recordingId: raw.recordingId } : {}),
        ...(raw.version ? { version: raw.version } : {}),
        ...(raw.discNumber ? { discNumber: raw.discNumber } : {}),
        ...(raw.trackNumber ? { trackNumber: raw.trackNumber } : {}),
        ...(raw.albumId ? { albumId: raw.albumId } : {}),
        ...(raw.gapless !== undefined ? { gapless: raw.gapless } : {}),
        // 0 is a legitimate ReplayGain, so test for null/undefined, not falsiness.
        ...(raw.replayGain != null ? { replayGain: raw.replayGain } : {}),
        ...(raw.peak != null ? { peak: raw.peak } : {}),
    };
}

// ── public API (mirrors the used slice of ytdlp.ts) ──

/** Free-text search on TIDAL, best matches first. */
export async function tidalSearch(query: string, limit = 20): Promise<TrackInfo[]> {
    const res = await runMeta(["search", query, String(limit)]);
    const tracks = (res.tracks as RawTrack[] | undefined) ?? [];
    return tracks.map(toTrackInfo);
}

/** The seed track's TIDAL "track radio" mix (for endless sets). */
export async function tidalRadio(seedId: string, max = 20): Promise<TrackInfo[]> {
    const res = await runMeta(["radio", seedId, String(max)]);
    const tracks = (res.tracks as RawTrack[] | undefined) ?? [];
    return tracks.map(toTrackInfo);
}

// ── structured search (top hit + tracks + artists + albums) ──

export interface TidalArtist {
    id: string;
    name: string;
    picture: string | null;
}
export interface TidalAlbum {
    id: string;
    title: string;
    cover: string | null;
    artist: string | null;
    year: number | null;
    trackCount: number | null;
    kind: string; // Album | Single | Ep
}
export interface TidalPlaylist {
    id: string;
    title: string;
    cover: string | null;
    subtitle: string | null;
    trackCount: number | null;
    kind: string; // "Playlist"
}
export type TopHit =
    | { kind: "artist"; artist: TidalArtist }
    | { kind: "album"; album: TidalAlbum }
    | { kind: "playlist"; playlist: TidalPlaylist }
    | { kind: "track"; track: TrackInfo }
    | null;
export interface RichSearch {
    topHit: TopHit;
    tracks: TrackInfo[];
    artists: TidalArtist[];
    albums: TidalAlbum[];
    playlists: TidalPlaylist[];
}

function mapTopHit(raw: unknown): TopHit {
    const t = raw as {
        kind?: string;
        artist?: TidalArtist;
        album?: TidalAlbum;
        playlist?: TidalPlaylist;
        track?: RawTrack;
    } | null;
    if (!t?.kind) return null;
    if (t.kind === "artist" && t.artist) return { kind: "artist", artist: t.artist };
    if (t.kind === "album" && t.album) return { kind: "album", album: t.album };
    if (t.kind === "playlist" && t.playlist) return { kind: "playlist", playlist: t.playlist };
    if (t.kind === "track" && t.track) return { kind: "track", track: toTrackInfo(t.track) };
    return null;
}

/** Structured search — the rich results surface (top hit + shelves). */
export async function tidalRichSearch(query: string, limit = 25): Promise<RichSearch> {
    const res = await runMeta(["richsearch", query, String(limit)]);
    return {
        topHit: mapTopHit(res.topHit),
        tracks: ((res.tracks as RawTrack[] | undefined) ?? []).map(toTrackInfo),
        artists: (res.artists as TidalArtist[] | undefined) ?? [],
        albums: (res.albums as TidalAlbum[] | undefined) ?? [],
        playlists: (res.playlists as TidalPlaylist[] | undefined) ?? [],
    };
}

/** A playlist's tracks (same shape as album detail — one design for both). */
export async function tidalPlaylist(
    playlistId: string,
): Promise<{ playlist: TidalPlaylist | null; tracks: TrackInfo[] }> {
    const res = await runMeta(["playlist", playlistId]);
    return {
        playlist: (res.playlist as TidalPlaylist | undefined) ?? null,
        tracks: ((res.tracks as RawTrack[] | undefined) ?? []).map(toTrackInfo),
    };
}

/** An album's tracks (for the album detail / "play album"). */
export async function tidalAlbum(albumId: string): Promise<{ album: TidalAlbum | null; tracks: TrackInfo[] }> {
    const res = await runMeta(["album", albumId]);
    return {
        album: (res.album as TidalAlbum | undefined) ?? null,
        tracks: ((res.tracks as RawTrack[] | undefined) ?? []).map(toTrackInfo),
    };
}

export interface TidalLyrics {
    synced: { timeMs: number; text: string }[];
    plain: string | null;
}

/** TIDAL's own synced lyrics for a track (more accurate than LRCLIB matching). */
export async function tidalLyrics(trackId: string): Promise<TidalLyrics> {
    const res = await runMeta(["lyrics", trackId]);
    return {
        synced: (res.synced as { timeMs: number; text: string }[] | undefined) ?? [],
        plain: (res.plain as string | undefined) ?? null,
    };
}

// ── home / discovery feed (TIDAL's editorial + personalized start page) ──

/** A TIDAL mix / radio station (Daily Discovery, custom mixes, artist radio).
 *  Card-shaped like a playlist, but its tracks come from the mix endpoint. */
export interface TidalMix {
    id: string;
    title: string;
    cover: string | null;
    subtitle: string | null;
    kind: string; // "Mix"
}

/** One horizontal shelf on the home feed. Exactly one of the arrays is populated,
 *  per `kind` — mirrors how the Python helper shapes each `pages/*` module. */
export interface HomeSection {
    title: string;
    kind: "tracks" | "albums" | "playlists" | "mixes";
    tracks: TrackInfo[];
    albums: TidalAlbum[];
    playlists: TidalPlaylist[];
    mixes: TidalMix[];
}
export interface HomeFeed {
    sections: HomeSection[];
}

function mapHomeSection(raw: unknown): HomeSection {
    const s = raw as {
        title?: string;
        kind?: string;
        tracks?: RawTrack[];
        albums?: TidalAlbum[];
        playlists?: TidalPlaylist[];
        mixes?: TidalMix[];
    };
    const kind = s.kind === "albums" || s.kind === "playlists" || s.kind === "mixes" ? s.kind : "tracks";
    return {
        title: s.title ?? "",
        kind,
        tracks: (s.tracks ?? []).map(toTrackInfo),
        albums: s.albums ?? [],
        playlists: s.playlists ?? [],
        mixes: s.mixes ?? [],
    };
}

/** The start page: TIDAL's editorial home (hits, new releases, editor playlists)
 *  plus personalized mixes, radio stations and "because you listened…" shelves.
 *  Metadata-only, so it rides the warm worker when persistence is on. */
export async function tidalHome(): Promise<HomeFeed> {
    const res = await runMeta(["home"], 20_000);
    return { sections: ((res.sections as unknown[] | undefined) ?? []).map(mapHomeSection) };
}

/** Is the python helper reachable at all? Needs no TIDAL login. */
export async function tidalPing(): Promise<boolean> {
    try {
        const res = await runMeta(["ping"], 15_000);
        return res.pong === true;
    } catch {
        return false;
    }
}

/**
 * Why TIDAL isn't usable, or `ok` when it is. The distinction matters because the
 * fixes are different: a dead helper is a python/venv path problem, while a live
 * helper that can't search is an expired login (`tiddl auth login`).
 */
export type TidalHealth = { ok: true } | { ok: false; reason: "disabled" | "helper" | "auth"; detail: string };

/**
 * Probe TIDAL end to end: helper reachable, then an actually-authenticated call.
 * `ping` alone would pass with expired credentials, so this also runs a one-result
 * search — the cheapest call that proves the session is live.
 */
export async function tidalHealth(): Promise<TidalHealth> {
    if (!config.TIDAL_ENABLED) {
        return { ok: false, reason: "disabled", detail: "TIDAL_ENABLED is false" };
    }
    if (!(await tidalPing())) {
        return { ok: false, reason: "helper", detail: `helper not runnable via ${python}` };
    }
    try {
        await tidalSearch("a", 1);
        return { ok: true };
    } catch (err) {
        return { ok: false, reason: "auth", detail: (err as Error).message };
    }
}

/** One track by its TIDAL id. Null when the id doesn't resolve to a playable track. */
export async function tidalTrack(trackId: string): Promise<TrackInfo | null> {
    const res = await runMeta(["track", trackId]);
    const raw = res.track as RawTrack | undefined;
    return raw ? toTrackInfo(raw) : null;
}

/** A mix / radio station's tracks (resolved via TIDAL's mix endpoint). */
export async function tidalMix(mixId: string): Promise<{ tracks: TrackInfo[] }> {
    const res = await runMeta(["mix", mixId]);
    return { tracks: ((res.tracks as RawTrack[] | undefined) ?? []).map(toTrackInfo) };
}

export interface TidalCredit {
    role: string;
    names: string[];
}

/** A track's credits, grouped by role (Producer, Composer, Lyricist, …). */
export async function tidalCredits(trackId: string): Promise<{ credits: TidalCredit[] }> {
    const res = await runMeta(["credits", trackId]);
    return { credits: (res.credits as TidalCredit[] | undefined) ?? [] };
}

// ── explore (browsable categories → genre/mood/decade pages) ──

export interface ExploreCategory {
    title: string;
    path: string; // a `pages/...` path, fetch via tidalPage
    icon: string | null;
}
export interface ExploreGroup {
    title: string;
    categories: ExploreCategory[];
}
/** One card of the editorial "Featured" carousel on the explore page. `kind`
 *  says what `id` addresses: an album/playlist/mix/artist id, or a `pages/...`
 *  path for `kind === "page"`. */
export interface ExploreFeature {
    header: string; // eyebrow, e.g. "35th ANNIVERSARY"
    title: string;
    subtitle: string;
    image: string | null; // wide promo image (1100x800)
    kind: "album" | "playlist" | "mix" | "artist" | "page";
    id: string;
}
export interface Explore {
    groups: ExploreGroup[];
    featured: ExploreFeature[];
}
export interface PageFeed {
    title: string;
    sections: HomeSection[];
}

/** TIDAL's explore directory: the editorial "Featured" carousel plus Genres,
 *  Moods & Activities (incl. "For DJs") and Decades — each a link resolvable
 *  with `tidalPage`. */
export async function tidalExplore(): Promise<Explore> {
    const res = await runMeta(["explore"], 20_000);
    return {
        groups: (res.groups as ExploreGroup[] | undefined) ?? [],
        featured: (res.featured as ExploreFeature[] | undefined) ?? [],
    };
}

/** Any TIDAL `pages/*` page (a genre/mood/decade), shaped into home sections. */
export async function tidalPage(path: string): Promise<PageFeed> {
    const res = await runMeta(["page", path], 20_000);
    return {
        title: (res.title as string | undefined) ?? "",
        sections: ((res.sections as unknown[] | undefined) ?? []).map(mapHomeSection),
    };
}

/** An artist's albums (for the artist detail). */
export async function tidalArtist(artistId: string): Promise<{ artist: TidalArtist | null; albums: TidalAlbum[] }> {
    const res = await runMeta(["artist", artistId]);
    return {
        artist: (res.artist as TidalArtist | undefined) ?? null,
        albums: (res.albums as TidalAlbum[] | undefined) ?? [],
    };
}

// ── the user's own TIDAL collection ──

export type FavoriteKind = "tracks" | "albums" | "artists" | "playlists";

/** One entry of the user's collection, plus when they added it (ISO string). */
export type FavoriteItem<T> = T & { addedAt?: string | null };

export interface Favorites<T> {
    kind: FavoriteKind;
    /** How many the account holds in total — may exceed the returned page. */
    total: number | null;
    items: FavoriteItem<T>[];
}

/**
 * The user's own TIDAL favourites, most recently added first. Never cached: the
 * collection is the one thing in the API the user changes themselves, so a stale
 * read here is immediately visible as a bug.
 */
export async function tidalFavorites(kind: "tracks", limit?: number): Promise<Favorites<TrackInfo>>;
export async function tidalFavorites(kind: "albums", limit?: number): Promise<Favorites<TidalAlbum>>;
export async function tidalFavorites(kind: "artists", limit?: number): Promise<Favorites<TidalArtist>>;
export async function tidalFavorites(kind: "playlists", limit?: number): Promise<Favorites<TidalPlaylist>>;
export async function tidalFavorites(kind: FavoriteKind = "tracks", limit = 50): Promise<Favorites<unknown>> {
    const res = await runMeta(["favorites", kind, String(limit)]);
    const raw = (res.items as Record<string, unknown>[] | undefined) ?? [];
    return {
        kind: (res.kind as FavoriteKind | undefined) ?? kind,
        total: (res.total as number | undefined) ?? null,
        // Only tracks go through the TrackInfo mapper; the other kinds already
        // arrive in their final card shape from the helper.
        items:
            kind === "tracks"
                ? raw.map((r) => ({ ...toTrackInfo(r as unknown as RawTrack), addedAt: (r.addedAt as string) ?? null }))
                : (raw as FavoriteItem<unknown>[]),
    };
}

// ── bootstrap stream (start audio before the file is on disk) ──

export interface TidalStreamUrl {
    /** Directly playable by ffmpeg; the CDN honours HTTP ranges, so `-ss` works. */
    url: string;
    /** Unix seconds at which the URL's signature dies (TIDAL signs for ~60 min). */
    expiresAt: number | null;
    quality: string;
    replayGain: number | null;
    peak: number | null;
}

/**
 * A URL that can be played immediately, or null when this track cannot be
 * bootstrapped (hi-res arrives as dozens of DASH segments needing a full-file
 * remux — there is nothing single-URL to hand ffmpeg).
 *
 * Deliberately fetched at play time, never at queue time: the signature expires
 * about an hour out, so a URL resolved when a track was queued could be dead by the
 * time it plays. Treat the result as a short-lived credential — it must not be
 * logged, persisted, or written into a playback snapshot.
 */
export async function tidalStreamUrl(trackId: string): Promise<TidalStreamUrl | null> {
    const res = await runMeta(["streamurl", trackId, config.TIDAL_QUALITY], 20_000);
    if (!res.bootstrappable || typeof res.url !== "string") {
        log.debug(`no bootstrap for ${trackId}: ${(res.reason as string) ?? "unsupported"}`);
        return null;
    }
    const expiresAt = (res.expiresAt as number | undefined) ?? null;
    // A signature that dies before the track ends would stall mid-playback. Refuse it
    // here so the caller falls back to the plain download instead of finding out live.
    if (expiresAt != null && expiresAt * 1000 < Date.now() + STREAM_URL_MIN_LIFETIME_MS) {
        log.warn(`bootstrap url for ${trackId} expires too soon — falling back to download`);
        return null;
    }
    return {
        url: res.url,
        expiresAt,
        quality: (res.quality as string | undefined) ?? config.TIDAL_QUALITY,
        replayGain: (res.replayGain as number | undefined) ?? null,
        peak: (res.peak as number | undefined) ?? null,
    };
}

/** A bootstrap URL must outlive the longest track we would start on it. */
const STREAM_URL_MIN_LIFETIME_MS = 20 * 60_000;

// Bound concurrent downloads (be gentle with the account → avoid flags). Uses the
// shared, tested counting semaphore rather than an ad-hoc one that could over-admit.
const downloadGate = new Semaphore(limitFor(config.TIDAL_MAX_CONCURRENCY, resources.tidalDownloads));

/** Cache key: id + quality, because bumping TIDAL_QUALITY must not keep returning a
 *  stale lower-tier file (LOSSLESS and HI_RES_LOSSLESS share the .flac extension). */
function cacheBase(track: TrackInfo): string {
    const id = track.id.replace(/[^a-zA-Z0-9_-]/g, "_");
    return `tidal-${id}-${config.TIDAL_QUALITY.toLowerCase()}`;
}

/**
 * The cached file for this track, or null if it isn't downloaded yet. Only counts a
 * non-empty file, so a truncated download from an interrupted run can't poison the
 * cache forever.
 */
export async function tidalCachedPath(track: TrackInfo): Promise<string | null> {
    if (track.source !== "tidal") return null;
    const base = cacheBase(track);
    // .flac normally; .m4a when a lossy tier or an un-remuxed hi-res container landed.
    for (const ext of [".flac", ".m4a"]) {
        const p = resolve(cacheDir, `${base}${ext}`);
        const f = Bun.file(p);
        if ((await f.exists()) && f.size > 0) return p;
    }
    return null;
}

/**
 * Download a TIDAL track to the cache (keyed by id + quality), returning the file
 * path. Reuses a prior, fully-written copy if present.
 */
export async function tidalDownloadTrack(track: TrackInfo): Promise<string> {
    if (track.source !== "tidal") throw new Error(`not a TIDAL track: ${track.id}`);
    await mkdir(cacheDir, { recursive: true });
    const base = cacheBase(track);

    const hit = await tidalCachedPath(track);
    if (hit) return hit;

    return downloadGate.run(async () => {
        const out = resolve(cacheDir, base); // helper picks the extension
        const res = await runHelper(["download", track.id, out, config.TIDAL_QUALITY], 120_000);
        const path = res.path as string | undefined;
        if (!path) throw new Error("tidal download returned no path");
        log.info(`downloaded "${track.title}" (${res.quality}) → ${path}`);
        return path;
    });
}

export { cacheDir as tidalCacheDir, helperPath as tidalHelperPath, python as tidalPython };
