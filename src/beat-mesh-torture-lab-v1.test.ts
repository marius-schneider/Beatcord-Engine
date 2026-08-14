import { describe, expect, test } from "bun:test";
import {
    annotationInformationGain,
    BEAT_MESH_EXPERIMENTS_V1,
    BEAT_MESH_TORTURE_BUCKETS_V1,
    beatMeshActiveTeachingValue,
    beatMeshPromotionRule,
    compareBeatMeshEnsemble,
    localRefinementValue,
    selectAnnotationWindows,
} from "./beat-mesh-torture-lab-v1";

describe("beat mesh torture lab v1", () => {
    const result = (domain: (typeof BEAT_MESH_TORTURE_BUCKETS_V1)[number], failures = 0) => ({
        domain,
        accuracy: 0.95,
        calibration: 0.9,
        computeCost: 0.4,
        transitionFailures: failures,
        latencyRegression: 0.02,
        batteryRegression: 0.02,
        falseCorrectionRate: 0.01,
    });

    test("contains all eighteen deliberately difficult rhythm buckets", () => {
        expect(BEAT_MESH_TORTURE_BUCKETS_V1).toHaveLength(18);
        expect(BEAT_MESH_TORTURE_BUCKETS_V1).toContain("polyrhythm");
    });
    test("uses a domain-calibrated Raveform benchmark", () => {
        expect(BEAT_MESH_EXPERIMENTS_V1.domainBenchmark).toContain("raveform-edm");
    });
    test("compares ensemble value across quality, calibration, failures and compute", () => {
        expect(
            compareBeatMeshEnsemble({
                single: { ...result("jazz", 4), accuracy: 0.8, calibration: 0.7, computeCost: 0.2 },
                ensemble: result("jazz", 1),
            }),
        ).toEqual({ accuracyGain: 0.15, calibrationGain: 0.2, failuresPrevented: 3, computeIncrease: 0.2 });
    });
    test("validates cheap global analysis plus local refinement", () => {
        expect(
            localRefinementValue({
                fullTrackQuality: 0.9,
                localWindowQuality: 0.89,
                fullTrackCompute: 1,
                localWindowCompute: 0.3,
            }),
        ).toEqual({ qualityEquivalent: true, computeSaved: 0.7, preferFoveation: true });
    });
    test("scores active teaching by improvement per correction second", () => {
        expect(
            beatMeshActiveTeachingValue({
                correctionSeconds: 5,
                beatImprovement: 1,
                phraseImprovement: 1,
                transitionImprovement: 1,
                futureReuse: 1,
            }),
        ).toBe(0.2);
        expect(
            beatMeshActiveTeachingValue({
                correctionSeconds: 0,
                beatImprovement: 1,
                phraseImprovement: 1,
                transitionImprovement: 1,
                futureReuse: 1,
            }),
        ).toBe(0);
    });
    test("targets annotation where information gain is highest", () => {
        expect(annotationInformationGain({ disagreement: 0.5, downstreamImpact: 0.8, futureReuse: 0.5 })).toBe(0.2);
        expect(
            selectAnnotationWindows(
                [
                    { id: "easy", disagreement: 0.1, downstreamImpact: 1, futureReuse: 1 },
                    { id: "hard", disagreement: 1, downstreamImpact: 1, futureReuse: 1 },
                ],
                1,
            )[0]?.id,
        ).toBe("hard");
    });
    test("promotes only domains with safe operational regressions", () => {
        const promotion = beatMeshPromotionRule([
            result("straight-edm-control"),
            { ...result("jazz"), batteryRegression: 0.2 },
        ]);
        expect(promotion.promotedDomains).toEqual(["straight-edm-control"]);
        expect(promotion.escalationDomains).toEqual(["jazz"]);
    });
    test("never declares a global default from an incomplete corpus", () => {
        expect(beatMeshPromotionRule([result("straight-edm-control")]).globalDefault).toBeFalse();
    });
});
