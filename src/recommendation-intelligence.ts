import type { ConcreteExperienceId } from "./experience-engine";

export const RECOMMENDATION_STACK = [
    "candidate-retrieval",
    "personal-relevance",
    "session-context",
    "crowd",
    "musical-compatibility",
    "journey-route",
    "diversity-fairness-novelty",
    "transition-feasibility",
    "final-candidates",
] as const;
export type RecommendationStage = (typeof RECOMMENDATION_STACK)[number];

export interface RecommendationObjectives {
    userSatisfaction: number;
    crowdSatisfaction: number;
    sessionFit: number;
    musicalCompatibility: number;
    discovery: number;
    diversity: number;
    novelty: number;
    requestPriority: number;
    fairness: number;
    trendRelevance: number;
    localRelevance: number;
    transitionQuality: number;
}

export type RecommendationObjective = keyof RecommendationObjectives;
export type RecommendationWeights = Record<RecommendationObjective, number>;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1000) / 1000;
const objectiveKeys = [
    "userSatisfaction",
    "crowdSatisfaction",
    "sessionFit",
    "musicalCompatibility",
    "discovery",
    "diversity",
    "novelty",
    "requestPriority",
    "fairness",
    "trendRelevance",
    "localRelevance",
    "transitionQuality",
] as const satisfies readonly RecommendationObjective[];

export function recommendationWeights(
    experience: ConcreteExperienceId,
    context: { crowdActive?: boolean; explicitRequest?: boolean; discoveryBudget?: number } = {},
): RecommendationWeights {
    const base: RecommendationWeights = {
        userSatisfaction: 1,
        crowdSatisfaction: context.crowdActive ? 0.9 : 0,
        sessionFit: 1,
        musicalCompatibility: experience === "party" ? 0.9 : 0.8,
        discovery: (context.discoveryBudget ?? 0.4) * (experience === "chill" ? 0.6 : 0.45),
        diversity: 0.55,
        novelty: experience === "party" ? 0.4 : 0.3,
        requestPriority: context.explicitRequest ? 1 : experience === "party" ? 0.8 : 0.25,
        fairness: context.crowdActive ? 0.85 : 0.15,
        trendRelevance: experience === "party" ? 0.5 : 0.2,
        localRelevance: context.crowdActive ? 0.55 : 0.3,
        transitionQuality: experience === "party" ? 1 : experience === "love" ? 0.8 : 0.65,
    };
    return Object.fromEntries(objectiveKeys.map((key) => [key, round(base[key])])) as unknown as RecommendationWeights;
}

export interface SequentialRecommendationContext {
    position: number;
    sessionLength: number;
    previousCompatibility: number;
    futureRouteFit: number;
    localSequenceFit: number;
}

export interface RecommendationCandidate<T = unknown> {
    id: string;
    value: T;
    objectives: RecommendationObjectives;
    sequential: SequentialRecommendationContext;
    hardEligible: boolean;
    transitionFeasible: boolean;
}

export interface RankedRecommendation<T = unknown> {
    candidate: RecommendationCandidate<T>;
    score: number;
    objectiveScore: number;
    sequentialScore: number;
    stages: { stage: RecommendationStage; passed: boolean; contribution: number }[];
    reasons: string[];
}

export function scoreSequentialContext(context: SequentialRecommendationContext): number {
    const positionWeight =
        context.sessionLength <= 1 ? 1 : 1 - Math.abs(context.position / (context.sessionLength - 1) - 0.5) * 0.15;
    return round(
        clamp01(
            (context.previousCompatibility * 0.35 + context.localSequenceFit * 0.35 + context.futureRouteFit * 0.3) *
                positionWeight,
        ),
    );
}

export function rankRecommendations<T>(
    candidates: readonly RecommendationCandidate<T>[],
    weights: RecommendationWeights,
): RankedRecommendation<T>[] {
    const totalWeight = objectiveKeys.reduce((sum, key) => sum + Math.max(0, weights[key]), 0) || 1;
    return candidates
        .map((candidate): RankedRecommendation<T> => {
            const objectiveScore =
                objectiveKeys.reduce(
                    (sum, key) => sum + clamp01(candidate.objectives[key]) * Math.max(0, weights[key]),
                    0,
                ) / totalWeight;
            const sequentialScore = scoreSequentialContext(candidate.sequential);
            const score =
                candidate.hardEligible && candidate.transitionFeasible
                    ? objectiveScore * 0.72 + sequentialScore * 0.28
                    : 0;
            const stages = RECOMMENDATION_STACK.map((stage) => ({
                stage,
                passed:
                    stage === "transition-feasibility"
                        ? candidate.transitionFeasible
                        : stage === "final-candidates"
                          ? candidate.hardEligible && candidate.transitionFeasible
                          : candidate.hardEligible,
                contribution: round(
                    stage === "session-context"
                        ? candidate.objectives.sessionFit
                        : stage === "musical-compatibility"
                          ? candidate.objectives.musicalCompatibility
                          : stage === "transition-feasibility"
                            ? Number(candidate.transitionFeasible)
                            : score,
                ),
            }));
            const strongest = [...objectiveKeys]
                .sort((a, b) => candidate.objectives[b] * weights[b] - candidate.objectives[a] * weights[a])
                .slice(0, 3);
            return {
                candidate,
                score: round(score),
                objectiveScore: round(objectiveScore),
                sequentialScore,
                stages,
                reasons: strongest.map((key) => `${key} ${round(candidate.objectives[key])}`),
            };
        })
        .sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id));
}

export interface PredictedSessionResponse {
    completion: number;
    skip: number;
    like: number;
    energyFit: number;
    crowdFit: number;
    expectedReward: number;
}

export interface SessionWorldState {
    satisfaction: number;
    fatigue: number;
    recentSkips: number;
    targetEnergy: number;
    crowdActive: boolean;
}

/** Offline/shadow simulator only; it cannot commit a real recommendation. */
export function simulateRecommendation(
    state: SessionWorldState,
    objectives: RecommendationObjectives,
): PredictedSessionResponse {
    const energyFit = clamp01(objectives.sessionFit);
    const crowdFit = state.crowdActive ? clamp01(objectives.crowdSatisfaction) : 0.5;
    const completion = clamp01(
        objectives.userSatisfaction * 0.42 +
            energyFit * 0.25 +
            objectives.musicalCompatibility * 0.18 +
            (1 - state.fatigue) * 0.15 -
            state.recentSkips * 0.04,
    );
    const skip = clamp01(1 - completion + state.fatigue * 0.15);
    const like = clamp01(
        objectives.userSatisfaction * 0.55 +
            objectives.discovery * 0.15 +
            objectives.novelty * 0.1 +
            state.satisfaction * 0.2,
    );
    const expectedReward = completion * 0.45 + like * 0.25 + energyFit * 0.15 + crowdFit * 0.15 - skip * 0.25;
    return {
        completion: round(completion),
        skip: round(skip),
        like: round(like),
        energyFit: round(energyFit),
        crowdFit: round(crowdFit),
        expectedReward: round(expectedReward),
    };
}

export type TasteVector = Record<string, number>;
export interface TasteSignal {
    value: number;
    confidence: number;
    observations: number;
    lastObservedAt: number;
}

export interface PreferenceSignal {
    target: string;
    value: number;
    kind: PreferenceSignalKind;
    confidence: number;
    observedAt: number;
}

export interface UserTasteProfile {
    longTerm: TasteVector;
    recent: TasteVector;
    contextual: Record<string, TasteVector>;
    positivePreferences: PreferenceSignal[];
    negativePreferences: PreferenceSignal[];
    artistAffinity: Record<string, TasteSignal>;
    genreAffinity: Record<string, TasteSignal>;
    trackAffinity: Record<string, TasteSignal>;
    noveltyPreference: number;
    familiarityPreference: number;
    explorationTolerance: number;
}

export interface TasteResolutionInput {
    profile: UserTasteProfile;
    context?: string;
    session?: TasteVector;
    explicit?: TasteVector;
}

function mergeTasteLayers(layers: readonly { vector: TasteVector; weight: number }[]): TasteVector {
    const keys = [...new Set(layers.flatMap((layer) => Object.keys(layer.vector)))];
    return Object.fromEntries(
        keys.map((key) => {
            let weighted = 0;
            let total = 0;
            for (const layer of layers) {
                if (layer.vector[key] === undefined) continue;
                weighted += clamp01(layer.vector[key]!) * layer.weight;
                total += layer.weight;
            }
            return [key, round(total ? weighted / total : 0)];
        }),
    );
}

/** Explicit > session/context > recent > long-term, without deleting any horizon. */
export function resolveTaste(input: TasteResolutionInput): TasteVector {
    return mergeTasteLayers([
        { vector: input.profile.longTerm, weight: 1 },
        { vector: input.profile.recent, weight: 2 },
        { vector: input.context ? (input.profile.contextual[input.context] ?? {}) : {}, weight: 3 },
        { vector: input.session ?? {}, weight: 4 },
        { vector: input.explicit ?? {}, weight: 8 },
    ]);
}

export type PreferenceKind = "artist" | "genre" | "track" | "mood" | "session";
export function preferenceDecay(signal: TasteSignal, nowMs: number, kind: PreferenceKind): TasteSignal {
    const halfLifeDays = { artist: 730, genre: 540, track: 730, mood: 60, session: 14 }[kind];
    const ageDays = Math.max(0, nowMs - signal.lastObservedAt) / 86_400_000;
    const decay = 0.5 ** (ageDays / halfLifeDays);
    return { ...signal, value: round(signal.value * decay), confidence: round(signal.confidence * Math.sqrt(decay)) };
}

export function tasteConfidence(observations: number, consistency: number, recency: number): number {
    return round(
        clamp01(
            (1 - Math.exp(-Math.max(0, observations) / 12)) * 0.6 +
                clamp01(consistency) * 0.25 +
                clamp01(recency) * 0.15,
        ),
    );
}

export type PreferenceSignalKind =
    | "explicit-correction"
    | "like"
    | "dislike"
    | "favorite"
    | "never-play"
    | "more-like-this"
    | "less-like-this"
    | "completion"
    | "skip"
    | "replay"
    | "queue-add"
    | "save"
    | "search"
    | "volume-change"
    | "transition-skip"
    | "session-exit";

export function preferenceSignalWeight(kind: PreferenceSignalKind): number {
    return {
        "explicit-correction": 1,
        "never-play": 1,
        favorite: 0.9,
        dislike: 0.85,
        like: 0.8,
        "more-like-this": 0.8,
        "less-like-this": 0.8,
        "queue-add": 0.65,
        save: 0.65,
        replay: 0.6,
        "transition-skip": 0.55,
        skip: 0.35,
        completion: 0.3,
        search: 0.25,
        "session-exit": 0.2,
        "volume-change": 0.1,
    }[kind];
}

export interface SkipInterpretation {
    trackDislike: number;
    transitionDislike: number;
    sessionMismatch: number;
    fatigue: number;
    timingIssue: number;
    confidence: number;
}

export function interpretSkip(input: {
    positionSec: number;
    durationSec: number;
    duringTransition: boolean;
    similarTracksBefore: number;
    energyMismatch: number;
}): SkipInterpretation {
    const ratio = input.durationSec > 0 ? clamp01(input.positionSec / input.durationSec) : 0;
    const late = ratio >= 0.88;
    const early = ratio <= 0.08;
    const transitionDislike = input.duringTransition ? 0.75 : 0.08;
    const fatigue = clamp01(input.similarTracksBefore / 6);
    const sessionMismatch = clamp01(Math.abs(input.energyMismatch));
    const timingIssue = late ? 0.75 : input.duringTransition ? 0.45 : 0.1;
    const trackDislike = late ? 0.05 : early ? 0.72 : input.duringTransition ? 0.24 : 0.48;
    const confidence = clamp01(
        0.45 +
            Number(input.durationSec > 0) * 0.15 +
            Number(input.duringTransition) * 0.12 +
            Number(input.similarTracksBefore > 0) * 0.08,
    );
    return {
        trackDislike: round(trackDislike),
        transitionDislike: round(transitionDislike),
        sessionMismatch: round(sessionMismatch),
        fatigue: round(fatigue),
        timingIssue: round(timingIssue),
        confidence: round(confidence),
    };
}

export type RecommendationFeedbackType = "love" | "hate" | "bad-recommendation";
export function recommendationFeedbackTargets(type: RecommendationFeedbackType): {
    trackPreference: number;
    contextualRecommendation: number;
} {
    if (type === "love") return { trackPreference: 1, contextualRecommendation: 0.4 };
    if (type === "hate") return { trackPreference: -1, contextualRecommendation: -0.35 };
    return { trackPreference: 0, contextualRecommendation: -1 };
}

export interface DiscoveryProfile {
    novelty: number;
    obscurity: number;
    genreDistance: number;
    artistDistance: number;
    geographicExploration: number;
    eraExploration: number;
    emergingArtistBias: number;
}

export type DiscoveryMode = "safe" | "adjacent" | "explorer" | "deep-dive";
export const DISCOVERY_MODES: Record<DiscoveryMode, DiscoveryProfile> = {
    safe: {
        novelty: 0.25,
        obscurity: 0.1,
        genreDistance: 0.1,
        artistDistance: 0.2,
        geographicExploration: 0.1,
        eraExploration: 0.1,
        emergingArtistBias: 0.2,
    },
    adjacent: {
        novelty: 0.5,
        obscurity: 0.35,
        genreDistance: 0.3,
        artistDistance: 0.5,
        geographicExploration: 0.25,
        eraExploration: 0.25,
        emergingArtistBias: 0.45,
    },
    explorer: {
        novelty: 0.75,
        obscurity: 0.6,
        genreDistance: 0.65,
        artistDistance: 0.72,
        geographicExploration: 0.65,
        eraExploration: 0.58,
        emergingArtistBias: 0.7,
    },
    "deep-dive": {
        novelty: 0.82,
        obscurity: 0.95,
        genreDistance: 0.5,
        artistDistance: 0.8,
        geographicExploration: 0.5,
        eraExploration: 0.72,
        emergingArtistBias: 0.85,
    },
};

export interface DiscoveryBudgetState {
    capacity: number;
    remaining: number;
    consecutiveUnknown: number;
    familiarityRequired: boolean;
}

export function updateDiscoveryBudget(
    state: DiscoveryBudgetState,
    novelty: number,
    completed: boolean,
): DiscoveryBudgetState {
    const spend = clamp01(novelty) * (completed ? 0.8 : 1.2);
    const recovery = novelty < 0.25 && completed ? 0.22 : 0;
    const remaining = Math.max(0, Math.min(state.capacity, state.remaining - spend + recovery));
    const consecutiveUnknown = novelty >= 0.55 ? state.consecutiveUnknown + 1 : 0;
    return {
        capacity: state.capacity,
        remaining: round(remaining),
        consecutiveUnknown,
        familiarityRequired: remaining <= state.capacity * 0.2 || consecutiveUnknown >= 3,
    };
}
