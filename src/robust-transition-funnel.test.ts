import { describe, expect, test } from "bun:test";
import {
    ANALYSIS_FUNNEL,
    analysisFunnel,
    bridgeTrackUtility,
    cheapMixabilityPredictor,
    counterfactualMixSearch,
    mixDifficulty,
    transitionAwareRecommendationScore,
    transitionRobustness,
} from "./robust-transition-funnel";

describe("robust transition funnel", () => {
    test("selects the safest high-value counterfactual", () => {
        expect(
            counterfactualMixSearch([
                { strategy: "stem-role-handoff", value: 1, risk: 0.5, manipulation: 0.4 },
                { strategy: "classic-eq-blend", value: 0.8, risk: 0.1, manipulation: 0.1 },
            ])?.strategy,
        ).toBe("classic-eq-blend");
    });
    test("tests quality under analysis perturbations", () => {
        expect(transitionRobustness(0.9, { bpmDelta: 0.2, phaseMs: 8, stemQualityDelta: 0.1 }, 0.8)).toEqual({
            robustness: 1,
            robust: true,
            samples: 5,
        });
        expect(transitionRobustness(0.5, { bpmDelta: 1, phaseMs: 30, stemQualityDelta: 0.3 }, 0.6).robust).toBeFalse();
    });
    test("allocates compute by pair difficulty", () => {
        const easy = {
            tempoGap: 0.1,
            gridUncertainty: 0.1,
            meterMismatch: 0,
            vocalDensity: 0.1,
            harmonicConflict: 0.1,
            stemQualityRisk: 0.1,
            structuralIncompatibility: 0.1,
            timbreShock: 0.1,
        };
        expect(mixDifficulty(easy).allocation).toBe("fast-plan");
        expect(
            mixDifficulty(Object.fromEntries(Object.keys(easy).map((key) => [key, 1])) as typeof easy).allocation,
        ).toBe("bridge-track");
    });
    test("uses bridge tracks only when route gain exceeds cost", () => {
        expect(bridgeTrackUtility({ routeImprovement: 0.9, extraTime: 0.2, userRelevanceCost: 0.1 })).toBe(0.6);
        expect(bridgeTrackUtility({ routeImprovement: 0.2, extraTime: 0.5, userRelevanceCost: 0.3 })).toBeLessThan(0);
    });
    test("includes cheap mixability before recommendation commitment", () => {
        expect(
            transitionAwareRecommendationScore({
                recommendationFit: 0.9,
                estimatedMixability: 0.8,
                transitionDifficulty: 0.2,
            }),
        ).toBe(0.86);
        expect(
            cheapMixabilityPredictor({
                tempo: 1,
                rhythmEmbedding: 1,
                structure: 1,
                vocalProbability: 0,
                harmonicActivity: 0,
                timbre: 1,
            }),
        ).toBe(1);
    });
    test("funnels catalog candidates before expensive analysis", () => {
        expect(ANALYSIS_FUNNEL).toEqual([10_000, 100, 20, 5, 2, 1]);
        expect(analysisFunnel()).toEqual({ valid: true, expensiveCandidates: 2, renderedCandidates: 1 });
        expect(analysisFunnel([100, 20, 30, 1]).valid).toBeFalse();
    });
});
