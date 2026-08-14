import { describe, expect, test } from "bun:test";
import {
    aggregateGroupUtility,
    assessCrowdCohesion,
    evaluateGroupFairness,
    explainFairness,
    inferLatentCrowdMood,
    PHYSIOLOGICAL_SIGNAL_POLICY,
    planAffectJourney,
    selectFairnessPolicy,
    separateCrowdExperienceSignals,
} from "./crowd-experience-v2";

const affect = (valence: number, arousal: number) => ({
    valence,
    arousal,
    valenceConfidence: 0.8,
    arousalConfidence: 0.9,
});

describe("crowd experience and dynamic fairness", () => {
    test("plans gradual emotional trajectories instead of jumping", () => {
        const path = planAffectJourney(
            { start: affect(0, 0.2), target: affect(0.6, 0.9), durationMinutes: 60, strategy: "gradual-shift" },
            4,
        );
        expect(path).toHaveLength(4);
        expect(path[0]!.arousal).toBeGreaterThan(0.2);
        expect(path.at(-1)?.arousal).toBe(0.9);
    });

    test("keeps inferred crowd mood latent and uncertain", () => {
        const mood = inferLatentCrowdMood({
            explicit: affect(0.8, 0.7),
            behavioral: affect(-0.2, 0.9),
            evidence: { explicit: 0.6, behavioral: 0.5 },
        });
        expect(mood.latent).toBe(true);
        expect(mood.uncertainty).toBeGreaterThan(0);
        expect(mood.estimate.valence).toBeLessThan(0.8);
    });

    test("measures non-biometric crowd cohesion from synchronous reactions", () => {
        const cohesion = assessCrowdCohesion([
            { memberId: "a", atMs: 1_000, direction: 0.9, engagement: 0.8 },
            { memberId: "b", atMs: 2_000, direction: 0.8, engagement: 0.9 },
            { memberId: "c", atMs: 2_500, direction: 1, engagement: 0.7 },
        ]);
        expect(cohesion.consensus).toBeGreaterThan(0.9);
        expect(cohesion.reactionSynchrony).toBeGreaterThan(0.9);
        expect(PHYSIOLOGICAL_SIGNAL_POLICY.required).toBe(false);
    });

    test("does not collapse mood, engagement, sentiment and satisfaction", () => {
        const signals = separateCrowdExperienceSignals({
            mood: affect(-0.2, 0.9),
            activity: 1,
            positiveReactions: 1,
            negativeReactions: 9,
            acceptance: 0.2,
        });
        expect(signals.engagement).toBe(1);
        expect(signals.sentiment).toBeLessThan(0);
        expect(signals.satisfaction).toBe(0.2);
        expect(signals.mood.arousal).toBe(0.9);
    });

    test("supports six explicit group aggregation strategies", () => {
        const members = [
            { memberId: "a", utility: 1, approved: true, fairnessDebt: 0 },
            { memberId: "b", utility: 0.2, approved: false, fairnessDebt: 1 },
        ];
        expect(aggregateGroupUtility(members, "average")).toBe(0.6);
        expect(aggregateGroupUtility(members, "least-misery")).toBe(0.2);
        expect(aggregateGroupUtility(members, "most-pleasure")).toBe(1);
        expect(aggregateGroupUtility(members, "approval")).toBe(0.5);
        expect(aggregateGroupUtility(members, "fair-share")).toBeLessThan(0.6);
        expect(aggregateGroupUtility(members, "weighted-consensus")).toBe(0.6);
    });

    test("selects contextual fairness policies and truth-based explanations", () => {
        expect(selectFairnessPolicy("dinner").leastMiseryWeight).toBeGreaterThan(
            selectFairnessPolicy("party-peak").leastMiseryWeight,
        );
        expect(selectFairnessPolicy("party-peak").requestWeight).toBeGreaterThan(
            selectFairnessPolicy("dinner").requestWeight,
        );
        expect(explainFairness(["bridge"], { genres: ["Pop", "House"] })).toContain("Pop and House");
    });

    test("reports computational and perceived fairness separately", () => {
        expect(evaluateGroupFairness(0.9, [0.4, 0.6])).toEqual({
            computational: 0.9,
            perceived: 0.5,
            gap: 0.4,
            strategyUniversal: false,
        });
    });
});
