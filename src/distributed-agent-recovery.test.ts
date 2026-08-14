import { describe, expect, test } from "bun:test";
import {
    AI_FAILURE_TYPES,
    applyBeatgridOverrides,
    clockSynchronization,
    confidenceSeparation,
    DIRECTOR_STATE_GRAPH,
    ENGINE_PHILOSOPHY_V2,
    jitterBufferWindow,
    LLM_MUSIC_BENCHMARK,
    MULTI_DEVICE_POLICY,
    MUSIC_QUALITY_JUDGES,
    networkFailurePolicy,
    nextDirectorState,
    recommendationAgentSlo,
    recoverConversationEntity,
    scheduleFutureEvent,
    unifiedRecovery,
} from "./distributed-agent-recovery";

describe("distributed runtime and agent recovery", () => {
    test("uses master audio as authoritative distributed presentation clock", () => {
        const result = clockSynchronization(
            { sessionEpoch: 1n, offsetNs: 0, driftPpm: 1, jitterNs: 1_000, confidence: 0.99 },
            "lighting",
        );
        expect(result.authority).toBe("master-audio-device");
        expect(result.framePerfectClaimAllowed).toBe(true);
        expect(
            clockSynchronization(
                { sessionEpoch: 1n, offsetNs: 0, driftPpm: 1, jitterNs: 1_000, confidence: 0.99 },
                "remote-audio",
            ).multiroomAudioCapabilityRequired,
        ).toBe(true);
    });

    test("sends future sample/time events early for local scheduling", () => {
        expect(
            scheduleFutureEvent(
                { event: "UPCOMING_DROP", sessionSample: 283443200, sessionTime: 590.506, confidence: 0.99 },
                580,
            ),
        ).toMatchObject({ reliability: "sample-locked", scheduleLocally: true, sentEarly: true });
    });

    test("sizes jitter buffers without send-now commands", () => {
        expect(jitterBufferWindow({ jitterMs: 10, renderLatencyMs: 20, predictionHorizonMs: 500 })).toEqual({
            bufferMs: 50,
            usableHorizonMs: 450,
            sendNowCommandForbidden: true,
        });
    });

    test("continues scheduled events then stops horizon and resyncs", () => {
        expect(networkFailurePolicy(2, 1_000).action).toBe("continue-scheduled");
        expect(networkFailurePolicy(0, 5_000).action).toBe("stop-horizon");
        expect(networkFailurePolicy(0, 15_000)).toEqual({ action: "resync", abruptJump: false });
    });

    test("keeps v1 audio on one master and treats multiroom separately", () => {
        expect(MULTI_DEVICE_POLICY.v1AudioOutputs).toBe(1);
        expect(MULTI_DEVICE_POLICY.requiredForMultiroom).toHaveLength(4);
    });

    test("uses a constrained seven-node director state graph and failure taxonomy", () => {
        expect(DIRECTOR_STATE_GRAPH).toHaveLength(7);
        expect(AI_FAILURE_TYPES).toHaveLength(10);
        expect(
            nextDirectorState({
                node: "resolve-entities",
                outcome: "recoverable-failure",
                failure: "entity-resolution",
            }),
        ).toEqual({ action: "recover", playbackContinues: true });
    });

    test("resolves entities only with a clear context winner", () => {
        expect(
            recoverConversationEntity([
                { id: "a", label: "Animals", contextConfidence: 0.9, available: true },
                { id: "b", label: "Animals", contextConfidence: 0.5, available: true },
            ]).selected,
        ).toBe("a");
        expect(
            recoverConversationEntity([
                { id: "a", label: "Animals", contextConfidence: 0.8, available: true },
                { id: "b", label: "Animals", contextConfidence: 0.75, available: true },
            ]),
        ).toMatchObject({ selected: null, showNonBlockingAmbiguityUi: true, playbackContinues: true });
    });

    test("evaluates recommendation agent production SLOs", () => {
        expect(
            recommendationAgentSlo({
                intentSuccess: 0.99,
                entityResolutionAccuracy: 0.99,
                constraintViolationRate: 0,
                toolRecoveryRate: 0.99,
                medianLatencyMs: 300,
                planApplicationSuccess: 1,
            }).met,
        ).toBe(true);
        expect(
            recommendationAgentSlo({
                intentSuccess: 0.5,
                entityResolutionAccuracy: 1,
                constraintViolationRate: 0,
                toolRecoveryRate: 1,
                medianLatencyMs: 300,
                planApplicationSuccess: 1,
            }).failures,
        ).toEqual(["intent"]);
    });

    test("benchmarks language separately and never relies on an LLM judge alone", () => {
        expect(LLM_MUSIC_BENCHMARK).toHaveLength(8);
        expect(MUSIC_QUALITY_JUDGES).toEqual(["signal-metrics", "specialized-models", "human-tests"]);
    });

    test("gives power-user grid corrections highest priority", () => {
        expect(
            applyBeatgridOverrides({ beat: 1, downbeat: 2, phrase: 3 }, [
                { kind: "downbeat", valueSeconds: 4, source: "power-user", priority: "highest" },
            ]),
        ).toEqual({ beat: 1, downbeat: 4, phrase: 3 });
        expect(confidenceSeparation(0.9, 0.6)).toEqual({
            syncConfidence: 0.9,
            transitionConfidence: 0.6,
            fused: false,
        });
    });

    test("repairs locally or downgrades before safe continuation", () => {
        expect(unifiedRecovery({ domain: "audio", localRepairAvailable: true, capability: "stems" }).steps).toEqual([
            "detect",
            "local-repair",
            "validate",
        ]);
        expect(
            unifiedRecovery({ domain: "network", localRepairAvailable: false, capability: "future-events" }),
        ).toEqual({
            steps: ["detect", "downgrade:future-events", "safe-continuation", "replan-future"],
            safeContinuation: true,
            replanFuture: true,
        });
    });

    test("fixes planning, uncertainty, graceful degradation and grounding as universal principles", () => {
        expect(ENGINE_PHILOSOPHY_V2).toMatchObject({
            planAhead: "do-not-improvise-in-realtime",
            knowUncertainty: "confidence-is-part-of-feature",
            degradeGracefully: "simple-correct-beats-broken-intelligence",
            groundEverything: "catalog-and-audio-evidence-required",
            recoveryPreferredOverFreeAutonomy: true,
        });
    });
});
