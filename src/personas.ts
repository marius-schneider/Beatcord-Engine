// DJ personas + the Set Engine arc — four resident DJs, each with a different
// philosophy for how a whole evening should breathe. A persona shapes TWO
// things:
//
//   1. the ENERGY ARC across the whole set (shape + peak height + how it eases
//      down) — the difference between "next song" and "build me a 3-hour night
//      with a warm-up, a peak, and a comedown";
//   2. how the NEXT track is CHOSEN — which forces it weights (energy match,
//      harmonic flow, DNA continuity, its own fitness, vocals, memory, novelty).
//
// Same track library, four very different nights. All pure + testable.

import type { TrackDNA } from "./dna";

export type PersonaId = "festival" | "club" | "lounge" | "radio";
export type SetPhase = "warmup" | "build" | "peak" | "cooldown";

export interface PersonaWeights {
    energy: number; // match the arc's target energy
    dance: number; // match the target danceability
    harmonic: number; // Camelot smoothness with the current track
    genome: number; // overall DNA continuity (feels like a continuation)
    fit: number; // the persona's own fitness score (festivalFit, clubFit, …)
    vocal: number; // pull toward the persona's vocal preference
    memory: number; // per-user pair affinity (what worked before)
    adventure: number; // reward novelty (a little DNA distance)
}

export interface Persona {
    id: PersonaId;
    name: string;
    blurb: string;
    floorEnergy: number; // warm-up energy
    peakEnergy: number; // energy at the peak
    tailEnergy: number; // where the cooldown lands
    /** Phase boundaries as fractions of the whole set (ascending). */
    arc: { warmup: number; build: number; peak: number };
    vocalPref: number; // 0 avoid vocals … 1 vocal-forward
    fitKey: "festivalFit" | "clubFit" | "loungeFit" | "radioFit";
    breather: number; // 0..1 how much the peak dips recurrently to let the floor breathe
    weights: PersonaWeights;
}

export const PERSONAS: Record<PersonaId, Persona> = {
    festival: {
        id: "festival",
        name: "Festival",
        blurb: "Große Hände-hoch-Momente, Anthems, harte Drops.",
        floorEnergy: 0.55,
        peakEnergy: 0.97,
        tailEnergy: 0.6,
        arc: { warmup: 0.12, build: 0.4, peak: 0.85 },
        vocalPref: 0.7,
        fitKey: "festivalFit",
        breather: 0.1,
        weights: {
            energy: 2.2,
            dance: 0.9,
            harmonic: 0.9,
            genome: 1.0,
            fit: 1.6,
            vocal: 0.7,
            memory: 1.0,
            adventure: 0.5,
        },
    },
    club: {
        id: "club",
        name: "Club",
        blurb: "Durchgehender Groove, tiefe, tighte Mixe, wenig Vocals.",
        floorEnergy: 0.45,
        peakEnergy: 0.9,
        tailEnergy: 0.5,
        arc: { warmup: 0.18, build: 0.45, peak: 0.85 },
        vocalPref: 0.3,
        fitKey: "clubFit",
        breather: 0.08,
        weights: {
            energy: 1.8,
            dance: 1.3,
            harmonic: 1.6,
            genome: 1.4,
            fit: 1.3,
            vocal: 0.6,
            memory: 1.1,
            adventure: 0.3,
        },
    },
    lounge: {
        id: "lounge",
        name: "Lounge",
        blurb: "Warm, tief, entspannt — kein Drop, nie lauter als schoen.",
        floorEnergy: 0.25,
        peakEnergy: 0.5,
        tailEnergy: 0.22,
        arc: { warmup: 0.2, build: 0.5, peak: 0.8 },
        vocalPref: 0.6,
        fitKey: "loungeFit",
        breather: 0.03,
        weights: {
            energy: 2.0,
            dance: 0.6,
            harmonic: 1.2,
            genome: 1.5,
            fit: 1.5,
            vocal: 0.6,
            memory: 0.9,
            adventure: 0.3,
        },
    },
    radio: {
        id: "radio",
        name: "Radio",
        blurb: "Hits, viel Abwechslung, Vocal-forward, schnelle Wechsel.",
        floorEnergy: 0.5,
        peakEnergy: 0.82,
        tailEnergy: 0.5,
        arc: { warmup: 0.15, build: 0.45, peak: 0.8 },
        vocalPref: 0.85,
        fitKey: "radioFit",
        breather: 0.06,
        weights: {
            energy: 1.4,
            dance: 0.9,
            harmonic: 0.7,
            genome: 0.8,
            fit: 1.5,
            vocal: 1.3,
            memory: 0.8,
            adventure: 0.9,
        },
    },
};

export const DEFAULT_PERSONA: PersonaId = "club";

export function persona(id: PersonaId | string | undefined): Persona {
    return PERSONAS[id as PersonaId] ?? PERSONAS[DEFAULT_PERSONA];
}

// ── the Set Engine arc (pure math) ──

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** Smoothstep easing — no kinks at the phase joins. */
const ease = (k: number) => {
    const t = clamp01(k);
    return t * t * (3 - 2 * t);
};

/** Which phase a fractional set position (0..1) lands in for this persona. */
export function phaseAt(p: Persona, progress: number): SetPhase {
    const t = clamp01(progress);
    if (t < p.arc.warmup) return "warmup";
    if (t < p.arc.build) return "build";
    if (t < p.arc.peak) return "peak";
    return "cooldown";
}

/**
 * Target energy at a fractional set position (0..1): ramp up through warm-up +
 * build, hold near peak (with a gentle recurring breather so the floor can
 * breathe), then ease down through the cooldown. `wobble` (0..1) drives only
 * the peak breather; the caller derives it from elapsed time.
 */
export function targetEnergyAt(p: Persona, progress: number, wobble = 0): number {
    const t = clamp01(progress);
    const { warmup, build, peak } = p.arc;
    const midWarm = p.floorEnergy + (p.peakEnergy - p.floorEnergy) * 0.4;
    if (t < warmup) {
        return lerp(p.floorEnergy, midWarm, ease(warmup <= 0 ? 1 : t / warmup));
    }
    if (t < build) {
        return lerp(midWarm, p.peakEnergy * 0.97, ease((t - warmup) / Math.max(1e-6, build - warmup)));
    }
    if (t < peak) {
        const dip = p.breather * Math.max(0, Math.sin(wobble * Math.PI * 2)) * 0.5;
        return clamp01(p.peakEnergy - dip);
    }
    return lerp(p.peakEnergy, p.tailEnergy, ease((t - peak) / Math.max(1e-6, 1 - peak)));
}

export interface SetTarget {
    energy: number;
    danceability: number;
    vocalness: number;
    phase: SetPhase;
}

/** The full target "feel" at a fractional set position. */
export function targetAt(p: Persona, progress: number, wobble = 0): SetTarget {
    const energy = targetEnergyAt(p, progress, wobble);
    const phase = phaseAt(p, progress);
    // Danceability tracks energy but never bottoms out.
    const danceability = clamp01(0.35 + energy * 0.55);
    // Vocals: warm-up & cooldown tolerate more; the peak leans instrumental for
    // club/festival, while radio stays vocal throughout (high vocalPref).
    const vocalShift = phase === "peak" ? -0.15 : phase === "warmup" || phase === "cooldown" ? 0.1 : 0;
    const vocalness = clamp01(p.vocalPref + vocalShift);
    return { energy, danceability, vocalness, phase };
}

/**
 * Persona-weighted fit of one candidate to the current set target. Higher is
 * better; the scale is arbitrary (only ordering matters). Pure + testable.
 */
export function scoreForSet(
    p: Persona,
    target: SetTarget,
    dna: TrackDNA | null,
    harmonic: number, // 0..1 Camelot compatibility with current track
    genomeSim: number, // 0..1 overall DNA similarity
    memory: number, // 0..1 per-user pair affinity (0.5 = neutral/unknown)
): number {
    const w = p.weights;
    if (!dna) {
        // Unknown candidate — lean on harmonic flow + memory, with a penalty so
        // an analyzed candidate is preferred when one exists.
        return harmonic * w.harmonic + memory * w.memory - 0.3;
    }
    const energyScore = 1 - Math.abs(dna.energy - target.energy);
    const danceScore = 1 - Math.abs(dna.danceability - target.danceability);
    const vocalScore = 1 - Math.abs(dna.vocalness - target.vocalness);
    const fitScore = dna[p.fitKey];
    // Adventure rewards a touch of DNA distance (novelty) rather than sameness.
    const genomeTerm = genomeSim * w.genome + (1 - genomeSim) * w.adventure * 0.4;
    return (
        energyScore * w.energy +
        danceScore * w.dance +
        vocalScore * w.vocal +
        fitScore * w.fit +
        harmonic * w.harmonic +
        genomeTerm +
        memory * w.memory
    );
}
