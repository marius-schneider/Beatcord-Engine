const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export interface BeatHypothesisV2 {
    source: "full-mix" | "foundation" | "drum-stem" | "kick-snare" | "bass-rhythm" | "tempo-estimator";
    bpm: number;
    phase: number;
    meter: number;
    confidence: number;
}
export interface BeatDisagreement {
    start: number;
    end: number;
    phaseDisagreement: number;
    tempoDisagreement: number;
    meterDisagreement: number;
    expectedImpact: number;
}

export function queryByCommittee(hypotheses: readonly BeatHypothesisV2[]): {
    primary: BeatHypothesisV2 | null;
    disagreement: BeatDisagreement;
    hypothesesPreserved: true;
} {
    if (!hypotheses.length)
        return {
            primary: null,
            disagreement: {
                start: 0,
                end: 0,
                phaseDisagreement: 1,
                tempoDisagreement: 1,
                meterDisagreement: 1,
                expectedImpact: 1,
            },
            hypothesesPreserved: true,
        };
    const primary = [...hypotheses].sort((a, b) => b.confidence - a.confidence)[0] ?? null;
    const bpmValues = hypotheses.map((item) => item.bpm);
    const phaseValues = hypotheses.map((item) => item.phase);
    const meterValues = hypotheses.map((item) => item.meter);
    const range = (values: number[]) => Math.max(...values) - Math.min(...values);
    const tempoDisagreement = clamp01(range(bpmValues) / Math.max(1, Math.max(...bpmValues)));
    const phaseDisagreement = clamp01(range(phaseValues));
    const meterDisagreement = clamp01(range(meterValues) / Math.max(1, Math.max(...meterValues)));
    return {
        primary,
        disagreement: {
            start: 0,
            end: 30,
            phaseDisagreement: round(phaseDisagreement),
            tempoDisagreement: round(tempoDisagreement),
            meterDisagreement: round(meterDisagreement),
            expectedImpact: round(Math.max(phaseDisagreement, tempoDisagreement, meterDisagreement)),
        },
        hypothesesPreserved: true,
    };
}

export function annotationValue(input: {
    uncertainty: number;
    expectedTransitionUse: number;
    downstreamDependencyCount: number;
    maxDependencies?: number;
}): number {
    return round(
        clamp01(input.uncertainty) *
            clamp01(input.expectedTransitionUse) *
            clamp01(input.downstreamDependencyCount / (input.maxDependencies ?? 8)),
    );
}

export type UserBeatConstraintType = "beat-anchor" | "downbeat-anchor" | "tempo-scale" | "meter";
export interface UserBeatConstraint {
    type: UserBeatConstraintType;
    time: number;
    value: number;
    source: "human";
    timestamp: number;
    scope: "track" | "region";
    undoable: true;
}

export function applyBeatConstraints(
    hypotheses: readonly BeatHypothesisV2[],
    constraints: readonly UserBeatConstraint[],
): { hypotheses: BeatHypothesisV2[]; neuralModelRetrained: false; correctionLayer: "per-track-constraints" } {
    const scale = constraints.find((constraint) => constraint.type === "tempo-scale")?.value ?? 1;
    const downbeat = constraints.find((constraint) => constraint.type === "downbeat-anchor");
    return {
        hypotheses: hypotheses.map((hypothesis) => ({
            ...hypothesis,
            bpm: round(hypothesis.bpm * scale),
            phase: downbeat ? downbeat.time : hypothesis.phase,
            confidence: round(Math.min(0.99, hypothesis.confidence + constraints.length * 0.05)),
        })),
        neuralModelRetrained: false,
        correctionLayer: "per-track-constraints",
    };
}

export const CORRECTION_PROPAGATION_GRAPH = {
    "downbeat-anchor": [
        "bar-numbering",
        "meter-phase",
        "phrase-boundaries",
        "transition-windows",
        "cue-points",
        "loop-safety",
    ],
    "beat-anchor": ["tempo", "phase", "expressive-timing"],
    "tempo-scale": ["beat-mesh", "transition-windows"],
    meter: ["bar-numbering", "phrase-boundaries"],
} as const;
export const AUTOMATIC_CORRECTION_HIERARCHY = [
    "analyzer-ensemble",
    "stem-evidence",
    "local-hq-refinement",
    "multi-hypothesis-decoder",
    "ask-user",
] as const;

export function activeTeachingPrompt(input: { mode: "normal" | "dj-power"; value: number; pulseOptions?: number[] }): {
    visible: boolean;
    actions: string[];
    mlTerminologyExposed: false;
} {
    if (input.mode === "normal" || input.value < 0.35)
        return { visible: false, actions: [], mlTerminologyExposed: false };
    return {
        visible: true,
        actions: input.pulseOptions?.length
            ? ["tap-four-beats", ...input.pulseOptions.map((bpm) => `use-${bpm}-bpm`)]
            : ["tap-four-beats", "use-simple-transition"],
        mlTerminologyExposed: false,
    };
}

export interface BeatMeshMemoryEntry {
    trackId: string;
    constraints: UserBeatConstraint[];
    interpretations: { bpm: number; meter: number; confidence: number }[];
    preferredDjPulse?: number;
    reusable: true;
}
export function beatMeshMemory(entry: Omit<BeatMeshMemoryEntry, "reusable">): BeatMeshMemoryEntry {
    return { ...entry, reusable: true };
}

export function trustedCommunityCorrection(entries: readonly { bpm: number; meter: number; trust: number }[]): {
    merge: boolean;
    interpretations: { bpm: number; meter: number; confidence: number }[];
    blindMerge: false;
} {
    const groups = new Map<string, { bpm: number; meter: number; weights: number[] }>();
    for (const entry of entries) {
        const key = `${entry.bpm}:${entry.meter}`;
        const group = groups.get(key) ?? { bpm: entry.bpm, meter: entry.meter, weights: [] };
        group.weights.push(clamp01(entry.trust));
        groups.set(key, group);
    }
    const interpretations = [...groups.values()]
        .map((group) => ({
            bpm: group.bpm,
            meter: group.meter,
            confidence: round(group.weights.reduce((sum, value) => sum + value, 0) / group.weights.length),
        }))
        .sort((a, b) => b.confidence - a.confidence);
    return {
        merge: interpretations.length === 1 && entries.length >= 3 && (interpretations[0]?.confidence ?? 0) >= 0.8,
        interpretations,
        blindMerge: false,
    };
}

export function selectDjPulse(
    interpretations: readonly { bpm: number; confidence: number }[],
    preferred?: number,
): { musicalHypotheses: number[]; controlGrid: number | null; preferenceSeparate: true } {
    return {
        musicalHypotheses: interpretations.map((item) => item.bpm),
        controlGrid: preferred ?? [...interpretations].sort((a, b) => b.confidence - a.confidence)[0]?.bpm ?? null,
        preferenceSeparate: true,
    };
}

export const BEAT_MESH_EXPERIMENTS = {
    ensemble: {
        buckets: ["edm", "dnb", "disco", "live-rock", "funk", "jazz", "ballad", "classical", "odd-meter", "latin"],
        metrics: [
            "beat-f1",
            "downbeat-f1",
            "octave-error",
            "continuity-error",
            "catastrophic-failure",
            "transition-window-accuracy",
        ],
    },
    correction: {
        effortSeconds: [0, 5, 15],
        metrics: ["grid-improvement", "transition-improvement", "future-reused-value"],
    },
    selectiveTeaching: {
        variants: ["random-region", "highest-information-region"],
        metric: "improvement-per-user-second",
    },
} as const;

export const TOP_FIVE_IMPLEMENTATION = {
    architectureNow: [
        "exposure-ledger",
        "confidence-calibration-api",
        "decision-confidence",
        "beat-mesh-hypotheses",
        "device-environment-profile",
        "semantic-event-api",
    ],
    production: [
        "causal-taste-weighting",
        "domain-calibrated-beat-confidence",
        "output-aware-playback",
        "scene-classification",
        "beat-mesh-ensemble",
        "per-track-constraints",
    ],
    prototypes: ["spectral-pocket", "moment-defer", "active-teaching-ui", "local-adapters", "transition-monte-carlo"],
    partnerFuture: ["semantic-headphone-separation", "os-anc-control", "personalized-hrtf", "environmental-remix"],
} as const;
export const TOP_FIVE_MEASUREMENT = {
    playbackTwin: ["preference", "naturalness", "clarity", "fatigue", "artist-fidelity"],
    causalTaste: ["long-term-diversity", "voluntary-discovery", "profile-stability", "self-influence"],
    decisionConfidence: [
        "high-confidence-failure",
        "fallback-success",
        "calibration-error",
        "robust-transition-success",
    ],
    semanticListening: ["awareness", "speech-comprehension", "music-continuity", "false-trigger-annoyance"],
    activeBeatMesh: ["catastrophic-grid-failure", "octave-errors", "correction-roi", "transition-timing"],
} as const;
