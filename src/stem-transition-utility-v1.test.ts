import { describe, expect, test } from "bun:test";
import {
    originalPreservingStrategy,
    restorationDecision,
    STEM_UTILITY_BENCHMARK_V1,
    selectStemPortfolioRoute,
    stemDemandPlan,
    stemExposureRisk,
    transitionStemUtility,
} from "./stem-transition-utility-v1";

describe("stem transition utility v1", () => {
    const profile = {
        isolation: 0.8,
        artifactSalience: 0.3,
        transientIntegrity: 0.9,
        tonalIntegrity: 0.8,
        transitionUtilityByRole: { "vocal-overlay": 0.75 },
    };
    const masked = {
        relativeGainDb: -18,
        soloFraction: 0,
        durationSeconds: 2,
        foregroundProbability: 0.1,
        maskingLevel: 0.9,
    };
    const solo = { relativeGainDb: 0, soloFraction: 1, durationSeconds: 32, foregroundProbability: 1, maskingLevel: 0 };

    test("makes artifact risk depend on actual exposure", () => {
        expect(stemExposureRisk(masked)).toBeLessThan(stemExposureRisk(solo));
    });
    test("scores utility for the exact transition role", () => {
        expect(
            transitionStemUtility({
                profile,
                role: "vocal-overlay",
                exposure: masked,
                maskingBenefit: 0.8,
                spatialDamage: 0,
                reconstructionRisk: 0.1,
            }),
        ).toBeGreaterThan(0.5);
    });
    test("does not treat one objective metric as universal across sources", () => {
        expect(STEM_UTILITY_BENCHMARK_V1.objective).toContain("sdr-where-meaningful");
        expect(STEM_UTILITY_BENCHMARK_V1.objective).toContain("si-sar-where-meaningful");
    });
    test("selects portfolio winners by role, section and exposure", () => {
        const selected = selectStemPortfolioRoute(
            [
                { model: "A", role: "bass-handoff" as const, section: "outro", exposureClass: "masked", utility: 0.7 },
                { model: "B", role: "bass-handoff" as const, section: "outro", exposureClass: "masked", utility: 0.9 },
            ],
            { role: "bass-handoff", section: "outro", exposureClass: "masked" },
        );
        expect(selected?.model).toBe("B");
    });
    test("can preserve the original master through subtraction or classic EQ", () => {
        expect(
            originalPreservingStrategy({
                task: "vocal-attenuation",
                reconstructionUtility: 0.5,
                subtractionUtility: 0.9,
                classicEqUtility: 0.7,
            }),
        ).toBe("original-minus-target");
    });
    test("restores only when transition value exceeds artistic change", () => {
        expect(
            restorationDecision({ transitionGain: 0.3, artisticChange: 0.1, exposedInTransition: true }).restore,
        ).toBeTrue();
        expect(
            restorationDecision({ transitionGain: 0.3, artisticChange: 0.1, exposedInTransition: false }).restore,
        ).toBeFalse();
    });
    test("computes only demanded stems that fit the deadline", () => {
        expect(
            stemDemandPlan({
                requiredRoles: ["vocal-overlay", "bass-handoff", "drum-handoff"],
                cachedRoles: ["vocal-overlay"],
                deadlineMs: 100,
                estimatedRoleMs: 60,
            }),
        ).toEqual({ computeRoles: ["bass-handoff"], fallbackRoles: ["drum-handoff"], precomputeAll: false });
    });
    test("benchmarks solo and in-transition perception separately", () => {
        expect(STEM_UTILITY_BENCHMARK_V1.listeningConditions).toEqual(["stem-solo", "inside-actual-transition"]);
        expect(STEM_UTILITY_BENCHMARK_V1.optimizeFor).toBe("musical-task-utility");
    });
});
