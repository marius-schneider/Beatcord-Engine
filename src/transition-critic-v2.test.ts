import { describe, expect, test } from "bun:test";
import {
    chooseUnmaskingAction,
    contextualArtifactSalience,
    contextualEqBridge,
    criticCascade,
    criticCounterexample,
    criticDisagreement,
    DJ_STRUCTURE_DATASET,
    evaluateTransitionCriticV2,
    foregroundPriority,
    learnedSwitchPointPrior,
    loudnessMatchGain,
    roleOwnership,
    runPlanningLoop,
    STRUCTURE_VOCABULARY,
    stretchTransientRisk,
    temporalMaskingRisk,
    timbralContinuity,
    transientQuality,
} from "./transition-critic-v2";

const criticInput = {
    clipping: 0,
    dropout: 0,
    stemArtifact: 0.1,
    stretchArtifact: 0.1,
    phaseError: 0.1,
    loudnessDiscontinuity: 0.1,
    masking: 0.1,
    foregroundCollision: 0.1,
    lowEndCompetition: 0.1,
    transientDamage: 0.1,
    spectralCongestion: 0.1,
    beat: 0.9,
    downbeat: 0.9,
    phrase: 0.9,
    structure: 0.9,
    harmony: 0.8,
    payoff: 0.9,
    energyDirection: 0.9,
    experienceFit: 0.9,
    heuristicNaturalness: 0.8,
    learnedNaturalness: 0.8,
    humanEvidence: 0.9,
};
describe("transition critic v2", () => {
    test("changes plans before applying conservative dynamic EQ", () => {
        expect(chooseUnmaskingAction(0.8, true, 0.9).action).toBe("change-plan");
        const eq = chooseUnmaskingAction(0.5, false, 0.2);
        expect(eq.action).toBe("eq-carve");
        expect(eq.dynamicEqAmount).toBeLessThanOrEqual(0.18);
    });
    test("protects foreground roles and temporal intelligibility", () => {
        expect(foregroundPriority({ vocal: 0.8, melodicLead: 0.4, solo: 0.2, signatureHook: 0.3 }).dominantRole).toBe(
            "vocal",
        );
        expect(
            temporalMaskingRisk({ impactTime: 1, subtleEntryTime: 1.05, impactMagnitude: 1, entryForeground: 1 }),
        ).toBeGreaterThan(0.8);
    });
    test("measures transient preservation and signal-dependent stretch risk", () => {
        expect(transientQuality({ attackPreservation: 1, smearing: 0, crestChange: 0 })).toBe(1);
        expect(
            stretchTransientRisk({ ratio: 1.1, segmentType: "kick", transientDensity: 1, stemType: "drums" }),
        ).toBeGreaterThan(
            stretchTransientRisk({ ratio: 1.1, segmentType: "pad", transientDensity: 1, stemType: "other" }),
        );
    });
    test("requires loudness matching and contextualizes artifact salience", () => {
        expect(loudnessMatchGain(-14, -13.2)).toEqual({
            gainDb: -0.8,
            mandatoryBeforeEvaluation: true,
            biasRisk: 0.533,
        });
        expect(
            contextualArtifactSalience({
                artifactMagnitude: 1,
                audibility: 1,
                foregroundAttention: 1,
                exposureDuration: 4,
                masking: 0,
            }),
        ).toBe(1);
        expect(
            contextualArtifactSalience({
                artifactMagnitude: 1,
                audibility: 1,
                foregroundAttention: 0.2,
                exposureDuration: 1,
                masking: 0.9,
            }),
        ).toBeLessThan(0.1);
    });
    test("keeps five critic dimensions and uncertainty separate", () => {
        const result = evaluateTransitionCriticV2(criticInput);
        expect(result.technicalIntegrity).toBeGreaterThan(0.8);
        expect(result.perceptualClarity).toBeGreaterThan(0.8);
        expect(result.musicalCoherence).toBeGreaterThan(0.8);
        expect(result.uncertainty).toBeGreaterThanOrEqual(0);
    });
    test("evaluates reference-aware contribution and role ownership", () => {
        const clean = [
            { time: 0, deckA: 1, deckB: 0 },
            { time: 1, deckA: 0, deckB: 1 },
        ];
        const ambiguous = [{ time: 0, deckA: 1, deckB: 1 }];
        const result = roleOwnership({ bass: clean, vocals: clean, drums: ambiguous, lead: clean });
        expect(result.conflicts.drums).toBe(1);
        expect(result.handoffSmoothness).toBe(0.75);
    });
    test("supports genre structure semantics and learned switch priors", () => {
        expect(STRUCTURE_VOCABULARY.edm).toContain("drop");
        expect(STRUCTURE_VOCABULARY["hip-hop"]).toContain("hook");
        expect(DJ_STRUCTURE_DATASET.domain).toBe("edm-dj");
        expect(
            learnedSwitchPointPrior({
                outgoingStructure: 1,
                incomingStructure: 1,
                genrePrior: 1,
                energyFit: 1,
                phraseFit: 1,
            }).priorOnly,
        ).toBe(true);
    });
    test("detects timbre shock and limits EQ bridges to transitions", () => {
        const result = timbralContinuity([0, 0], [1, 1]);
        expect(result.shock).toBe(1);
        expect(result.remastersTrack).toBe(false);
        expect(contextualEqBridge(result.shock).guardianLimited).toBe(true);
    });
    test("uses compute-saving cascades and surfaces critic disagreement", () => {
        const cascade = criticCascade([
            { id: "a", symbolicScore: 0.9, featureScore: 0.9, previewScore: 0.9 },
            { id: "b", symbolicScore: 0.2, featureScore: 1, previewScore: 1 },
        ]);
        expect(cascade.fullPreview).toEqual(["a"]);
        const result = evaluateTransitionCriticV2({ ...criticInput, phrase: 0, structure: 0 });
        expect(criticDisagreement(result).requiresRepair).toBe(true);
    });
    test("turns counterexamples into bounded repair loops", () => {
        expect(criticCounterexample("vocal-collision").repair).toBe("move-handoff-after-vocal");
        const loop = runPlanningLoop("plan", [{ accepted: false, repair: "move-handoff" }, { accepted: true }]);
        expect(loop).toEqual({ finalPlan: "plan+move-handoff", iterations: 2, committed: true, budgetBounded: true });
    });
});
