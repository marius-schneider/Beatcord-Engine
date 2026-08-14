import { describe, expect, test } from "bun:test";
import {
    activeTeachingValue,
    calibratedConfidence,
    conformalActionEnvelope,
    correctionPropagation,
    culturalDomainGuard,
    decisionConfidence,
    diffusionStemEscalation,
    fewShotAdapter,
    microExploration,
} from "./exploration-uncertainty-teaching";

describe("exploration uncertainty and teaching", () => {
    test("uses safe one-artist micro exploration", () => {
        expect(
            microExploration({ candidateDistance: 0.2, genreFit: 0.9, energyFit: 0.8, transitionSafety: 0.9 }),
        ).toEqual({ allowed: true, scope: "one-artist", stableDimensions: ["genre", "energy", "transition"] });
        expect(
            microExploration({ candidateDistance: 0.8, genreFit: 0.9, energyFit: 0.8, transitionSafety: 0.9 }).allowed,
        ).toBeFalse();
    });
    test("calibrates confidence per analyzer and domain", () => {
        const observations = [
            { analyzer: "beat", domain: "rock", predictedConfidence: 0.9, correct: true },
            { analyzer: "beat", domain: "rock", predictedConfidence: 0.9, correct: false },
        ];
        expect(calibratedConfidence(observations, "beat", "rock", 0.9)).toEqual({
            calibrated: 0.5,
            samples: 2,
            domainConditional: true,
        });
        expect(calibratedConfidence(observations, "beat", "house", 0.9).calibrated).toBe(0.63);
    });
    test("separates model and decision confidence", () => {
        expect(decisionConfidence(0.8, 0.75)).toBe(0.6);
    });
    test("returns calibrated safe action sets", () => {
        expect(
            conformalActionEnvelope(
                [
                    { transition: "eq-blend", success: 0.95 },
                    { transition: "stem-mashup", success: 0.5 },
                ],
                0.9,
            ),
        ).toEqual({
            safeTransitions: ["eq-blend"],
            unsafeTransitions: ["stem-mashup"],
            confidenceLevel: 0.9,
            researchPrototype: true,
        });
    });
    test("asks only power users when information gain is high", () => {
        expect(
            activeTeachingValue({ uncertainty: 1, expectedFutureUse: 1, correctionValue: 1, mode: "normal" }),
        ).toEqual({ ask: false, score: 1, normalListenerNagged: false });
        expect(
            activeTeachingValue({ uncertainty: 1, expectedFutureUse: 1, correctionValue: 1, mode: "dj-power" }).ask,
        ).toBeTrue();
    });
    test("propagates simple corrections to dependent models", () => {
        expect(correctionPropagation("move-downbeat")).toEqual([
            "bar-numbering",
            "meter-phase",
            "phrase-boundaries",
            "transition-windows",
            "cue-points",
            "loop-safety",
        ]);
        expect(correctionPropagation("tap-4-beats")).toContain("expressive-timing");
    });
    test("builds tiny local adapters without mutating global models", () => {
        expect(
            fewShotAdapter({
                domain: "live disco",
                corrections: 4,
                highConfidenceLabels: 2,
                globalModelMutation: false,
            }),
        ).toEqual({ create: true, name: "livediscoAdapter", localOnly: true, globalModelMutation: false });
    });
    test("reduces intervention outside known cultural domains", () => {
        expect(culturalDomainGuard(0.9)).toEqual({ intervention: "preserve", westernFourFourAssumed: false });
    });
    test("uses diffusion refinement only in lookahead escalation", () => {
        expect(
            diffusionStemEscalation({
                fastStemQuality: 0.5,
                transitionImportance: 0.9,
                computeAvailable: true,
                lookahead: true,
            }),
        ).toEqual({ useDiffusion: true, normalRealtimePath: false, fallback: "deterministic-separation" });
        expect(
            diffusionStemEscalation({
                fastStemQuality: 0.5,
                transitionImportance: 0.9,
                computeAvailable: true,
                lookahead: false,
            }).useDiffusion,
        ).toBeFalse();
    });
});
