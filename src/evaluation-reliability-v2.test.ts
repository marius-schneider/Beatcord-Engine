import { describe, expect, test } from "bun:test";
import {
    FULL_RESEARCH_ARCHITECTURE,
    failureAnalytics,
    GOLDEN_TRANSITION_CORPUS_V2,
    listeningTestDesign,
    PRODUCT_INTERVENTION_PRINCIPLE,
    personalizedCritic,
    preserveExpertDisagreement,
    RELIABILITY_SLOS,
    RESEARCH_COMPLETION_AREAS,
    RESEARCH_SOURCE_REGISTRY_V2,
    reliabilitySloStatus,
    researchConfidence,
    shadowEvaluation,
    TRANSITION_FAILURE_TYPES,
} from "./evaluation-reliability-v2";

describe("evaluation and reliability v2", () => {
    test("keeps expert and casual preferences as separate cohorts", () => {
        const result = preserveExpertDisagreement([
            { cohort: "dj", candidateId: "a", score: 0.9, listeners: 10 },
            { cohort: "dj", candidateId: "b", score: 0.6, listeners: 10 },
            { cohort: "casual", candidateId: "a", score: 0.5, listeners: 100 },
            { cohort: "casual", candidateId: "b", score: 0.85, listeners: 100 },
        ]);
        expect(result.winners).toMatchObject({ dj: "a", casual: "b" });
        expect(result.disagreement).toBe(true);
    });

    test("applies a global quality floor before personal mixing taste", () => {
        const result = personalizedCritic([
            { id: "broken-favorite", globalQuality: 0.4, userMixingPreference: 1 },
            { id: "valid", globalQuality: 0.8, userMixingPreference: 0.6 },
        ]);
        expect(result.selected).toBe("valid");
        expect(result.rejectedBelowFloor).toEqual(["broken-favorite"]);
        expect(result.qualityFloorAppliedFirst).toBe(true);
    });

    test("uses the complete transition failure taxonomy", () => {
        expect(TRANSITION_FAILURE_TYPES).toHaveLength(14);
        expect(TRANSITION_FAILURE_TYPES).toContain("BUFFER");
    });

    test("aggregates failures by rate and diagnostic dimensions", () => {
        const result = failureAnalytics([
            { type: "GRID", genre: "house", device: "phone", experience: "party", fallback: true, corrected: false },
            { type: "VOCAL", genre: "pop", device: "speaker", experience: "love", fallback: false, corrected: true },
        ]);
        expect(result.rates.GRID).toBe(0.5);
        expect(result.fallbackRate).toBe(0.5);
        expect(result.dimensions.genres).toEqual(["house", "pop"]);
    });

    test("evaluates technical SLOs before product metrics", () => {
        const status = reliabilitySloStatus({
            dropoutRate: 0,
            catastrophicGridFailureRate: 0,
            fallbackSuccessRate: 1,
            commitMissRate: 0,
        });
        expect(status.met).toBe(true);
        expect(status.evaluatedBeforeProductMetrics).toBe(true);
        expect(RELIABILITY_SLOS.fallbackSuccessRate).toBe(0.995);
    });

    test("keeps shadow critics and directors playback-inert", () => {
        expect(shadowEvaluation("plays-b", "would-play-c", "feedback-1")).toEqual({
            production: "plays-b",
            experimental: "would-play-c",
            affectsPlayback: false,
            feedbackId: "feedback-1",
        });
    });

    test("covers the full golden transition corpus v2", () => {
        expect(GOLDEN_TRANSITION_CORPUS_V2).toHaveLength(15);
        expect(GOLDEN_TRANSITION_CORPUS_V2).toContain("bluetooth-route");
        expect(GOLDEN_TRANSITION_CORPUS_V2).toContain("buffer-starvation");
    });

    test("selects MUSHRA for large effects and BS.1116 for small artifacts", () => {
        expect(listeningTestDesign("large", ["a", "b"]).standard).toBe("MUSHRA");
        const subtle = listeningTestDesign("small", ["a", "b"]);
        expect(subtle.standard).toBe("BS.1116");
        expect(subtle).toMatchObject({ blind: true, randomized: true, levelMatched: true, referenceHidden: true });
    });

    test("registers research domains and completion criteria", () => {
        expect(RESEARCH_SOURCE_REGISTRY_V2.realtime).toContain("AudioWorklet");
        expect(RESEARCH_COMPLETION_AREAS).toHaveLength(23);
    });

    test("marks experimental claims as requiring Beatcord user studies", () => {
        expect(researchConfidence("sample-scheduling")).toEqual({ confidence: "high", userStudyRequired: false });
        expect(researchConfidence("transition-naturalness")).toEqual({
            confidence: "experimental",
            userStudyRequired: true,
        });
    });

    test("captures the complete post-research architecture and restraint principle", () => {
        expect(FULL_RESEARCH_ARCHITECTURE).toHaveLength(16);
        expect(PRODUCT_INTERVENTION_PRINCIPLE.preserveMusicWhenInterventionAddsNoValue).toBe(true);
        expect(PRODUCT_INTERVENTION_PRINCIPLE.keyIsStrongSignalNotUniversalHardGate).toBe(true);
    });
});
