import type { KeyInfo } from "./key";
import { createLogger } from "./logger";

/**
 * Musical key detection via essentia.js (the MTG's WASM build of Essentia — the
 * extractor behind AcousticBrainz). Benchmarked against our hand-rolled
 * Krumhansl detector on 43 cached tracks: ours showed a strong A-minor ("8A")
 * bias at low confidence where essentia disagreed at high strength — so essentia
 * is the primary key source and the local detector is the fallback (see
 * detectBeatGrid). BPM stays on aubio (93% agreement, faster).
 *
 * The WASM module is loaded lazily on first use and kept as a singleton. Any
 * load/analysis failure returns null so the caller can fall back — key detection
 * must never break the analysis pipeline.
 */

const log = createLogger("KeyEss");

/** essentia.js instance (lazy singleton), or null after a failed load. */
let instance: unknown | null | undefined;

interface EssentiaLike {
    arrayToVector(a: Float32Array): { delete(): void };
    KeyExtractor(v: unknown): { key: string; scale: string; strength: number };
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
        log.info("essentia.js key extractor ready (WASM).");
    } catch (err) {
        instance = null;
        log.warn(`essentia.js unavailable — falling back to local key detection: ${(err as Error).message}`);
    }
    return instance as EssentiaLike | null;
}

// Pitch class → Camelot (same wheel as key.ts; essentia may emit flats).
const PC: Record<string, number> = {
    C: 0,
    "C#": 1,
    Db: 1,
    D: 2,
    "D#": 3,
    Eb: 3,
    E: 4,
    F: 5,
    "F#": 6,
    Gb: 6,
    G: 7,
    "G#": 8,
    Ab: 8,
    A: 9,
    "A#": 10,
    Bb: 10,
    B: 11,
};
const CAMELOT_MAJOR = ["8B", "3B", "10B", "5B", "12B", "7B", "2B", "9B", "4B", "11B", "6B", "1B"];
const CAMELOT_MINOR = ["5A", "12A", "7A", "2A", "9A", "4A", "11A", "6A", "1A", "8A", "3A", "10A"];

/**
 * Detect the key of mono 44.1kHz PCM via essentia's KeyExtractor, or null when
 * essentia isn't available / the result is unusable (caller falls back).
 */
export async function detectKeyEssentia(samples: Float32Array): Promise<KeyInfo | null> {
    const essentia = await getEssentia();
    if (!essentia) return null;
    let vec: { delete(): void } | null = null;
    try {
        vec = essentia.arrayToVector(samples);
        const r = essentia.KeyExtractor(vec);
        const pc = PC[r.key];
        if (pc === undefined || !(r.strength > 0)) return null;
        const camelot = r.scale === "major" ? CAMELOT_MAJOR[pc]! : CAMELOT_MINOR[pc]!;
        return { name: `${r.key} ${r.scale}`, camelot, confidence: r.strength };
    } catch (err) {
        log.debug(`KeyExtractor failed: ${(err as Error).message}`);
        return null;
    } finally {
        // WASM heap memory is manual — leaking vectors would grow the heap forever.
        vec?.delete();
    }
}
