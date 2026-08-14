const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const round = (v: number) => Math.round(v * 1000) / 1000;

export type ClubPhase =
    | "warmup"
    | "groove-lock"
    | "build"
    | "lift"
    | "peak"
    | "release"
    | "reset"
    | "second-build"
    | "finale";
export const CLUB_PERFORMANCE_ARC: Record<ClubPhase, { intensity: number; style: string }> = {
    warmup: { intensity: 0.2, style: "subtle-blend" },
    "groove-lock": { intensity: 0.4, style: "long-phrase-mix" },
    build: { intensity: 0.55, style: "layering" },
    lift: { intensity: 0.7, style: "impact-build" },
    peak: { intensity: 0.9, style: "adaptive-impact" },
    release: { intensity: 0.35, style: "clean-decompression" },
    reset: { intensity: 0.15, style: "low-complexity" },
    "second-build": { intensity: 0.65, style: "layering" },
    finale: { intensity: 0.8, style: "controlled-finale" },
};

export interface ProtectedMoment {
    start: number;
    end: number;
    type: "drop" | "build" | "payoff";
    importance: number;
    overlayTolerance: number;
}
export function protectMoment(
    moment: ProtectedMoment,
    overlayIntensity: number,
    intentionalReplacement: boolean,
): { allowed: boolean; reason: string } {
    const allowed = intentionalReplacement || overlayIntensity <= moment.overlayTolerance || moment.importance < 0.5;
    return {
        allowed,
        reason: allowed
            ? intentionalReplacement
                ? "intentional-drop-swap"
                : "within-overlay-tolerance"
            : `protect-${moment.type}`,
    };
}

export interface DropSwapRequirements {
    barLock: number;
    phraseLock: number;
    energyCompatibility: number;
    dropConfidence: number;
    latencyReadiness: number;
}
export function dropSwapReadiness(r: DropSwapRequirements): number {
    return round(Math.min(...Object.values(r).map(clamp01)));
}
export function doubleDropDecision(
    input: DropSwapRequirements & {
        harmonic: number;
        rhythmic: number;
        bassManagement: number;
        arrangement: number;
        stems: number;
        minutesSinceLast: number;
    },
): { allowed: boolean; risk: number; cooldownMinutes: number } {
    const readiness = Math.min(
        dropSwapReadiness(input),
        input.harmonic,
        input.rhythmic,
        input.bassManagement,
        input.arrangement,
        input.stems,
    );
    const cooldownMinutes = 45;
    return {
        allowed: readiness >= 0.82 && input.minutesSinceLast >= cooldownMinutes,
        risk: round(1 - readiness),
        cooldownMinutes,
    };
}

export interface ClubSurprise {
    track: number;
    transition: number;
    energy: number;
    tempo: number;
    fx: number;
}
export function clubSurpriseBudget(s: ClubSurprise): { total: number; allowed: boolean } {
    const total = Object.values(s).reduce((sum, v) => sum + clamp01(v), 0);
    return { total: round(total), allowed: total <= 2.8 };
}

export interface LocalKey {
    start: number;
    end: number;
    tonic: number;
    mode: string;
    confidence: number;
    harmonicActivity: number;
}
export function localHarmonicBlend(
    outgoing: LocalKey,
    incoming: LocalKey,
    compatibility: number,
): { blendDepth: number; rejectByKey: boolean; percussiveEscape: boolean } {
    const confidence = Math.min(outgoing.confidence, incoming.confidence);
    const activity = (outgoing.harmonicActivity + incoming.harmonicActivity) / 2;
    return {
        blendDepth: round(clamp01(compatibility * confidence * activity + (1 - activity) * 0.35)),
        rejectByKey: confidence >= 0.75 && activity >= 0.65 && compatibility < 0.2,
        percussiveEscape: compatibility < 0.4 && activity < 0.35,
    };
}

export const BEATGRID_EVALUATION_GROUPS = [
    "quantized-edm",
    "house",
    "techno",
    "dnb",
    "hip-hop",
    "pop",
    "rock",
    "funk",
    "disco",
    "live-drums",
    "jazz",
    "classical",
    "ambient",
    "tempo-changes",
    "odd-meter",
    "sparse-intro",
    "acapella",
] as const;
export interface DjBeatgridMetrics {
    f1: number;
    phaseErrorMs: number;
    downbeatError: number;
    barContinuity: number;
    tempoDriftError: number;
    gridJumpCount: number;
    phraseAlignmentError: number;
    transitionWindowAccuracy: number;
    catastrophicGridErrorRate: number;
}
export function assessDjBeatgrid(metrics: DjBeatgridMetrics): { djReady: boolean; f1Sufficient: false; score: number } {
    const score =
        metrics.f1 * 0.12 +
        (1 - clamp01(metrics.phaseErrorMs / 50)) * 0.14 +
        (1 - metrics.downbeatError) * 0.12 +
        metrics.barContinuity * 0.14 +
        (1 - metrics.tempoDriftError) * 0.12 +
        (1 - clamp01(metrics.gridJumpCount / 3)) * 0.1 +
        (1 - metrics.phraseAlignmentError) * 0.1 +
        metrics.transitionWindowAccuracy * 0.06;
    return {
        djReady: metrics.catastrophicGridErrorRate <= 0.005 && score >= 0.82,
        f1Sufficient: false,
        score: round(clamp01(score)),
    };
}

export function calibrateGridConfidence(
    rows: readonly { genre: string; confidence: number; correct: boolean }[],
): Record<string, { reliabilityGap: number; count: number }> {
    return Object.fromEntries(
        [...new Set(rows.map((r) => r.genre))].map((genre) => {
            const items = rows.filter((r) => r.genre === genre);
            const predicted = items.reduce((s, r) => s + r.confidence, 0) / items.length;
            const observed = items.filter((r) => r.correct).length / items.length;
            return [genre, { reliabilityGap: round(Math.abs(predicted - observed)), count: items.length }];
        }),
    );
}

export interface BeatGridDelta {
    beatOffsetsMs: Record<number, number>;
    confidence: number;
    localOnly: true;
}
export interface DualBeatGrid<T> {
    offlineReference: T;
    runtimeCorrection: BeatGridDelta;
    offlineReproducible: true;
}
export function applyRuntimeGridCorrection<T>(
    offlineReference: T,
    beatOffsetsMs: Record<number, number>,
    confidence: number,
): DualBeatGrid<T> {
    return {
        offlineReference: structuredClone(offlineReference),
        runtimeCorrection: { beatOffsetsMs: { ...beatOffsetsMs }, confidence: clamp01(confidence), localOnly: true },
        offlineReproducible: true,
    };
}

export interface SampleEvent {
    sampleIndex: bigint;
    type: "beat" | "bar" | "phrase" | "automation" | "stem-swap" | "fx" | "lighting" | "haptics";
}
export class SampleAccurateScheduler {
    readonly #events: SampleEvent[] = [];
    scheduleAtSample(event: SampleEvent): void {
        this.#events.push({ ...event });
        this.#events.sort((a, b) => (a.sampleIndex < b.sampleIndex ? -1 : 1));
    }
    due(sample: bigint): SampleEvent[] {
        return this.#events.filter((e) => e.sampleIndex <= sample).map((e) => ({ ...e }));
    }
}

export interface ClubTransitionPreview {
    clippingRisk: number;
    lowEndCollision: number;
    vocalCollision: number;
    phaseRisk: number;
    stretchRisk: number;
    stemArtifacts: number;
    loudnessJump: number;
}
export function transitionQualityGuardian(
    preview: ClubTransitionPreview,
    gridConfidence: number,
    quality: number,
): { allowed: boolean; fallback: string; failures: string[] } {
    const failures = [
        preview.clippingRisk > 0.25 && "clipping",
        preview.lowEndCollision > 0.65 && "low-end",
        preview.vocalCollision > 0.65 && "vocals",
        preview.phaseRisk > 0.4 && "phase",
        preview.stretchRisk > 0.55 && "stretch",
        preview.stemArtifacts > 0.5 && "stems",
        preview.loudnessJump > 0.35 && "loudness",
        gridConfidence < 0.55 && "grid",
        quality < 0.6 && "quality",
    ].filter((v): v is string => Boolean(v));
    const ladder = [
        "complex-stem-mix",
        "classic-eq-blend",
        "short-phrase-blend",
        "echo-reverb-exit",
        "clean-structural-cut",
        "emergency-fade",
    ];
    return {
        allowed: failures.length === 0,
        fallback: ladder[Math.min(ladder.length - 1, Math.max(0, failures.length))]!,
        failures,
    };
}

export interface ClubMixingTaste {
    preferredBlendLength: number;
    dropSwapAffinity: number;
}
export function learnClubCorrection(
    taste: ClubMixingTaste,
    correction: "skip-long-transition" | "like-drop-swap",
): ClubMixingTaste {
    return correction === "skip-long-transition"
        ? { ...taste, preferredBlendLength: round(clamp01(taste.preferredBlendLength - 0.08)) }
        : { ...taste, dropSwapAffinity: round(clamp01(taste.dropSwapAffinity + 0.06)) };
}
export interface ClubTransitionHistory {
    type: string;
    tracks: [string, string];
    context: string;
    predictedQuality: number;
    observedFeedback: number;
    corrections: string[];
}
export function clubDebugTrace(h: ClubTransitionHistory): string[] {
    return [
        `${h.tracks[0]} -> ${h.tracks[1]}`,
        `type ${h.type}`,
        `context ${h.context}`,
        `predicted ${h.predictedQuality.toFixed(2)}`,
        `observed ${h.observedFeedback.toFixed(2)}`,
        `corrections ${h.corrections.join(",") || "none"}`,
    ];
}

export const HUMAN_AUDITION_QUESTIONS = [
    "smoother",
    "energetic",
    "natural",
    "club-preference",
    "noticed-transition",
] as const;
export const LISTENER_PANELS = ["professional-djs", "hobby-djs", "music-enthusiasts", "normal-listeners"] as const;
export const CLUB_SUCCESS_METRICS = [
    "beat-stability",
    "phrase-correctness",
    "perceived-smoothness",
    "energy-continuity",
    "impact",
    "naturalness",
    "noticeability",
    "artifact-rate",
    "crowd-response",
] as const;
export const DJ_CORPUS_SCHEMA = [
    "track-a",
    "track-b",
    "mix-output",
    "exact-alignment",
    "genre",
    "context",
    "entry",
    "exit",
    "duration",
    "tempo-movement",
] as const;
export const CLUB_ENGINE_ARCHITECTURE_V3 = [
    "track-audio",
    "multi-analyzer-rhythm",
    "dynamic-beatgrid",
    "downbeat-meter",
    "phrase-structure",
    "harmony-stem-texture",
    "moment-map",
    "transition-windows",
    "mixability-graph",
    "club-journey-director",
    "constraint-solver",
    "tempo-phase-plan",
    "eq-stem-fx-automation",
    "preview-quality-guardian",
    "sample-accurate-dsp",
    "runtime-sync-monitor",
    "rescue-engine",
    "feedback-learning",
] as const;
export const CLUB_SYNC_DIMENSIONS = [
    "tempo-map",
    "beat-phase",
    "downbeat",
    "meter",
    "phrase",
    "structure",
    "groove",
    "harmony",
    "arrangement",
    "energy",
    "journey",
    "transition-intent",
] as const;
export const CLUB_MODE_PRINCIPLE = "synchronize-only-when-it-serves-the-musical-transition" as const;
export const CLUB_RESEARCH_SOURCES = { scientificMir: 6, practicalSystems: 6, djUserExperience: 6 } as const;
