import { createLogger } from "./logger";

const log = createLogger("Tempo");

/**
 * BPM detection via aubio (WASM). aubio's onset/spectral-flux tempo tracker is far
 * less prone to the 2× / half-time errors that music-tempo (Beatroot) makes on
 * busy material — e.g. it reports an 83 BPM track as 83, not 164. We use it purely
 * for the *tempo number*; beat positions still come from music-tempo.
 *
 * The WASM module is initialised once, lazily, and cached. If init ever fails
 * (e.g. WASM unavailable), {@link detectTempoAubio} returns null and the caller
 * falls back to music-tempo's estimate — so this is a strict upgrade, never a
 * regression.
 */

interface AubioTempo {
    do(buffer: Float32Array): number;
    getBpm(): number;
    getConfidence(): number;
}
interface AubioModule {
    Tempo: new (bufferSize: number, hopSize: number, sampleRate: number) => AubioTempo;
}

const WIN = 1024;
const HOP = 512;

let modulePromise: Promise<AubioModule | null> | null = null;

/** Lazily load + init the aubio WASM module once. Returns null if it can't load. */
async function getAubio(): Promise<AubioModule | null> {
    if (!modulePromise) {
        modulePromise = (async () => {
            try {
                // aubiojs exports an async factory (CJS default or the namespace itself,
                // depending on interop). Probe for whichever is callable.
                const mod: unknown = await import("aubiojs");
                const asAny = mod as { default?: unknown };
                const factory = (typeof mod === "function" ? mod : asAny.default) as
                    | ((init?: unknown) => Promise<AubioModule>)
                    | undefined;
                if (typeof factory !== "function") throw new Error("aubiojs has no callable export");
                const instance = await factory();
                log.info("aubio tempo detector ready (WASM).");
                return instance;
            } catch (err) {
                log.warn(`aubio unavailable, falling back to music-tempo: ${(err as Error).message}`);
                return null;
            }
        })();
    }
    return modulePromise;
}

export interface TempoResult {
    bpm: number;
    confidence: number;
}

/**
 * Estimate the tempo of a mono PCM segment with aubio. Feeds the signal hop-by-hop
 * through the tracker (its streaming model), then reads the settled BPM. Returns
 * null when aubio isn't available or the read is non-finite.
 */
export async function detectTempoAubio(samples: Float32Array, sampleRate: number): Promise<TempoResult | null> {
    const aubio = await getAubio();
    if (!aubio) return null;
    try {
        const tempo = new aubio.Tempo(WIN, HOP, sampleRate);
        for (let i = 0; i + HOP <= samples.length; i += HOP) {
            tempo.do(samples.subarray(i, i + HOP));
        }
        const bpm = tempo.getBpm();
        if (!Number.isFinite(bpm) || bpm <= 0) return null;
        return { bpm, confidence: tempo.getConfidence() };
    } catch (err) {
        log.debug(`aubio tempo failed: ${(err as Error).message}`);
        return null;
    }
}
