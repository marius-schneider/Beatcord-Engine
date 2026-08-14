import { describe, expect, test } from "bun:test";
import {
    APPLE_DIGITAL_MASTER_LESSONS,
    AUDIO_STACK_LAYERS,
    decodeProcessingPipeline,
    FLAC_CAPABILITIES,
    FLAC_POLICY,
    losslessCodecEquivalence,
    sourceResolution,
    validateNativeResolution,
} from "./audio-source-resolution-policy";

describe("audio source resolution policy", () => {
    test("separates source, representation, codec, renderer and DSP", () => {
        expect(AUDIO_STACK_LAYERS).toEqual(["source-master", "representation", "delivery-codec", "renderer", "dsp"]);
    });

    test("uses standardized FLAC for sources but not realtime samples", () => {
        expect(FLAC_CAPABILITIES.standard).toBe("RFC 9639");
        expect(FLAC_POLICY.useFor).toContain("archive");
        expect(FLAC_POLICY.notFor).toContain("internal-realtime-sample-representation");
    });

    test("decodes codecs to float PCM before DSP", () => {
        expect(decodeProcessingPipeline("flac")).toEqual({
            source: "flac",
            processing: "float32-pcm",
            codecPresentDuringDsp: false,
            stages: ["encoded-source", "decode", "float-pcm", "dsp", "render", "delivery"],
        });
    });

    test("treats FLAC and ALAC as fidelity-equivalent for the same PCM", () => {
        const result = losslessCodecEquivalence({ flacPcmHash: "same", alacPcmHash: "same" });
        expect(result.sameMaster).toBeTrue();
        expect(result.fidelityDifference).toBeFalse();
    });

    test("does not create fake hi-res labels through upsampling", () => {
        const result = sourceResolution(
            {
                sampleRate: 44_100,
                bitDepth: 16,
                lossless: true,
                nativeResolutionKnown: true,
                provenance: "native-master",
            },
            192_000,
        );
        expect(result.hiResLabel).toBeFalse();
        expect(result.fakeHiResPrevented).toBeTrue();
        expect(APPLE_DIGITAL_MASTER_LESSONS.upsampleForBadge).toBeFalse();
    });

    test("rejects unprovable native resolution metadata", () => {
        const result = validateNativeResolution({
            sampleRate: 96_000,
            bitDepth: 24,
            lossless: true,
            nativeResolutionKnown: true,
            provenance: "transcode",
        });
        expect(result.valid).toBeFalse();
        expect(result.reasons).toContain("transcode-cannot-prove-native-resolution");
    });
});
