import { describe, expect, test } from "bun:test";
import {
    exposureAgencyWeight,
    perceptualDifferenceBudget,
    playbackTwinConfidence,
    playbackTwinExperiment,
    playbackTwinPolicy,
} from "./playback-twin-causal-ledger-v2";

describe("playback twin and causal ledger v2", () => {
    test("represents the twin as calibrated estimate, not physical truth", () => {
        expect(
            playbackTwinConfidence({
                deviceIdentification: 1,
                frequencyResponseKnowledge: 0,
                environmentKnowledge: 0.5,
                spatialProfileQuality: 0,
                userPreferenceEvidence: 1,
            }),
        ).toBe(0.5);
    });
    test("budgets minimal perceptual difference by experience", () => {
        expect(perceptualDifferenceBudget("chill", false)).toEqual({
            tonalChange: 0.15,
            dynamicChange: 0.15,
            spatialChange: 0.075,
            loudnessChange: 0.075,
        });
        expect(perceptualDifferenceBudget("accessibility", true).tonalChange).toBe(0.8);
    });
    test("outputs policy without inventing HRTFs or a sound signature", () => {
        const result = playbackTwinPolicy({
            device: {
                deviceClass: "earbuds",
                form: "in-ear",
                frequencyResponseKnown: false,
                maxOutputKnown: false,
                latencyKnown: false,
            },
            environment: { noiseLevelClass: "loud", scene: "transport", confidence: 0.8, ephemeral: true },
            confidence: {
                deviceIdentification: 0.8,
                frequencyResponseKnowledge: 0,
                environmentKnowledge: 0.8,
                spatialProfileQuality: 0,
                userPreferenceEvidence: 0.7,
            },
        });
        expect(result).toMatchObject({ originalMasterPrimary: true, proprietaryHrtfGenerated: false });
        expect(result.adaptations).toContain("environment-volume-recommendation");
    });
    test("measures automation control boundaries", () => {
        expect(
            playbackTwinExperiment("suggested", {
                preference: 1,
                clarity: 1,
                naturalness: 1,
                artistFidelity: 1,
                fatigue: 0,
            }),
        ).toEqual({ mode: "suggested", score: 1, userControlBoundaryMeasured: true });
    });
    test("weights agency with explicit heuristic priors", () => {
        const searched = exposureAgencyWeight(
            { trackId: "x", exposureSource: "user-search", context: "home", recentAlgorithmicExposureCount: 0 },
            "complete",
        );
        expect(searched).toEqual({ weight: 1, heuristicPrior: true, saturationApplied: false });
    });
    test("saturates repeated algorithmic exposure", () => {
        const once = exposureAgencyWeight(
            {
                trackId: "x",
                exposureSource: "beatcord-recommendation",
                context: "home",
                recentAlgorithmicExposureCount: 0,
            },
            "complete",
        );
        const repeated = exposureAgencyWeight(
            {
                trackId: "x",
                exposureSource: "beatcord-recommendation",
                context: "home",
                recentAlgorithmicExposureCount: 3,
            },
            "complete",
        );
        expect(once.weight).toBe(0.35);
        expect(repeated).toEqual({ weight: 0.175, heuristicPrior: true, saturationApplied: true });
    });
});
