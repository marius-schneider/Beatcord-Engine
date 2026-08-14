import { describe, expect, test } from "bun:test";
import {
    arrangementCompetition,
    completeTransitionQuality,
    evaluateSegmentPolicy,
    harmonicTransitionStrategy,
    materialTransitionPolicy,
    sanitizeLearnedControlTrajectory,
    segmentPairMixability,
    TRANSITION_NOTICEABILITY_TARGETS,
    transitionExperienceScore,
    VALIDATION_EVIDENCE_KINDS,
} from "./transition-material-intelligence";

describe("transition material and arrangement intelligence", () => {
    test("keeps study, practitioner and user-report evidence distinct", () => {
        expect(VALIDATION_EVIDENCE_KINDS).toEqual(["study-listening-test", "practitioner-experience", "user-report"]);
    });

    test("penalizes salient effects more strongly in chill than party", () => {
        const evaluation = { technicalQuality: 0.9, musicalFit: 0.9, continuity: 0.9, salience: 0.9, novelty: 0.8 };
        expect(transitionExperienceScore(evaluation, "party")).toBeGreaterThan(
            transitionExperienceScore(evaluation, "chill"),
        );
        expect(TRANSITION_NOTICEABILITY_TARGETS.chill.max).toBeLessThan(TRANSITION_NOTICEABILITY_TARGETS.party.max);
    });

    test("uses material-aware transition policies", () => {
        expect(materialTransitionPolicy("locked-electronic").beatmatching).toBe("enabled");
        expect(materialTransitionPolicy("live-drums").beatmatching).toBe("dynamic-map-required");
        expect(materialTransitionPolicy("beatless").beatmatching).toBe("disabled");
        expect(materialTransitionPolicy("classical").preferredBasis).toContain("semantic");
    });

    test("does not blindly truncate useful but artistically important segments", () => {
        const album = evaluateSegmentPolicy({
            mixUtility: 0.9,
            artisticImportance: 1,
            experience: "love",
            albumMode: true,
        });
        const party = evaluateSegmentPolicy({
            mixUtility: 0.9,
            artisticImportance: 1,
            experience: "party",
            albumMode: false,
        });
        expect(album.truncationRisk).toBeGreaterThan(party.truncationRisk);
        expect(album.mixUtility).toBe(0.9);
    });

    test("learns bounded control trajectories while retaining deterministic DSP", () => {
        const policy = sanitizeLearnedControlTrajectory([
            { progress: 1.2, outgoingGain: -1, incomingGain: 2, lowEqSwap: 0.5, effectAmount: 0.2 },
        ]);
        expect(policy.controls[0]).toMatchObject({ progress: 1, outgoingGain: 0, incomingGain: 1 });
        expect(policy.audioGeneration).toBe(false);
        expect(policy.deterministicDsp).toBe(true);
    });

    test("scores segment pairs rather than assuming whole-track similarity", () => {
        const mix = segmentPairMixability("outro", "intro", {
            beat: 0.9,
            chroma: 0.8,
            latentTopic: 0.2,
            phrase: 1,
            texture: 0.9,
        });
        expect(mix.outgoingSegmentId).toBe("outro");
        expect(mix.score).toBeGreaterThan(0.7);
    });

    test("does not equate beatmatching with transition quality", () => {
        const weak = completeTransitionQuality({
            beat: 1,
            phrase: 0,
            harmony: 0,
            density: 0,
            vocals: 0,
            structure: 0,
            energy: 0,
            policyFit: 0,
        });
        const complete = completeTransitionQuality({
            beat: 0.8,
            phrase: 0.9,
            harmony: 0.8,
            density: 0.9,
            vocals: 0.9,
            structure: 0.9,
            energy: 0.8,
            policyFit: 0.9,
        });
        expect(weak).toBeLessThan(0.1);
        expect(complete).toBeGreaterThan(0.8);
    });

    test("detects vocal, lead, bass and density collisions with mitigations", () => {
        const dense = { density: 1, vocalPresence: 1, leadPresence: 1, percussionPresence: 0.8, bassPresence: 1 };
        const result = arrangementCompetition(dense, dense);
        expect(result.score).toBe(1);
        expect(result.mitigations).toEqual([
            "shorter-transition",
            "stem-isolation",
            "aggressive-eq",
            "different-phrase",
        ]);
    });

    test("makes harmonic risk depend on segment harmonic activity", () => {
        const drums = harmonicTransitionStrategy(0, 0.05, 0.05);
        const melodies = harmonicTransitionStrategy(0, 1, 1);
        expect(drums.risk).toBeLessThan(0.1);
        expect(melodies.risk).toBe(1);
        expect(melodies.shortenOverlap).toBe(true);
    });
});
