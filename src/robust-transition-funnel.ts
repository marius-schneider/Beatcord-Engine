const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
export type CounterfactualStrategy = "preserve-cut-tail" | "classic-eq-blend" | "stem-role-handoff" | "short-blend";
export interface CounterfactualCandidate {
    strategy: CounterfactualStrategy;
    value: number;
    risk: number;
    manipulation: number;
}
export function counterfactualMixSearch(
    candidates: readonly CounterfactualCandidate[],
): CounterfactualCandidate | null {
    return (
        [...candidates].sort((a, b) => b.value - b.risk - b.manipulation - (a.value - a.risk - a.manipulation))[0] ??
        null
    );
}

export interface UncertaintyRange {
    bpmDelta: number;
    phaseMs: number;
    stemQualityDelta: number;
}
export function transitionRobustness(
    baseQuality: number,
    uncertainty: UncertaintyRange,
    qualityFloor: number,
): { robustness: number; robust: boolean; samples: number } {
    const perturbations = [-1, -0.5, 0, 0.5, 1];
    const qualities = perturbations.map(
        (factor) =>
            baseQuality -
            Math.abs(factor) *
                (uncertainty.bpmDelta * 0.02 + uncertainty.phaseMs / 1_000 + uncertainty.stemQualityDelta * 0.2),
    );
    const passing = qualities.filter((quality) => quality >= qualityFloor).length;
    const robustness = passing / qualities.length;
    return { robustness, robust: robustness >= 0.8, samples: qualities.length };
}

export interface MixDifficultyFeatures {
    tempoGap: number;
    gridUncertainty: number;
    meterMismatch: number;
    vocalDensity: number;
    harmonicConflict: number;
    stemQualityRisk: number;
    structuralIncompatibility: number;
    timbreShock: number;
}
export function mixDifficulty(input: MixDifficultyFeatures): {
    score: number;
    class: "easy" | "medium" | "hard" | "extreme";
    allocation: "fast-plan" | "preview" | "multiple-candidates" | "bridge-track";
} {
    const score = round(Object.values(input).reduce((sum, value) => sum + clamp01(value), 0) / 8);
    if (score < 0.25) return { score, class: "easy", allocation: "fast-plan" };
    if (score < 0.5) return { score, class: "medium", allocation: "preview" };
    if (score < 0.75) return { score, class: "hard", allocation: "multiple-candidates" };
    return { score, class: "extreme", allocation: "bridge-track" };
}
export function bridgeTrackUtility(input: {
    routeImprovement: number;
    extraTime: number;
    userRelevanceCost: number;
}): number {
    return round(clamp01(input.routeImprovement) - clamp01(input.extraTime) - clamp01(input.userRelevanceCost));
}
export function transitionAwareRecommendationScore(input: {
    recommendationFit: number;
    estimatedMixability: number;
    transitionDifficulty: number;
}): number {
    return round(
        clamp01(input.recommendationFit) * 0.6 +
            clamp01(input.estimatedMixability) * 0.3 +
            (1 - clamp01(input.transitionDifficulty)) * 0.1,
    );
}
export interface CheapMixabilitySignals {
    tempo: number;
    rhythmEmbedding: number;
    structure: number;
    vocalProbability: number;
    harmonicActivity: number;
    timbre: number;
}
export function cheapMixabilityPredictor(input: CheapMixabilitySignals): number {
    return round(
        clamp01(input.tempo) * 0.2 +
            clamp01(input.rhythmEmbedding) * 0.2 +
            clamp01(input.structure) * 0.2 +
            (1 - clamp01(input.vocalProbability)) * 0.1 +
            (1 - clamp01(input.harmonicActivity)) * 0.1 +
            clamp01(input.timbre) * 0.2,
    );
}
export const ANALYSIS_FUNNEL = [10_000, 100, 20, 5, 2, 1] as const;
export function analysisFunnel(stageCounts: readonly number[] = ANALYSIS_FUNNEL): {
    valid: boolean;
    expensiveCandidates: number;
    renderedCandidates: number;
} {
    const valid = stageCounts.every((count, index) => index === 0 || count <= (stageCounts[index - 1] ?? 0));
    return { valid, expensiveCandidates: stageCounts.at(-2) ?? 0, renderedCandidates: stageCounts.at(-1) ?? 0 };
}
