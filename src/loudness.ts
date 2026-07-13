import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

import { config } from "./config";
import { createLogger } from "./logger";

const log = createLogger("Loudness");

const ffmpegPath = resolve(process.cwd(), config.FFMPEG_PATH);
/** Persisted loudness cache lives alongside the audio cache dir. */
const cacheFile = resolve(process.cwd(), config.CACHE_DIR, "loudness-cache.json");

/** Target loudness for playback. -14 LUFS is the de-facto streaming standard. */
export const TARGET_I = -14;
/** True-peak ceiling (dBTP) and loudness range — EBU R128 music defaults. */
export const TARGET_TP = -1.5;
export const TARGET_LRA = 11;

/**
 * Pass-1 loudnorm measurements for a track. Cached so we measure each file once
 * and reuse the values on every replay. Strings (as ffmpeg prints them) are kept
 * verbatim — they're fed straight back into the pass-2 filter.
 */
export interface LoudnessStats {
    input_i: string;
    input_tp: string;
    input_lra: string;
    input_thresh: string;
    target_offset: string;
}

/**
 * Loudness cache, keyed by the cache filename (= sanitized track id, see ytdlp), NOT
 * the absolute path — so a re-download to the same id reuses the measurement. A full
 * loudnorm scan reads the whole file (~1s per minute of audio, measured), so persisting
 * this across restarts avoids a multi-second re-measure on the first play of every
 * track after a restart. The in-memory Map stays the hot-path cache; it's hydrated from
 * disk lazily on first use and the file is rewritten only when a NEW entry is measured.
 *
 * `undefined` value = not measured yet; `null` = measured and failed (don't retry).
 */
const cache = new Map<string, LoudnessStats | null>();
let loaded = false;

/** Map key for a file: its basename (the track id), independent of the cache dir path. */
function cacheKey(filePath: string): string {
    return basename(filePath);
}

/** Hydrate the in-memory cache from disk once (best-effort; a bad file is ignored). */
function ensureLoaded(): void {
    if (loaded) return;
    loaded = true;
    try {
        const raw = JSON.parse(readFileSync(cacheFile, "utf8")) as Record<string, LoudnessStats | null>;
        for (const [k, v] of Object.entries(raw)) cache.set(k, v);
        log.debug(`Loaded ${cache.size} cached loudness entries.`);
    } catch {
        /* no cache file yet, or unreadable — start empty */
    }
}

/** Persist the cache to disk (best-effort; a write failure must never break playback). */
function persist(): void {
    try {
        writeFileSync(cacheFile, JSON.stringify(Object.fromEntries(cache)));
    } catch (err) {
        log.debug(`Could not persist loudness cache: ${(err as Error).message}`);
    }
}

/**
 * Measure a file's integrated loudness (EBU R128) with a single analysis pass of
 * ffmpeg's `loudnorm` filter. The result feeds {@link loudnormFilter} so playback
 * can apply a *linear* gain to hit {@link TARGET_I} — equal loudness across tracks
 * without the moment-to-moment pumping a single-pass dynamic loudnorm causes.
 *
 * Returns null if measurement fails (then playback simply skips normalization).
 * Memoised per path.
 */
export async function measureLoudness(filePath: string): Promise<LoudnessStats | null> {
    ensureLoaded();
    const key = cacheKey(filePath);
    const hit = cache.get(key);
    if (hit !== undefined) return hit;

    const stats = await runMeasurement(filePath);
    cache.set(key, stats);
    persist(); // a new measurement is expensive (~1s/min) — never lose it to a restart
    return stats;
}

function runMeasurement(filePath: string): Promise<LoudnessStats | null> {
    return new Promise((resolvePromise) => {
        const ff = spawn(
            ffmpegPath,
            [
                "-hide_banner",
                "-i",
                filePath,
                "-af",
                `loudnorm=I=${TARGET_I}:TP=${TARGET_TP}:LRA=${TARGET_LRA}:print_format=json`,
                // Analysis only — discard the audio output, keep the JSON (on stderr).
                "-f",
                "null",
                "-",
            ],
            { stdio: ["ignore", "ignore", "pipe"] },
        );
        let stderr = "";
        ff.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
        ff.on("error", (err) => {
            log.debug(`loudnorm measure failed for ${filePath}: ${err.message}`);
            resolvePromise(null);
        });
        ff.on("close", () => {
            // ffmpeg prints the JSON block last on stderr; grab the final {...}.
            const start = stderr.lastIndexOf("{");
            const end = stderr.lastIndexOf("}");
            if (start === -1 || end === -1 || end < start) {
                resolvePromise(null);
                return;
            }
            try {
                const raw = JSON.parse(stderr.slice(start, end + 1)) as Record<string, string>;
                if (raw.input_i == null) return resolvePromise(null);
                resolvePromise({
                    input_i: raw.input_i,
                    input_tp: raw.input_tp!,
                    input_lra: raw.input_lra!,
                    input_thresh: raw.input_thresh!,
                    target_offset: raw.target_offset!,
                });
            } catch {
                resolvePromise(null);
            }
        });
    });
}

/**
 * Build the pass-2 `loudnorm` filter string that applies a linear gain to reach
 * {@link TARGET_I}, using the previously measured values. `linear=true` makes it a
 * single constant gain (dynamics preserved); without measured values loudnorm
 * would fall back to dynamic (pumping) mode, which we explicitly avoid.
 */
export function loudnormFilter(stats: LoudnessStats): string {
    return (
        `loudnorm=I=${TARGET_I}:TP=${TARGET_TP}:LRA=${TARGET_LRA}` +
        `:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}` +
        `:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}` +
        `:offset=${stats.target_offset}:linear=true`
    );
}
