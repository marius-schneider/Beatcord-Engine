import { describe, expect, test } from "bun:test";
import {
    beatSafeResynchronization,
    choosePacketRecovery,
    compilePresentationProgram,
    momentAwareProtection,
    qosForMedia,
    SESSION_FABRIC_V2,
    scheduleMediaObject,
    TRANSPORT_BENCHMARK_SUITE_V2,
    transportRecoveryPolicy,
} from "./deadline-transport-runtime-v2";

describe("deadline transport runtime v2", () => {
    const endpoint = { decodeMs: 10, renderMs: 5, deviceMs: 20, transportMs: 35, confidence: 0.9 };

    test("retransmits only when the packet can beat its playout deadline", () => {
        expect(
            choosePacketRecovery({
                retransmissionEtaMs: 12,
                timeUntilPlayoutMs: 20,
                fecAvailable: true,
                dredAvailable: true,
                dredMaturity: "prototype",
            }),
        ).toBe("retransmit");
        expect(
            choosePacketRecovery({
                retransmissionEtaMs: 22,
                timeUntilPlayoutMs: 20,
                fecAvailable: true,
                dredAvailable: false,
                dredMaturity: "watch",
            }),
        ).toBe("fec");
    });
    test("keeps DRED experimental and uses it only in an explicit prototype", () => {
        expect(
            choosePacketRecovery({
                retransmissionEtaMs: 40,
                timeUntilPlayoutMs: 20,
                fecAvailable: false,
                dredAvailable: true,
                dredMaturity: "prototype",
            }),
        ).toBe("dred");
        expect(SESSION_FABRIC_V2.prototypeWatch).toContain("opus-dred");
    });
    test("raises protection before important moments without unbounded buffering", () => {
        expect(momentAwareProtection({ importance: 1, startTime: 1000, durationMs: 4000 })).toMatchObject({
            redundancy: "maximum",
            bufferMarginMs: 40,
            latencyInflationCapped: true,
        });
    });
    test("assigns media to musical QoS classes", () => {
        expect(qosForMedia("audio")).toBe("A");
        expect(qosForMedia("lyrics")).toBe("B");
        expect(qosForMedia("analytics")).toBe("D");
    });
    test("schedules backwards from desired perceived presentation time", () => {
        const object = scheduleMediaObject({
            id: "drop",
            kind: "lights",
            presentationTime: 1000,
            priority: 9,
            payloadRef: "event:drop",
            endpoint,
            transitionCritical: true,
        });
        expect(object.requiredSendTime).toBe(930);
        expect(object.deadline).toBe(975);
        expect(object.qosClass).toBe("A");
    });
    test("corrects drift transparently and rejoins large drift on musical boundaries", () => {
        expect(
            beatSafeResynchronization({ clockOffsetMs: 0, bufferMs: 40, playoutDriftMs: 5, lateObjects: 0 }).action,
        ).toBe("micro-correct");
        expect(
            beatSafeResynchronization({ clockOffsetMs: 0, bufferMs: 0, playoutDriftMs: 300, lateObjects: 8 }),
        ).toMatchObject({ action: "musical-rejoin", boundary: "phrase", arbitrarySampleJump: false });
    });
    test("adapts compute and transport while preserving musical intent", () => {
        const program = compilePresentationProgram({
            compute: { device: "mobile", batteryLevel: 0.1, thermalPressure: 0.8, cachedStems: true },
            networkQuality: 0.4,
            syncReport: { clockOffsetMs: 0, bufferMs: 80, playoutDriftMs: 10, lateObjects: 1 },
            localMaster: true,
        });
        expect(program.computePlan).toBe("cached-stems-simple-stretch");
        expect(program.fallbackPlan).toBe("continue-local-master");
        expect(program.musicPlanChanged).toBeFalse();
    });
    test("drops stale low-priority objects and preserves local playback", () => {
        const stale = [
            scheduleMediaObject({
                id: "analytics",
                kind: "analytics",
                presentationTime: 10,
                priority: 0,
                payloadRef: "a",
                endpoint,
            }),
        ];
        expect(transportRecoveryPolicy({ staleObjects: stale, nextSafeBoundaryTime: 200 })).toEqual({
            droppedIds: ["analytics"],
            preservedQos: ["A", "B"],
            rejoinAt: 200,
            localPlaybackStops: false,
        });
        expect(TRANSPORT_BENCHMARK_SUITE_V2).toHaveLength(10);
    });
});
