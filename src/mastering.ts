import { config } from "./config";
import type { GenreHint } from "./genre";

/**
 * Genre-aware "mastering" filter chain (ffmpeg). Sits AFTER loudnorm and BEFORE
 * the final resample + safety limiter, so every track gets a light, genre-tuned
 * polish on top of equal-loudness:
 *
 *  - `crossfeed` on everything — blends a little of each channel into the other,
 *    taming the fatiguing hard stereo separation that headphones (how most people
 *    hear Discord) exaggerate. The single most universally-helpful tweak.
 *  - a gentle glue `acompressor` + subtle shelving EQ tuned per genre (EDM gets
 *    air + tight lows, hip-hop gets weight, chill stays nearly untouched).
 *
 * Everything is deliberately subtle — this enhances, it shouldn't recolour. The
 * whole chain is gated by MASTERING_ENABLED and the crossfeed/tone amounts are
 * overridable from .env for taste-tuning without code changes.
 */

interface Preset {
    /** Glue compressor: [ratio, makeup dB] — gentle level evening, not pumping. */
    comp: [ratio: number, makeup: number] | null;
    /** Low-shelf gain (dB) @ ~90Hz. */
    bass: number;
    /** High-shelf gain (dB) @ ~9kHz. */
    treble: number;
    /** virtualbass cutoff (Hz, ≥100) when extra low-end body helps, else null. */
    virtualBass: number | null;
}

/** Per-genre starting points (kept gentle; verified against real tracks). */
const PRESETS: Record<GenreHint, Preset> = {
    // Bright, punchy, wide — add air + tighten the lows.
    edm: { comp: [2, 2], bass: 1.5, treble: 2, virtualBass: null },
    // Bass-forward and controlled — weight up the low end, light glue.
    hiphop: { comp: [2.5, 2], bass: 3, treble: 0.5, virtualBass: 110 },
    // Broad middle — a faint smile curve + glue.
    pop: { comp: [2, 1.5], bass: 1.5, treble: 1.5, virtualBass: null },
    // Mellow material — leave dynamics alone, just a touch of warmth.
    chill: { comp: null, bass: 1, treble: 0, virtualBass: null },
    // No genre guess — neutral, near-transparent.
    unknown: { comp: [2, 1], bass: 1, treble: 1, virtualBass: null },
};

/**
 * Build the mastering filter list for a track of the given genre. Returns [] when
 * mastering is disabled. Order within the chain: crossfeed → compressor → EQ →
 * virtual bass (stereo/headphone shaping first, then dynamics, then tone/body).
 */
export function masteringFilters(genre: GenreHint): string[] {
    if (!config.MASTERING_ENABLED) return [];

    const p = PRESETS[genre] ?? PRESETS.unknown;
    const filters: string[] = [];

    // 1) Headphone crossfeed (skip if explicitly zeroed).
    if (config.MASTERING_CROSSFEED > 0) {
        filters.push(`crossfeed=strength=${config.MASTERING_CROSSFEED.toFixed(2)}`);
    }

    // 2) Gentle glue compression (genre-dependent).
    if (p.comp) {
        const [ratio, makeup] = p.comp;
        filters.push(`acompressor=threshold=-18dB:ratio=${ratio}:attack=15:release=250:makeup=${makeup}`);
    }

    // 3) Shelving EQ: preset + the global .env tilt, clamped to a sane range.
    const bass = clampDb(p.bass + config.MASTERING_BASS);
    const treble = clampDb(p.treble + config.MASTERING_TREBLE);
    if (Math.abs(bass) >= 0.1) filters.push(`bass=g=${bass.toFixed(1)}:f=90`);
    if (Math.abs(treble) >= 0.1) filters.push(`treble=g=${treble.toFixed(1)}:f=9000`);

    // 4) Virtual bass for genres that benefit from extra low-end body on small
    //    speakers (cutoff must be ≥100Hz per ffmpeg).
    if (p.virtualBass) filters.push(`virtualbass=cutoff=${p.virtualBass}:strength=2`);

    return filters;
}

/** Keep a shelf gain within ±6 dB so a bad override can't wreck the sound. */
function clampDb(db: number): number {
    return Math.min(6, Math.max(-6, db));
}
