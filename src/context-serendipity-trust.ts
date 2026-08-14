const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export interface ContextSignal<T> {
    value: T;
    confidence: number;
}
export interface ContextState {
    temporal: ContextSignal<string>;
    activity?: ContextSignal<string>;
    social: ContextSignal<string>;
    device: ContextSignal<string>;
    environment?: ContextSignal<string>;
    explicitIntent?: ContextSignal<string>;
    confidence: number;
}

export interface ListeningRoutine {
    temporalPattern: string;
    expectedContext: Record<string, number>;
    expectedTaste: Record<string, number>;
    confidence: number;
}

export const CONTEXT_HIERARCHY = [
    "explicit-current-intent",
    "active-application",
    "current-social-session",
    "device-environment",
    "recent-behavior",
    "historical-routine",
] as const;

export function resolveContext<T>(input: {
    explicit?: ContextSignal<T>;
    application?: ContextSignal<T>;
    social?: ContextSignal<T>;
    device?: ContextSignal<T>;
    recent?: ContextSignal<T>;
    routine?: ContextSignal<T>;
}): { value: T | null; source: (typeof CONTEXT_HIERARCHY)[number] | "none"; confidence: number } {
    const candidates = [
        ["explicit-current-intent", input.explicit],
        ["active-application", input.application],
        ["current-social-session", input.social],
        ["device-environment", input.device],
        ["recent-behavior", input.recent],
        ["historical-routine", input.routine],
    ] as const;
    const selected = candidates.find(([, signal]) => signal !== undefined && signal.confidence > 0);
    return selected?.[1]
        ? { value: selected[1].value, source: selected[0], confidence: clamp01(selected[1].confidence) }
        : { value: null, source: "none", confidence: 0 };
}

export function contextConfidenceLabel(confidence: number): "low" | "low-medium" | "medium" | "high" {
    if (confidence >= 0.8) return "high";
    if (confidence >= 0.55) return "medium";
    if (confidence >= 0.3) return "low-medium";
    return "low";
}

export interface TasteUpdateScope {
    globalWeight: number;
    contextWeight: number;
    sessionWeight: number;
}
export function isolatedTasteUpdate(explicitGlobal: boolean): TasteUpdateScope {
    return explicitGlobal
        ? { globalWeight: 0.7, contextWeight: 0.25, sessionWeight: 0.05 }
        : { globalWeight: 0.05, contextWeight: 0.65, sessionWeight: 0.3 };
}

export type RegulationIntent = "match" | "maintain" | "shift" | "contrast";
export function desiredStateTarget(current: number, desired: number, intent: RegulationIntent): number {
    if (intent === "match" || intent === "maintain") return clamp01(current);
    if (intent === "contrast") return clamp01(1 - current);
    return clamp01(desired);
}

export interface ContextTransition {
    from: string;
    to: string;
    progress: number;
    active: boolean;
}
export function contextTransition(from: string, to: string, progress: number): ContextTransition {
    const normalized = clamp01(progress);
    return { from, to, progress: normalized, active: from !== to && normalized < 1 };
}

export function contextChangeDecision(input: {
    explicit: boolean;
    consistentSignals: number;
    averageConfidence: number;
}): { change: boolean; hysteresisApplied: true } {
    return {
        change: input.explicit || (input.consistentSignals >= 2 && input.averageConfidence >= 0.65),
        hysteresisApplied: true,
    };
}

export function explainContextReasoning(input: {
    explicitSelection?: string;
    observableSessionFact?: string;
    inferredMood?: string;
}): { explanation: string; unsupportedInferenceExposed: false } {
    const reasons = [input.explicitSelection, input.observableSessionFact].filter(Boolean).join(" and ");
    return {
        explanation: reasons || "Beatcord is making a conservative session adjustment.",
        unsupportedInferenceExposed: false,
    };
}

export interface SerendipityComponents {
    unexpected: number;
    valuable: number;
    contextuallyMeaningful: number;
    discoverableConnection: number;
}
export function serendipityValue(input: SerendipityComponents): number {
    return round(
        clamp01(input.unexpected) *
            clamp01(input.valuable) *
            clamp01(input.contextuallyMeaningful) *
            clamp01(input.discoverableConnection),
    );
}

export interface CuriosityState {
    explorationDemand: number;
    discoveryFatigue: number;
    recentAcceptance: number;
    confidence: number;
}
export function sessionCuriosity(state: CuriosityState, sessionPreference?: number): number {
    if (sessionPreference !== undefined) return clamp01(sessionPreference);
    return round(
        clamp01(state.explorationDemand) * 0.5 +
            (1 - clamp01(state.discoveryFatigue)) * 0.25 +
            clamp01(state.recentAcceptance) * 0.25,
    );
}

export interface SurpriseBudgetV2 {
    trackNovelty: number;
    artistNovelty: number;
    genreDistance: number;
    semanticDistance: number;
    transitionNovelty: number;
    journeyNovelty: number;
}

export function surpriseCost(input: SurpriseBudgetV2): number {
    return round(Object.values(input).reduce((total, value) => total + clamp01(value), 0) / 6);
}

export function surpriseComposition(
    input: SurpriseBudgetV2,
    mode: "balanced" | "adventure-wild",
): {
    allowed: boolean;
    overloadedDimensions: number;
} {
    const overloadedDimensions = Object.values(input).filter((value) => value >= 0.7).length;
    return { allowed: mode === "adventure-wild" || overloadedDimensions <= 2, overloadedDimensions };
}

export function surpriseBalance(input: { itemNovelty: number; transitionNovelty: number }): {
    balanced: boolean;
    recommendation: "keep" | "simplify-item" | "simplify-transition";
} {
    const item = clamp01(input.itemNovelty);
    const transition = clamp01(input.transitionNovelty);
    if (item > 0.65 && transition > 0.65) {
        return { balanced: false, recommendation: item >= transition ? "simplify-transition" : "simplify-item" };
    }
    return { balanced: true, recommendation: "keep" };
}

export function discoveryBridge(input: {
    surprise: number;
    knownConnection: string;
    destination: string;
}): string | null {
    if (input.surprise < 0.55) return null;
    return `New for you — connects ${input.knownConnection} with ${input.destination}.`;
}

export function explanationRequirement(surprise: number): "none" | "optional" | "recommended" {
    return surprise >= 0.75 ? "recommended" : surprise >= 0.45 ? "optional" : "none";
}

export interface NoveltyVector {
    artistPopularity: number;
    trackPopularity: number;
    momentFamiliarity: number;
    communityPopularity: number;
    familiarArtist: boolean;
}
export function perceivedNovelty(input: NoveltyVector): number {
    const familiarity =
        clamp01(input.artistPopularity) * 0.2 +
        clamp01(input.trackPopularity) * 0.35 +
        clamp01(input.momentFamiliarity) * 0.25 +
        clamp01(input.communityPopularity) * 0.2 +
        (input.familiarArtist ? 0.12 : 0);
    return round(clamp01(1 - familiarity));
}

export const TRUST_FOUNDATIONS = [
    "reliability",
    "predictability",
    "reversibility",
    "truthful-explanations",
    "user-control",
    "correct-memory",
] as const;

export const RECOMMENDATION_FAILURES = [
    "too-repetitive",
    "too-narrow",
    "too-mainstream",
    "too-unfamiliar",
    "wrong-context",
    "wrong-mood",
    "ignored-correction",
    "overlearned-temporary-behavior",
    "bad-explanation",
    "unexpected-queue-manipulation",
] as const;
export type RecommendationFailure = (typeof RECOMMENDATION_FAILURES)[number];

export function recommendationProblemReport(
    problem: RecommendationFailure | "something-else",
    note?: string,
): {
    problem: RecommendationFailure | "something-else";
    note: string | null;
    changesLongTermTaste: false;
} {
    return { problem, note: note ?? null, changesLongTermTaste: false };
}

export function recommendationRecovery(negativeSignals: number): {
    sessionConfidenceMultiplier: number;
    familiarAnchorWeight: number;
    autonomyMultiplier: number;
    askLightweightIntent: boolean;
} {
    const severity = clamp01(negativeSignals / 3);
    return {
        sessionConfidenceMultiplier: round(1 - severity * 0.6),
        familiarAnchorWeight: round(0.4 + severity * 0.6),
        autonomyMultiplier: round(1 - severity * 0.7),
        askLightweightIntent: negativeSignals >= 2,
    };
}

export interface AutonomyState {
    level: number;
    trustConfidence: number;
}
export function updateAutonomy(
    state: AutonomyState,
    outcome: "accepted" | "corrected",
    newUser = false,
): AutonomyState {
    const delta = outcome === "accepted" ? 0.04 : -0.18;
    const ceiling = newUser ? 0.45 : 1;
    return {
        level: round(Math.min(ceiling, clamp01(state.level + delta))),
        trustConfidence: round(clamp01(state.trustConfidence + (outcome === "accepted" ? 0.03 : -0.12))),
    };
}

export function resetTodaysVibe<T>(longTermTaste: T): { sessionSignals: []; longTermTaste: T } {
    return { sessionSignals: [], longTermTaste };
}

export interface FairnessControls {
    popularHidden: number;
    familiarNew: number;
    sameBroaderArtists: number;
}
export function fairnessControls(
    mode: "simple" | "power",
    controls?: FairnessControls,
): {
    exposed: boolean;
    controls: FairnessControls;
} {
    return {
        exposed: mode === "power",
        controls: controls ?? { popularHidden: 0.5, familiarNew: 0.5, sameBroaderArtists: 0.5 },
    };
}

export interface InteractionPreference {
    automationPreference: number;
    controlDepth: number;
    explanationPreference: number;
}
export type ConsumptionAutonomy = "autonomous-user" | "hybrid-user" | "director-first-user";
export function consumptionArchetype(preference: InteractionPreference): ConsumptionAutonomy {
    if (preference.automationPreference <= 0.33) return "autonomous-user";
    if (preference.automationPreference >= 0.67) return "director-first-user";
    return "hybrid-user";
}

export const INTENT_LEVEL_CONTROLS = ["more-familiar", "less-repetitive", "more-discovery", "broader-artists"] as const;

export function journeyChangePreview(
    from: string,
    bridge: string,
    to: string,
    minutes: number,
): {
    route: string[];
    etaMinutes: number;
    previewBeforeCommit: true;
} {
    return { route: [from, bridge, to], etaMinutes: Math.max(0, Math.round(minutes)), previewBeforeCommit: true };
}

export function truthfulStateLanguage(input: { explicitSelection?: string; inferredDirection?: string }): string {
    if (input.explicitSelection) return `${input.explicitSelection} is currently selected.`;
    return `Beatcord is leaning toward ${input.inferredDirection ?? "a safer direction"}.`;
}
