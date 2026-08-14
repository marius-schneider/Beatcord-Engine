import { describe, expect, test } from "bun:test";
import {
    APPLE_REALTIME_TOPOLOGY_V1,
    admitRealtimeModel,
    appleAnalysisRequest,
    creatorPermission,
    deadlineTelemetry,
    fuseMusicalEvidence,
    MUSIC_UNDERSTANDING_BENCH_V1,
} from "./platform-evidence-realtime-v1";

describe("platform evidence and realtime v1", () => {
    const vocal = {
        role: "vocal" as const,
        gainRangeDb: [-1.5, 1.5] as [number, number],
        muteAllowed: false,
        stemMixAllowed: false,
        transitionManipulationAllowed: false,
        preferredPreservation: 1,
    };

    test("enforces artist-authored interaction boundaries", () => {
        expect(creatorPermission({ envelope: vocal, operation: "gain", gainDb: 1 }).allowed).toBeTrue();
        expect(creatorPermission({ envelope: vocal, operation: "mute" })).toEqual({
            allowed: false,
            sourcePriority: "artist-authorized",
            inferenceMayOverride: false,
        });
    });
    test("targets only requested Apple analysis and keeps Beat Mesh independent", () => {
        expect(appleAnalysisRequest({ kinds: ["beats", "beats", "pace"] })).toEqual({
            requestedOnly: ["beats", "pace"],
            offlineCapable: true,
            replacementForBeatMesh: false,
        });
    });
    test("fuses providers and converts disagreement into uncertainty", () => {
        const fused = fuseMusicalEvidence([
            { provider: "apple", kind: "beats", confidence: 0.9, values: [1], native: true },
            { provider: "beatcord", kind: "beats", confidence: 0.9, values: [1.5], native: false },
        ]);
        expect(fused.providerCount).toBe(2);
        expect(fused.disagreement).toBeGreaterThan(0);
        expect(fused.confidence).toBeLessThan(0.9);
    });
    test("prioritizes native artist evidence during fusion", () => {
        const fused = fuseMusicalEvidence([
            { provider: "artist", kind: "key", confidence: 1, values: [4], native: true },
            { provider: "beatcord", kind: "key", confidence: 0.4, values: [8], native: false },
        ]);
        expect(fused.consensus[0]).toBeLessThan(6);
    });
    test("admits only bounded preallocated models inside the callback budget", () => {
        expect(
            admitRealtimeModel({
                profile: {
                    worstCaseMicros: 100,
                    memoryBytes: 1024,
                    modelVersion: "transient-v1",
                    deadlineClass: "audio-callback",
                    fallback: "detector",
                    preallocated: true,
                    boundedShapes: true,
                    performsIo: false,
                },
                otherDspMicros: 200,
                bufferDeadlineMicros: 1000,
                safetyMargin: 0.8,
            }).route,
        ).toBe("audio-workgroup");
    });
    test("moves unsafe or oversized models to lookahead", () => {
        expect(
            admitRealtimeModel({
                profile: {
                    worstCaseMicros: 900,
                    memoryBytes: 1024,
                    modelVersion: "large-v1",
                    deadlineClass: "audio-callback",
                    fallback: "bypass",
                    preallocated: false,
                    boundedShapes: true,
                    performsIo: true,
                },
                otherDspMicros: 200,
                bufferDeadlineMicros: 1000,
                safetyMargin: 0.8,
            }).route,
        ).toBe("lookahead-worker");
    });
    test("reports deadline percentiles and miss rate", () => {
        expect(deadlineTelemetry([100, 200, 300, 1200], 1000)).toMatchObject({
            worstCase: 1200,
            deadlineMissRate: 0.25,
        });
    });
    test("keeps heavy intelligence outside the realtime workgroup", () => {
        expect(APPLE_REALTIME_TOPOLOGY_V1.nonRealtime).toContain("llm");
        expect(MUSIC_UNDERSTANDING_BENCH_V1.catalog).toContain("rubato");
    });
});
