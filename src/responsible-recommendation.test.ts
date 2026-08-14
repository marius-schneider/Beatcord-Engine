import { describe, expect, test } from "bun:test";
import {
    artistExposureAdjustment,
    compareCounterfactualRoutes,
    EVALUATION_PYRAMID,
    explainDecisionFromEvidence,
    groupFeedbackLabels,
    longTermValue,
    monitorHomogenization,
    planDiscoveryBudget,
    popularityAlignment,
    predictWorldModelResponse,
    RECOMMENDATION_EVALUATION_DIMENSIONS,
    recommendationStewardship,
    reinforcementLearningGate,
    scheduleSatisfactionSurvey,
    serendipityScore,
} from "./responsible-recommendation";

describe("responsible recommendation and evaluation", () => {
    test("personalizes popularity alignment instead of universally debiasing", () => {
        const mainstream = popularityAlignment(0.95, { mainstreamAffinity: 0.9, longTailAffinity: 0.1, confidence: 1 });
        const niche = popularityAlignment(0.95, { mainstreamAffinity: 0.1, longTailAffinity: 0.9, confidence: 1 });
        expect(mainstream.alignment).toBeGreaterThan(niche.alignment);
        expect(mainstream.hardTarget).toBe(false);
    });

    test("never forces creator exposure over listener relevance", () => {
        expect(
            artistExposureAdjustment({ listenerRelevance: 0.2, creatorExposureNeed: 1, minimumRelevance: 0.5 }),
        ).toEqual({ eligible: false, adjustment: 0, forced: false });
        expect(
            artistExposureAdjustment({ listenerRelevance: 0.8, creatorExposureNeed: 1, minimumRelevance: 0.5 })
                .adjustment,
        ).toBeLessThanOrEqual(0.12);
    });

    test("balances present relevance with consented long-term openness", () => {
        const conservative = recommendationStewardship(0.9, 1, 0);
        const exploratory = recommendationStewardship(0.9, 1, 1);
        expect(conservative.longTermOpenness).toBe(1);
        expect(exploratory.combined).toBeGreaterThan(conservative.combined);
    });

    test("detects homogenization and distinguishes serendipity from novelty", () => {
        const state = monitorHomogenization({
            artistConcentration: 1,
            genreConcentration: 0.9,
            popularityConcentration: 0.9,
            embeddingCoverage: 0.1,
            noveltyTrend: -0.8,
        });
        expect(state.risk).toBeGreaterThan(0.8);
        expect(serendipityScore(1, 0.9, 0.8)).toBe(0.72);
        expect(serendipityScore(1, 0, 1)).toBe(0);
    });

    test("bounds discovery with anchors and bridge tracks", () => {
        const plan = planDiscoveryBudget(10, 0.8, 0.7);
        expect(plan.discoverySlots).toBeLessThan(8);
        expect(plan.familiarityAnchors).toBeGreaterThan(0);
        expect(plan.bridgeTracks).toBeGreaterThan(0);
    });

    test("builds explanations exclusively from positive model evidence", () => {
        const result = explainDecisionFromEvidence([
            { reason: "transition-compatibility", contribution: 0.8, source: "director" },
            { reason: "user-affinity", contribution: 0, source: "taste" },
        ]);
        expect(result.reasons).toEqual(["transition-compatibility"]);
        expect(result.explanation).not.toContain("user-affinity");
    });

    test("measures long-term value and schedules surveys sparingly", () => {
        expect(
            longTermValue({
                wouldReuseExperience: 1,
                wouldStartAnotherSession: 1,
                wouldSaveJourney: 0.5,
                wouldTrustAutoAgain: 1,
            }),
        ).toBeGreaterThan(0.8);
        expect(
            scheduleSatisfactionSurvey({
                completedSessionsSincePrompt: 2,
                sessionDurationMinutes: 60,
                dismissedLastPrompt: false,
            }).due,
        ).toBe(false);
        expect(
            scheduleSatisfactionSurvey({
                completedSessionsSincePrompt: 8,
                sessionDurationMinutes: 60,
                dismissedLastPrompt: true,
            }).due,
        ).toBe(true);
    });

    test("keeps track, transition and session labels separate", () => {
        const grouped = groupFeedbackLabels([
            { scope: "track", label: "song-quality", value: 1 },
            { scope: "transition", label: "mix-quality", value: 0.8 },
            { scope: "session", label: "journey-quality", value: 0.9 },
        ]);
        expect(grouped.track[0]?.label).toBe("song-quality");
        expect(grouped.transition[0]?.label).toBe("mix-quality");
        expect(grouped.session[0]?.label).toBe("journey-quality");
    });

    test("publishes broad evaluation dimensions and a staged evidence pyramid", () => {
        expect(RECOMMENDATION_EVALUATION_DIMENSIONS).toHaveLength(13);
        expect(EVALUATION_PYRAMID).toEqual([
            "offline-tests",
            "simulation",
            "shadow-mode",
            "small-user-tests",
            "ab-tests",
            "longitudinal-evaluation",
        ]);
    });

    test("uses world models as uncertain filters for counterfactuals", () => {
        const state = { satisfaction: 0.5, skipRisk: 0.4, energy: 0.4, crowdFairness: 0.5, transitionQuality: 0.5 };
        const observed = predictWorldModelResponse(
            state,
            { relevance: 0.5, energy: 0.5, fairness: 0.5, transitionQuality: 0.5 },
            0.7,
        );
        const counterfactual = predictWorldModelResponse(
            state,
            { relevance: 0.9, energy: 0.7, fairness: 0.9, transitionQuality: 0.9 },
            0.7,
        );
        expect(observed.filterOnly).toBe(true);
        expect(compareCounterfactualRoutes(observed, counterfactual).preferred).toBe("counterfactual");
    });

    test("blocks reinforcement learning until every safety prerequisite exists", () => {
        const gate = reinforcementLearningGate({
            strongBaselines: true,
            reliableLogging: true,
            rewardAttribution: false,
            safeConstraints: true,
            simulation: true,
        });
        expect(gate.allowed).toBe(false);
        expect(gate.currentStrategy).toBe("retrieval-ranking-route-planning");
        expect(gate.missing).toEqual(["rewardAttribution"]);
    });
});
