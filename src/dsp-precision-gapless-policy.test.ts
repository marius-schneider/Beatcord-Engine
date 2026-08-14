import { describe, expect, test } from "bun:test";
import {
    bitPerfectBypass,
    canonicalContentTimeline,
    finalQuantization,
    gaplessIntegrity,
    immersiveDeliveryCapability,
    internalDspPrecision,
    RESAMPLER_POLICY,
    sampleRateLane,
} from "./dsp-precision-gapless-policy";

describe("DSP precision and gapless policy", () => {
    test("uses float32 realtime and float64 only for precision-heavy jobs", () => {
        expect(internalDspPrecision("realtime")).toEqual({
            format: "float32",
            intermediateQuantization: false,
            realtimeSuitable: true,
        });
        expect(internalDspPrecision("offline-measurement").format).toBe("float64");
    });
    test("dithers once and only for final reduced-bit quantization", () => {
        expect(finalQuantization(16)).toEqual({
            destinationBits: 16,
            dither: "highpass-triangular",
            ditherApplications: 1,
            internalUiExposed: false,
        });
        expect(finalQuantization(24).ditherApplications).toBe(0);
    });
    test("uses native pure playback and canonical 48 kHz adaptive processing", () => {
        expect(
            sampleRateLane({ sourceRate: 44_100, deviceRate: 44_100, processingRequested: false, spatial: false }).lane,
        ).toBe("native-bypass");
        expect(
            sampleRateLane({ sourceRate: 192_000, deviceRate: 192_000, processingRequested: true, spatial: false }),
        ).toEqual({ lane: "canonical-48khz", workingRate: 48_000, resampled: true, highRateQualityClaim: false });
        expect(RESAMPLER_POLICY.hqOffline).toBe("soxr-28bit");
    });
    test("claims bit-perfect only when the complete runtime path is verified", () => {
        expect(
            bitPerfectBypass({
                lossless: true,
                processingRequested: false,
                sourceRate: 48_000,
                deviceRate: 48_000,
                outputIntegerCompatible: true,
                systemMixerTransparent: true,
            }).claim,
        ).toBe("bit-perfect");
        expect(
            bitPerfectBypass({
                lossless: true,
                processingRequested: false,
                sourceRate: 44_100,
                deviceRate: 48_000,
                outputIntegerCompatible: true,
                systemMixerTransparent: true,
            }).verified,
        ).toBeFalse();
    });
    test("plans against content samples rather than packet time", () => {
        expect(
            canonicalContentTimeline(
                { rawDecodedStart: 0, contentStart: 2112, contentEnd: 50_112, encoderDelay: 2112 },
                2112,
            ),
        ).toEqual({ contentSample: 0, insideContent: true, encodedPacketTimeIgnored: true });
    });
    test("detects every gapless sample-accounting failure class", () => {
        expect(
            gaplessIntegrity({
                missingSamples: 0,
                duplicateSamples: 0,
                addedSilenceSamples: 0,
                phaseDiscontinuity: 0,
                timingOffsetSamples: 0,
            }).passed,
        ).toBeTrue();
        expect(
            gaplessIntegrity({
                missingSamples: 1,
                duplicateSamples: 0,
                addedSilenceSamples: 0,
                phaseDiscontinuity: 0.2,
                timingOffsetSamples: 0,
            }).errors,
        ).toEqual(["missing-samples", "phase-discontinuity"]);
    });
    test("keeps the immersive scene independent of its delivery codec", () => {
        expect(immersiveDeliveryCapability("IAMF")).toEqual({
            open: true,
            partnerDependent: false,
            sceneIndependentOfCodec: true,
        });
        expect(immersiveDeliveryCapability("AC4").partnerDependent).toBeTrue();
    });
});
