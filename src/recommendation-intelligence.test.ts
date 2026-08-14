import { describe, expect, test } from "bun:test";
import {
    DISCOVERY_MODES,
    interpretSkip,
    preferenceDecay,
    preferenceSignalWeight,
    type RecommendationCandidate,
    type RecommendationObjectives,
    rankRecommendations,
    recommendationFeedbackTargets,
    recommendationWeights,
    resolveTaste,
    simulateRecommendation,
    tasteConfidence,
    type UserTasteProfile,
    updateDiscoveryBudget,
} from "./recommendation-intelligence";

const objectives = (overrides: Partial<RecommendationObjectives> = {}): RecommendationObjectives => ({
    userSatisfaction: 0.8,
    crowdSatisfaction: 0.5,
    sessionFit: 0.8,
    musicalCompatibility: 0.8,
    discovery: 0.4,
    diversity: 0.5,
    novelty: 0.4,
    requestPriority: 0,
    fairness: 0.5,
    trendRelevance: 0.3,
    localRelevance: 0.4,
    transitionQuality: 0.8,
    ...overrides,
});

describe("recommendation and taste intelligence", () => {
    test("changes multi-objective weights with experience and runs every recommendation stage", () => {
        const party = recommendationWeights("party", { crowdActive: true, explicitRequest: true });
        const chill = recommendationWeights("chill");
        expect(party.crowdSatisfaction).toBeGreaterThan(chill.crowdSatisfaction);
        expect(party.transitionQuality).toBeGreaterThan(chill.transitionQuality);
        const candidates: RecommendationCandidate[] = [
            {
                id: "good-now",
                value: null,
                objectives: objectives({ sessionFit: 0.95 }),
                sequential: {
                    position: 1,
                    sessionLength: 5,
                    previousCompatibility: 0.9,
                    futureRouteFit: 0.9,
                    localSequenceFit: 0.9,
                },
                hardEligible: true,
                transitionFeasible: true,
            },
            {
                id: "bad-sequence",
                value: null,
                objectives: objectives({ userSatisfaction: 0.95 }),
                sequential: {
                    position: 1,
                    sessionLength: 5,
                    previousCompatibility: 0.1,
                    futureRouteFit: 0.1,
                    localSequenceFit: 0.1,
                },
                hardEligible: true,
                transitionFeasible: true,
            },
        ];
        const ranked = rankRecommendations(candidates, party);
        expect(ranked[0]?.candidate.id).toBe("good-now");
        expect(ranked[0]?.stages).toHaveLength(9);
    });

    test("simulates responses only as an offline expected-reward model", () => {
        const response = simulateRecommendation(
            { satisfaction: 0.7, fatigue: 0.1, recentSkips: 0, targetEnergy: 0.8, crowdActive: true },
            objectives({ userSatisfaction: 0.95, crowdSatisfaction: 0.9 }),
        );
        expect(response.completion).toBeGreaterThan(response.skip);
        expect(response.expectedReward).toBeGreaterThan(0);
    });

    test("resolves explicit, session, contextual, recent and long-term taste without collapsing them", () => {
        const profile: UserTasteProfile = {
            longTerm: { house: 0.8, jazz: 0.4 },
            recent: { house: 0.4, dnb: 0.9 },
            contextual: { driving: { energy: 0.9, house: 0.7 } },
            positivePreferences: [],
            negativePreferences: [],
            artistAffinity: {},
            genreAffinity: {},
            trackAffinity: {},
            noveltyPreference: 0.4,
            familiarityPreference: 0.6,
            explorationTolerance: 0.5,
        };
        const resolved = resolveTaste({ profile, context: "driving", session: { chill: 0.8 }, explicit: { house: 1 } });
        expect(resolved.house).toBeGreaterThan(0.8);
        expect(resolved.dnb).toBe(0.9);
        expect(resolved.chill).toBe(0.8);
    });

    test("calibrates taste confidence, decay and explicit signal priority", () => {
        expect(tasteConfidence(1_842, 0.95, 0.9)).toBeGreaterThan(tasteConfidence(3, 0.5, 0.5));
        const now = 1_000_000_000;
        const artist = preferenceDecay(
            { value: 1, confidence: 1, observations: 10, lastObservedAt: now - 180 * 86_400_000 },
            now,
            "artist",
        );
        const mood = preferenceDecay(
            { value: 1, confidence: 1, observations: 10, lastObservedAt: now - 180 * 86_400_000 },
            now,
            "mood",
        );
        expect(artist.value).toBeGreaterThan(mood.value);
        expect(preferenceSignalWeight("explicit-correction")).toBeGreaterThan(preferenceSignalWeight("skip"));
    });

    test("distinguishes skip causes and bad recommendation from track hate", () => {
        expect(
            interpretSkip({
                positionSec: 3,
                durationSec: 240,
                duringTransition: false,
                similarTracksBefore: 0,
                energyMismatch: 0,
            }).trackDislike,
        ).toBeGreaterThan(0.7);
        expect(
            interpretSkip({
                positionSec: 238,
                durationSec: 240,
                duringTransition: false,
                similarTracksBefore: 0,
                energyMismatch: 0,
            }).trackDislike,
        ).toBeLessThan(0.1);
        expect(
            interpretSkip({
                positionSec: 20,
                durationSec: 240,
                duringTransition: true,
                similarTracksBefore: 5,
                energyMismatch: 0.7,
            }).transitionDislike,
        ).toBeGreaterThan(0.7);
        expect(recommendationFeedbackTargets("bad-recommendation")).toEqual({
            trackPreference: 0,
            contextualRecommendation: -1,
        });
    });

    test("offers distinct discovery modes and requires familiarity when budget is depleted", () => {
        expect(DISCOVERY_MODES["deep-dive"].obscurity).toBeGreaterThan(DISCOVERY_MODES.safe.obscurity);
        let state = { capacity: 4, remaining: 4, consecutiveUnknown: 0, familiarityRequired: false };
        state = updateDiscoveryBudget(state, 0.9, true);
        state = updateDiscoveryBudget(state, 0.9, true);
        state = updateDiscoveryBudget(state, 0.9, false);
        expect(state.familiarityRequired).toBe(true);
    });
});
