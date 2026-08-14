import { describe, expect, test } from "bun:test";
import {
    AC4_RESEARCH_POLICY,
    AUDIO_ROUTE_TEST_MATRIX_V2,
    artifactRepair,
    dependencyCapability,
    fidelityStatus,
    metadataPreservationTest,
    postRendererTransitionCritic,
    renderSpecificAutomation,
    resamplingGraph,
    sourceFidelityLedger,
    stretchRoute,
} from "./transform-fidelity-ledger-v2";

describe("transform fidelity ledger v2", () => {
    test("keeps AC-4 claims in independent validation status", () => {
        expect(AC4_RESEARCH_POLICY.productClaimAllowed).toBeFalse();
    });
    test("detects metadata loss including TrueHD object loss", () => {
        const result = metadataPreservationTest(
            {
                preservesSamples: true,
                preservesTiming: true,
                preservesMetadata: ["gapless"],
                preservesSpatialScene: false,
                introducesLoss: false,
            },
            ["gapless", "objects"],
        );
        expect(result.missing).toEqual(["objects"]);
        expect(result.trueHdAtmosMetadataAtRisk).toBeTrue();
    });
    test("keeps sources immutable while derived transformations stay auditable", () => {
        const ledger = sourceFidelityLedger({
            sourceHash: "abc",
            transformations: [],
            outputFormat: "opus",
            reversible: false,
        });
        expect(ledger.sourceImmutable).toBeTrue();
    });
    test("runs the complete post-renderer critic chain", () => {
        const result = postRendererTransitionCritic({
            pcmQuality: 0.95,
            codecQuality: 0.9,
            rendererQuality: 0.85,
            deviceTwinQuality: 0.8,
            divergence: { loudness: 0.1, balance: 0.1, spatialPosition: 0.1, transitionTiming: 0.1 },
        });
        expect(result.finalRisk).toBe(0.2);
        expect(result.stages.at(-1)).toBe("final-risk");
    });
    test("adapts renderer automation without changing musical identity", () => {
        expect(renderSpecificAutomation({ renderer: "binaural", baseWidth: 1, baseOverlapSec: 10 })).toEqual({
            width: 0.7,
            overlapSec: 10,
            musicalIdentityChanged: false,
        });
    });
    test("tracks dependency license as a hard capability", () => {
        expect(
            dependencyCapability(
                {
                    name: "x",
                    license: "research-only",
                    commercialAllowed: false,
                    attributionRequired: true,
                    platformSupport: ["mac"],
                },
                "mac",
                true,
            ).usable,
        ).toBeFalse();
    });
    test("uses bridge tracks instead of heroic extreme stretching", () => {
        expect(stretchRoute(1.15).action).toBe("stretch");
        expect(stretchRoute(1.25).action).toBe("find-bridge-track");
        expect(artifactRepair("spatial-drift")).toBe("reject-stem-or-spatial-manipulation");
    });
    test("logs and detects avoidable resampling chains", () => {
        const result = resamplingGraph([
            { inputRate: 44_100, outputRate: 48_000, reason: "engine", backend: "soxr" },
            { inputRate: 48_000, outputRate: 96_000, reason: "analysis", backend: "x" },
            { inputRate: 96_000, outputRate: 44_100, reason: "device", backend: "os" },
        ]);
        expect(result.doubleResampling).toBeTrue();
        expect(result.warnings).toContain("unexpected-resampling-chain");
    });
    test("reports the complete fidelity chain instead of source branding", () => {
        const stage = { format: "flac", sampleRate: 48_000, bitDepth: 24, lossless: true, verified: true };
        const result = fidelityStatus({
            source: stage,
            decode: stage,
            dsp: stage,
            transport: { ...stage, format: "aac", lossless: false },
            output: { ...stage, format: "bluetooth", lossless: false },
        });
        expect(result.simpleLabel).toBe("High Quality");
        expect(result.endToEndLossless).toBeFalse();
        expect(AUDIO_ROUTE_TEST_MATRIX_V2.devices).toContain("airpods");
    });
});
