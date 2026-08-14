import { describe, expect, test } from "bun:test";
import {
    calibrationBenchmark,
    calibrationDrift,
    causalTasteFirewallV2,
    confidenceStack,
    counterfactualTasteMemory,
    DECISION_RELEVANCE_MATRIX,
    microRandomizedRecommendation,
    safeActionSet,
    selfInfluenceAlarm,
    transitionMonteCarlo,
} from "./causal-decision-confidence-v3";

describe("causal taste and decision confidence v3", () => {
    test("separates observed consumption from voluntary preference", () => {
        const relation = counterfactualTasteMemory({
            consumptionSignals: [1, 0.8],
            voluntarySignals: [0.3],
            recommendationSignals: [0.9, 1],
        });
        expect(relation.consumptionAffinity).toBe(0.9);
        expect(relation.voluntaryAffinity).toBe(0.3);
        expect(relation.exposureBiasRisk).toBe(0.65);
    });

    test("micro-randomizes only candidates above the experience floor", () => {
        const result = microRandomizedRecommendation(
            [
                { id: "a", quality: 0.92 },
                { id: "b", quality: 0.91 },
                { id: "bad", quality: 0.2 },
            ],
            0.9,
            7,
        );
        expect(result.propensities.map((row) => row.candidateId)).toEqual(["a", "b"]);
        expect(result.propensities.reduce((sum, row) => sum + row.probability, 0)).toBeCloseTo(1, 5);
        expect(result.unsafeCandidatesExcluded).toBeTrue();
    });

    test("firewalls contextual algorithmic exposure from global taste", () => {
        const result = causalTasteFirewallV2({
            agency: 0.8,
            contextSpecific: true,
            algorithmicExposure: 0.7,
            repeatCount: 3,
            sessionOnly: false,
            signal: 1,
        });
        expect(result.persistentWeight).toBe(0);
        expect(result.sessionWeight).toBeGreaterThan(0);
        expect(result.steps).toHaveLength(6);
    });

    test("alarms on policy-contaminated taste evidence", () => {
        const result = selfInfluenceAlarm({
            selfInfluence: 0.82,
            algorithmicExposureConcentration: 0.8,
            artistConcentration: 0.4,
            genreConcentration: 0.5,
            voluntarySearchDiversity: 0.2,
            discoveryAcceptance: 0.5,
            recommendationOriginShare: 0.82,
        });
        expect(result.alarm).toBeTrue();
        expect(result.actions).toContain("increase-voluntary-signal-weight");
    });

    test("separates calibrated relevant evidence from plan robustness", () => {
        const result = confidenceStack(
            [
                {
                    confidence: {
                        rawModelConfidence: 0.95,
                        calibratedConfidence: 0.8,
                        domainCalibration: 0.7,
                        sectionCalibration: 0.9,
                    },
                    relevance: 1,
                },
                {
                    confidence: {
                        rawModelConfidence: 0.2,
                        calibratedConfidence: 0.2,
                        domainCalibration: 0.2,
                        sectionCalibration: 0.2,
                    },
                    relevance: 0,
                },
            ],
            0.8,
        );
        expect(result).toEqual({ relevantEvidence: 0.7, planRobustness: 0.8, finalConfidence: 0.56 });
        expect(DECISION_RELEVANCE_MATRIX["drum-swap"].harmony).toBeLessThan(
            DECISION_RELEVANCE_MATRIX["vocal-mashup"].harmony,
        );
    });

    test("uses perturbations to form a safe action set", () => {
        const robust = transitionMonteCarlo({
            baseQuality: 0.95,
            bpmUncertainty: 0.1,
            phaseUncertainty: 0.1,
            keyUncertainty: 0.1,
            stemUncertainty: 0.1,
            qualityFloor: 0.8,
        });
        const risky = transitionMonteCarlo({
            baseQuality: 0.7,
            bpmUncertainty: 0.5,
            phaseUncertainty: 0.5,
            keyUncertainty: 0.5,
            stemUncertainty: 0.5,
            qualityFloor: 0.8,
        });
        expect(
            safeActionSet([
                { action: "eq-blend", robustness: robust.robustness },
                { action: "stem-mashup", robustness: risky.robustness },
            ]),
        ).toEqual({ safe: ["eq-blend"], risky: ["stem-mashup"], conformalInspired: true });
    });

    test("benchmarks catastrophic high-confidence errors and drift", () => {
        const benchmark = calibrationBenchmark([
            { predicted: 0.95, correct: false, catastrophic: true },
            { predicted: 0.9, correct: true },
        ]);
        expect(benchmark.catastrophicHighConfidenceErrorRate).toBe(0.5);
        expect(
            calibrationDrift({ baselineError: 0.05, currentError: 0.12, modelVersionChanged: false, domainShift: 0 })
                .recalibrate,
        ).toBeTrue();
    });
});
