import { describe, expect, test } from "bun:test";
import {
    analyzerRouter,
    artifactAwareLoopScore,
    cleanStemRegion,
    degradationAwareEnhancement,
    distilledStrategyPrior,
    djSafeRestoration,
    identityDifference,
    personalizedSyncTightness,
    provenanceWeightedAnalysis,
    requiredStemQuality,
    transferableMixPattern,
    transitionFingerprintSimilarity,
    transitionWeightedGridError,
} from "./analyzer-transition-knowledge";

describe("analyzer and transition knowledge", () => {
    test("weights grid errors where transitions happen", () => {
        expect(
            transitionWeightedGridError([
                { error: 0.1, transitionWeight: 1 },
                { error: 0.9, transitionWeight: 0 },
            ]),
        ).toBe(0.1);
    });
    test("routes analyzers from domain telemetry", () => {
        expect(
            analyzerRouter(
                [
                    { analyzer: "a", domain: "rock", section: "any", confidence: 0.9, success: 0.8, samples: 20 },
                    { analyzer: "b", domain: "rock", section: "outro", confidence: 0.9, success: 0.9, samples: 20 },
                ],
                "rock",
                "outro",
            ),
        ).toEqual({ analyzer: "b", empiricalReliability: 0.9 });
    });
    test("lets manual corrections dominate model evidence", () => {
        expect(
            provenanceWeightedAnalysis([
                { value: 1, provenance: "beatcord-model", confidence: 1 },
                { value: 2, provenance: "dj-correction", confidence: 0.8 },
            ]),
        ).toMatchObject({ value: 2, provenance: "dj-correction", confidence: 0.8 });
    });
    test("personalizes sync tightness without erasing style", () => {
        expect(personalizedSyncTightness({ style: "club-edm", userPreference: 1 })).toBe(0.965);
        expect(personalizedSyncTightness({ style: "funk-disco", userPreference: 0 })).toBe(0.385);
    });
    test("budgets stem precision by exposure and picks clean windows", () => {
        expect(requiredStemQuality(1, 1, 1)).toBe(1);
        expect(requiredStemQuality(0.5, 0.5, 0.5)).toBe(0.125);
        expect(
            cleanStemRegion(
                [
                    { start: 0, end: 10, confidence: 0.6 },
                    { start: 10, end: 20, confidence: 0.95 },
                ],
                0.8,
            )?.start,
        ).toBe(10);
    });
    test("penalizes repeated artifacts in loops", () => {
        expect(artifactAwareLoopScore(1, 0.1, 1)).toBe(0.9);
        expect(artifactAwareLoopScore(1, 0.1, 9)).toBe(0.7);
    });
    test("reuses similar transition motifs rather than pairs", () => {
        const a = { rhythmic: [1], harmonic: [0.8], timbral: [0.6], roleHandoff: [1, 0], energyCurve: [0.5, 1] };
        expect(transitionFingerprintSimilarity(a, a)).toBe(1);
    });
    test("generalizes high-quality mixability graph patterns", () => {
        const edge = {
            fromMoment: "a",
            toMoment: "b",
            strategy: "drum-first",
            quality: 0.9,
            context: "party",
            outroType: "percussion",
            introType: "drum",
            rolePlan: "drums-bass",
        };
        expect(transferableMixPattern([edge], "percussion", "drum")).toEqual(edge);
    });
    test("distills only a prior while retaining deterministic validation", () => {
        expect(
            distilledStrategyPrior([
                { strategy: "blend", probability: 0.8 },
                { strategy: "cut", probability: 0.2 },
            ]),
        ).toEqual({ prior: "blend", deterministicValidationRequired: true });
    });
    test("enhances only confidently detected degradation", () => {
        expect(degradationAwareEnhancement({ codecDamage: 0, noise: 0, clipping: 0, bandwidthLoss: 0 }, 1)).toEqual({
            enhance: false,
            reason: "none",
        });
        expect(degradationAwareEnhancement({ codecDamage: 0.8, noise: 0, clipping: 0, bandwidthLoss: 0 }, 0.9)).toEqual(
            { enhance: true, reason: "codecDamage" },
        );
    });
    test("guards restoration with disentangled identity difference", () => {
        const difference = identityDifference({ rhythm: 0.1, melody: 0.1, timbre: 0.2, spatial: 0.2 });
        expect(difference).toBe(0.14);
        expect(
            djSafeRestoration({ transitionUtilityGain: 0.2, identityDifference: difference, threshold: 0.2 }),
        ).toEqual({ allowed: true, artistIdentityGuarded: true });
    });
});
