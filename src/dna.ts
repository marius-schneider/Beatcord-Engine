// Song-DNA — a rich, human-readable descriptor of a track's *feel*, derived
// entirely from the analysis we already run (beat grid, spectral timbre,
// energy, groove, genre, structure). No extra decode.
//
// Where the genome vector (genome.ts) is a compact numeric fingerprint for
// similarity math, the DNA is the interpretable layer the Set Engine and the
// DJ personas reason over: mood, density, singalong potential, festival/club/
// lounge/radio fitness, best time of day. New physical signals (stem-based
// vocal probability, learned valence) refine these estimates as they come
// online; the shape stays stable. Everything here is pure and testable.

import type { GenreHint } from "./genre";

import type { AnalysisRecord } from "./prefetch";

export type TimeOfDay = "afternoon" | "sundown" | "primetime" | "afterhours";

export interface TrackDNA {
    tempo: number; // bpm (raw)
    energy: number; // 0..1 overall energy
    intensity: number; // 0..1 punch = energy × drive × density
    danceability: number; // 0..1
    drive: number; // 0..1 percussive push
    density: number; // 0..1 how full / busy the arrangement is
    brightness: number; // 0..1 spectral centroid
    air: number; // 0..1 top-end extension
    warmth: number; // 0..1 low-mid weight (inverse brightness)
    organic: number; // 0..1 tonal/acoustic ↔ 0 synthetic/noisy
    groove: number; // 0..1 swing (0 straight → 1 hard shuffle)
    mood: number; // 0..1 valence (dark/moody → bright/euphoric)
    vocalness: number; // 0..1 how vocal-forward
    singalong: number; // 0..1 anthemic mitsing potential
    hasDrop: boolean; // a real energy drop somewhere in the track
    // "Eignung" — 0..1 fitness for each setting.
    festivalFit: number;
    clubFit: number;
    loungeFit: number;
    radioFit: number;
    timeOfDay: TimeOfDay;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const norm = (v: number, lo: number, hi: number) => clamp01((v - lo) / (hi - lo));
const inBand = (v: number, lo: number, hi: number) => (v >= lo && v <= hi ? 1 : 0);

/** Major keys read brighter/happier than minor — a Camelot 'B' suffix = major. */
function isMajor(camelot: string | undefined): boolean {
    return !!camelot && /b$/i.test(camelot);
}

/** Vocal-forwardness from genre + timbre (no stem probe needed). */
function estimateVocalness(genre: GenreHint, danceability: number, organic: number): number {
    // Pop/hip-hop are vocal-centric; EDM the least, chill in between.
    const base = genre === "pop" ? 0.72 : genre === "hiphop" ? 0.66 : genre === "chill" ? 0.42 : 0.34;
    // Vocal music tends to be more tonal (organic) and mid-danceable.
    return clamp01(base * 0.78 + organic * 0.16 + (danceability > 0.4 ? 0.06 : 0));
}

/**
 * Build a track's DNA. Returns null when there's no beat grid yet (nothing to
 * derive from). Stem-based `vocalActivity` refines vocalness when present.
 */
export function trackDNA(rec: AnalysisRecord | undefined): TrackDNA | null {
    const g = rec?.grid;
    if (!g) return null;
    const s = g.spectral;
    const genre = rec.genre;

    const energy = clamp01(g.energy.energy);
    const drive = clamp01(g.energy.percussiveness);
    const danceability = clamp01((g.energy.danceability ?? 1.5) / 3);
    const brightness = norm(s.centroid, 800, 5000);
    const air = norm(s.rolloff, 1000, 12000);
    const warmth = clamp01(1 - brightness);
    const organic = clamp01(1 - Math.min(1, s.flatness * 5));
    const flux = norm(s.flux, 0, 0.4);
    const density = clamp01(0.42 * drive + 0.33 * flux + 0.25 * energy);
    const groove = clamp01(((rec.groove?.swing ?? 0.5) - 0.5) / 0.2);
    const mood = clamp01(
        0.28 + (isMajor(g.key.camelot) ? 0.22 : 0) + brightness * 0.22 + energy * 0.2 + danceability * 0.08,
    );
    const vocalness = estimateVocalness(genre, danceability, organic);
    const intensity = clamp01(0.5 * energy + 0.3 * drive + 0.2 * density);
    const hasDrop = !!rec.sections?.some((x) => x.kind === "drop");
    const singalong = clamp01(
        vocalness * 0.55 + (genre === "pop" || genre === "hiphop" ? 0.2 : 0) + mood * 0.15 + energy * 0.1,
    );

    const bpm = g.bpm;
    const festivalFit = clamp01(
        energy * 0.34 +
            danceability * 0.18 +
            (hasDrop ? 0.14 : 0) +
            inBand(bpm, 122, 140) * 0.16 +
            singalong * 0.1 +
            brightness * 0.08,
    );
    const clubFit = clamp01(
        drive * 0.3 + danceability * 0.24 + inBand(bpm, 118, 132) * 0.2 + (1 - vocalness) * 0.16 + density * 0.1,
    );
    const loungeFit = clamp01(
        (1 - energy) * 0.36 + warmth * 0.22 + organic * 0.2 + (bpm < 112 ? 0.14 : 0) + (1 - drive) * 0.08,
    );
    const radioFit = clamp01(
        vocalness * 0.32 +
            singalong * 0.26 +
            (genre === "pop" ? 0.16 : 0) +
            inBand(energy, 0.45, 0.82) * 0.18 +
            mood * 0.08,
    );

    const timeOfDay: TimeOfDay =
        energy < 0.42 ? "afternoon" : energy < 0.62 ? "sundown" : energy < 0.83 ? "primetime" : "afterhours";

    return {
        tempo: bpm,
        energy,
        intensity,
        danceability,
        drive,
        density,
        brightness,
        air,
        warmth,
        organic,
        groove,
        mood,
        vocalness,
        singalong,
        hasDrop,
        festivalFit,
        clubFit,
        loungeFit,
        radioFit,
        timeOfDay,
    };
}
