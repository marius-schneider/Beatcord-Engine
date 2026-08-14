import { describe, expect, test } from "bun:test";
import {
    AUDIO_TEST_MATRIX,
    assessAudioRoute,
    chooseDspQuality,
    compensatePresentation,
    compileRenderPlan,
    convertClock,
    createRecoverySnapshot,
    estimateClockDrift,
    listeningTestStandard,
    nextRouteRecoveryState,
    OBJECTIVE_AUDIO_CHECKS,
    prepareGaplessHandoff,
    REALTIME_ARCHITECTURE,
    REALTIME_MEMORY_RULES,
    RealtimeRingBuffer,
    samplePresentationTime,
} from "./realtime-audio-reliability";

describe("realtime audio reliability", () => {
    test("keeps intelligence off the realtime path and schedules by samples", () => {
        expect(REALTIME_ARCHITECTURE.intelligenceOnCriticalPath).toBe(false);
        expect(
            samplePresentationTime(
                { renderedSample: 0n, sampleRate: 48_000, hostTime: 0n, outputLatencyFrames: 480 },
                48_000n,
            ),
        ).toEqual({ renderTimeSec: 1, presentationTimeSec: 1.01 });
    });
    test("converts multiple clocks and slowly compensates hardware drift", () => {
        expect(
            convertClock(1_000, { sourceClock: "a", targetClock: "b", offset: 10, driftPpm: 100, confidence: 0.9 })
                .value,
        ).toBe(1010.1);
        const drift = estimateClockDrift([
            { source: 0, target: 0 },
            { source: 10_000, target: 10_001 },
        ]);
        expect(drift.driftPpm).toBe(100);
        expect(drift.hardJump).toBe(false);
    });
    test("does not claim wireless club precision and exposes predictive latency windows", () => {
        expect(
            assessAudioRoute({
                transport: "bluetooth",
                estimatedLatencyMs: 180,
                latencyConfidence: 0.5,
                sampleRate: 48_000,
                channels: 2,
                interactiveSafe: false,
            }).clubPerformanceSafe,
        ).toBe(false);
        expect(compensatePresentation(1_000, 20, 180, 0.5)).toEqual({
            presentationTimeMs: 1200,
            predictiveWindowMs: 100,
            exactClaim: false,
        });
    });
    test("prepares robust gapless decoder handoffs", () => {
        expect(
            prepareGaplessHandoff(
                { codec: "mp3", sampleRate: 44_100, channels: 2, paddingFrames: 529 },
                { codec: "aac", sampleRate: 48_000, channels: 1, encoderDelayFrames: 1024 },
            ),
        ).toMatchObject({
            prepareNextEarly: true,
            trimLeadingFrames: 1024,
            trimTrailingFrames: 529,
            resample: true,
            remixChannels: true,
            metadataTrustedAlone: false,
        });
    });
    test("tracks realtime ring-buffer health", () => {
        const buffer = new RealtimeRingBuffer(1_000);
        expect(buffer.write(800)).toBe(800);
        expect(buffer.read(300)).toBe(300);
        expect(buffer.health(800, 700)).toEqual({
            availableFrames: 500,
            targetFrames: 800,
            underrunRisk: 0.375,
            trend: -200,
        });
    });
    test("degrades DSP before audio drops and permits analysis pauses", () => {
        expect(
            chooseDspQuality({ blockDeadlineMs: 5, cpuLoad: 0.97, dspLoad: 0.9, decoderLoad: 0.5, xruns: 1 }),
        ).toEqual({ level: "safe-playback", analysisMayPause: true, audioMustContinue: true });
        expect(REALTIME_MEMORY_RULES).toHaveLength(8);
    });
    test("compiles committed immutable plans and precompiled automation", () => {
        const plan = compileRenderPlan({
            startSample: 0n,
            endSample: 48_000n,
            automation: [
                {
                    parameter: "gain",
                    segments: [{ startSample: 0n, endSample: 48_000n, startValue: 1, endValue: 0, curve: "linear" }],
                },
            ],
            stems: ["vocal"],
            fxGraph: "ready",
        });
        expect(plan.committed).toBe(true);
        expect(Object.isFrozen(plan)).toBe(true);
        expect(Object.isFrozen(plan.automation[0]?.segments[0])).toBe(true);
    });
    test("recovers route changes and creates crash-safe snapshots", () => {
        expect(nextRouteRecoveryState("route-change-detected")).toBe("mute-hold");
        expect(nextRouteRecoveryState("fade-back")).toBe("route-stable");
        expect(
            createRecoverySnapshot({ activeTrack: "a", sourcePosition: 12.4, queue: ["b"], experience: "party" })
                .checksum,
        ).toContain("a:12:1:party");
    });
    test("publishes a broad audio matrix and objective validation list", () => {
        expect(AUDIO_TEST_MATRIX.sampleRates).toEqual([44_100, 48_000, 96_000]);
        expect(AUDIO_TEST_MATRIX.codecs).toHaveLength(6);
        expect(OBJECTIVE_AUDIO_CHECKS).toHaveLength(11);
    });
    test("uses MUSHRA-like and BS.1116-inspired standards with separate panels", () => {
        expect(listeningTestStandard("transition-strategy").method).toBe("mushra-like");
        expect(listeningTestStandard("tiny-artifact").method).toBe("bs1116-inspired");
        expect(listeningTestStandard("tiny-artifact").panel).toHaveLength(4);
    });
});
