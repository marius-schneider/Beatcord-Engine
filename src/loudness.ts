import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

import { config } from "./config";
import { createLogger } from "./logger";
import { limitFor, resources } from "./resources";
import { Semaphore } from "./semaphore";

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
 * Cap on simultaneous measurements. Each one decodes the WHOLE file through the
 * loudnorm filter at full speed (~1s of CPU per audio minute), so this is the most
 * expensive thing on the track-start path. Uncapped, every guild starting or
 * prefetching a track at the same time spawned its own full-speed decode and they
 * all fought for the same cores — the analysis then took longer than the audio it
 * was supposed to be ready for.
 *
 * Sized from the host (a third of the CPU budget, capped) so it leaves headroom for
 * the playback ffmpeg processes, which must never be starved: a late loudness
 * measurement only costs equal-loudness on one track, while a starved decoder is an
 * audible dropout.
 */
const measureGate = new Semaphore(limitFor(config.LOUDNESS_MAX_CONCURRENCY, resources.loudnessScans));

/**
 * Measurements in flight, keyed like the cache. Two guilds starting the SAME track
 * (a popular song, or one bot serving several rooms) would otherwise each pay for a
 * full decode — the cache only helps once the first one finishes.
 */
const inFlight = new Map<string, Promise<LoudnessStats | null>>();

/**
 * Measure a file's integrated loudness (EBU R128) with a single analysis pass of
 * ffmpeg's `loudnorm` filter. The result feeds {@link loudnormFilter} so playback
 * can apply a *linear* gain to hit {@link TARGET_I} — equal loudness across tracks
 * without the moment-to-moment pumping a single-pass dynamic loudnorm causes.
 *
 * Returns null if measurement fails (then playback simply skips normalization).
 * Cached on disk, deduplicated in flight, and rate-limited by {@link measureGate}.
 */
export async function measureLoudness(filePath: string, cacheIdentity?: string): Promise<LoudnessStats | null> {
    ensureLoaded();
    const key = cacheIdentity ?? cacheKey(filePath);
    const hit = cache.get(key);
    if (hit !== undefined) return hit;

    const running = inFlight.get(key);
    if (running) return running;

    const job = measureGate
        .run(async () => {
            // Re-check inside the gate: while queued, another waiter may have finished
            // this exact file and filled the cache.
            const cached = cache.get(key);
            if (cached !== undefined) return cached;
            const stats = await runMeasurement(filePath);
            cache.set(key, stats);
            persist(); // a new measurement is expensive (~1s/min) — never lose it to a restart
            return stats;
        })
        .finally(() => inFlight.delete(key));

    inFlight.set(key, job);
    return job;
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
/**
 * The level TIDAL's `replayGain` values sit at, measured — not assumed.
 *
 * Across 10 tracks (spanning loud pop, metal and solo cello), `replayGain +
 * measuredI` averaged -19.30 LUFS (median -19.20, sd 1.99). Applying the gain
 * therefore lands a track near -19.3, and the extra offset to {@link TARGET_I} is
 * what {@link replayGainFilter} adds.
 */
export const TIDAL_REPLAYGAIN_REFERENCE = -19.3;

/**
 * A provisional constant gain from TIDAL's metadata, for the window where playback
 * has started but no file exists to measure yet.
 *
 * Read this before relying on it: TIDAL's `replayGain` is NOT a standard ReplayGain.
 * Regressed against EBU R128 integrated loudness over 10 tracks it has a slope of
 * **-0.47**, where a true ReplayGain would be -1.00 (r = -0.79, R² = 0.62). It
 * therefore corrects only about half the deviation — measured, it narrows the spread
 * across those tracks from 11.4 dB to 6.8 dB rather than flattening it.
 *
 * So: better than raw, clearly worse than {@link loudnormFilter}, and only ever a
 * stopgap until the real measurement lands. Do not use it when a file is available.
 *
 * A fitted two-parameter correction would roughly halve the residual, but ten
 * samples is not enough to bake those constants into playback — the vendor's own
 * value applied as intended is the defensible choice.
 */
export function replayGainFilter(replayGain: number | null, peak: number | null): string | null {
    if (replayGain == null || !Number.isFinite(replayGain)) return null;

    let gain = replayGain + (TARGET_I - TIDAL_REPLAYGAIN_REFERENCE);

    // Never push the signal into the true-peak ceiling. `peak` is a normalised SAMPLE
    // peak, and inter-sample peaks can sit ~1 dB above it, so reserve that on top of
    // TARGET_TP rather than spending the whole headroom.
    if (peak != null && peak > 0 && Number.isFinite(peak)) {
        const peakDb = 20 * Math.log10(peak);
        gain = Math.min(gain, TARGET_TP - 1 - peakDb);
    }

    // A gain this small is not worth an extra filter in the chain.
    if (Math.abs(gain) < 0.1) return null;
    return `volume=${gain.toFixed(2)}dB`;
}

export function loudnormFilter(stats: LoudnessStats): string {
    return (
        `loudnorm=I=${TARGET_I}:TP=${TARGET_TP}:LRA=${TARGET_LRA}` +
        `:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}` +
        `:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}` +
        `:offset=${stats.target_offset}:linear=true`
    );
}
