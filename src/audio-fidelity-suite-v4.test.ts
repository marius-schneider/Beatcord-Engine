import { describe, expect, test } from "bun:test";
import {
    AUDIO_ARCHITECTURE_V4,
    AUDIO_FIDELITY_SUITE_V4,
    AUDIO_IMPLEMENTATION_PHASES_V4,
    AUDIO_RESEARCH_PRIORITY_V4,
    CODEC_SPATIAL_INDEPENDENCE,
    fidelityBenchResult,
    GAPLESS_FIXTURES_V4,
    LOSSLESS_FIXTURES_V4,
    METADATA_OPERATIONS_V4,
    qualityGuardianV4,
    RESAMPLE_METRICS_V4,
    STRETCH_METRICS_V4,
} from "./audio-fidelity-suite-v4";

describe("audio fidelity suite v4", () => {
    test("models the full immutable-source to device-route architecture", () => {
        expect(AUDIO_ARCHITECTURE_V4[0]).toBe("immutable-source");
        expect(AUDIO_ARCHITECTURE_V4.at(-1)).toBe("device-route");
        expect(CODEC_SPATIAL_INDEPENDENCE.formatsAreBackends).toBeTrue();
    });
    test("separates core, DSP, open and commercial implementation phases", () => {
        expect(AUDIO_IMPLEMENTATION_PHASES_V4.core).toContain("gapless-corpus");
        expect(AUDIO_IMPLEMENTATION_PHASES_V4.openImmersive).toContain("oar-binaural");
        expect(AUDIO_IMPLEMENTATION_PHASES_V4.commercialImmersive).toContain("dolby-partnership");
    });
    test("contains all ten fidelity benchmarks", () => {
        expect(AUDIO_FIDELITY_SUITE_V4).toHaveLength(10);
        expect(AUDIO_FIDELITY_SUITE_V4).toContain("metadata-preservation");
    });
    test("turns measured metrics into explicit benchmark results", () => {
        expect(fidelityBenchResult("stretch", [0.9, 0.8, 1])).toEqual({
            name: "stretch",
            score: 0.9,
            passed: true,
            measuredNotClaimed: true,
        });
    });
    test("defines realistic fixtures and measurement dimensions", () => {
        expect(LOSSLESS_FIXTURES_V4).toContain("24-192");
        expect(GAPLESS_FIXTURES_V4).toContain("sample-accurate-synthetic");
        expect(RESAMPLE_METRICS_V4).toContain("alias-rejection");
        expect(STRETCH_METRICS_V4).toContain("vocal-naturalness");
        expect(METADATA_OPERATIONS_V4).toContain("remux");
    });
    test("bypasses when possible and otherwise uses minimum sufficient processing", () => {
        expect(qualityGuardianV4({ canBypass: true, requiredProcessingTier: 5, deliveryValidation: 1 })).toEqual({
            action: "bypass",
            processingTier: 0,
            actualDeliveryValidated: true,
            maximumAvailableProcessingUsed: false,
        });
        expect(
            qualityGuardianV4({ canBypass: false, requiredProcessingTier: 3, deliveryValidation: 0.8 }).processingTier,
        ).toBe(3);
    });
    test("separates build, prototype and partner priorities", () => {
        expect(AUDIO_RESEARCH_PRIORITY_V4.buildNow).toContain("canonical-content-timeline");
        expect(AUDIO_RESEARCH_PRIORITY_V4.partnerWatch).toContain("ac4-encoding");
    });
});
