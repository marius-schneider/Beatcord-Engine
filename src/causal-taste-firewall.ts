const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
export interface CausalExposureContext {
    wasUserSelected: boolean;
    recommendationSource: string;
    rankPosition: number;
    explorationProbability?: number;
    propensity?: number;
    contextSpecific: boolean;
    algorithmicRepeatCount: number;
}
export function causalPreferenceEvidence(
    exposure: CausalExposureContext,
    feedback: "search" | "like" | "completed" | "skip",
): { weight: number; longTermEligible: boolean; independentDiscovery: boolean; reason: string } {
    const feedbackWeight = { search: 1, like: 0.85, completed: 0.35, skip: -0.7 }[feedback];
    const choiceMultiplier = exposure.wasUserSelected ? 1 : 0.45;
    const repeatDiscount = 1 / Math.max(1, exposure.algorithmicRepeatCount);
    const propensityWeight = exposure.propensity && exposure.propensity > 0 ? Math.min(2, 1 / exposure.propensity) : 1;
    const weight = round(
        Math.max(-1, Math.min(1, feedbackWeight * choiceMultiplier * repeatDiscount * propensityWeight)),
    );
    return {
        weight,
        longTermEligible:
            !exposure.contextSpecific && (exposure.wasUserSelected || feedback === "like" || feedback === "search"),
        independentDiscovery: exposure.wasUserSelected || exposure.recommendationSource === "external",
        reason: exposure.wasUserSelected ? "user-choice" : "algorithmic-exposure-discounted",
    };
}
export function causalPreferenceFirewall(input: {
    evidence: ReturnType<typeof causalPreferenceEvidence>;
    algorithmForced: boolean;
    sessionOnly: boolean;
}): { updateLongTerm: boolean; appliedWeight: number; learnsOwnEcho: false } {
    const updateLongTerm =
        input.evidence.longTermEligible &&
        !input.sessionOnly &&
        (!input.algorithmForced || input.evidence.independentDiscovery);
    return {
        updateLongTerm,
        appliedWeight: updateLongTerm ? clamp01(Math.abs(input.evidence.weight)) * Math.sign(input.evidence.weight) : 0,
        learnsOwnEcho: false,
    };
}
