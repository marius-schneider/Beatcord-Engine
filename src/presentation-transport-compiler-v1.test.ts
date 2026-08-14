import { describe, expect, test } from "bun:test";
import {
    auracastArchitecture,
    CONTROL_AUDIO_PLANE_ARCHITECTURE,
    compilePresentation,
    contextRequirements,
    LE_AUDIO_BASELINE,
    lc3plusPolicy,
    opusRemotePolicy,
    transportScore,
    wirelessCapability,
} from "./presentation-transport-compiler-v1";

describe("presentation transport compiler v1", () => {
    const local = {
        name: "local-pcm",
        codecs: ["pcm"],
        latencyRangeMs: [2, 10] as [number, number],
        packetLossRecovery: [],
        maxChannels: 8,
        supportsBroadcast: false,
        supportsBidirectional: false,
        supportsTimedMetadata: true,
        maturity: "production" as const,
    };
    const remote = {
        name: "webrtc-opus",
        codecs: ["opus"],
        latencyRangeMs: [30, 150] as [number, number],
        packetLossRecovery: ["fec", "dred"],
        maxChannels: 2,
        supportsBroadcast: true,
        supportsBidirectional: true,
        supportsTimedMetadata: true,
        maturity: "production" as const,
    };

    test("keeps the music plan independent from delivery compilation", () => {
        const result = compilePresentation(contextRequirements("local-headphones"), [local, remote]);
        expect(result.transport).toBe("local-pcm");
        expect(result.musicPlanChanged).toBeFalse();
        expect(result.deliveryPlanIndependent).toBeTrue();
    });
    test("compiles local, remote party and home contexts differently", () => {
        expect(contextRequirements("local-headphones").latencyClass).toBe("local-realtime");
        expect(contextRequirements("remote-party").fanout).toBe(20);
        expect(contextRequirements("tv-home").spatialRequired).toBeTrue();
    });
    test("scores transport quality, reliability and real operational costs", () => {
        expect(
            transportScore({
                quality: 1,
                reliability: 1,
                syncPrecision: 1,
                batteryEfficiency: 1,
                latency: 0,
                bandwidthCost: 0,
                failureRisk: 0,
            }),
        ).toBe(0.75);
    });
    test("keeps Auracast audio separate from session control", () => {
        expect(auracastArchitecture({ listeners: 100, controlClients: 20 })).toEqual({
            audioPlane: "auracast-broadcast",
            controlPlane: "session-data-channel",
            planesSeparated: true,
            fanout: 100,
        });
        expect(CONTROL_AUDIO_PLANE_ARCHITECTURE.remoteControllersCarryAudio).toBeFalse();
    });
    test("treats LC3 as baseline without assuming LC3plus", () => {
        expect(LE_AUDIO_BASELINE.lc3plusAssumed).toBeFalse();
        expect(
            lc3plusPolicy({ baselineLeAudio: true, lc3plusNegotiated: false, losslessProfileNegotiated: false }),
        ).toEqual({ codec: "LC3", lossless: false, vendorLatencyUniversalized: false });
    });
    test("requires measured wireless capabilities rather than branding", () => {
        const result = wirelessCapability({
            codec: "aac",
            sampleRate: 48_000,
            measuredLatencyMs: 120,
            lossless: false,
            confidence: 1,
        });
        expect(result.verifiedLossless).toBeFalse();
        expect(result.brandingUsedAsEvidence).toBeFalse();
        expect(result.latencyClaim).toBe("measured");
    });
    test("keeps Opus HD lossy and defaults remote audio to 48 kHz", () => {
        expect(opusRemotePolicy({ opusVersion: "1.6", inputRate: 96_000, testsShowHdValue: false })).toEqual({
            sampleRate: 48_000,
            lossless: false,
            dredAvailable: true,
            hdLabelMeansLossless: false,
        });
    });
});
