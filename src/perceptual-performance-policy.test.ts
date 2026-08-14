import { describe, expect, test } from "bun:test";
import {
    ADDITIONAL_EVIDENCE_SOURCES,
    adaptiveCognitiveLoad,
    distributeSurprise,
    effectFatigue,
    evaluateStemQuality,
    fuseTransitionEvidence,
    genreMixingPolicy,
    loudnessPolicy,
    RESEARCH_FEATURE_MATRIX,
    routeTransitionFeedback,
    segmentStretchBudget,
    stemArtifactBudget,
    TRANSITION_PERSONALITIES,
    ultimateCandidateDecision,
} from "./perceptual-performance-policy";

describe("perceptual DSP and performance policy", () => {
    test("combines objective, perceptual and in-mix stem quality", () => {
        const result = evaluateStemQuality({
            objectiveMetric: 0.4,
            perceptualListeningQuality: 0.6,
            stemIsolationQuality: 0.4,
            stemInMixQuality: 0.9,
            mixContextTested: true,
        });
        expect(result.usable).toBe(true);
        expect(result.score).toBeGreaterThan(0.6);
    });

    test("adapts stem artifact tolerance to masking and experience", () => {
        expect(stemArtifactBudget({ experience: "party", masking: 1, vocalExposure: 0 }).tolerance).toBeGreaterThan(
            stemArtifactBudget({ experience: "chill", masking: 0, vocalExposure: 1 }).tolerance,
        );
    });

    test("uses segment-specific percussion-aware stretch budgets", () => {
        const risk = { ratio: 1.08, percussionDensity: 1, transientDensity: 1, vocalPresence: 0.2 };
        expect(segmentStretchBudget(risk, "percussive-drop").maxRatioDelta).toBeLessThan(
            segmentStretchBudget(risk, "pad-intro").maxRatioDelta,
        );
    });

    test("preserves album dynamics and avoids identical peak targets", () => {
        expect(loudnessPolicy("album").preserveAlbumRelativeDynamics).toBe(true);
        expect(loudnessPolicy("chill").dynamicPreservation).toBeGreaterThan(
            loudnessPolicy("party").dynamicPreservation,
        );
        expect(loudnessPolicy("party").identicalPeakTarget).toBe(false);
    });

    test("offers personality presets and genre policies independently from experience", () => {
        expect(Object.keys(TRANSITION_PERSONALITIES)).toEqual(["natural", "smooth", "expressive", "club", "wild"]);
        expect(TRANSITION_PERSONALITIES.natural.subtlety).toBeGreaterThan(TRANSITION_PERSONALITIES.wild.subtlety);
        expect(genreMixingPolicy("ambient").independentFromExperience).toBe(true);
        expect(genreMixingPolicy("house-techno").beatmixReliance).toBeGreaterThan(
            genreMixingPolicy("ambient").beatmixReliance,
        );
    });

    test("publishes the twenty-item research-backed feature matrix", () => {
        expect(RESEARCH_FEATURE_MATRIX).toHaveLength(20);
        expect(RESEARCH_FEATURE_MATRIX.find((item) => item.feature === "crowd-mood-inference")?.confidence).toBe(
            "medium",
        );
    });

    test("fuses calibrated evidence kinds and exposes contributions", () => {
        const result = fuseTransitionEvidence([
            { source: "audio-model", value: 0.9, calibration: 0.8 },
            { source: "user-feedback", value: 0.5, calibration: 1 },
        ]);
        expect(result.expectedQuality).toBeGreaterThan(0.5);
        expect(result.expectedQuality).toBeLessThan(0.9);
        expect(result.sourceContributions["user-feedback"]).toBeGreaterThan(0);
    });

    test("routes transition feedback only into mixing taste", () => {
        expect(routeTransitionFeedback("bad-transition", "a", "b")).toEqual({
            learningTarget: "mixing-taste",
            musicTasteChanged: false,
            pair: "a->b",
            delta: -0.1,
        });
    });

    test("controls effect repetition, fatigue, novelty and appropriateness", () => {
        const history = Array.from({ length: 6 }, () => ({ effect: "vocal-chop", appropriateness: 0.3 }));
        expect(effectFatigue("vocal-chop", history).fatiguePenalty).toBeGreaterThan(0.9);
        expect(effectFatigue("echo", history).novelty).toBe(1);
    });

    test("distributes surprise and adapts cognitive load to crowd response", () => {
        const surprise = distributeSurprise(
            { trackNovelty: 1, genreNovelty: 1, transitionNovelty: 1, rhythmicNovelty: 1, journeyNovelty: 1 },
            false,
        );
        expect(surprise.adjusted).toBe(true);
        expect(surprise.total).toBe(2);
        const calm = adaptiveCognitiveLoad(
            { trackNovelty: 0.5, transitionSalience: 0.5, genreDistance: 0.5, tempoShock: 0.5, harmonicShock: 0.5 },
            "party",
            0,
        );
        const reacting = adaptiveCognitiveLoad(
            { trackNovelty: 0.5, transitionSalience: 0.5, genreDistance: 0.5, tempoShock: 0.5, harmonicShock: 0.5 },
            "party",
            1,
        );
        expect(calm.allowed).toBe(true);
        expect(reacting.allowed).toBe(false);
    });

    test("combines five fit layers into play, defer or reject", () => {
        expect(
            ultimateCandidateDecision({
                songFit: 0.9,
                momentFit: 0.8,
                journeyFit: 0.8,
                mixFit: 0.9,
                experienceFit: 0.8,
            }).decision,
        ).toBe("play");
        expect(
            ultimateCandidateDecision({
                songFit: 0.9,
                momentFit: 0.45,
                journeyFit: 0.8,
                mixFit: 0.9,
                experienceFit: 0.8,
            }).decision,
        ).toBe("defer");
        expect(
            ultimateCandidateDecision({
                songFit: 0.9,
                momentFit: 0.2,
                journeyFit: 0.8,
                mixFit: 0.9,
                experienceFit: 0.8,
            }).decision,
        ).toBe("reject");
        expect(Object.values(ADDITIONAL_EVIDENCE_SOURCES).reduce((sum, count) => sum + count, 0)).toBe(29);
    });
});
