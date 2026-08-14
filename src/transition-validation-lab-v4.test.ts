import { describe, expect, test } from "bun:test";
import {
    mixPointPrior,
    preferenceGraph,
    TRANSITION_LAB_V4,
    transitionCriticV4,
    transitionLabShipGate,
} from "./transition-validation-lab-v4";

describe("transition validation lab v4", () => {
    const diagnostics = {
        loudnessControl: 0.9,
        spectralCollision: 0.2,
        spectralContinuity: 0.8,
        trajectorySmoothness: 0.7,
        stereoStability: 0.9,
        beatConsistency: 1,
        musicalPhrasing: 0.75,
        journeyFit: 0.85,
    };

    test("keeps technical, perceptual, musical and experience layers separate", () => {
        const critic = transitionCriticV4(diagnostics);
        expect(Object.keys(critic.layers)).toEqual(["technical", "perceptual", "musical", "experience"]);
        expect(critic.scalarForRankingOnly).toBeGreaterThan(0);
    });
    test("retains diagnostic dimensions instead of hiding them in one score", () => {
        expect(transitionCriticV4(diagnostics).dimensions.spectralCollision).toBe(0.2);
        expect(TRANSITION_LAB_V4.measurableCore).toHaveLength(6);
    });
    test("builds a pairwise preference ranking", () => {
        const graph = preferenceGraph([
            { preferredId: "A", rejectedId: "C", expertise: "dj", labels: ["phrasing"] },
            { preferredId: "C", rejectedId: "B", expertise: "casual-listener", labels: ["naturalness"] },
            { preferredId: "A", rejectedId: "B", expertise: "mix-engineer", labels: ["clarity"] },
        ]);
        expect(graph.ranking[0]).toBe("A");
        expect(graph.absoluteRegressorUsed).toBeFalse();
    });
    test("learns where humans mix separately from how the system mixes", () => {
        expect(mixPointPrior({ structuralMatch: 1, genreMatch: 0, energyMatch: 1, roleMatch: 1 })).toBe(0.85);
        expect(TRANSITION_LAB_V4.corpusSources).toContain("raveform-mix-points");
    });
    test("compares minimum intervention through expressive treatment", () => {
        expect(TRANSITION_LAB_V4.conditions).toEqual(["preserve", "simple-eq", "role-stem", "expressive-fx"]);
    });
    test("splits listener and expert panels", () => {
        expect(TRANSITION_LAB_V4.expertiseGroups).toContain("casual-listener");
        expect(TRANSITION_LAB_V4.expertiseGroups).toContain("mix-engineer");
    });
    test("ships an improved critic only with acceptable operational regressions", () => {
        expect(
            transitionLabShipGate({
                pairwisePreferenceGain: 0.1,
                catastrophicRejectionGain: 0,
                naturalnessGain: 0,
                journeyFitGain: 0,
                computeRegression: 0.03,
                latencyRegression: 0.01,
                reliabilityRegression: 0,
            }).ship,
        ).toBeTrue();
        expect(
            transitionLabShipGate({
                pairwisePreferenceGain: 0.1,
                catastrophicRejectionGain: 0,
                naturalnessGain: 0,
                journeyFitGain: 0,
                computeRegression: 0.2,
                latencyRegression: 0,
                reliabilityRegression: 0,
            }).ship,
        ).toBeFalse();
    });
    test("covers human functional regions used for mix-point priors", () => {
        expect(TRANSITION_LAB_V4.functionalRegions).toContain("drop");
        expect(TRANSITION_LAB_V4.functionalRegions).toContain("ambient-intro-outro");
    });
});
