import { describe, expect, test } from "bun:test";

import { emptyRuntimeEvidenceSummary } from "./runtime-evidence-ledger-v1";
import { compileValidationRuntimeV1, type ValidationRuntimeCompilerInputV1 } from "./validation-runtime-compiler-v1";

const input = (): ValidationRuntimeCompilerInputV1 => ({
    currentTrackId: "a",
    nextTrackId: "b",
    transitionType: "blend",
    fadeSec: 8,
    stemsReady: false,
    beat: { compatibility: 0.9, bpmConfidence: 0.8, rhythmicMismatch: 0.1, phraseCompatibility: 0.9 },
    stem: {
        quality: 0.8,
        artifactSalience: 0.1,
        stretchArtifacts: 0.1,
        spectralCollision: 0.1,
        vocalCollision: 0.1,
        spatialQuality: 0.9,
        spatialCollisionRisk: 0.1,
        maskingRisk: 0.1,
        postRendererRisk: 0.1,
        manipulationCost: 0.2,
        totalQualityRisk: 0.1,
    },
    taste: { profileDrift: 0, userConfirmedChange: 0, profileIdentification: 1 },
    intervention: {
        experience: "other",
        experienceImprovement: 0.8,
        decisionConfidence: 0.9,
        currentSongValue: 0.7,
        upcomingPayoff: 0.2,
        userSelected: false,
        albumIntegrity: 0,
        currentFlow: 0.7,
        targetEnergy: 0.8,
        surpriseUsed: 0.1,
        candidates: [{ id: "blend", plannerScore: 0.7, directorScore: 0.8 }],
    },
    runtimeEvidence: emptyRuntimeEvidenceSummary(1),
});

describe("validation runtime compiler v1", () => {
    test("compiles all four labs from one immutable input", () => {
        const result = compileValidationRuntimeV1(input());
        expect(result.beatMeshTortureLabV1.buckets).toHaveLength(18);
        expect(result.stemTransitionUtilityV1.utility).toBeGreaterThan(0);
        expect(result.longitudinalTasteLabV1.program.minimumWeeks).toBe(12);
        expect(result.humanInterventionLabV1.program.finalPrinciple).toBe("earn-every-intervention");
    });
    test("consumes runtime evidence instead of fixed trust and taste counts", () => {
        const changed = input();
        changed.runtimeEvidence.tasteEvidence = { algorithmGenerated: 9, voluntary: 1, editorial: 0, organic: 0 };
        changed.runtimeEvidence.intervention = { accepted: 9, undone: 1, evidenceWindow: 10, trust: 0.8 };
        const result = compileValidationRuntimeV1(changed);
        expect(result.longitudinalTasteLabV1.selfInfluence.ratio).toBe(0.9);
        expect(result.humanInterventionLabV1.threshold).toBeLessThan(0.5);
    });
    test("keeps rare-domain Beat Mesh on escalation until the corpus is complete", () => {
        expect(compileValidationRuntimeV1(input()).beatMeshTortureLabV1.promotion.globalDefault).toBeFalse();
    });
    test("routes exposed acapella stems differently from masked blends", () => {
        const acapella = input();
        acapella.transitionType = "acapella";
        expect(compileValidationRuntimeV1(acapella).stemTransitionUtilityV1.portfolio?.exposureClass).toBe("exposed");
        expect(compileValidationRuntimeV1(input()).stemTransitionUtilityV1.portfolio?.exposureClass).toBe("masked");
    });
});
