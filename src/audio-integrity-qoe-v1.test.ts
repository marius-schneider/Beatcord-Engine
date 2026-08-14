import { describe, expect, test } from "bun:test";
import {
    BEATCORD_QUALITY_HIERARCHY,
    codecAwareQoe,
    codecRoundTripBenchmark,
    dspNullTest,
    immersiveCollision,
    losslessCacheStrategy,
    masterIntegrityHash,
    minimumDspTier,
    pcmIntegrityTest,
    renderMatrixBenchmark,
    SPATIAL_ROLE_OWNERSHIP_V2,
    spatialHandoffPolicy,
} from "./audio-integrity-qoe-v1";

describe("audio integrity and QoE v1", () => {
    test("caches encoded lossless sources plus bounded transition lookahead", () => {
        const strategy = losslessCacheStrategy({
            durationSec: 300,
            channels: 2,
            sampleRate: 48_000,
            lookaheadBars: 64,
        });
        expect(strategy.storeWholeDecodedLibrary).toBeFalse();
        expect(strategy.lookaheadBars).toBe(32);
    });
    test("hashes immutable master content and verifies lossless PCM", () => {
        expect(masterIntegrityHash([0, 0.5, -0.5])).toMatch(/^pcm-fnv1a-/);
        expect(pcmIntegrityTest([0, 0.5], [0, 0.5]).exact).toBeTrue();
        expect(pcmIntegrityTest([0, 0.5], [0, 0.4]).exact).toBeFalse();
    });
    test("null-tests identity DSP for hidden processing", () => {
        expect(dspNullTest([0, 0.5], [0, 0.5]).passed).toBeTrue();
        expect(dspNullTest([0, 0.5], [0, 0.4]).hiddenProcessingDetected).toBeTrue();
    });
    test("benchmarks delay, padding, loudness, peaks and artifacts per codec", () => {
        const result = codecRoundTripBenchmark([
            {
                codec: "opus",
                delaySamples: 0,
                paddingSamples: 0,
                loudnessDelta: 0.05,
                truePeakDelta: 0.05,
                transientError: 0.05,
                spectralDifference: 0.05,
            },
        ]);
        expect(result.passed).toBeTrue();
        expect(result.worstCodec).toBe("opus");
    });
    test("marks transitions renderer-specific when a downmix is weak", () => {
        const result = renderMatrixBenchmark([
            {
                renderer: "stereo",
                roleBalance: 0.5,
                loudness: 0.8,
                localization: 0.5,
                bass: 0.8,
                foregroundClarity: 0.6,
                transitionIntegrity: 0.6,
            },
            {
                renderer: "7.1.4",
                roleBalance: 0.9,
                loudness: 0.9,
                localization: 0.9,
                bass: 0.9,
                foregroundClarity: 0.9,
                transitionIntegrity: 0.9,
            },
        ]);
        expect(result.rendererSpecific).toBeTrue();
    });
    test("moves spatial roles only for musical purpose", () => {
        const handoff = {
            role: "vocal",
            outgoingPosition: [0, 0, 1] as [number, number, number],
            incomingPosition: [0.2, 0, 1] as [number, number, number],
            widthCurve: [0.5, 0.3],
            distanceCurve: [1, 1],
        };
        expect(spatialHandoffPolicy(handoff, "transition").allowed).toBeTrue();
        expect(spatialHandoffPolicy(handoff, "decoration").allowed).toBeFalse();
    });
    test("tracks gain, frequency, foreground and spatial ownership separately", () => {
        expect(SPATIAL_ROLE_OWNERSHIP_V2).toEqual([
            "gain-ownership",
            "frequency-ownership",
            "foreground-ownership",
            "spatial-ownership",
        ]);
    });
    test("adds spatial position to perceptual collision", () => {
        const result = immersiveCollision({
            frequencyOverlap: 0,
            foregroundOverlap: 0.5,
            spatialDistance: 0,
            roleConflict: 0.5,
        });
        expect(result.risk).toBeGreaterThan(0.5);
        expect(result.dimensions).toContain("spatial-position");
    });
    test("keeps DSP complexity independent from delivery quality", () => {
        expect(minimumDspTier({ processing: "spatial" })).toEqual({ tier: 5, minimumNecessary: true });
        expect(codecAwareQoe({ bandwidthKbps: 200, losslessRequiredKbps: 1000, currentTier: "lossless" })).toEqual({
            deliveryTier: "low-bandwidth-fallback",
            continuityOverBadge: true,
            dspTierIndependent: true,
        });
    });
    test("prioritizes audible integrity over a sample-rate badge", () => {
        expect(BEATCORD_QUALITY_HIERARCHY[0]).toBe("correct-master");
        expect(BEATCORD_QUALITY_HIERARCHY).not.toContain("192-khz-badge");
    });
});
