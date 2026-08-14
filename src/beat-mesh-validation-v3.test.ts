import { describe, expect, test } from "bun:test";
import {
    BEAT_MESH_FAILURE_CLASSES_V3,
    BEAT_MESH_VALIDATION_V3,
    beatMeshComplexityRoi,
    beatMeshDeploymentDecision,
    transitionSafetyGain,
} from "./beat-mesh-validation-v3";

describe("beat mesh validation v3", () => {
    const failures = {
        octaveErrorRate: 0.01,
        continuityFailureRate: 0.01,
        catastrophicFailureRate: 0,
        downbeatPhaseError: 0.01,
        meterError: 0,
        tempoDrift: 0.01,
        highConfidenceWrongRate: 0.005,
    };

    test("measures net transition-safety gain", () => {
        expect(transitionSafetyGain({ badTransitionsAvoided: 12, badTransitionsIntroduced: 2 })).toBe(10);
    });
    test("reports all failure classes instead of only aggregate beat F1", () => {
        expect(BEAT_MESH_FAILURE_CLASSES_V3).toHaveLength(7);
        expect(BEAT_MESH_FAILURE_CLASSES_V3).toContain("highConfidenceWrongRate");
    });
    test("normalizes quality improvement by compute and complexity", () => {
        expect(
            beatMeshComplexityRoi({
                transitionQualityImprovement: 0.3,
                additionalCompute: 0.2,
                additionalComplexity: 0.1,
            }),
        ).toBe(1);
    });
    test("uses escalation when only a tiny catalog slice benefits", () => {
        expect(
            beatMeshDeploymentDecision({ affectedCatalogRate: 0.0001, safetyGain: 10, roi: 1, failures }).route,
        ).toBe("escalation");
    });
    test("rejects confident-but-wrong or net-unsafe inference", () => {
        expect(beatMeshDeploymentDecision({ affectedCatalogRate: 0.5, safetyGain: -1, roi: 1, failures }).route).toBe(
            "classic-grid",
        );
        expect(
            beatMeshDeploymentDecision({
                affectedCatalogRate: 0.5,
                safetyGain: 2,
                roi: 1,
                failures: { ...failures, highConfidenceWrongRate: 0.1 },
            }).route,
        ).toBe("classic-grid");
    });
    test("allows default deployment only when safety and ROI justify it", () => {
        expect(beatMeshDeploymentDecision({ affectedCatalogRate: 0.2, safetyGain: 10, roi: 1, failures })).toEqual({
            route: "default",
            reason: "measurable-transition-safety-gain",
            aggregateF1Sufficient: false,
        });
    });
    test("encodes the validation research question and escalation rule", () => {
        expect(BEAT_MESH_VALIDATION_V3.centralQuestion).toContain("audible-failures");
        expect(BEAT_MESH_VALIDATION_V3.escalationForRareCatalog).toBeTrue();
    });
});
