const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
export type MeterHypothesis = "2/4" | "3/4" | "4/4" | "6/8" | "compound" | "changing" | "unknown";
export interface BeatPoint {
    time: number;
    confidence: number;
}
export interface BeatHypothesis {
    id: string;
    tempo: number;
    tempoScale: 0.5 | 1 | 2;
    meter: MeterHypothesis;
    beats: BeatPoint[];
    downbeats: BeatPoint[];
    confidence: number;
    evidence: string[];
}
export interface Pulse {
    bpm: number;
    confidence: number;
}
export interface PulseHierarchy {
    tatum?: Pulse;
    beat: Pulse;
    doubleTime?: Pulse;
    halfTime?: Pulse;
    bar: Pulse;
    phrase: Pulse;
}
export function pulseHierarchy(bpm: number, confidence: number): PulseHierarchy {
    const pulse = { confidence: clamp01(confidence) };
    return {
        beat: { bpm, ...pulse },
        doubleTime: { bpm: bpm * 2, ...pulse },
        halfTime: { bpm: bpm / 2, ...pulse },
        bar: { bpm: bpm / 4, ...pulse },
        phrase: { bpm: bpm / 16, ...pulse },
    };
}
export function compatiblePulse(a: PulseHierarchy, b: PulseHierarchy): { compatible: boolean; ratio: number } {
    const candidates = [b.beat.bpm, b.halfTime?.bpm, b.doubleTime?.bpm].filter(
        (value): value is number => value !== undefined,
    );
    const best = candidates.sort((x, y) => Math.abs(x - a.beat.bpm) - Math.abs(y - a.beat.bpm))[0] ?? b.beat.bpm;
    const ratio = best / a.beat.bpm;
    return { compatible: Math.abs(ratio - 1) <= 0.04, ratio: round(ratio) };
}

export type RhythmSource =
    | "full-mix"
    | "drums"
    | "kick"
    | "snare"
    | "hi-hat"
    | "bass"
    | "vocal-onsets"
    | "harmonic-changes";
export interface RhythmEvidence {
    source: RhythmSource;
    onsetTimes: number[];
    periodicities: number[];
    accentStrength: number[];
    confidence: number;
}
export function sectionRhythmSources(section: "intro" | "drop" | "breakdown" | "other"): RhythmSource[] {
    if (section === "intro") return ["harmonic-changes", "vocal-onsets", "full-mix"];
    if (section === "drop") return ["kick", "drums", "bass"];
    if (section === "breakdown") return ["harmonic-changes", "vocal-onsets"];
    return ["full-mix", "drums", "bass"];
}
export function beatConsensus(
    evidence: readonly RhythmEvidence[],
    dispersion: number,
): { confidence: number; sources: RhythmSource[]; dispersion: number } {
    const total = evidence.reduce((sum, item) => sum + clamp01(item.confidence), 0);
    return {
        confidence: round(clamp01((total / Math.max(1, evidence.length)) * (1 - clamp01(dispersion)))),
        sources: evidence.map((item) => item.source),
        dispersion: clamp01(dispersion),
    };
}

export interface SectionBeatConfidence {
    sectionId: string;
    confidence: number;
    start: number;
    end: number;
}
export function confidenceIsland(
    sections: readonly SectionBeatConfidence[],
    minimum = 0.8,
): SectionBeatConfidence | null {
    return (
        [...sections]
            .filter((section) => section.confidence >= minimum)
            .sort((a, b) => b.confidence - a.confidence || b.end - b.start - (a.end - a.start))[0] ?? null
    );
}
export interface MixGrid {
    outgoingWindow: [number, number];
    incomingWindow: [number, number];
    precision: "transition-window-hq";
    wholeTrackPerfectRequired: false;
}
export function transitionMixGrid(outgoing: [number, number], incoming: [number, number]): MixGrid {
    return {
        outgoingWindow: outgoing,
        incomingWindow: incoming,
        precision: "transition-window-hq",
        wholeTrackPerfectRequired: false,
    };
}
export type BeatgridComputeTier = 1 | 2 | 3 | 4;
export function analysisFoveation(stage: "catalog" | "section" | "candidate" | "committed"): {
    tier: BeatgridComputeTier;
    scope: string;
} {
    return {
        catalog: { tier: 1, scope: "whole-song-quick" },
        section: { tier: 2, scope: "section-refinement" },
        candidate: { tier: 3, scope: "transition-window" },
        committed: { tier: 4, scope: "sample-transient-alignment" },
    }[stage] as { tier: BeatgridComputeTier; scope: string };
}

export type GridState = "LOCKED" | "DRIFTING" | "UNCERTAIN" | "REACQUIRING" | "FREE";
export function phaseResidual(observed: number, predicted: number): number {
    return round(observed - predicted);
}
export function classifyGridResidual(residuals: readonly number[]): GridState {
    if (!residuals.length) return "FREE";
    const average = residuals.reduce((sum, value) => sum + value, 0) / residuals.length;
    const spread = Math.max(...residuals) - Math.min(...residuals);
    const slope = residuals.length > 1 ? (residuals.at(-1)! - residuals[0]!) / (residuals.length - 1) : 0;
    if (spread > 0.06) return "REACQUIRING";
    if (Math.abs(slope) > 0.004) return "DRIFTING";
    if (Math.abs(average) > 0.03) return "UNCERTAIN";
    return "LOCKED";
}
export function spreadGridCorrection(offsetSeconds: number, upcomingBeats: number, audible: boolean): number[] {
    if (!audible) return [offsetSeconds];
    const count = Math.max(1, upcomingBeats);
    return Array.from({ length: count }, () => round(offsetSeconds / count));
}

export interface GrooveField {
    kickOffset: number[];
    snareOffset: number[];
    hatsOffset: number[];
    bassOffset: number[];
    vocalOffset: number[];
    swingRatio?: number;
}
export function groovePreservingSync(
    structuralTempo: number,
    targetTempo: number,
    groove: GrooveField,
): { tempoRatio: number; groove: GrooveField; residualPreserved: true } {
    return {
        tempoRatio: round(targetTempo / structuralTempo),
        groove: structuredClone(groove),
        residualPreserved: true,
    };
}
export function tempoDecomposition(
    structuralTempo: number,
    expressiveResidual: number,
): { total: number; structuralTempo: number; expressiveResidual: number } {
    return { total: structuralTempo + expressiveResidual, structuralTempo, expressiveResidual };
}
export interface GrooveFeatures {
    swingRatio: number;
    syncopation: number;
    kickDensity: number;
    snarePlacement: number;
    hatPattern: number;
    bassKickTiming: number;
}
export function grooveCompatibility(a: GrooveFeatures, b: GrooveFeatures): number {
    const keys = Object.keys(a) as (keyof GrooveFeatures)[];
    return round(1 - keys.reduce((sum, key) => sum + Math.abs(a[key] - b[key]), 0) / keys.length);
}
export function grooveMixStrategy(compatibility: number): "long-rhythmic-blend" | "structural-transition" {
    return compatibility >= 0.7 ? "long-rhythmic-blend" : "structural-transition";
}
export interface BridgeAxes {
    rhythmContinuity: number;
    timbreProgress: number;
    harmonicFit: number;
    targetGenreProgress: number;
}
export function multiAxisBridgeScore(axes: BridgeAxes): number {
    return round(
        clamp01(axes.rhythmContinuity) * 0.3 +
            clamp01(axes.timbreProgress) * 0.25 +
            clamp01(axes.harmonicFit) * 0.2 +
            clamp01(axes.targetGenreProgress) * 0.25,
    );
}
