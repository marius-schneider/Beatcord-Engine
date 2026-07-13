import { createLogger } from "./logger";

/**
 * High-level music descriptors via essentia.js (the same MTG WASM build used for key
 * detection in {@link detectKeyEssentia}). Right now: **danceability** — Essentia's
 * Detrended-Fluctuation-Analysis estimate of how danceable a track is (0–3, higher =
 * more danceable). It's a pure algorithm in the installed build, so no extra model or
 * TensorFlow dependency.
 *
 * Measured on real tracks (Ambient/Dance/Pop/Ballad): ranks musically (dance > … >
 * ballad) and is stable across windows for steady tracks but varies with a track's
 * build (intro vs. drop) — so the worker averages it over the segments it already
 * decodes rather than trusting a single window. ~mid-100ms per call in the worker.
 *
 * Like the key extractor, this loads the WASM module lazily as a singleton and returns
 * null on any failure, so a missing/broken essentia can never break analysis.
 */

const log = createLogger("Descriptors");

/** essentia.js instance (lazy singleton), or null after a failed load. */
let instance: unknown | null | undefined;

interface EssentiaLike {
    arrayToVector(a: Float32Array): { delete(): void };
    Danceability(
        signal: unknown,
        maxTau?: number,
        minTau?: number,
        sampleRate?: number,
        tauMultiplier?: number,
    ): { danceability: number };
}

async function getEssentia(): Promise<EssentiaLike | null> {
    if (instance !== undefined) return instance as EssentiaLike | null;
    try {
        const esPkg = (await import("essentia.js")) as unknown as {
            default?: { Essentia: new (w: unknown) => unknown; EssentiaWASM: unknown };
            Essentia?: new (w: unknown) => unknown;
            EssentiaWASM?: unknown;
        };
        const pkg = esPkg.default ?? esPkg;
        instance = new pkg.Essentia!(pkg.EssentiaWASM);
        log.info("essentia.js descriptors ready (WASM).");
    } catch (err) {
        instance = null;
        log.warn(`essentia.js unavailable — danceability disabled: ${(err as Error).message}`);
    }
    return instance as EssentiaLike | null;
}

/**
 * Danceability (0–3, higher = more danceable) of a mono 44.1kHz PCM segment, or null
 * when essentia isn't available / the result is unusable (caller degrades gracefully).
 */
export async function detectDanceability(samples: Float32Array): Promise<number | null> {
    const essentia = await getEssentia();
    if (!essentia) return null;
    let vec: { delete(): void } | null = null;
    try {
        vec = essentia.arrayToVector(samples);
        const { danceability } = essentia.Danceability(vec, 8800, 310, 44_100);
        // Guard against NaN/negatives from a degenerate segment.
        return danceability >= 0 ? danceability : null;
    } catch (err) {
        log.debug(`Danceability failed: ${(err as Error).message}`);
        return null;
    } finally {
        // WASM heap memory is manual — leaking vectors would grow the heap forever.
        vec?.delete();
    }
}
