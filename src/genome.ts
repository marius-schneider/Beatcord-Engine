// DJ Genome — every track as a normalized feature vector (its "DNA"), so the
// director can pick the next track by SIMILARITY OF FEEL, not just matching
// BPM. This is the leap from "same tempo" to "same vibe": two 128-BPM tracks
// with different brightness, drive, and danceability are far apart in genome
// space, and the director hears that.
//
// The vector is built from the analysis that already runs on every track
// (energy, danceability, percussiveness, spectral timbre, genre, tempo). New
// dimensions (groove, emotion) plug in here as they come online.

import type { GenreHint } from "./genre";

import type { AnalysisRecord } from "./prefetch";

/** Ordered, human-readable genome dimensions (for logging / debugging). */
export const GENOME_DIMS = [
    "tempo",
    "energy",
    "danceability",
    "drive", // percussiveness
    "brightness", // spectral centroid
    "air", // spectral rolloff
    "texture", // spectral flatness (tonal ↔ noisy/synthetic)
    "motion", // spectral flux
    "g_edm",
    "g_hiphop",
    "g_pop",
    "g_chill",
    "groove", // swing feel (0.5 straight ↔ 0.66 shuffle)
] as const;

/** Per-dimension weights — what matters most for "does this fit right now". */
const WEIGHTS = [1.0, 1.4, 1.3, 1.1, 1.0, 0.7, 0.8, 0.7, 0.9, 0.9, 0.6, 0.9, 1.1];

const norm = (v: number, lo: number, hi: number) => Math.min(1, Math.max(0, (v - lo) / (hi - lo)));

function genreOneHot(g: GenreHint): [number, number, number, number] {
    return [g === "edm" ? 1 : 0, g === "hiphop" ? 1 : 0, g === "pop" ? 1 : 0, g === "chill" ? 1 : 0];
}

/**
 * Build a track's genome vector (all dims in 0..1). Returns null when the track
 * has no beat grid yet (can't be placed in genome space).
 */
export function trackVector(rec: AnalysisRecord | undefined): number[] | null {
    const g = rec?.grid;
    if (!g) return null;
    const s = g.spectral;
    const [edm, hip, pop, chill] = genreOneHot(rec.genre);
    return [
        norm(g.bpm, 70, 140),
        Math.min(1, Math.max(0, g.energy.energy)),
        Math.min(1, (g.energy.danceability ?? 1.5) / 3),
        Math.min(1, Math.max(0, g.energy.percussiveness)),
        norm(s.centroid, 800, 5000),
        norm(s.rolloff, 1000, 12000),
        Math.min(1, s.flatness * 5),
        norm(s.flux, 0, 0.4),
        edm,
        hip,
        pop,
        chill,
        // Groove: map swing [0.5..0.7] → [0..1]; straight when unknown.
        Math.min(1, Math.max(0, ((rec.groove?.swing ?? 0.5) - 0.5) / 0.2)),
    ];
}

/**
 * Similarity of two genome vectors in 0..1 (1 = identical DNA). Weighted RMS
 * distance mapped to a similarity — interpretable and stable on [0,1] features
 * (cosine would ignore magnitude, which is exactly the "feel" we care about).
 */
export function genomeSimilarity(a: number[] | null, b: number[] | null): number {
    if (!a || !b || a.length !== b.length) return 0.5; // unknown → neutral
    let acc = 0;
    let wsum = 0;
    for (let i = 0; i < a.length; i++) {
        const w = WEIGHTS[i] ?? 1;
        const d = a[i]! - b[i]!;
        acc += w * d * d;
        wsum += w;
    }
    const rms = Math.sqrt(acc / wsum);
    return Math.min(1, Math.max(0, 1 - rms));
}
