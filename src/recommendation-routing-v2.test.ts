import { describe, expect, test } from "bun:test";
import {
    ADDITIONAL_RESEARCH_SOURCES,
    aggregatePrivateGroup,
    assessDeferredRecommendation,
    CrowdReactionLoop,
    evaluateRecommendationHardGates,
    GroupProfileStore,
    planRecommendationRoute,
    RECOMMENDATION_ARCHITECTURE_V2,
    RECOMMENDATION_MILESTONES,
    recommendationScoreV2,
    resolveCrowdMood,
    STRATEGIC_BRAINS,
    separateSocialInfluence,
    transitionCompatibility,
} from "./recommendation-routing-v2";

describe("recommendation routing v2", () => {
    test("scores musical transitions and defers tracks with stronger future fit", () => {
        expect(
            transitionCompatibility({ musical: 1, mood: 0.8, energy: 0.8, semantic: 0.7, contrastIntent: 0.9 }),
        ).toBeGreaterThan(0.8);
        expect(assessDeferredRecommendation("peak", 0.4, [0.55, 0.86]).defer).toBe(true);
    });

    test("plans a bounded route and preserves deferred candidates", () => {
        const route = planRecommendationRoute(
            [
                {
                    trackId: "a",
                    durationMinutes: 4,
                    immediateFit: 0.9,
                    futureFit: 0.7,
                    transitionFromPrevious: 0.9,
                    targetProgress: 0.7,
                },
                {
                    trackId: "b",
                    durationMinutes: 4,
                    immediateFit: 0.8,
                    futureFit: 0.9,
                    transitionFromPrevious: 0.8,
                    targetProgress: 0.9,
                },
                {
                    trackId: "c",
                    durationMinutes: 30,
                    immediateFit: 0.2,
                    futureFit: 0.2,
                    transitionFromPrevious: 0.2,
                    targetProgress: 0.2,
                },
            ],
            8,
        );
        expect(route.trackIds).toEqual(["b", "a"]);
        expect(route.deferredTrackIds).toContain("c");
    });

    test("decays crowd reactions and supports controlled mood override", () => {
        const loop = new CrowdReactionLoop();
        loop.record({ trackId: "x", reaction: "dance", atMs: 0, confidence: 1 });
        expect(loop.feedback("x", 45 * 60_000).adjustment).toBeCloseTo(0.4, 3);
        expect(resolveCrowdMood({ mode: "adaptive", observedMood: 0.2, overrideMood: 0.9 })).toEqual({
            targetMood: 0.9,
            source: "override",
        });
    });

    test("aggregates only consenting members without exposing identifiers", () => {
        const profile = aggregatePrivateGroup([
            { memberId: "secret-a", consent: true, taste: { house: 1 }, negativeTags: ["metal"] },
            { memberId: "secret-b", consent: true, taste: { house: 0.5 }, negativeTags: ["metal"] },
            { memberId: "secret-c", consent: false, taste: { house: 0 }, negativeTags: ["house"] },
        ]);
        expect(profile.aggregateTaste.house).toBe(0.75);
        expect(profile.blockedTags).toEqual(["metal"]);
        expect(JSON.stringify(profile)).not.toContain("secret");
    });

    test("discards session groups and version-controls explicitly saved groups", () => {
        const profile = aggregatePrivateGroup([{ memberId: "a", consent: true, taste: { pop: 1 } }]);
        const store = new GroupProfileStore();
        store.setSession("session", profile);
        store.endSession("session");
        expect(store.session("session")).toBeNull();
        expect(store.save("friends", profile, 1).version).toBe(1);
        expect(store.evolve("friends", { ...profile, aggregateTaste: { pop: 0 } }, 2).version).toBe(2);
    });

    test("keeps personal and social influence auditable and applies hard gates before scoring", () => {
        expect(separateSocialInfluence(0.8, 1, false)).toEqual({ personal: 0.8, social: 0, combined: 0.576 });
        expect(
            evaluateRecommendationHardGates({
                explicitDislike: true,
                neverPlay: false,
                contentAllowed: true,
                providerAvailable: true,
                sessionAllowed: true,
                duplicate: false,
                requestOrderValid: true,
                qualitySufficient: true,
            }),
        ).toEqual({ allowed: false, failures: ["explicit-dislike"] });
        expect(
            recommendationScoreV2({
                personalTaste: 1,
                sessionContext: 1,
                capabilityFit: 1,
                groupFit: 0.8,
                transitionFit: 0.8,
                futureFit: 0.8,
                memoryAdjustment: 0.1,
                fatiguePenalty: 0,
                overplayPenalty: 0,
            }),
        ).toBeGreaterThan(0.9);
    });

    test("publishes the architecture, milestones, research map and three-brain strategy", () => {
        expect(RECOMMENDATION_ARCHITECTURE_V2).toHaveLength(10);
        expect(RECOMMENDATION_MILESTONES.map((item) => item.id)).toEqual([14, 15, 16, 17, 18, 19, 20]);
        expect(ADDITIONAL_RESEARCH_SOURCES).toHaveLength(6);
        expect(STRATEGIC_BRAINS).toEqual(["taste-brain", "session-brain", "music-director"]);
    });
});
