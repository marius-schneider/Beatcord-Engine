export type ListenerCohort = "dj" | "casual" | "audiophile" | "accessibility";
export interface CohortPreference {
    cohort: ListenerCohort;
    candidateId: string;
    score: number;
    listeners: number;
}

export function preserveExpertDisagreement(rows: readonly CohortPreference[]): {
    winners: Partial<Record<ListenerCohort, string>>;
    disagreement: boolean;
    averageWinner: string | null;
} {
    const cohorts = [...new Set(rows.map((row) => row.cohort))];
    const winners = Object.fromEntries(
        cohorts.map((cohort) => {
            const winner = rows.filter((row) => row.cohort === cohort).sort((a, b) => b.score - a.score)[0];
            return [cohort, winner?.candidateId];
        }),
    ) as Partial<Record<ListenerCohort, string>>;
    const totals = new Map<string, { weighted: number; listeners: number }>();
    for (const row of rows) {
        const total = totals.get(row.candidateId) ?? { weighted: 0, listeners: 0 };
        total.weighted += row.score * row.listeners;
        total.listeners += row.listeners;
        totals.set(row.candidateId, total);
    }
    const averageWinner =
        [...totals].sort((a, b) => b[1].weighted / b[1].listeners - a[1].weighted / a[1].listeners)[0]?.[0] ?? null;
    return { winners, disagreement: new Set(Object.values(winners)).size > 1, averageWinner };
}

export interface PersonalizedCriticCandidate {
    id: string;
    globalQuality: number;
    userMixingPreference: number;
}
export function personalizedCritic(
    candidates: readonly PersonalizedCriticCandidate[],
    qualityFloor = 0.72,
): {
    selected: string | null;
    rejectedBelowFloor: string[];
    qualityFloorAppliedFirst: true;
} {
    const eligible = candidates.filter((candidate) => candidate.globalQuality >= qualityFloor);
    return {
        selected: [...eligible].sort((a, b) => b.userMixingPreference - a.userMixingPreference)[0]?.id ?? null,
        rejectedBelowFloor: candidates
            .filter((candidate) => candidate.globalQuality < qualityFloor)
            .map((candidate) => candidate.id),
        qualityFloorAppliedFirst: true,
    };
}

export const TRANSITION_FAILURE_TYPES = [
    "GRID",
    "PHRASE",
    "KEY",
    "VOCAL",
    "BASS",
    "TIMBRE",
    "LOUDNESS",
    "STRETCH",
    "STEM",
    "STRUCTURE",
    "ENERGY",
    "EXPERIENCE",
    "LATENCY",
    "BUFFER",
] as const;
export type TransitionFailureType = (typeof TRANSITION_FAILURE_TYPES)[number];
export interface FailureEvent {
    type: TransitionFailureType;
    genre: string;
    device: string;
    experience: string;
    fallback: boolean;
    corrected: boolean;
}

export function failureAnalytics(events: readonly FailureEvent[]): {
    total: number;
    rates: Record<TransitionFailureType, number>;
    fallbackRate: number;
    correctionRate: number;
    dimensions: { genres: string[]; devices: string[]; experiences: string[] };
} {
    const total = Math.max(1, events.length);
    const rates = Object.fromEntries(
        TRANSITION_FAILURE_TYPES.map((type) => [type, events.filter((event) => event.type === type).length / total]),
    ) as Record<TransitionFailureType, number>;
    return {
        total: events.length,
        rates,
        fallbackRate: events.filter((event) => event.fallback).length / total,
        correctionRate: events.filter((event) => event.corrected).length / total,
        dimensions: {
            genres: [...new Set(events.map((event) => event.genre))],
            devices: [...new Set(events.map((event) => event.device))],
            experiences: [...new Set(events.map((event) => event.experience))],
        },
    };
}

export interface ReliabilityMetrics {
    dropoutRate: number;
    catastrophicGridFailureRate: number;
    fallbackSuccessRate: number;
    commitMissRate: number;
}
export const RELIABILITY_SLOS = {
    dropoutRate: 0.001,
    catastrophicGridFailureRate: 0.005,
    fallbackSuccessRate: 0.995,
    commitMissRate: 0.002,
} as const;
export function reliabilitySloStatus(metrics: ReliabilityMetrics): {
    met: boolean;
    failures: string[];
    evaluatedBeforeProductMetrics: true;
} {
    const failures = [
        metrics.dropoutRate >= RELIABILITY_SLOS.dropoutRate && "audio-dropout",
        metrics.catastrophicGridFailureRate >= RELIABILITY_SLOS.catastrophicGridFailureRate && "catastrophic-grid",
        metrics.fallbackSuccessRate <= RELIABILITY_SLOS.fallbackSuccessRate && "fallback-success",
        metrics.commitMissRate >= RELIABILITY_SLOS.commitMissRate && "commit-miss",
    ].filter((value): value is string => Boolean(value));
    return { met: failures.length === 0, failures, evaluatedBeforeProductMetrics: true };
}

export function shadowEvaluation<T>(
    production: T,
    experimental: T,
    feedbackId?: string,
): {
    production: T;
    experimental: T;
    affectsPlayback: false;
    feedbackId?: string;
} {
    return { production, experimental, affectsPlayback: false, ...(feedbackId ? { feedbackId } : {}) };
}

export const GOLDEN_TRANSITION_CORPUS_V2 = [
    "perfect-house-blend",
    "bad-phase",
    "wrong-downbeat",
    "vocal-clash",
    "key-clash",
    "bass-clash",
    "live-drummer-drift",
    "large-tempo-jump",
    "beatless-intro",
    "stem-artifacts",
    "over-limited-master",
    "quiet-old-master",
    "mono-compatibility",
    "bluetooth-route",
    "buffer-starvation",
] as const;

export type ListeningStandard = "MUSHRA" | "BS.1116";
export function listeningTestDesign(
    effectSizeExpected: "large" | "small",
    candidates: readonly string[],
): {
    standard: ListeningStandard;
    blind: true;
    randomized: true;
    levelMatched: true;
    referenceHidden: true;
    anchors: boolean;
    candidates: string[];
    statistics: readonly ["confidence-intervals", "significance", "effect-sizes", "listener-reliability"];
} {
    return {
        standard: effectSizeExpected === "large" ? "MUSHRA" : "BS.1116",
        blind: true,
        randomized: true,
        levelMatched: true,
        referenceHidden: true,
        anchors: effectSizeExpected === "large",
        candidates: [...candidates],
        statistics: ["confidence-intervals", "significance", "effect-sizes", "listener-reliability"],
    };
}

export const RESEARCH_SOURCE_REGISTRY_V2 = {
    listening: ["ITU-R BS.1534", "ITU-R BS.1116"],
    realtime: ["Web Audio API", "AudioWorklet", "AVAudioEngine", "Core Audio"],
    perception: [
        "musical-mix-clarity",
        "automatic-masking-minimisation",
        "informational-masking",
        "auditory-scene-analysis",
    ],
    structure: ["functional-song-structure", "raveform", "dj-timbre-tool"],
    conversation: ["RecSys-2026", "JAM", "MuChator", "TalkPlay"],
    controlAndPrivacy: ["controllable-recommenders", "ContextPlay", "federated-recommendation"],
} as const;

export const RESEARCH_COMPLETION_AREAS = [
    "beat-downbeat-meter",
    "phrase-structure",
    "key-harmony",
    "tempo-beatmatching",
    "club-practice",
    "stems",
    "time-stretch",
    "loudness",
    "psychoacoustics",
    "transition-critic",
    "recommendation",
    "sequential-recommendation",
    "genre-graph",
    "charts-trends",
    "discovery-familiarity",
    "crowd-taste",
    "crowd-fairness",
    "crowd-mood",
    "conversational-intent",
    "user-control",
    "privacy",
    "realtime-reliability",
    "listening-tests",
] as const;

export type ResearchConfidence = "high" | "medium-high" | "experimental";
export const RESEARCH_CONFIDENCE_MAP: Record<ResearchConfidence, readonly string[]> = {
    high: [
        "sample-scheduling",
        "beat-downbeat",
        "phrase",
        "masking",
        "loudness",
        "familiarity",
        "sequential-recommendation",
        "user-control",
    ],
    "medium-high": [
        "structure-aware-transition",
        "harmonic-adaptation",
        "simulation",
        "context-taste",
        "group-fairness",
        "conversation",
    ],
    experimental: ["crowd-mood", "crowd-cohesion", "surprise-budget", "journey-world-model", "transition-naturalness"],
};

export function researchConfidence(feature: string): {
    confidence: ResearchConfidence | "unknown";
    userStudyRequired: boolean;
} {
    const confidence =
        (Object.entries(RESEARCH_CONFIDENCE_MAP) as [ResearchConfidence, readonly string[]][]).find(([, features]) =>
            features.includes(feature),
        )?.[0] ?? "unknown";
    return { confidence, userStudyRequired: confidence === "experimental" || confidence === "unknown" };
}

export const FULL_RESEARCH_ARCHITECTURE = [
    "user-crowd-intent",
    "session-contract",
    "taste-brain",
    "crowd-brain",
    "music-knowledge",
    "musical-understanding",
    "candidate-retrieval",
    "multi-objective-ranker",
    "sequence-route",
    "music-director",
    "transition-planner",
    "transition-critic",
    "rescue-engine",
    "sample-accurate-dsp",
    "runtime-quality-loop",
    "feedback",
] as const;

export const PRODUCT_INTERVENTION_PRINCIPLE = {
    objective: "understand-when-and-how-strongly-to-intervene",
    preserveMusicWhenInterventionAddsNoValue: true,
    psychoacousticsOffRealtimeCallback: true,
    genrePolicyChoosesStrategySetNotExactTransition: true,
    keyIsStrongSignalNotUniversalHardGate: true,
} as const;
