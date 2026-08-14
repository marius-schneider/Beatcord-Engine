import { describe, expect, test } from "bun:test";
import {
    constructSequentialTransition,
    generativeStemPolicy,
    MSR_RESEARCH,
    MSST_PLATFORM_CAPABILITIES,
    rolePreset,
    routeStemBackend,
    selectStemEnsemble,
    stemQualityScore,
    transitionLocalRestoration,
} from "./stem-restoration-sequential";

const quality = {
    separation: 0.9,
    perceptualQuality: 0.8,
    leakage: 0.1,
    transientIntegrity: 0.9,
    tonalIntegrity: 0.8,
    temporalStability: 0.9,
};
describe("stem restoration and sequential blending", () => {
    test("routes interchangeable stem backends by runtime context", () => {
        const backends = [
            {
                id: "live",
                kind: "fast-realtime" as const,
                capabilities: { realtime: true, mobile: false, cloud: false, ensemble: false, restoration: false },
                latencyMs: 20,
                quality: 0.7,
            },
            {
                id: "hq",
                kind: "high-quality" as const,
                capabilities: { realtime: false, mobile: false, cloud: false, ensemble: true, restoration: true },
                latencyMs: 1000,
                quality: 0.95,
            },
        ];
        expect(
            routeStemBackend(backends, { live: true, mobile: false, cloudAllowed: false, qualityPriority: 1 })?.id,
        ).toBe("live");
        expect(
            routeStemBackend(backends, { live: false, mobile: false, cloudAllowed: false, qualityPriority: 1 })?.id,
        ).toBe("hq");
    });
    test("captures MSST as a platform rather than one model", () => {
        expect(MSST_PLATFORM_CAPABILITIES).toHaveLength(7);
        expect(MSST_PLATFORM_CAPABILITIES).toContain("sliding-window-crossfade");
    });
    test("scores six-dimensional stem quality instead of SDR alone", () => {
        expect(stemQualityScore(quality)).toBeGreaterThan(0.8);
        expect(MSR_RESEARCH.sdrAloneSufficient).toBe(false);
    });
    test("uses ensembles only in offline/precompute budgets", () => {
        expect(
            selectStemEnsemble(
                [
                    { backendId: "a", quality },
                    { backendId: "b", quality: { ...quality, leakage: 0.3 } },
                ],
                true,
            ),
        ).toEqual({ selected: "a", ensemble: ["a", "b"], offlineOnly: true });
    });
    test("restores only 8–32 transition bars under quality and risk gates", () => {
        expect(
            transitionLocalRestoration({
                bars: 64,
                stemQuality: 0.4,
                hqMode: true,
                computeAvailable: true,
                artisticProductionRisk: 0.2,
            }),
        ).toMatchObject({
            apply: true,
            bars: 32,
            usage: "internal-transition-tool",
            outsideTransitionUsesOriginalMaster: true,
        });
        expect(
            transitionLocalRestoration({
                bars: 16,
                stemQuality: 0.4,
                hqMode: true,
                computeAvailable: true,
                artisticProductionRisk: 0.9,
            }).apply,
        ).toBe(false);
    });
    test("allows bounded repair but no generated replacement in adaptive playback", () => {
        expect(generativeStemPolicy("adaptive-playback", true)).toEqual({
            allowGeneratedContent: false,
            allowArtifactRepair: true,
            replacementForbidden: true,
        });
        expect(generativeStemPolicy("creative-remix", false).allowGeneratedContent).toBe(true);
    });
    test("builds a transition role by role and evaluates each submix", () => {
        const result = constructSequentialTransition(rolePreset("bass-swap"), (roles) =>
            roles.length === 4 ? 0.8 : 0.9,
        );
        expect(result.stages.map((stage) => stage.role)).toEqual(["drums", "bass", "harmony", "foreground"]);
        expect(result.committed).toBe(true);
    });
    test("stops sequential construction at the first unsafe submix", () => {
        const result = constructSequentialTransition(rolePreset("eq-blend"), (roles) =>
            roles.length === 2 ? 0.4 : 0.9,
        );
        expect(result.stages).toHaveLength(2);
        expect(result.committed).toBe(false);
    });
    test("expresses traditional transition types as role-handoff presets", () => {
        const bassSwap = rolePreset("bass-swap");
        expect(bassSwap.bass).toMatchObject({ mode: "hard", bar: 9 });
        expect(bassSwap.foreground.mode).toBe("outgoing-only");
    });
    test("records the restoration corpus and combined evaluation", () => {
        expect(MSR_RESEARCH).toMatchObject({
            rawStemsSongs: 578,
            rawSourceHours: 354.13,
            evaluatesObjectivePerceptualAndSubjective: true,
        });
    });
});
