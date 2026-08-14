import { expect, test } from "bun:test";

import { goldenMixCases } from "../tests/mixes";
import { evaluateGoldenMixCase } from "./golden-mix-benchmark";
import {
    createBlindListeningTrial,
    createPerceptualObservation,
    type PerceptualRatings,
    publicBlindListeningTrial,
    scoreVariantWithPerception,
    summarizePerceptualEvaluations,
    validateBlindListeningResponse,
} from "./perceptual-evaluation";

const preview = evaluateGoldenMixCase(goldenMixCases[0]!).preview;

function ratings(value: number): PerceptualRatings {
    return {
        naturalness: value,
        musicalLogic: value,
        energyFlow: value,
        audioQuality: value,
        surprise: value,
        emotionality: value,
        continueListening: value,
    };
}

test("blind trials are stable per participant, counterbalanced and hide variant identities", () => {
    const first = createBlindListeningTrial(preview, "listener-a", () => 100);
    const repeated = createBlindListeningTrial(preview, "listener-a", () => 200);
    expect(first.id).toBe(repeated.id);
    expect(first.samples.map((sample) => sample.variantId)).toEqual(repeated.samples.map((sample) => sample.variantId));

    let opposite = null;
    for (let index = 0; index < 100; index++) {
        const trial = createBlindListeningTrial(preview, `listener-${index}`);
        if (trial.samples[0].variantId !== first.samples[0].variantId) {
            opposite = trial;
            break;
        }
    }
    expect(opposite).not.toBeNull();

    const publicTrial = publicBlindListeningTrial(first);
    expect(JSON.stringify(publicTrial)).not.toContain("variant-");
    expect(JSON.stringify(publicTrial)).not.toContain("listener-a");
    expect(publicTrial.samples.map((sample) => sample.label)).toEqual(["A", "B"]);
});

test("responses validate every perceptual dimension and map blind choices server-side", () => {
    const trial = createBlindListeningTrial(preview, "listener-a", () => 100);
    const input = { choice: "A", ratings: { A: ratings(5), B: ratings(2) }, confidence: 0.8 } as const;
    const validated = validateBlindListeningResponse(input);
    expect(validated.ok).toBe(true);
    if (!validated.ok) throw new Error(validated.error);
    const observation = createPerceptualObservation(trial, "listener-a", validated.value, 200);
    expect(observation.selectedVariantId).toBe(trial.samples[0].variantId);
    expect(observation.raterHash).not.toContain("listener-a");
    expect(observation.ratingsByVariant[trial.samples[1].variantId]?.audioQuality).toBe(2);
    expect(() => createPerceptualObservation(trial, "listener-b", validated.value)).toThrow();

    expect(validateBlindListeningResponse({ ...input, confidence: 2 }).ok).toBe(false);
    expect(validateBlindListeningResponse({ ...input, ratings: { A: ratings(0), B: ratings(2) } }).ok).toBe(false);
});

test("aggregation deduplicates votes and exposes pairwise confidence intervals", () => {
    const recommended = preview.recommendedVariantId;
    const observations = Array.from({ length: 6 }, (_, index) => {
        const participant = `panel-${index}`;
        const trial = createBlindListeningTrial(preview, participant);
        const choice = trial.samples[0].variantId === recommended ? "A" : "B";
        const response = {
            choice,
            ratings: {
                A: ratings(trial.samples[0].variantId === recommended ? 5 : 2),
                B: ratings(trial.samples[1].variantId === recommended ? 5 : 2),
            },
            confidence: 0.9,
        } as const;
        return createPerceptualObservation(trial, participant, response, index + 1);
    });
    const summary = summarizePerceptualEvaluations([...observations, observations[0]!]);
    const winner = summary.variants.find((variant) => variant.variantId === recommended)!;
    expect(summary.responses).toBe(6);
    expect(summary.uniqueRaters).toBe(6);
    expect(summary.duplicateResponsesRemoved).toBe(1);
    expect(winner).toMatchObject({ comparisons: 6, wins: 6, losses: 0, preferenceRate: 1, humanQualityScore: 100 });
    expect(winner.preferenceInterval95.low).toBeGreaterThan(0.5);

    const variant = preview.variants.find((item) => item.id === recommended)!;
    const underpowered = scoreVariantWithPerception(variant, summarizePerceptualEvaluations(observations.slice(0, 4)));
    expect(underpowered.humanWeight).toBe(0);
    expect(underpowered.jointScore).toBe(underpowered.technicalScore);
    const joint = scoreVariantWithPerception(variant, summary);
    expect(joint.humanWeight).toBeGreaterThan(0);
    expect(joint.evidence).toBe(6);
});
