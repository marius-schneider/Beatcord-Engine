const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

export interface PopularityPreference {
    mainstreamAffinity: number;
    longTailAffinity: number;
    confidence: number;
}

export function popularityAlignment(
    catalogPopularity: number,
    preference: PopularityPreference,
): { alignment: number; diagnosticCalibration: number; hardTarget: false } {
    const total = Math.max(0.001, preference.mainstreamAffinity + preference.longTailAffinity);
    const preferredPopularity = preference.mainstreamAffinity / total;
    const rawAlignment = 1 - Math.abs(clamp01(catalogPopularity) - preferredPopularity);
    return {
        alignment: round(clamp01(0.5 + (rawAlignment - 0.5) * clamp01(preference.confidence))),
        diagnosticCalibration: round(Math.abs(clamp01(catalogPopularity) - preferredPopularity)),
        hardTarget: false,
    };
}

export interface ArtistExposureDecision {
    listenerRelevance: number;
    creatorExposureNeed: number;
    minimumRelevance: number;
}

export function artistExposureAdjustment(input: ArtistExposureDecision): {
    eligible: boolean;
    adjustment: number;
    forced: false;
} {
    const eligible = input.listenerRelevance >= input.minimumRelevance;
    return {
        eligible,
        adjustment: eligible ? round(clamp01(input.creatorExposureNeed) * 0.12) : 0,
        forced: false,
    };
}

export interface RecommendationStewardship {
    shortTermRelevance: number;
    longTermOpenness: number;
    userDiscoveryConsent: number;
    combined: number;
}

export function recommendationStewardship(
    shortTermRelevance: number,
    longTermOpenness: number,
    userDiscoveryConsent: number,
): RecommendationStewardship {
    const consent = clamp01(userDiscoveryConsent);
    return {
        shortTermRelevance: round(clamp01(shortTermRelevance)),
        longTermOpenness: round(clamp01(longTermOpenness)),
        userDiscoveryConsent: round(consent),
        combined: round(
            clamp01(shortTermRelevance) * (0.85 - consent * 0.2) + clamp01(longTermOpenness) * consent * 0.35,
        ),
    };
}

export interface HomogenizationState {
    artistConcentration: number;
    genreConcentration: number;
    popularityConcentration: number;
    embeddingCoverage: number;
    noveltyTrend: number;
    risk: number;
}

export function monitorHomogenization(input: Omit<HomogenizationState, "risk">): HomogenizationState {
    const concentration =
        clamp01(input.artistConcentration) * 0.32 +
        clamp01(input.genreConcentration) * 0.28 +
        clamp01(input.popularityConcentration) * 0.2;
    const coverageDeficit = 1 - clamp01(input.embeddingCoverage);
    const noveltyDecline = clamp01(-input.noveltyTrend);
    return { ...input, risk: round(clamp01(concentration + coverageDeficit * 0.12 + noveltyDecline * 0.08)) };
}

export function serendipityScore(unexpectedness: number, relevance: number, contextualFit: number): number {
    return round(clamp01(unexpectedness) * clamp01(relevance) * clamp01(contextualFit));
}

export interface DiscoveryBudgetPlan {
    discoverySlots: number;
    familiarityAnchors: number;
    bridgeTracks: number;
    noveltyMax: number;
}

export function planDiscoveryBudget(totalSlots: number, discoveryTarget: number, fatigue: number): DiscoveryBudgetPlan {
    const safeTarget = clamp01(discoveryTarget) * (1 - clamp01(fatigue) * 0.65);
    const discoverySlots = Math.min(totalSlots, Math.round(totalSlots * safeTarget));
    return {
        discoverySlots,
        familiarityAnchors: Math.max(0, totalSlots - discoverySlots),
        bridgeTracks: discoverySlots > 0 ? Math.max(1, Math.ceil(discoverySlots / 3)) : 0,
        noveltyMax: round(Math.min(0.8, 0.25 + safeTarget * 0.55)),
    };
}

export type DecisionReason =
    | "user-affinity"
    | "crowd-consensus"
    | "energy-bridge"
    | "requested-track-route"
    | "friend-trending"
    | "transition-compatibility"
    | "fairness-debt"
    | "familiarity-anchor"
    | "serendipity";

export interface DecisionReasonEvidence {
    reason: DecisionReason;
    contribution: number;
    source: string;
}

export function explainDecisionFromEvidence(evidence: readonly DecisionReasonEvidence[]): {
    reasons: DecisionReason[];
    explanation: string;
} {
    const active = evidence.filter((item) => item.contribution > 0).sort((a, b) => b.contribution - a.contribution);
    return {
        reasons: active.map((item) => item.reason),
        explanation: active.length
            ? `Selected for ${active
                  .slice(0, 3)
                  .map((item) => item.reason)
                  .join(", ")}.`
            : "No positive model reason was recorded.",
    };
}

export interface LongTermValueSignals {
    wouldReuseExperience: number;
    wouldStartAnotherSession: number;
    wouldSaveJourney: number;
    wouldTrustAutoAgain: number;
}

export function longTermValue(signals: LongTermValueSignals): number {
    return round(
        clamp01(
            signals.wouldReuseExperience * 0.3 +
                signals.wouldStartAnotherSession * 0.25 +
                signals.wouldSaveJourney * 0.2 +
                signals.wouldTrustAutoAgain * 0.25,
        ),
    );
}

export type SessionFeeling = "perfect" | "good" | "okay" | "off";
export interface SatisfactionSurveyPrompt {
    due: boolean;
    kind: "session-feel" | "vibe-understanding";
    options: readonly string[];
}

export function scheduleSatisfactionSurvey(input: {
    completedSessionsSincePrompt: number;
    sessionDurationMinutes: number;
    dismissedLastPrompt: boolean;
}): SatisfactionSurveyPrompt {
    const due =
        input.completedSessionsSincePrompt >= (input.dismissedLastPrompt ? 8 : 5) && input.sessionDurationMinutes >= 20;
    return {
        due,
        kind: input.completedSessionsSincePrompt % 2 === 0 ? "vibe-understanding" : "session-feel",
        options:
            input.completedSessionsSincePrompt % 2 === 0 ? ["yes", "mostly", "no"] : ["perfect", "good", "okay", "off"],
    };
}

export type FeedbackLabel =
    | { scope: "track"; label: "song-quality"; value: number }
    | { scope: "transition"; label: "mix-quality"; value: number }
    | { scope: "session"; label: "journey-quality"; value: number };

export function groupFeedbackLabels(labels: readonly FeedbackLabel[]): Record<FeedbackLabel["scope"], FeedbackLabel[]> {
    return {
        track: labels.filter((label) => label.scope === "track"),
        transition: labels.filter((label) => label.scope === "transition"),
        session: labels.filter((label) => label.scope === "session"),
    };
}

export const RECOMMENDATION_EVALUATION_DIMENSIONS = [
    "relevance",
    "completion",
    "skip",
    "discovery",
    "novelty",
    "serendipity",
    "diversity",
    "coverage",
    "fairness",
    "popularity-alignment",
    "session-coherence",
    "transition-quality",
    "long-term-satisfaction",
] as const;

export const EVALUATION_PYRAMID = [
    "offline-tests",
    "simulation",
    "shadow-mode",
    "small-user-tests",
    "ab-tests",
    "longitudinal-evaluation",
] as const;

export interface SimulatedSessionState {
    satisfaction: number;
    skipRisk: number;
    energy: number;
    crowdFairness: number;
    transitionQuality: number;
}

export interface WorldModelPrediction {
    state: SimulatedSessionState;
    confidence: number;
    filterOnly: true;
}

export function predictWorldModelResponse(
    state: SimulatedSessionState,
    candidate: { relevance: number; energy: number; fairness: number; transitionQuality: number },
    modelConfidence: number,
): WorldModelPrediction {
    const relevance = clamp01(candidate.relevance);
    return {
        state: {
            satisfaction: round(clamp01(state.satisfaction * 0.65 + relevance * 0.35)),
            skipRisk: round(clamp01(state.skipRisk * 0.55 + (1 - relevance) * 0.45)),
            energy: round(clamp01(state.energy * 0.4 + candidate.energy * 0.6)),
            crowdFairness: round(clamp01(state.crowdFairness * 0.6 + candidate.fairness * 0.4)),
            transitionQuality: round(clamp01(state.transitionQuality * 0.4 + candidate.transitionQuality * 0.6)),
        },
        confidence: round(clamp01(modelConfidence)),
        filterOnly: true,
    };
}

export function compareCounterfactualRoutes(
    observed: WorldModelPrediction,
    counterfactual: WorldModelPrediction,
): { preferred: "observed" | "counterfactual" | "uncertain"; delta: number } {
    const utility = (prediction: WorldModelPrediction) =>
        prediction.state.satisfaction * 0.3 +
        (1 - prediction.state.skipRisk) * 0.2 +
        prediction.state.crowdFairness * 0.2 +
        prediction.state.transitionQuality * 0.2 +
        prediction.confidence * 0.1;
    const delta = utility(counterfactual) - utility(observed);
    return {
        preferred: Math.abs(delta) < 0.04 ? "uncertain" : delta > 0 ? "counterfactual" : "observed",
        delta: round(delta),
    };
}

export interface ReinforcementLearningReadiness {
    strongBaselines: boolean;
    reliableLogging: boolean;
    rewardAttribution: boolean;
    safeConstraints: boolean;
    simulation: boolean;
}

export function reinforcementLearningGate(readiness: ReinforcementLearningReadiness): {
    allowed: boolean;
    currentStrategy: "reinforcement-learning" | "retrieval-ranking-route-planning";
    missing: string[];
} {
    const missing = Object.entries(readiness)
        .filter(([, ready]) => !ready)
        .map(([name]) => name);
    return {
        allowed: missing.length === 0,
        currentStrategy: missing.length === 0 ? "reinforcement-learning" : "retrieval-ranking-route-planning",
        missing,
    };
}
