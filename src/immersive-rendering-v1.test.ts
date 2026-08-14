import { describe, expect, test } from "bun:test";
import {
    APPLE_AUDIO_FORMATS,
    atmosDeliveryValidation,
    binauralQuality,
    codecRoundTripCritic,
    FFMPEG_LOUDNORM,
    ffmpegRole,
    LOUDNESS_HIERARCHY,
    OPEN_IMMERSIVE_LAB,
    renderRobustness,
    spatialPresentationName,
    spatialSafeMode,
    spatialStemPolicy,
    transitionLoudnessPolicy,
    truePeakGuard,
} from "./immersive-rendering-v1";

describe("immersive rendering v1", () => {
    test("names native Atmos and generated spatial presentations honestly", () => {
        expect(spatialPresentationName("native-atmos")).toBe("Native Atmos");
        expect(spatialPresentationName("generated-upmix")).toBe("Beatcord Spatial Presentation");
    });
    test("enforces native Atmos source, resolution, loudness and peak limits", () => {
        expect(
            atmosDeliveryValidation({
                provenance: "native-atmos",
                bitDepth: 24,
                sampleRate: 48_000,
                integratedLkfs: -18,
                truePeakDbtp: -1,
                createdByDemixingStereo: false,
            }).validAppleMusicAtmos,
        ).toBeTrue();
        expect(
            atmosDeliveryValidation({
                provenance: "generated-upmix",
                bitDepth: 24,
                sampleRate: 48_000,
                integratedLkfs: -18,
                truePeakDbtp: -1,
                createdByDemixingStereo: true,
            }).localResearchOnly,
        ).toBeTrue();
    });
    test("keeps IAMF and OAR as the open spatial research path", () => {
        expect(OPEN_IMMERSIVE_LAB).toEqual(["musical-ir", "immersive-ir", "iamf", "oar", "binaural-or-speakers"]);
    });
    test("keeps ALAC, ASAF and APAC as separate concepts", () => {
        expect(APPLE_AUDIO_FORMATS.alac).toBe("lossless-pcm-compression");
        expect(APPLE_AUDIO_FORMATS.asaf).toBe("immersive-production-representation");
        expect(APPLE_AUDIO_FORMATS.apac).toBe("immersive-delivery-codec");
    });
    test("uses FFmpeg for ingest and tooling, never the realtime clock", () => {
        const role = ffmpegRole({
            decoders: ["mpegh"],
            encoders: [],
            demuxers: [],
            muxers: ["iamf"],
            filters: [],
            libraries: { rubberband: true, soxr: true, mpegh: true },
        });
        expect(role.realtimeCriticalPath).toBeFalse();
        expect(role.immersiveAware).toBeTrue();
    });
    test("guards post-mix true peak rather than sample peak only", () => {
        expect(truePeakGuard({ samplePeakDbfs: -1, truePeakDbtp: 0.2, targetDbtp: -1 })).toEqual({
            gainReductionDb: 1.2,
            samplePeakIsTruePeak: false,
            postMix: true,
        });
    });
    test("uses loudnorm oversampling only for true-peak detection", () => {
        expect(FFMPEG_LOUDNORM.dynamicOversamplingHz).toBe(192_000);
        expect(FFMPEG_LOUDNORM.highResolutionSoundClaim).toBeFalse();
    });
    test("preserves dynamics through the complete loudness hierarchy", () => {
        expect(LOUDNESS_HIERARCHY.at(-1)).toBe("safety-true-peak");
        expect(
            transitionLoudnessPolicy({ albumDynamics: 0.8, experienceDynamics: 0.6, loudnessJump: 0.2 })
                .identicalMomentaryNormalization,
        ).toBeFalse();
    });
    test("criticizes the encoded and decoded delivery result", () => {
        expect(
            codecRoundTripCritic({
                truePeakDelta: 0.05,
                transientSmearing: 0.05,
                preEcho: 0.05,
                spectralChange: 0.05,
                stereoImageChange: 0.05,
                bassPhaseError: 0.05,
            }),
        ).toEqual({ score: 0.95, passed: true, preCodecOnly: false });
    });
    test("uses the weakest relevant renderer as robustness score", () => {
        expect(renderRobustness({ stereo: 0.95, binaural: 0.7, speakers: 0.9 })).toEqual({
            score: 0.7,
            renderInvariant: false,
            testedNotAssumed: true,
        });
    });
    test("evaluates binaural rendering separately", () => {
        expect(
            binauralQuality({
                externalization: 0.8,
                localizationStability: 0.8,
                spectralNaturalness: 0.8,
                frontBackConfusionRisk: 0.2,
                spatialIntegrity: 0.8,
            }),
        ).toBe(0.8);
    });
    test("preserves a binaural master when spatial-aware separation is unsafe", () => {
        expect(
            spatialStemPolicy({
                provenance: "binaural-render",
                spatialAwareMssQuality: 0.95,
                nativeObjectsAvailable: false,
            }).action,
        ).toBe("preserve-master");
        expect(spatialSafeMode({ nativeSpatial: false, generatedQuality: 0.5, creativeMode: true }).render).toBe(
            "high-quality-stereo",
        );
    });
});
