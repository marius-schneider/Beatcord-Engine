import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { BoundedCache } from "./bounded-cache";
import { enforceCacheLimit, touch } from "./cache";
import { config } from "./config";
import { createLogger } from "./logger";
import { isMirrorUrl, mirrorQuery, resolveMirror } from "./mirror";
import { limitFor, resources } from "./resources";
import { Semaphore } from "./semaphore";
import {
    getYtMusicAlbum,
    getYtMusicSearchSuggestions,
    getYtMusicWatchPlaylist,
    searchYtMusicAlbums,
    searchYtMusicPlaylists,
    searchYtMusicSongs,
    type YtMusicAlbumDetails,
    type YtMusicSong,
} from "./ytmusic";

const log = createLogger("ytdlp");

/** Resolved metadata for one track (before download). */
export interface TrackInfo {
    /** yt-dlp extractor id (e.g. YouTube video id) – also our cache key. */
    id: string;
    title: string;
    url: string;
    durationMs: number;
    uploader: string | null;
    thumbnail: string | null;
    /** Album/release name, when known (YouTube Music path only); null otherwise. */
    album?: string | null;
    /** Link to the album on YouTube Music, when its browse id is known; null otherwise. */
    albumUrl?: string | null;
    /** True for live streams (no finite file to cache — can't be downloaded/mixed). */
    isLive?: boolean;
    /** Which source this track came from. Absent/"youtube" = yt-dlp; "tidal" = TIDAL. */
    source?: "youtube" | "tidal";
    /** Trusted BPM from the source's metadata (TIDAL), when available — used to
     *  fix beatgrid octave errors. Absent for yt-dlp. */
    bpm?: number | null;
    /** Mastering-grade ReplayGain in dB from the source's metadata (TIDAL), when
     *  available — a gain target that needs no analysis pass. Absent for yt-dlp. */
    replayGain?: number | null;
    /** Normalised sample peak (0..1) from the source's metadata, so available
     *  headroom is `1 - peak`. Pairs with replayGain. Absent for yt-dlp. */
    peak?: number | null;
    /** Optional provider identity/album continuity fields used when available. */
    recordingId?: string | null;
    isrc?: string | null;
    fingerprint?: string | null;
    version?: import("./track-identity").TrackVersion | null;
    userSelectedVersion?: boolean;
    albumId?: string | null;
    discNumber?: number | null;
    trackNumber?: number | null;
    continuityGroup?: string | null;
    gapless?: boolean;
    originalGapSec?: number | null;
    conceptAlbum?: boolean;
}

interface RawEntry {
    id: string;
    title?: string | undefined;
    track?: string | undefined;
    artist?: string | undefined;
    artists?: string[] | undefined;
    creator?: string | undefined;
    album?: string | undefined;
    /** YT Music album browse id (MPREb_…), when the entry came from the Music path. */
    albumId?: string | undefined;
    url?: string | undefined;
    webpage_url?: string | undefined;
    duration?: number | undefined;
    uploader?: string | undefined;
    channel?: string | undefined;
    thumbnail?: string | undefined;
    thumbnails?: { url: string }[];
    _type?: string;
    playlist_count?: number;
    entries?: RawEntry[];
    is_live?: boolean;
}

const YT_MUSIC_ENRICH_LIMIT = 15;

function youtubeMusicSongsUrl(query: string): string {
    // yt-dlp does not expose a ytmusicsearch: prefix. The supported route is the
    // music.youtube.com search URL; the #songs fragment tells the extractor to read
    // the songs section instead of generic YouTube video results.
    return `https://music.youtube.com/search?q=${encodeURIComponent(query)}#songs`;
}

/** A YouTube playlist surfaced by a search (for the search UI's Playlists tab). */
export interface PlaylistInfo {
    id: string;
    title: string;
    url: string;
    uploader: string | null;
    count: number;
}

/**
 * A YouTube Music album/release (the search UI's Releases tab). The fast album
 * search only yields the browse id; the title/count/playlist URL are resolved
 * lazily for the rows actually shown (see {@link resolveAlbumMeta}).
 */
export interface AlbumInfo {
    /** YT Music album browse id (MPREb_…). */
    id: string;
    /** Resolved album title, or null until its metadata has been fetched. */
    title: string | null;
    /** Primary album artist, when available from YouTube Music. */
    artist: string | null;
    /** Release year, when available from YouTube Music. */
    year: string | null;
    /** Track count once resolved, else 0. */
    count: number;
    /** The OLAK5uy… playlist URL to expand into tracks, once resolved. */
    url: string | null;
    /** YT Music album audio playlist id (OLAK5uy…), needed for true album radio/shuffle. */
    audioPlaylistId: string | null;
}

const configuredYtdlp = resolve(process.cwd(), config.YTDLP_PATH);
const ffmpegPath = resolve(process.cwd(), config.FFMPEG_PATH);
const cacheDir = resolve(process.cwd(), config.CACHE_DIR);

/**
 * The argv prefix used to invoke yt-dlp. Resolved once at startup to the FASTEST
 * working variant.
 *
 * The self-contained `yt-dlp_macos`/`yt-dlp_linux` binaries re-extract a bundled
 * Python on EVERY call (~10s cold start). The much faster path is the official
 * "zipimport" build (`bin/yt-dlp-zip`, the suffixless release file) run under a
 * system Python ≥3.10 — same up-to-date yt-dlp, but ~0.3s startup. We prefer that
 * and fall back to the standalone binary if no suitable Python exists.
 */
let ytdlpCmd: string[] = [configuredYtdlp];
let ytdlpBaseArgs: string[] = ["--no-warnings"];

/**
 * Shared promise for the one-time command resolution. Every call path awaits this
 * before spawning so we NEVER fall back to the slow standalone binary just because
 * a `/play` raced the startup self-check (that binary re-extracts a bundled Python
 * on each call → ~7s instead of ~1.5s). Resolved at most once.
 */
let cmdReady: Promise<void> | null = null;
function ensureYtdlpCommand(): Promise<void> {
    return (cmdReady ??= resolveYtdlpCommand());
}

const zipimportPath = resolve(process.cwd(), "bin/yt-dlp-zip");

/** Time how long `--version` takes for a candidate; returns ms + version, or null. */
async function probeYtdlp(cmd: string[]): Promise<{ ms: number; version: string } | null> {
    const t = Date.now();
    try {
        const p = Bun.spawn([...cmd, "--version"], { stdout: "pipe", stderr: "pipe" });
        const [out, code] = await Promise.all([new Response(p.stdout).text(), p.exited]);
        return code === 0 ? { ms: Date.now() - t, version: out.trim() } : null;
    } catch {
        return null;
    }
}

/** Find a Python interpreter that's ≥3.10 (required by current yt-dlp). */
async function findModernPython(): Promise<string | null> {
    const candidates = [
        process.env.PYTHON ?? "",
        "/opt/homebrew/bin/python3",
        "python3.13",
        "python3.12",
        "python3.11",
        "python3.10",
        "python3",
    ].filter(Boolean);
    for (const py of candidates) {
        try {
            const p = Bun.spawn([py, "-c", "import sys;print(sys.version_info[0]*100+sys.version_info[1])"], {
                stdout: "pipe",
                stderr: "pipe",
            });
            const [out, code] = await Promise.all([new Response(p.stdout).text(), p.exited]);
            if (code === 0 && Number(out.trim()) >= 310) return py;
        } catch {
            /* try next */
        }
    }
    return null;
}

type JsRuntimeName = "deno" | "node" | "quickjs" | "bun";
type VersionTuple = [number, number, number];

interface JsRuntimeCandidate {
    name: JsRuntimeName;
    paths: string[];
}

function parseVersionTuple(text: string): VersionTuple | null {
    const match = text.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
    if (!match) return null;
    return [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)];
}

function compareVersion(a: VersionTuple, b: VersionTuple): number {
    for (let i = 0; i < 3; i++) {
        const diff = a[i]! - b[i]!;
        if (diff !== 0) return diff;
    }
    return 0;
}

async function probeVersion(cmd: string): Promise<VersionTuple | null | undefined> {
    try {
        const p = Bun.spawn([cmd, "--version"], { stdout: "pipe", stderr: "pipe" });
        const [stdout, stderr, code] = await Promise.all([
            new Response(p.stdout).text(),
            new Response(p.stderr).text(),
            p.exited,
        ]);
        if (code !== 0) return undefined;
        return parseVersionTuple(`${stdout}\n${stderr}`);
    } catch {
        return undefined;
    }
}

function supportedRuntime(name: JsRuntimeName, version: VersionTuple | null): boolean {
    if (!version) return name === "quickjs";
    if (name === "deno") return compareVersion(version, [2, 3, 0]) >= 0;
    if (name === "node") return compareVersion(version, [22, 0, 0]) >= 0;
    if (name === "bun") return compareVersion(version, [1, 2, 11]) >= 0 && compareVersion(version, [1, 3, 14]) <= 0;
    return true;
}

async function findJsRuntime(): Promise<string | null> {
    const explicit = config.YTDLP_JS_RUNTIME.trim();
    if (explicit) return explicit;

    const candidates: JsRuntimeCandidate[] = [
        { name: "deno", paths: [process.env.DENO ?? "", "/opt/homebrew/bin/deno", "deno"] },
        { name: "node", paths: [process.env.NODE ?? "", "/opt/homebrew/bin/node", "node"] },
        { name: "quickjs", paths: [process.env.QUICKJS ?? "", "/opt/homebrew/bin/quickjs", "quickjs", "qjs"] },
        { name: "bun", paths: [process.env.BUN ?? "", "/opt/homebrew/bin/bun", "bun"] },
    ];

    for (const candidate of candidates) {
        for (const path of candidate.paths.filter(Boolean)) {
            const version = await probeVersion(path);
            if (version !== undefined && supportedRuntime(candidate.name, version)) {
                return `${candidate.name}:${path}`;
            }
        }
    }
    return null;
}

async function resolveYtdlpBaseArgs(): Promise<void> {
    const jsRuntime = await findJsRuntime();
    ytdlpBaseArgs = jsRuntime ? ["--no-warnings", "--js-runtimes", jsRuntime] : ["--no-warnings"];
    if (jsRuntime) {
        log.info(`Using yt-dlp JavaScript runtime ${jsRuntime}.`);
    } else {
        log.warn("No supported yt-dlp JavaScript runtime found; YouTube format availability may be reduced.");
    }
    // Premium cookies (unlocks the 256 kbps Opus tier on YT Music) + user args.
    if (config.YTDLP_COOKIES.trim()) {
        ytdlpBaseArgs.push("--cookies", config.YTDLP_COOKIES.trim());
        log.info("yt-dlp cookies file configured — premium formats available when the account has them.");
    } else if (config.YTDLP_COOKIES_FROM_BROWSER.trim()) {
        ytdlpBaseArgs.push("--cookies-from-browser", config.YTDLP_COOKIES_FROM_BROWSER.trim());
        log.info(
            `yt-dlp reading cookies from browser "${config.YTDLP_COOKIES_FROM_BROWSER.trim()}" — premium formats available when the account has them.`,
        );
    }
    const extra = config.YTDLP_EXTRA_ARGS.trim();
    if (extra) ytdlpBaseArgs.push(...extra.split(/\s+/));
}

/**
 * Pick the fastest working yt-dlp invocation, in order:
 *  1. zipimport build under a modern Python  (fast + always current)
 *  2. `python -m yt_dlp` (pip install)        (fast, if installed & current)
 *  3. `yt-dlp` on PATH                        (system install)
 *  4. the configured standalone binary        (slow cold start, last resort)
 */
async function resolveYtdlpCommand(): Promise<void> {
    const candidates: string[][] = [];

    const python = await findModernPython();
    if (python && (await Bun.file(zipimportPath).exists())) {
        candidates.push([python, zipimportPath]);
        candidates.push([python, "-m", "yt_dlp"]);
    }
    candidates.push(["yt-dlp"]);
    candidates.push([configuredYtdlp]);

    for (const cmd of candidates) {
        const r = await probeYtdlp(cmd);
        if (r != null) {
            ytdlpCmd = cmd;
            await resolveYtdlpBaseArgs();
            log.info(`Using yt-dlp via "${cmd.join(" ")}" — v${r.version}, startup ${r.ms}ms.`);
            return;
        }
    }
    log.error("No working yt-dlp found (tried zipimport, pip module, PATH, and configured path).");
}

/**
 * Startup self-check: resolve the fastest yt-dlp and confirm ffmpeg runs.
 * Surfaces a missing/misconfigured tool at boot instead of on the first /play.
 */
export async function checkTools(): Promise<boolean> {
    await ensureYtdlpCommand();
    const ytOk = (await probeYtdlp(ytdlpCmd)) != null;

    let ffOk = false;
    try {
        const p = Bun.spawn([ffmpegPath, "-version"], { stdout: "pipe", stderr: "pipe" });
        ffOk = (await p.exited) === 0;
    } catch (err) {
        log.error(`ffmpeg not runnable at "${ffmpegPath}": ${(err as Error).message}`);
    }
    return ytOk && ffOk;
}

/**
 * A stable cover URL for a track. Our fast searches (`--flat-playlist`/`--print`)
 * usually omit the thumbnail field, so we derive it deterministically from the
 * YouTube video id — `i.ytimg.com/vi/<id>/hqdefault.jpg` always exists and never
 * expires (unlike the signed `thumbnails[]` URLs). Falls back to whatever yt-dlp
 * did give us for non-YouTube ids.
 */
function thumbnailFor(e: RawEntry): string | null {
    if (e.thumbnail) return e.thumbnail;
    // 11-char YouTube video id → deterministic still.
    if (e.id && /^[A-Za-z0-9_-]{11}$/.test(e.id)) {
        return `https://i.ytimg.com/vi/${e.id}/hqdefault.jpg`;
    }
    return e.thumbnails?.at(-1)?.url ?? null;
}

function rawEntryFromYtMusicSong(song: YtMusicSong): RawEntry {
    return {
        id: song.id,
        title: song.title,
        track: song.title,
        artist: song.artists[0],
        artists: song.artists,
        creator: song.artists.join(", ") || undefined,
        album: song.album ?? undefined,
        albumId: song.albumId ?? undefined,
        webpage_url: `https://music.youtube.com/watch?v=${song.id}`,
        url: `https://music.youtube.com/watch?v=${song.id}`,
        duration: song.durationMs > 0 ? song.durationMs / 1000 : undefined,
        thumbnail: song.thumbnail ?? undefined,
    };
}

function trackInfoFromYtMusicSong(song: YtMusicSong): TrackInfo {
    return toTrackInfo(rawEntryFromYtMusicSong(song));
}

function albumInfoFromYtMusicAlbum(album: {
    id: string;
    title: string | null;
    artist: string | null;
    year: string | null;
    count: number;
    audioPlaylistId: string | null;
}): AlbumInfo {
    return {
        id: album.id,
        title: album.title,
        artist: album.artist,
        year: album.year,
        count: album.count,
        url: album.audioPlaylistId ? `https://music.youtube.com/playlist?list=${album.audioPlaylistId}` : null,
        audioPlaylistId: album.audioPlaylistId,
    };
}

function toTrackInfo(e: RawEntry): TrackInfo {
    const artist = e.artist ?? e.artists?.join(", ") ?? e.creator ?? e.uploader ?? e.channel ?? null;
    return {
        id: e.id,
        // YouTube Music full extraction gives clean music metadata; prefer it over
        // the YouTube video title ("Artist - Song (Official Video)").
        title: e.track ?? e.title ?? "Unknown",
        url: entryPageUrl(e),
        durationMs: e.duration ? Math.round(e.duration * 1000) : 0,
        uploader: artist,
        thumbnail: thumbnailFor(e),
        album: e.album ?? null,
        // A browse id only exists on the YT-Music path; without it we can still show the
        // album name (above) but can't link to it.
        albumUrl: e.albumId ? `https://music.youtube.com/browse/${e.albumId}` : null,
        isLive: e.is_live === true,
    };
}

function dedupeEntries(entries: RawEntry[]): RawEntry[] {
    const seen = new Set<string>();
    return entries.filter((e) => {
        if (!e.id || seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
    });
}

function entryPageUrl(e: RawEntry): string {
    const url = e.webpage_url ?? e.url ?? "";
    if (url.startsWith("http")) return url;
    // Prefer the Music URL for song ids: full extraction from music.youtube.com
    // often exposes track/artist/album where plain youtube.com only exposes
    // uploader/channel.
    if (/^[A-Za-z0-9_-]{11}$/.test(e.id)) return `https://music.youtube.com/watch?v=${e.id}`;
    return url;
}

/**
 * Bounds how many yt-dlp subprocesses run at once. Every spawn is CPU+RAM; a burst
 * (e.g. resolving a whole page of albums in parallel) without a cap can spike the
 * box. Calls past the limit queue and proceed as slots free. Shared by `runYtdlp`
 * and the streaming search spawn so the cap covers all yt-dlp work.
 */
export const ytdlpSemaphore = new Semaphore(limitFor(config.YTDLP_MAX_CONCURRENCY, resources.ytdlp));

/** Run yt-dlp (via the resolved fastest command) and return stdout. */
async function runYtdlp(args: string[]): Promise<string> {
    // Resolve the command (one-time --version probe) OUTSIDE the semaphore — it's a
    // setup step, not the bounded work, and gating it could stall under contention.
    await ensureYtdlpCommand();
    return ytdlpSemaphore.run(async () => {
        const proc = Bun.spawn([...ytdlpCmd, ...ytdlpBaseArgs, ...args], { stdout: "pipe", stderr: "pipe" });
        try {
            const [stdout, stderr, exitCode] = await Promise.all([
                new Response(proc.stdout).text(),
                new Response(proc.stderr).text(),
                proc.exited,
            ]);
            if (exitCode !== 0) {
                throw new Error(`yt-dlp exited ${exitCode}: ${stderr.trim() || "unknown error"}`);
            }
            return stdout;
        } catch (err) {
            if (
                (err as { code?: string }).code === "ENOENT" ||
                /ENOENT|not found|spawn/i.test((err as Error).message)
            ) {
                throw new Error(`Cannot run yt-dlp ("${ytdlpCmd.join(" ")}"). Install it or set YTDLP_PATH.`);
            }
            throw err;
        }
    });
}

async function searchDefaultVideoEntries(query: string, count: number): Promise<RawEntry[]> {
    const json = await runYtdlp(["--dump-single-json", "--flat-playlist", `${config.DEFAULT_SEARCH}${count}:${query}`]);
    const data = JSON.parse(json) as RawEntry & { entries?: RawEntry[] };
    return (data.entries ?? []).filter((e) => e?.id);
}

async function searchYouTubeMusicSongs(query: string, count: number): Promise<RawEntry[]> {
    const ytmusic = await searchYtMusicSongs(query, count);
    if (ytmusic?.length) return ytmusic.map(rawEntryFromYtMusicSong);

    try {
        const json = await runYtdlp([
            "--dump-single-json",
            "--flat-playlist",
            "--playlist-end",
            String(count),
            youtubeMusicSongsUrl(query),
        ]);
        const data = JSON.parse(json) as RawEntry & { entries?: RawEntry[] };
        const entries = (data.entries ?? []).filter((e) => e?.id);
        if (entries.length) return entries;
    } catch (err) {
        log.debug(`YouTube Music song search failed for "${query}": ${(err as Error).message}`);
    }
    return [];
}

async function enrichEntry(e: RawEntry): Promise<RawEntry> {
    if (e.track && (e.artist || e.artists?.length || e.creator) && e.duration) return e;

    const pageUrl = entryPageUrl(e);
    if (!pageUrl) return e;
    try {
        const json = await runYtdlp([
            "--dump-single-json",
            "--skip-download",
            "--no-playlist",
            "--ignore-no-formats-error",
            // We only need metadata here. Skipping HLS/DASH manifest probing keeps the
            // verification pass cheaper while still exposing track/artist/album.
            "--extractor-args",
            "youtube:skip=hls,dash",
            pageUrl,
        ]);
        const full = JSON.parse(json) as RawEntry;
        return {
            ...e,
            ...full,
            id: e.id,
            url: pageUrl,
            // Preserve the Music URL when this came from YT Music. If we later
            // resolve the result again (autocomplete pick/direct URL), the Music URL
            // lets yt-dlp recover track/artist/album instead of plain video metadata.
            webpage_url: pageUrl,
        };
    } catch (err) {
        log.debug(`Could not enrich ${e.id}: ${(err as Error).message}`);
        return e;
    }
}

async function enrichTopEntries(entries: RawEntry[], limit = YT_MUSIC_ENRICH_LIMIT): Promise<RawEntry[]> {
    const unique = dedupeEntries(entries);
    const head = unique.slice(0, Math.min(limit, unique.length));
    const tail = unique.slice(head.length);
    const enriched = await Promise.all(head.map((e) => enrichEntry(e)));
    return [...enriched, ...tail];
}

async function searchSongCandidates(query: string, count: number): Promise<RawEntry[]> {
    // Prefer YouTube Music's Songs shelf: it avoids the generic YouTube tendency to
    // surface reuploads, lyric channels, live versions and official music videos
    // ahead of the actual catalogue track.
    let entries = await searchYouTubeMusicSongs(query, count);
    if (entries.length) return enrichTopEntries(entries);

    const suggestions = await getYtMusicSearchSuggestions(query);
    for (const suggestion of suggestions?.slice(0, 3) ?? []) {
        if (suggestion.trim().toLowerCase() === query.trim().toLowerCase()) continue;
        entries = await searchYouTubeMusicSongs(suggestion, count);
        if (entries.length) {
            log.debug(`YouTube Music suggestion rescued empty search "${query}" → "${suggestion}".`);
            return enrichTopEntries(entries);
        }
    }

    entries = await searchDefaultVideoEntries(query, count);
    if (entries.length) return enrichTopEntries(entries, Math.min(8, YT_MUSIC_ENRICH_LIMIT));

    // SoundCloud fallback: when YouTube has nothing (region-blocked, taken down,
    // niche/producer uploads), try SoundCloud — a second catalogue with a search.
    return searchSoundCloud(query, count);
}

/**
 * Score a search result by how good a *clean audio* source it is. Higher = better.
 * Prefers YouTube Music "Topic" channels and "Official Audio"/lyric uploads (the
 * exact-length audio versions) over "Official Video" uploads, which usually carry
 * intros/outros that pad the runtime and hurt beatmatching.
 */
function scoreEntry(e: RawEntry, query: string): number {
    const title = (e.track ?? e.title ?? "").toLowerCase();
    const uploader = (e.artist ?? e.artists?.join(" ") ?? e.creator ?? e.uploader ?? e.channel ?? "").toLowerCase();
    const url = e.webpage_url ?? e.url ?? "";
    let score = 0;

    // ── Source quality ──
    if (url.includes("music.youtube.com/")) score += 120; // YT Music songs beat generic video search
    if (e.track && (e.artist || e.artists?.length || e.creator)) score += 90; // verified music metadata
    if (e.album) score += 20;
    if (uploader.endsWith("- topic")) score += 100; // YT Music auto-upload = pristine audio
    if (/official audio|\(audio\)|\[audio\]/.test(title)) score += 60;
    if (/lyric/.test(title)) score += 25; // lyric videos are usually clean audio too
    if (/official video|music video|official music video|\(video\)/.test(title)) score -= 40; // intro/outro risk
    if (/live|concert|performance|session/.test(title)) score -= 60; // live versions differ
    if (/cover|karaoke|instrumental|remix|sped ?up|slowed|reverb|8d|nightcore|mashup/.test(title)) score -= 55;
    if (/teaser|trailer|snippet|preview|reaction|tutorial/.test(title)) score -= 90;

    // ── Relevance: query words present in the title ──
    const words = query
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2);
    const hay = `${title} ${uploader}`.toLowerCase();
    const present = words.filter((w) => hay.includes(w)).length;
    score += (present / Math.max(1, words.length)) * 40;

    // ── Plausible song length (1–10 min); penalise very long (extended/compilations) ──
    const dur = e.duration ?? 0;
    if (dur > 0 && dur < 60) score -= 30; // too short (snippet)
    if (dur > 600) score -= 30; // 10min+ likely a mix/compilation

    return score;
}

/**
 * Resolve a query (URL or search term) to one or more tracks, WITHOUT
 * downloading. URLs resolve directly. Searches fetch several candidates and rank
 * them so the cleanest audio version (Topic/Official Audio, no video intros) wins.
 */
export async function resolveQuery(query: string, limit = 1): Promise<TrackInfo[]> {
    const trimmed = query.trim();
    const isUrl = /^https?:\/\//i.test(trimmed);

    // Spotify / Apple Music: can't be streamed (DRM), so mirror them — read the
    // track metadata and play the matching YouTube result(s) instead.
    if (isUrl && isMirrorUrl(trimmed)) {
        return resolveMirroredTracks(trimmed);
    }

    if (isUrl) {
        const json = await runYtdlp(["--dump-single-json", "--flat-playlist", query]);
        const data = JSON.parse(json) as RawEntry & { entries?: RawEntry[] };
        const entries = data.entries ?? [data];
        const valid = entries.filter((e) => e?.id);
        if (valid.length === 1 && /^[A-Za-z0-9_-]{11}$/.test(valid[0]!.id)) {
            const one = valid[0]!;
            if (trimmed.includes("music.youtube.com/")) {
                one.url = trimmed;
                one.webpage_url = trimmed;
            }
            return [toTrackInfo(await enrichEntry(one))];
        }
        return valid.map(toTrackInfo);
    }

    // Search: pull a wider candidate pool, then rank for clean-audio quality.
    const pool = Math.max(8, limit * 4);
    const entries = await searchSongCandidates(query, pool);

    entries.sort((a, b) => scoreEntry(b, query) - scoreEntry(a, query));
    return entries.slice(0, limit).map(toTrackInfo);
}

/** Search SoundCloud (`scsearch`) as a fallback catalogue. Best-effort → [] on error. */
async function searchSoundCloud(query: string, count: number): Promise<RawEntry[]> {
    try {
        const json = await runYtdlp(["--dump-single-json", "--flat-playlist", `scsearch${count}:${query}`]);
        const data = JSON.parse(json) as RawEntry & { entries?: RawEntry[] };
        const entries = (data.entries ?? []).filter((e) => e?.id && !e.is_live);
        if (entries.length) log.debug(`SoundCloud fallback for "${query}": ${entries.length} hits.`);
        return entries;
    } catch (err) {
        log.debug(`SoundCloud search failed for "${query}": ${(err as Error).message}`);
        return [];
    }
}

/**
 * Mirror a Spotify/Apple-Music link: read its track metadata, then find the best
 * YouTube match for each track. Searches run with bounded concurrency so a big
 * album/playlist doesn't fire 50 yt-dlp processes at once. Tracks with no YouTube
 * hit are silently skipped.
 */
async function resolveMirroredTracks(url: string): Promise<TrackInfo[]> {
    const mirror = await resolveMirror(url);
    if (!mirror.length) return [];

    const results: (TrackInfo | null)[] = new Array(mirror.length).fill(null);
    const CONCURRENCY = 4;
    let cursor = 0;
    async function worker(): Promise<void> {
        while (cursor < mirror.length) {
            const i = cursor++;
            try {
                const [best] = await resolveQuery(mirrorQuery(mirror[i]!), 1);
                if (best) results[i] = best;
            } catch {
                /* skip tracks we can't match */
            }
        }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, mirror.length) }, worker));
    // Preserve the album/playlist order; drop misses.
    return results.filter((t): t is TrackInfo => t != null);
}

/** Multiple search results for a select menu. */
export function search(query: string, limit = 5): Promise<TrackInfo[]> {
    return resolveQuery(query, limit);
}

// Shared cache policy for the search caches: short TTL keeps results fresh, the
// size cap (LRU) keeps them from growing without bound on a long-running server.
const SEARCH_TTL_MS = 90_000;
const SEARCH_CACHE_MAX = 500;

/**
 * Rich search for the `/play` results UI: returns a ranked list of songs plus any
 * playlists the search surfaced. `count` candidates are pulled so the UI can
 * paginate. Songs are ranked for clean-audio quality (Topic/Official Audio).
 */
export async function searchMany(
    query: string,
    count = 50,
): Promise<{ songs: TrackInfo[]; playlists: PlaylistInfo[] }> {
    // Cache the (deterministically-ranked) result so repeat searches — common as the
    // app re-opens or paginates a query — skip the ~1.5s yt-dlp round-trip. A stable
    // result also gives the HTTP layer a stable ETag (→ working 304s). Same TTL/cap
    // policy as the streamed-search cache.
    const cacheKey = `${count}:${query}`;
    const cached = searchManyCache.get(cacheKey);
    if (cached) return cached;

    const entries = await searchSongCandidates(query, count);

    const songs: RawEntry[] = [];
    const playlists: PlaylistInfo[] = [];
    for (const e of entries) {
        if (e._type === "playlist" || e.playlist_count != null) {
            playlists.push({
                id: e.id,
                title: e.title ?? "Playlist",
                url: e.webpage_url ?? e.url ?? "",
                uploader: e.uploader ?? e.channel ?? null,
                count: e.playlist_count ?? 0,
            });
        } else {
            songs.push(e);
        }
    }

    songs.sort((a, b) => scoreEntry(b, query) - scoreEntry(a, query));
    const result = { songs: songs.map(toTrackInfo), playlists };
    searchManyCache.set(cacheKey, result);
    return result;
}

/** Cache for {@link searchMany} (the rich app-facing search). Bounded TTL+LRU. */
const searchManyCache = new BoundedCache<string, { songs: TrackInfo[]; playlists: PlaylistInfo[] }>(
    SEARCH_CACHE_MAX,
    SEARCH_TTL_MS,
);

/**
 * Short-lived cache of recent streamed searches (raw arrival order + ranked order),
 * keyed by `count:query`. Repeat searches — common while a user refines or re-opens
 * a query — then return instantly instead of paying the ~1.5s YouTube round-trip.
 * TTL keeps results fresh; the size cap (LRU) keeps it from growing without bound.
 */
const searchCache = new BoundedCache<string, { raw: TrackInfo[]; ranked: TrackInfo[] }>(
    SEARCH_CACHE_MAX,
    SEARCH_TTL_MS,
);

const playlistSearchCache = new BoundedCache<string, PlaylistInfo[]>(SEARCH_CACHE_MAX, SEARCH_TTL_MS);
const albumSearchCache = new BoundedCache<string, AlbumInfo[]>(SEARCH_CACHE_MAX, SEARCH_TTL_MS);

const RADIO_CACHE_MAX = 500;
const RADIO_CACHE_TTL_MS = 10 * 60 * 1000;
const RADIO_ENRICH_LIMIT = 12;
const radioCache = new BoundedCache<string, TrackInfo[]>(RADIO_CACHE_MAX, RADIO_CACHE_TTL_MS);

function playlistIdFromUrlOrId(input: string | null | undefined): string | null {
    if (!input) return null;
    try {
        const url = new URL(input);
        const list = url.searchParams.get("list");
        if (list) return list.replace(/^VL/, "").replace(/^RDAMPL/, "");
    } catch {
        // Not a URL; treat as a raw playlist id below.
    }
    const id = input
        .trim()
        .replace(/^VL/, "")
        .replace(/^RDAMPL/, "");
    return /^[A-Za-z0-9_-]+$/.test(id) ? id : null;
}

function getCachedSearch(key: string): { raw: TrackInfo[]; ranked: TrackInfo[] } | null {
    return searchCache.get(key);
}

/**
 * Synchronously read a cached search's ranked results (or null). Used by `/play`
 * autocomplete to show suggestions the instant a prefetch has landed, without
 * awaiting anything.
 */
export function peekCachedSearch(query: string, count: number): TrackInfo[] | null {
    return getCachedSearch(`${count}:${query}`)?.ranked ?? null;
}

/**
 * Warm the search cache for `query` without consuming the streamed rows. Safe to
 * fire repeatedly: an already-cached or in-flight query is a near-no-op (the cache
 * hit short-circuits, and de-dup is the caller's debounce job). Errors are
 * swallowed — a failed prefetch just means the real search runs normally.
 */
export async function prefetchSearch(query: string, count: number): Promise<void> {
    try {
        await searchStream(query, count, () => {});
    } catch {
        /* prefetch is best-effort */
    }
}

/**
 * Streaming search for the `/play` UI's "results appear one by one" effect. The
 * source is YouTube Music first, then YouTube/SoundCloud fallback. We enrich the
 * visible candidates before surfacing them so the UI gets real track/artist/duration
 * instead of generic reupload metadata.
 *
 * Returns the full list re-ranked for clean-audio quality, so the caller can show
 * the arrival order and then settle on the ranked order once everything's in.
 */
export async function searchStream(
    query: string,
    count: number,
    onResult: (track: TrackInfo, rawIndex: number) => void,
): Promise<TrackInfo[]> {
    const cacheKey = `${count}:${query}`;
    const cached = getCachedSearch(cacheKey);
    if (cached) {
        // Instant replay: feed the previously-streamed rows through the callback so
        // the UI fills identically, with zero network latency.
        cached.raw.forEach((track, i) => {
            onResult(track, i);
        });
        return cached.ranked;
    }

    const raws = await searchSongCandidates(query, count);

    // Raw arrival order (what the UI streamed) before re-sorting.
    const rawOrder = raws.map(toTrackInfo);
    for (let i = 0; i < rawOrder.length; i++) {
        onResult(rawOrder[i]!, i);
    }
    // Final clean-audio ranking over everything we streamed.
    raws.sort((a, b) => scoreEntry(b, query) - scoreEntry(a, query));
    const ranked = raws.map(toTrackInfo);

    if (rawOrder.length) {
        searchCache.set(cacheKey, { raw: rawOrder, ranked });
    }
    return ranked;
}

/**
 * Search specifically for YouTube playlists (the search UI's Playlists tab).
 * Plain `ytsearch` only returns videos, so we hit YouTube's playlist-filtered
 * results URL (`sp=EgIQAw`) and keep only entries that are actual playlists.
 */
export async function searchPlaylists(query: string, limit = 25): Promise<PlaylistInfo[]> {
    const cacheKey = `${limit}:${query}`;
    const cached = playlistSearchCache.get(cacheKey);
    if (cached) return cached;

    const ytmusic = await searchYtMusicPlaylists(query, limit);
    if (ytmusic?.length) {
        const playlists = ytmusic.map((playlist) => ({
            id: playlist.id,
            title: playlist.title,
            url: playlist.url,
            uploader: playlist.uploader,
            count: playlist.count,
        }));
        playlistSearchCache.set(cacheKey, playlists);
        return playlists;
    }

    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAw`;
    let json: string;
    try {
        json = await runYtdlp([
            "--dump-single-json",
            "--flat-playlist",
            "--ignore-no-formats-error",
            "--playlist-end",
            String(limit * 2),
            url,
        ]);
    } catch {
        return [];
    }
    const data = JSON.parse(json) as RawEntry;
    const entries = data.entries ?? [];
    const out: PlaylistInfo[] = [];
    for (const e of entries) {
        const u = e.webpage_url ?? e.url ?? "";
        const isPlaylist = u.includes("list=") || u.includes("/playlist");
        if (!isPlaylist || !e.id) continue;
        out.push({
            id: e.id,
            title: e.title ?? "Playlist",
            url: u.startsWith("http") ? u : `https://www.youtube.com/playlist?list=${e.id}`,
            uploader: e.uploader ?? e.channel ?? null,
            count: e.playlist_count ?? 0,
        });
        if (out.length >= limit) break;
    }
    const enriched = await enrichPlaylistSummaries(out);
    playlistSearchCache.set(cacheKey, enriched);
    return enriched;
}

/** Expand a playlist URL into its tracks (for the "add playlist" action). */
export async function expandPlaylist(url: string, max = 100): Promise<TrackInfo[]> {
    return (await expandPlaylistWithMeta(url, max)).tracks;
}

/** A playlist's display title plus its tracks, resolved in a single yt-dlp call. */
export interface PlaylistExpansion {
    /** The playlist's own title (yt-dlp's top-level `title`), or null if unnamed. */
    title: string | null;
    tracks: TrackInfo[];
}

const PLAYLIST_EXPANSION_CACHE_MAX = 200;
const PLAYLIST_EXPANSION_TTL_MS = 5 * 60 * 1000;
const PLAYLIST_SEARCH_META_LIMIT = 5;
const PLAYLIST_TRACK_ENRICH_LIMIT = 8;
const ALBUM_TRACK_ENRICH_LIMIT = 100;
const playlistSummaryCache = new BoundedCache<string, PlaylistInfo>(
    PLAYLIST_EXPANSION_CACHE_MAX,
    PLAYLIST_EXPANSION_TTL_MS,
);
const playlistExpansionCache = new BoundedCache<string, PlaylistExpansion>(
    PLAYLIST_EXPANSION_CACHE_MAX,
    PLAYLIST_EXPANSION_TTL_MS,
);

async function enrichPlaylistSummary(playlist: PlaylistInfo): Promise<PlaylistInfo> {
    const cached = playlistSummaryCache.get(playlist.id);
    if (cached) return cached;
    try {
        const json = await runYtdlp([
            "--dump-single-json",
            "--flat-playlist",
            "--ignore-no-formats-error",
            "--playlist-end",
            "1",
            playlist.url,
        ]);
        const data = JSON.parse(json) as RawEntry;
        const enriched = {
            ...playlist,
            title: data.title ?? playlist.title,
            url: data.webpage_url ?? data.url ?? playlist.url,
            uploader: data.uploader ?? data.channel ?? playlist.uploader,
            count: data.playlist_count ?? playlist.count,
        };
        playlistSummaryCache.set(playlist.id, enriched);
        return enriched;
    } catch {
        return playlist;
    }
}

async function enrichPlaylistSummaries(playlists: PlaylistInfo[]): Promise<PlaylistInfo[]> {
    const head = playlists.slice(0, Math.min(PLAYLIST_SEARCH_META_LIMIT, playlists.length));
    const tail = playlists.slice(head.length);
    return [...(await Promise.all(head.map(enrichPlaylistSummary))), ...tail];
}

async function expandPlaylistWithMetaInternal(
    url: string,
    max: number,
    enrichLimit: number,
): Promise<PlaylistExpansion> {
    const cacheKey = `${enrichLimit}:${max}:${url}`;
    const cached = playlistExpansionCache.get(cacheKey);
    if (cached) return cached;

    const json = await runYtdlp([
        "--dump-single-json",
        "--flat-playlist",
        "--ignore-no-formats-error",
        "--playlist-end",
        String(max),
        url,
    ]);
    const data = JSON.parse(json) as RawEntry;
    const entries = dedupeEntries((data.entries ?? []).filter((e) => e?.id && !e.is_live));
    const expanded = enrichLimit > 0 ? await enrichTopEntries(entries, Math.min(enrichLimit, max)) : entries;
    const result = {
        title: data.title ?? null,
        tracks: expanded.map(toTrackInfo),
    };
    playlistExpansionCache.set(cacheKey, result);
    return result;
}

/**
 * Expand a playlist URL into its tracks AND its title in one `--dump-single-json`
 * pass, then enriches the first few visible tracks for cleaner artist/title
 * metadata. Prefer this over {@link expandPlaylist} when you also need the
 * playlist name (e.g. saving it to a library).
 */
export async function expandPlaylistWithMeta(url: string, max = 100): Promise<PlaylistExpansion> {
    return expandPlaylistWithMetaInternal(url, max, PLAYLIST_TRACK_ENRICH_LIMIT);
}

/**
 * "Radio" / autoplay: given a seed YouTube video id, return the tracks YouTube's
 * Mix (RD) playlist recommends after it — a genre-coherent endless queue, the same
 * thing the YT app's autoplay uses. Used to keep the music going when the user's
 * queue runs dry. Skips the seed itself, any live streams, and de-dupes.
 *
 * Best-effort: returns [] if the seed has no mix (some uploads don't) or on error,
 * so the caller can simply stop instead of failing.
 */
export async function resolveRadio(seedId: string, max = 25): Promise<TrackInfo[]> {
    // RD-mixes only exist for plain 11-char YouTube ids; bail on anything else.
    if (!/^[A-Za-z0-9_-]{11}$/.test(seedId)) return [];
    const cacheKey = `${max}:${seedId}`;
    const cached = radioCache.get(cacheKey);
    if (cached) return cached;

    const ytmusic = await getYtMusicWatchPlaylist({ videoId: seedId, limit: max + 1, radio: true });
    if (ytmusic?.tracks.length) {
        const seen = new Set<string>([seedId]);
        const out: TrackInfo[] = [];
        for (const song of ytmusic.tracks) {
            if (!song.id || seen.has(song.id)) continue;
            seen.add(song.id);
            out.push(trackInfoFromYtMusicSong(song));
            if (out.length >= max) break;
        }
        if (out.length) {
            radioCache.set(cacheKey, out);
            return out;
        }
    }

    try {
        const json = await runYtdlp([
            "--dump-single-json",
            "--flat-playlist",
            "--ignore-no-formats-error",
            "--playlist-end",
            String(max + 1), // +1 because the seed is usually entry 0
            `https://music.youtube.com/watch?v=${seedId}&list=RDAMVM${seedId}`,
        ]);
        const data = JSON.parse(json) as RawEntry;
        const seen = new Set<string>([seedId]);
        const entries: RawEntry[] = [];
        for (const e of data.entries ?? []) {
            if (!e?.id || seen.has(e.id) || e.is_live) continue;
            seen.add(e.id);
            entries.push(e);
            if (entries.length >= max) break;
        }
        const enriched = await enrichTopEntries(entries, Math.min(RADIO_ENRICH_LIMIT, max));
        const out = enriched.slice(0, max).map(toTrackInfo);
        if (out.length) radioCache.set(cacheKey, out);
        return out;
    } catch (err) {
        log.debug(`resolveRadio failed for ${seedId}: ${(err as Error).message}`);
        return [];
    }
}

async function resolveWatchPlaylistTracks(input: {
    playlistId: string;
    max: number;
    radio?: boolean;
    shuffle?: boolean;
}): Promise<TrackInfo[]> {
    const cacheKey = `watch:${input.radio ? "radio" : input.shuffle ? "shuffle" : "next"}:${input.max}:${input.playlistId}`;
    const cached = radioCache.get(cacheKey);
    if (cached) return cached;

    const watchInput: { playlistId: string; limit: number; radio?: boolean; shuffle?: boolean } = {
        playlistId: input.playlistId,
        limit: input.max,
    };
    if (input.radio) watchInput.radio = true;
    if (input.shuffle) watchInput.shuffle = true;
    const ytmusic = await getYtMusicWatchPlaylist(watchInput);
    const out = (ytmusic?.tracks ?? []).slice(0, input.max).map(trackInfoFromYtMusicSong);
    if (out.length) radioCache.set(cacheKey, out);
    return out;
}

/**
 * True YT Music playlist/album radio (`RDAMPL...`), powered by ytmusicapi's watch
 * endpoint. This is intentionally separate from {@link resolveRadio}: yt-dlp can
 * usually scrape song radio (`RDAMVM...`), but playlist/album radio is often marked
 * unviewable by the extractor and needs the catalogue endpoint.
 */
export async function resolvePlaylistRadio(playlistUrlOrId: string, max = 25): Promise<TrackInfo[]> {
    const playlistId = playlistIdFromUrlOrId(playlistUrlOrId);
    if (!playlistId) return [];
    return resolveWatchPlaylistTracks({ playlistId, max, radio: true });
}

/** YT Music shuffle order for a playlist or album audio playlist. */
export async function resolvePlaylistShuffle(playlistUrlOrId: string, max = 25): Promise<TrackInfo[]> {
    const playlistId = playlistIdFromUrlOrId(playlistUrlOrId);
    if (!playlistId) return [];
    return resolveWatchPlaylistTracks({ playlistId, max, shuffle: true });
}

// ── YouTube Music albums / releases (the Releases tab) ──

/**
 * YT Music's "Albums only" search filter (the base64 `params` for the album
 * results category). Plain music search mixes songs/videos/albums; this scopes it
 * to actual albums, which come back as `browse/MPREb_…` browse ids.
 */
const YT_MUSIC_ALBUM_FILTER = "EgWKAQIYAWoKEAoQAxAEEAkQBQ%3D%3D";

/**
 * Fast album search: returns YT Music album browse ids (no titles — those are
 * resolved lazily for the visible rows via {@link resolveAlbumMeta}, which keeps
 * the Releases tab snappy since each title costs a separate resolve).
 */
export async function searchAlbums(query: string, limit = 25): Promise<AlbumInfo[]> {
    const cacheKey = `${limit}:${query}`;
    const cached = albumSearchCache.get(cacheKey);
    if (cached) return cached;

    const ytmusic = await searchYtMusicAlbums(query, limit);
    if (ytmusic?.length) {
        const albums = ytmusic.map(albumInfoFromYtMusicAlbum);
        albumSearchCache.set(cacheKey, albums);
        return albums;
    }

    const url = `https://music.youtube.com/search?q=${encodeURIComponent(query)}&sp=${YT_MUSIC_ALBUM_FILTER}`;
    let stdout: string;
    try {
        stdout = await runYtdlp([
            "--flat-playlist",
            "--ignore-no-formats-error",
            "--playlist-end",
            String(limit),
            "--print",
            "%(id)s",
            url,
        ]);
    } catch {
        return [];
    }
    const out: AlbumInfo[] = [];
    for (const line of stdout.split("\n")) {
        const id = line.trim();
        if (!id.startsWith("MPREb_")) continue; // keep only album browse ids
        out.push({ id, title: null, artist: null, year: null, count: 0, url: null, audioPlaylistId: null });
        if (out.length >= limit) break;
    }
    albumSearchCache.set(cacheKey, out);
    return out;
}

/**
 * Cache of resolved album metadata (id → meta), so paging/re-open is instant.
 * Album metadata is effectively immutable, so a long TTL is fine; the size cap
 * (LRU) is what matters — it keeps this from growing for the life of the process.
 */
const ALBUM_META_CACHE_MAX = 500;
const ALBUM_META_TTL_MS = 60 * 60 * 1000; // 1h
const albumMetaCache = new BoundedCache<string, AlbumInfo>(ALBUM_META_CACHE_MAX, ALBUM_META_TTL_MS);
const albumDetailsCache = new BoundedCache<string, YtMusicAlbumDetails>(ALBUM_META_CACHE_MAX, ALBUM_META_TTL_MS);

async function resolveYtMusicAlbumDetails(browseId: string): Promise<YtMusicAlbumDetails | null> {
    const cached = albumDetailsCache.get(browseId);
    if (cached) return cached;
    const details = await getYtMusicAlbum(browseId);
    if (!details) return null;
    albumDetailsCache.set(browseId, details);
    albumMetaCache.set(browseId, albumInfoFromYtMusicAlbum(details));
    return details;
}

/**
 * Resolve one album's title, track count, and OLAK5uy playlist URL from its browse
 * id. Cached, so re-resolving a visible row (e.g. on page flip) is free. Returns
 * the input unchanged (title still null) if resolution fails.
 */
export async function resolveAlbumMeta(album: AlbumInfo): Promise<AlbumInfo> {
    const cached = albumMetaCache.get(album.id);
    if (cached) return cached;
    if (album.title && (album.url || album.audioPlaylistId) && album.count > 0) {
        albumMetaCache.set(album.id, album);
        return album;
    }

    const ytmusic = await resolveYtMusicAlbumDetails(album.id);
    if (ytmusic) return albumInfoFromYtMusicAlbum(ytmusic);

    try {
        const json = await runYtdlp([
            "--dump-single-json",
            "--flat-playlist",
            "--ignore-no-formats-error",
            `https://music.youtube.com/browse/${album.id}`,
        ]);
        const data = JSON.parse(json) as RawEntry & { title?: string; playlist_count?: number };
        // yt-dlp titles these "Album - <name>"; strip the prefix for display.
        const title = (data.title ?? "").replace(/^Album\s*-\s*/i, "").trim() || null;
        const resolved: AlbumInfo = {
            id: album.id,
            title,
            artist: album.artist,
            year: album.year,
            count: data.playlist_count ?? data.entries?.length ?? 0,
            url: data.webpage_url ?? data.url ?? null,
            audioPlaylistId: album.audioPlaylistId,
        };
        albumMetaCache.set(album.id, resolved);
        return resolved;
    } catch {
        return album; // leave unresolved; the UI shows a "couldn't load" placeholder
    }
}

/**
 * Expand an album into its tracks for queueing. Use the YT Music browse URL even
 * when the resolved OLAK5uy playlist URL is known: flat browse entries keep
 * `music.youtube.com/watch` URLs, and enrichment recovers clean track/artist/album
 * metadata for the whole release.
 */
export async function expandAlbum(album: AlbumInfo, max = 100): Promise<TrackInfo[]> {
    const ytmusic = await resolveYtMusicAlbumDetails(album.id);
    if (ytmusic?.tracks.length) {
        return ytmusic.tracks.slice(0, max).map(trackInfoFromYtMusicSong);
    }

    const target = `https://music.youtube.com/browse/${album.id}`;
    return (await expandPlaylistWithMetaInternal(target, max, Math.min(max, ALBUM_TRACK_ENRICH_LIMIT))).tracks;
}

async function albumAudioPlaylistId(album: AlbumInfo): Promise<string | null> {
    if (album.audioPlaylistId) return album.audioPlaylistId;
    const details = await resolveYtMusicAlbumDetails(album.id);
    return details?.audioPlaylistId ?? playlistIdFromUrlOrId(album.url);
}

/** True album radio seeded from YT Music's album audio playlist. */
export async function resolveAlbumRadio(album: AlbumInfo, max = 25): Promise<TrackInfo[]> {
    const playlistId = await albumAudioPlaylistId(album);
    return playlistId ? resolvePlaylistRadio(playlistId, max) : [];
}

/** YT Music shuffle order for an album release. */
export async function resolveAlbumShuffle(album: AlbumInfo, max = 100): Promise<TrackInfo[]> {
    const playlistId = await albumAudioPlaylistId(album);
    return playlistId ? resolvePlaylistShuffle(playlistId, max) : [];
}

/**
 * Download the full best-audio file for a track into the cache and return its
 * absolute path. Having the complete file (not a live stream) is what enables
 * arbitrary local processing / mixing later. Re-downloads are skipped if the
 * file already exists.
 */
export async function downloadTrack(track: TrackInfo): Promise<string> {
    // Live streams have no finite file — yt-dlp would download forever (or fail).
    // Reject up front so a "lofi radio" result can't wedge the queue. (Searches don't
    // always flag is_live, so the queue layer should also avoid enqueueing these.)
    if (track.isLive) {
        throw new Error(`"${track.title}" is a live stream and can't be downloaded.`);
    }
    await mkdir(cacheDir, { recursive: true });

    // Re-use a cached copy if present (keyed by track id), refreshing its LRU mtime.
    const cached = resolve(cacheDir, `${sanitize(track.id)}.opus`);
    if (await Bun.file(cached).exists()) {
        await touch(cached);
        return cached;
    }

    // Stable, extension-agnostic output template keyed by the track id.
    const outTemplate = resolve(cacheDir, `${sanitize(track.id)}.%(ext)s`);

    // Pick the highest-bitrate audio, preferring Opus then AAC/m4a (the two best
    // codecs YouTube serves). Re-encode to Opus only when the source isn't already
    // Opus, avoiding needless lossy-on-lossy transcoding of native Opus streams.
    const args = [
        "-f",
        "bestaudio[acodec=opus]/bestaudio[ext=m4a]/bestaudio/best",
        "--extract-audio",
        "--audio-format",
        "opus",
        "--audio-quality",
        "0",
        // Only ever the single track, never the playlist it may belong to: a YouTube
        // URL can carry a `&list=` (radio/mix links especially), which would otherwise
        // expand to many downloads and make the after_move:filepath print ambiguous.
        "--no-playlist",
        // Audio is a single progressive stream — skip probing HLS/DASH manifests we
        // never use. Measured ~10% faster extraction, identical output.
        "--extractor-args",
        "youtube:skip=hls,dash",
        // Survive transient network/YouTube hiccups on a long-running server instead
        // of failing a download outright; re-extract if YouTube throttles us to a crawl.
        "--retries",
        "10",
        "--fragment-retries",
        "10",
        "--extractor-retries",
        "5",
        "--retry-sleep",
        "http:exp=1:20",
        "--retry-sleep",
        "fragment:exp=1:20",
        "--retry-sleep",
        "extractor:linear=1:5",
        "--socket-timeout",
        "15",
        "--throttled-rate",
        "100K",
        // Our ffmpeg lives in ./bin, not on PATH – tell yt-dlp where to find it.
        "--ffmpeg-location",
        ffmpegPath,
        "-o",
        outTemplate,
        "--print",
        "after_move:filepath",
        "--no-simulate",
        track.url || track.id,
    ];

    log.debug(`Downloading ${track.id} (${track.title})`);
    const stdout = await runYtdlp(args);
    const filepath = stdout.trim().split("\n").at(-1)?.trim();
    if (!filepath) throw new Error(`yt-dlp did not report an output path for ${track.id}`);

    // Keep the cache under its size limit (never evicts the file we just made).
    void enforceCacheLimit(new Set([filepath]));
    return filepath;
}

function sanitize(id: string): string {
    return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export { cacheDir };
