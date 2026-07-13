import { createLogger } from "./logger";
import { cleanTrackMeta } from "./trackmeta";

const log = createLogger("Lyrics");

/**
 * Synchronised lyrics via LRCLIB (https://lrclib.net) — a free, public, token-less
 * lyrics database with crowd-sourced LRC timing. We use it instead of Musixmatch:
 * no reverse-engineering, no fragile tokens, and it's explicitly fine for
 * non-commercial apps. Returns parsed, timestamped lines for the live display.
 */

const API = "https://lrclib.net/api";
const UA = "Beatcord (https://github.com/beatcord)";

/** One synced lyric line: text shown from `timeMs` until the next line. */
export interface LyricLine {
    timeMs: number;
    text: string;
}

export interface Lyrics {
    /** Timestamped lines, ascending by time. Empty if only plain lyrics exist. */
    synced: LyricLine[];
    /** Plain (un-timed) lyrics as a fallback, or null. */
    plain: string | null;
}

interface LrclibResult {
    syncedLyrics?: string | null;
    plainLyrics?: string | null;
    trackName?: string;
    artistName?: string;
    instrumental?: boolean;
    /** Catalogued track length in seconds — used to pick the closest match. */
    duration?: number;
}

/** Cache by "artist|title" so we hit the network once per track. */
const cache = new Map<string, Lyrics | null>();

/**
 * Fetch lyrics for a track. Cleans the YouTube title/uploader into a real
 * artist+track first (shared with the display layer), tries the exact `get`, then
 * a fuzzy `search`. Returns null when nothing usable is found (or it's
 * instrumental). Memoised by raw inputs.
 */
export async function fetchLyrics(
    rawTitle: string,
    uploader: string | null,
    durationMs?: number,
): Promise<Lyrics | null> {
    const key = `${uploader ?? ""}|${rawTitle}`.toLowerCase();
    const hit = cache.get(key);
    if (hit !== undefined) return hit;

    const { artist, title } = cleanTrackMeta(rawTitle, uploader);
    let lyrics = toLyrics(await lookup(title, artist, durationMs));
    // LRCLIB had nothing → fall back to a plain-lyrics source so most tracks still
    // show *something* (no timing, but better than "not found").
    if (!lyrics && artist) {
        const plain = await fetchPlainFallback(title, artist);
        if (plain) lyrics = { synced: [], plain };
    }
    cache.set(key, lyrics);
    return lyrics;
}

/**
 * Plain-lyrics fallback via lyrics.ovh (free, token-less, un-timed). Only tried
 * when LRCLIB has no entry. Best-effort: returns null on any miss/error.
 */
async function fetchPlainFallback(title: string, artist: string): Promise<string | null> {
    for (const t of titleVariants(title)) {
        const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(t)}`;
        const data = await getJson<{ lyrics?: string }>(url);
        const text = data?.lyrics?.replace(/\r\n/g, "\n").trim();
        if (text) {
            log.debug(`Plain lyrics via lyrics.ovh for "${t}" — ${artist}.`);
            return text;
        }
    }
    return null;
}

/**
 * Strip noise that YouTube titles carry but the catalogued track name doesn't, so a
 * messy "Traum (prod. Beathoavenz) [Official HD]" still matches "Traum". Produces a
 * few progressively-looser variants, most specific first, de-duplicated.
 */
export function titleVariants(title: string): string[] {
    const variants = new Set<string>();
    const add = (s: string) => {
        const t = s.replace(/\s{2,}/g, " ").trim();
        if (t) variants.add(t);
    };
    add(title);
    // Drop a "feat./ft./featuring …" clause.
    const noFeat = title.replace(/\s*[([]?\s*\b(feat|ft|featuring|with)\b\.?.*$/i, "");
    add(noFeat);
    // Drop any parenthetical/bracketed segment ("(Official Video)", "[Remix]", …).
    add(noFeat.replace(/\s*[([{][^)\]}]*[)\]}]/g, ""));
    // Drop a trailing " - …" suffix (e.g. "Song - Radio Edit").
    add(noFeat.replace(/\s+-\s+.*$/, ""));
    return [...variants];
}

/** Pick the best search hit: prefer synced lyrics and a close duration match. */
function pickResult(results: LrclibResult[], durationMs?: number): LrclibResult | null {
    if (!results.length) return null;
    const targetSec = durationMs && durationMs > 0 ? durationMs / 1000 : null;
    const score = (r: LrclibResult): number => {
        let s = 0;
        if (r.syncedLyrics)
            s += 1000; // synced ≫ plain
        else if (r.plainLyrics) s += 100;
        if (targetSec && typeof r.duration === "number" && r.duration > 0) {
            s -= Math.min(60, Math.abs(r.duration - targetSec)); // closer duration = better
        }
        return s;
    };
    return [...results].sort((a, b) => score(b) - score(a))[0] ?? null;
}

async function lookup(title: string, artist: string | null, durationMs?: number): Promise<LrclibResult | null> {
    const durSec = durationMs && durationMs > 0 ? String(Math.round(durationMs / 1000)) : null;

    // 1) Exact get on each title variant (most specific first). Duration sharpens it;
    //    retry without it since the YouTube length often drifts a second or two.
    if (artist) {
        for (const t of titleVariants(title)) {
            const withDur = durSec
                ? await getJson<LrclibResult>(
                      `${API}/get?track_name=${encodeURIComponent(t)}&artist_name=${encodeURIComponent(artist)}&duration=${durSec}`,
                  )
                : null;
            if (withDur && (withDur.syncedLyrics || withDur.plainLyrics)) return withDur;
            const noDur = await getJson<LrclibResult>(
                `${API}/get?track_name=${encodeURIComponent(t)}&artist_name=${encodeURIComponent(artist)}`,
            );
            if (noDur && (noDur.syncedLyrics || noDur.plainLyrics)) return noDur;
        }
    }

    // 2) Fuzzy search across variants → score for synced + closest duration.
    for (const t of titleVariants(title)) {
        const q = artist ? `${t} ${artist}` : t;
        const results = await getJson<LrclibResult[]>(`${API}/search?q=${encodeURIComponent(q)}`);
        const best = Array.isArray(results) ? pickResult(results, durationMs) : null;
        if (best && (best.syncedLyrics || best.plainLyrics)) return best;
    }
    return null;
}

function toLyrics(r: LrclibResult | null): Lyrics | null {
    if (!r || r.instrumental) return null;
    const synced = r.syncedLyrics ? parseLrc(r.syncedLyrics) : [];
    const plain = r.plainLyrics?.trim() || null;
    if (!synced.length && !plain) return null;
    return { synced, plain };
}

/**
 * Parse LRC text (`[mm:ss.xx] line`) into ascending timestamped lines. Lines may
 * carry multiple timestamps; blank lyric lines are kept (they mark instrumental
 * gaps, useful for the live view). Ignores metadata tags like `[ar:...]`.
 */
export function parseLrc(lrc: string): LyricLine[] {
    const out: LyricLine[] = [];
    const stamp = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
    for (const raw of lrc.split("\n")) {
        const text = raw.replace(stamp, "").trim();
        stamp.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = stamp.exec(raw))) {
            const min = Number(m[1]);
            const sec = Number(m[2]);
            const frac = m[3] ? Number(`0.${m[3]}`) : 0;
            if (Number.isFinite(min) && Number.isFinite(sec)) {
                out.push({ timeMs: Math.round((min * 60 + sec + frac) * 1000), text });
            }
        }
    }
    out.sort((a, b) => a.timeMs - b.timeMs);
    return out;
}

/**
 * Index of the synced line active at `positionMs` (the last line whose time has
 * passed), or -1 before the first line. Lines must be ascending (parseLrc output).
 */
export function activeLineIndex(lines: LyricLine[], positionMs: number): number {
    let lo = 0;
    let hi = lines.length - 1;
    let idx = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (lines[mid]!.timeMs <= positionMs) {
            idx = mid;
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }
    return idx;
}

async function getJson<T>(url: string): Promise<T | null> {
    try {
        const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as T;
    } catch (err) {
        log.debug(`lyrics fetch failed (${url}): ${(err as Error).message}`);
        return null;
    }
}
