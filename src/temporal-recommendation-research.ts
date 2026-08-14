import type { TasteVector } from "./recommendation-intelligence";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

export type TrendSignalKind = "viral" | "trend-24h" | "trend-7d" | "trend-30d" | "evergreen";
export const TREND_HALF_LIFE_HOURS: Record<TrendSignalKind, number> = {
    viral: 8,
    "trend-24h": 24,
    "trend-7d": 168,
    "trend-30d": 720,
    evergreen: 8_760,
};

export function decayTrendSignal(value: number, kind: TrendSignalKind, ageHours: number): number {
    return round(clamp01(value) * 2 ** (-Math.max(0, ageHours) / TREND_HALF_LIFE_HOURS[kind]));
}

export interface TasteSnapshot {
    atMs: number;
    vector: TasteVector;
    source: "observed" | "imported" | "session-summary";
}

export class PathDependentTasteHistory {
    readonly #snapshots: TasteSnapshot[] = [];

    append(snapshot: TasteSnapshot): void {
        this.#snapshots.push({ ...snapshot, vector: { ...snapshot.vector } });
        this.#snapshots.sort((a, b) => a.atMs - b.atMs);
    }

    history(): TasteSnapshot[] {
        return this.#snapshots.map((snapshot) => ({ ...snapshot, vector: { ...snapshot.vector } }));
    }

    change(key: string): number {
        const first = this.#snapshots[0]?.vector[key] ?? 0;
        const last = this.#snapshots.at(-1)?.vector[key] ?? 0;
        return round(last - first);
    }
}

export interface TasteChangeAttribution {
    possibleContributors: readonly ["beatcord", "social", "external-media", "event", "personal-phase"];
    causalClaim: false;
    observedCorrelation: number;
}

export function attributeTasteChange(observedCorrelation: number): TasteChangeAttribution {
    return {
        possibleContributors: ["beatcord", "social", "external-media", "event", "personal-phase"],
        causalClaim: false,
        observedCorrelation: round(Math.max(-1, Math.min(1, observedCorrelation))),
    };
}

export interface RecommendationUncertainty {
    personalFit: number;
    sessionFit: number;
    crowdFit: number;
    moodFit: number;
    transitionFit: number;
}

export function totalRecommendationUncertainty(uncertainty: RecommendationUncertainty): number {
    const values = Object.values(uncertainty).map(clamp01);
    return round(Math.sqrt(values.reduce((sum, value) => sum + value ** 2, 0) / values.length));
}

export type RiskContext = "party" | "experimental" | "love" | "background" | "default";
export const EXPERIENCE_RISK_SENSITIVITY: Record<RiskContext, number> = {
    party: 0.25,
    experimental: 0.15,
    love: 0.7,
    background: 0.85,
    default: 0.5,
};

export function riskSensitiveScore(
    expectedUtility: number,
    uncertainty: RecommendationUncertainty,
    context: RiskContext,
): number {
    return round(
        Math.max(
            0,
            expectedUtility - EXPERIENCE_RISK_SENSITIVITY[context] * totalRecommendationUncertainty(uncertainty),
        ),
    );
}

export interface CalibrationPrediction {
    subsystem: string;
    predicted: number;
    outcome: 0 | 1;
}

export interface CalibrationReport {
    subsystem: string;
    expectedCalibrationError: number;
    brierScore: number;
    reliability: { lower: number; upper: number; predictedMean: number; observedRate: number; count: number }[];
}

export function evaluateCalibration(predictions: readonly CalibrationPrediction[], bins = 10): CalibrationReport[] {
    return [...new Set(predictions.map((prediction) => prediction.subsystem))].map((subsystem) => {
        const rows = predictions.filter((prediction) => prediction.subsystem === subsystem);
        const reliability = Array.from({ length: bins }, (_, index) => {
            const lower = index / bins;
            const upper = (index + 1) / bins;
            const entries = rows.filter(
                (row) =>
                    row.predicted >= lower && (index === bins - 1 ? row.predicted <= upper : row.predicted < upper),
            );
            return {
                lower,
                upper,
                predictedMean: round(
                    entries.reduce((sum, row) => sum + row.predicted, 0) / Math.max(1, entries.length),
                ),
                observedRate: round(entries.reduce((sum, row) => sum + row.outcome, 0) / Math.max(1, entries.length)),
                count: entries.length,
            };
        }).filter((bin) => bin.count > 0);
        const expectedCalibrationError = reliability.reduce(
            (sum, bin) => sum + Math.abs(bin.predictedMean - bin.observedRate) * (bin.count / rows.length),
            0,
        );
        const brierScore =
            rows.reduce((sum, row) => sum + (row.predicted - row.outcome) ** 2, 0) / Math.max(1, rows.length);
        return {
            subsystem,
            expectedCalibrationError: round(expectedCalibrationError),
            brierScore: round(brierScore),
            reliability,
        };
    });
}

export type HumanAiControlMode = "manual" | "assisted" | "adaptive" | "director";
export const HUMAN_AI_CONTROL_MODES: Record<HumanAiControlMode, { queueControl: string; visibleLabel: string }> = {
    manual: { queueControl: "user", visibleLabel: "Manual – you control the queue" },
    assisted: { queueControl: "user-with-suggestions", visibleLabel: "Assisted – Beatcord suggests" },
    adaptive: { queueControl: "auto-reordering", visibleLabel: "Adaptive – Beatcord may reorder auto tracks" },
    director: {
        queueControl: "within-session-contract",
        visibleLabel: "Director – Beatcord controls the contracted journey",
    },
};

export function explainAutoReorder(input: {
    movedTrackId: string;
    from: number;
    to: number;
    actualReason: "mixes-better-later" | "requested-route" | "energy-journey";
}): string {
    const reason = {
        "mixes-better-later": "it mixes better after the current musical section",
        "requested-route": "it preserves the route to a requested track",
        "energy-journey": "it fits the planned energy journey later",
    }[input.actualReason];
    return `Moved ${input.movedTrackId} from ${input.from + 1} to ${input.to + 1} because ${reason}.`;
}

export type CorrectionLabel =
    | "too-energetic"
    | "too-calm"
    | "wrong-vibe"
    | "too-repetitive"
    | "bad-transition"
    | "unknown-song"
    | "too-much-unfamiliar";

export interface CorrectionObservation {
    label: CorrectionLabel;
    scope: "track" | "transition" | "session";
    cleanResearchLabel: true;
}

export function recordCorrection(label: CorrectionLabel): CorrectionObservation {
    return {
        label,
        scope: label === "bad-transition" ? "transition" : label === "too-much-unfamiliar" ? "session" : "track",
        cleanResearchLabel: true,
    };
}

export type PairwiseChoice = "a" | "b" | "same";
export interface PairwiseSessionEvaluation {
    excerptA: string;
    excerptB: string;
    choice: PairwiseChoice;
    dimension: "flow" | "coherence" | "transition" | "vibe";
}

export interface ResearchSessionRow {
    sessionId: string;
    memberIds: string[];
    tracks: string[];
    features: Record<string, number>[];
    transitions: string[];
    experience: string;
    crowdDistribution: number[];
    reactions: string[];
    requests: string[];
    corrections: CorrectionLabel[];
    satisfaction?: number;
    consented: boolean;
}

export function anonymizeResearchSession(
    row: ResearchSessionRow,
): Omit<ResearchSessionRow, "memberIds" | "consented"> & { anonymousMemberCount: number; exportable: boolean } {
    const { memberIds, consented: _consented, ...safe } = row;
    return {
        ...safe,
        sessionId: `anon-${row.sessionId.length}-${row.tracks.length}`,
        anonymousMemberCount: memberIds.length,
        exportable: row.consented,
    };
}

export const EVALUATION_SEGMENTS = {
    experience: ["chill", "love", "energy", "party", "auto"],
    genreFamily: [
        "electronic",
        "hip-hop",
        "pop",
        "rock",
        "metal",
        "jazz",
        "classical",
        "ambient",
        "live-tempo",
        "beatless",
    ],
    groupShape: [
        "high-consensus",
        "moderate-diversity",
        "polarized",
        "one-outlier",
        "two-equal-camps",
        "new-group",
        "saved-group",
    ],
    sessionLengthMinutes: [10, 30, 60, 180, 360],
} as const;

export function downstreamUtility(immediateUtility: number, futureUtility: number, gamma: number): number {
    return round(clamp01(immediateUtility) + Math.min(0.5, clamp01(gamma)) * clamp01(futureUtility));
}

export function journeyRegret(
    observedUtility: number,
    shadowRouteUtilities: readonly number[],
): { regret: number; betterRouteLikely: boolean } {
    const best = Math.max(observedUtility, ...shadowRouteUtilities);
    const regret = Math.max(0, best - observedUtility);
    return { regret: round(regret), betterRouteLikely: regret >= 0.05 };
}

export interface SessionCurvePoint {
    phase: string;
    target: number;
    observed: number;
}

export function evaluateSessionCurve(points: readonly SessionCurvePoint[]): {
    meanError: number;
    worstPhase: string | null;
    trajectory: SessionCurvePoint[];
} {
    if (!points.length) return { meanError: 0, worstPhase: null, trajectory: [] };
    const withErrors = points.map((point) => ({ point, error: Math.abs(point.target - point.observed) }));
    return {
        meanError: round(withErrors.reduce((sum, item) => sum + item.error, 0) / points.length),
        worstPhase: [...withErrors].sort((a, b) => b.error - a.error)[0]!.point.phase,
        trajectory: points.map((point) => ({ ...point })),
    };
}

export class PersonalSatisfactionFloor {
    readonly #violations = new Map<string, number>();
    readonly #debt = new Map<string, number>();

    observe(memberId: string, satisfaction: number, floor: number, consecutiveTolerance = 2): number {
        const violations = satisfaction < floor ? (this.#violations.get(memberId) ?? 0) + 1 : 0;
        this.#violations.set(memberId, violations);
        if (violations > consecutiveTolerance)
            this.#debt.set(memberId, (this.#debt.get(memberId) ?? 0) + (floor - satisfaction));
        return round(this.#debt.get(memberId) ?? 0);
    }
}

export const RESEARCH_BACKED_ARCHITECTURE = [
    "session-contract",
    "taste-memory",
    "crowd-distribution",
    "world-signals",
    "candidate-retrieval",
    "uncertainty-layer",
    "multi-objective-ranker",
    "sequence-optimizer",
    "music-director",
    "transition-dsp-core",
    "feedback-loop",
] as const;

export const BEATCORD_RESEARCH_QUESTIONS = [
    "transition-aware-satisfaction",
    "party-peak-familiarity",
    "perceived-fairness-debt",
    "explicit-vs-inferred-mood",
    "predictive-crowd-reactions",
    "experience-discovery-tolerance",
    "transition-vs-relevance-reordering",
    "preferred-journey-shapes",
    "bridge-vs-direct-rotation",
    "cross-genre-perceived-energy",
] as const;

export const RESEARCH_EXPERIMENTS = [
    { id: "transition-aware", conditions: ["relevance", "relevance-plus-compatibility", "full-route"] },
    { id: "group-fairness", conditions: ["average", "least-misery", "fairness-debt", "adaptive-hybrid"] },
    { id: "mood", conditions: ["none", "explicit", "inferred", "explicit-plus-inferred"] },
    { id: "discovery", conditions: ["10-percent", "30-percent", "50-percent", "adaptive"] },
] as const;

export const FINAL_RESEARCH_PIPELINE = [
    "understand-separate-models",
    "estimate-uncertainty",
    "make-constrained-decision",
    "simulate-validate",
    "play",
    "observe",
    "learn-at-correct-level",
] as const;

export const DEEP_RESEARCH_SOURCE_GROUPS = {
    sequential: 6,
    multimodal: 2,
    emotion: 6,
    groupCrowd: 4,
    popularityFairness: 4,
    diversityLongTerm: 5,
    explainability: 1,
    genre: 1,
} as const;
