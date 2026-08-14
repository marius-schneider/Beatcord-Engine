import { describe, expect, test } from "bun:test";
import {
    AGENT_PRODUCTION_PRINCIPLE,
    agentRetryDecision,
    applyTemporalPolicy,
    BASS_BENCHMARK_2026,
    fuseMusicEvidence,
    MELO_PRODUCTION_EVIDENCE,
    reflectiveRetry,
    relaxYearRange,
    SPECIALIST_ENSEMBLE,
    temporalIntentGraph,
} from "./temporal-agent-orchestration";

describe("temporal agent orchestration", () => {
    test("models session language as temporal policies rather than search queries", () => {
        const graph = temporalIntentGraph([
            {
                startCondition: { kind: "now" },
                endCondition: { kind: "time", value: 23.5 },
                changes: { familiarity: 0.9, mixIntensity: 0.5 },
                sourceText: "known until 23:30",
            },
            {
                startCondition: { kind: "time", value: 23.5 },
                changes: { energy: 0.9, discovery: 0.5 },
                sourceText: "then escalate",
            },
        ]);
        expect(graph.nodes).toHaveLength(2);
        expect(graph.temporalPoliciesNotQueries).toBe(true);
    });
    test("activates elapsed policies inside their time window", () => {
        const intent = {
            startCondition: { kind: "elapsed" as const, value: 600 },
            endCondition: { kind: "elapsed" as const, value: 1200 },
            changes: { energy: 0.8 },
            sourceText: "after dinner",
        };
        expect(applyTemporalPolicy(intent, 1_700, 1_000)).toEqual({ active: true, patch: { energy: 0.8 } });
        expect(applyTemporalPolicy(intent, 2_300, 1_000).active).toBe(false);
    });
    test("relaxes exact year/BPM while preserving hard and musical constraints", () => {
        const result = reflectiveRetry(
            [
                { id: "clean", value: true as unknown as string, importance: 1, relaxability: 0, kind: "clean-only" },
                { id: "year", value: 2008, importance: 0.3, relaxability: 0.9, kind: "year" },
                { id: "genre", value: "french-house", importance: 0.9, relaxability: 0.1, kind: "genre" },
            ],
            ["no candidate"],
        );
        expect(result.relax).toEqual(["year"]);
        expect(result.preserve).toContain("clean");
        expect(result.genericFallbackForbidden).toBe(true);
        expect(relaxYearRange(2008)).toEqual({ from: 2005, to: 2011 });
    });
    test("protects sample-precise specialist evidence from semantic override", () => {
        const fused = fuseMusicEvidence([
            { value: 12.01, source: "beat-tracker", confidence: 0.8, precisionClass: "sample" },
            { value: 13, source: "audio-lm", confidence: 0.99, precisionClass: "semantic" },
        ]);
        expect(fused.selected?.source).toBe("beat-tracker");
        expect(fused.specialistPrecisionProtected).toBe(true);
    });
    test("keeps specialist MIR models alongside audio-language reasoning", () => {
        expect(SPECIALIST_ENSEMBLE.specialists).toHaveLength(4);
        expect(SPECIALIST_ENSEMBLE.monolithicAudioAiTrusted).toBe(false);
    });
    test("captures BASS limitations instead of blindly trusting audio LMs", () => {
        expect(BASS_BENCHMARK_2026).toMatchObject({
            questions: 2658,
            songs: 1993,
            tasks: 12,
            higherLevelReasoningReliable: false,
        });
    });
    test("records production grounding and reflective recovery evidence", () => {
        expect(MELO_PRODUCTION_EVIDENCE.reflectiveRetrySessionRate).toBe(0.058);
        expect(MELO_PRODUCTION_EVIDENCE.processRecoveryRate).toBe(0.59);
    });
    test("retries recoverable tool/candidate failures but hard-fails ungrounded entities", () => {
        expect(
            agentRetryDecision({ entityGrounded: true, toolChainSucceeded: false, candidateQuality: 0.8 }).action,
        ).toBe("reflective-retry");
        expect(
            agentRetryDecision({ entityGrounded: false, toolChainSucceeded: true, candidateQuality: 1 }).action,
        ).toBe("hard-failure");
    });
    test("fixes grounding, state graph and retry as production principles", () => {
        expect(AGENT_PRODUCTION_PRINCIPLE).toMatchObject({
            catalogGrounding: true,
            deterministicStateGraph: true,
            reflectiveRetry: true,
            freeAutonomousAgent: false,
        });
    });
});
