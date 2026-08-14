import { describe, expect, test } from "bun:test";
import {
    aggregateGroupSatisfaction,
    applyCrowdMoodHysteresis,
    assessCrowdFatigue,
    CommunityGraph,
    crowdConsensusScore,
    evaluateFairnessWindow,
    groupRulesForPhase,
    inferCrowdMood,
    learnCrowdEnergyZone,
    permittedMoodPrivacyTier,
    rankCrowdRequests,
    scoreGroupBridgeTrack,
    socialRelevance,
    tasteCompatibility,
    updateGroupSatisfactionHistory,
    updatePresence,
} from "./group-recommendation";

describe("group recommendation and crowd mood", () => {
    test("dynamically blends group strategies and softens least misery", () => {
        const result = aggregateGroupSatisfaction(
            [
                { userId: "a", satisfaction: 0.98, fairnessDebt: 0 },
                { userId: "b", satisfaction: 0.96, fairnessDebt: 0 },
                { userId: "c", satisfaction: 0.03, fairnessDebt: 0.8 },
            ],
            "build",
        );
        expect(result.polarization).toBeGreaterThan(0.5);
        expect(result.leastMiseryPenalty).toBeGreaterThan(0);
        expect(result.score).toBeGreaterThan(0);
    });

    test("computes fairness debt over time and track windows", () => {
        const now = 1_000_000;
        const observations = Array.from({ length: 12 }, (_, index) => [
            {
                atMs: now - index * 60_000,
                trackId: `t${index}`,
                userId: "a",
                expectedSatisfaction: 0.8,
                observedSatisfaction: 0.8,
                represented: true,
            },
            {
                atMs: now - index * 60_000,
                trackId: `t${index}`,
                userId: "b",
                expectedSatisfaction: 0.8,
                observedSatisfaction: 0.3,
                represented: index < 2,
            },
        ]).flat();
        const result = evaluateFairnessWindow(observations, now);
        expect(result.trackCount).toBe(10);
        expect(result.debt.b).toBeGreaterThan(result.debt.a ?? 0);
    });

    test("infers probabilistic crowd mood and refuses invasive sensing by default", () => {
        const input = {
            explicit: { experienceSelection: "party" as const, crowdSlider: 0.9 },
            implicit: {
                likes: 5,
                reactions: 8,
                skipVotes: 0,
                requests: 4,
                queueAdds: 3,
                saveRate: 0.7,
                participation: 0.8,
                chatReactions: 5,
            },
            optionalSensing: { consent: false, cameraEmotion: 1, microphoneEmotion: 1 },
        };
        const mood = inferCrowdMood(input);
        expect(mood.party).toBeGreaterThan(mood.chill);
        expect(mood.confidence).toBeGreaterThan(0.5);
        expect(permittedMoodPrivacyTier(input)).toBe(1);
    });

    test("smooths noisy mood and needs confidence plus margin to switch", () => {
        const previous = {
            chill: 0.1,
            love: 0.1,
            energy: 0.3,
            party: 0.8,
            engagement: 0.8,
            fatigue: 0.1,
            familiarityDemand: 0.2,
            noveltyDemand: 0.6,
            confidence: 0.9,
        };
        const oneSkip = { ...previous, chill: 0.9, party: 0.1, confidence: 0.3 };
        expect(applyCrowdMoodHysteresis(previous, oneSkip, "party").dominant).toBe("party");
    });

    test("separates five crowd fatigue dimensions and learns a non-monotonic energy zone", () => {
        const fatigue = assessCrowdFatigue([
            { energy: 0.9, genre: "house", vocalness: 0.8, novelty: 0.7, transitionComplexity: 0.8, reaction: 0.9 },
            { energy: 0.92, genre: "house", vocalness: 0.85, novelty: 0.8, transitionComplexity: 0.9, reaction: 0.2 },
        ]);
        expect(fatigue.energyFatigue).toBeGreaterThan(0);
        expect(fatigue.genreFatigue).toBeGreaterThan(0);
        const zone = learnCrowdEnergyZone([
            { energy: 0.5, engagement: 0.5, confidence: 0.8 },
            { energy: 0.7, engagement: 0.95, confidence: 0.9 },
            { energy: 0.9, engagement: 0.4, confidence: 0.9 },
        ]);
        expect(zone.peak).toBe(0.7);
    });

    test("weights close communities above global trends and finds bridge genres", () => {
        const graph = new CommunityGraph();
        graph.add({ from: "marius", to: "friends", relation: "close-friend", strength: 0.91 });
        graph.add({ from: "marius", to: "global", relation: "global", strength: 1 });
        expect(graph.affinity("marius", "friends")).toBeGreaterThan(graph.affinity("marius", "global"));
        expect(socialRelevance(0.8, 0.9, 0.7)).toBeGreaterThan(socialRelevance(1, 0.2, 0.7));
        const compatibility = tasteCompatibility(
            { house: 0.9, electropop: 0.5 },
            { pop: 0.9, electropop: 0.6 },
            { electropop: ["house", "pop"] },
        );
        expect(compatibility.bridgeGenres).toContain("electropop");
    });

    test("uses bridge tracks and fair request routing instead of requester domination", () => {
        expect(
            scoreGroupBridgeTrack(
                [
                    { userId: "a", satisfaction: 0.73, fairnessDebt: 0 },
                    { userId: "b", satisfaction: 0.91, fairnessDebt: 0 },
                    { userId: "c", satisfaction: 0.69, fairnessDebt: 0.5 },
                ],
                0.9,
                0.85,
            ).score,
        ).toBeGreaterThan(0.6);
        const now = 10_000_000;
        const ranked = rankCrowdRequests(
            [
                {
                    id: "a-13th",
                    trackId: "x",
                    requestedBy: "a",
                    priority: 0.8,
                    playNext: false,
                    votes: 1,
                    compatibility: 0.8,
                    createdAtMs: now - 1_000,
                },
                {
                    id: "b-first",
                    trackId: "y",
                    requestedBy: "b",
                    priority: 0.7,
                    playNext: false,
                    votes: 1,
                    compatibility: 0.8,
                    createdAtMs: now - 1_000,
                },
            ],
            now,
            { a: 0, b: 0.8 },
            { a: 12, b: 0 },
        );
        expect(ranked[0]?.id).toBe("b-first");
    });

    test("measures consensus separately from mean and changes rules by session phase", () => {
        const polar = crowdConsensusScore([1, 0.98, 0.04, 0.01]);
        const aligned = crowdConsensusScore([0.75, 0.72, 0.7, 0.71]);
        expect(aligned.consensus).toBeGreaterThan(polar.consensus);
        expect(groupRulesForPhase("peak").familiarity).toBeGreaterThan(groupRulesForPhase("warmup").familiarity);
        expect(groupRulesForPhase("breather").minorityOpportunity).toBeGreaterThan(
            groupRulesForPhase("peak").minorityOpportunity,
        );
    });

    test("tracks satisfaction history and ramps presence without hard crowd jumps", () => {
        const history = updateGroupSatisfactionHistory(
            {
                userId: "b",
                recentExpectedSatisfaction: 0.8,
                recentObservedSatisfaction: 0.3,
                representation: 0.2,
                requestDebt: 0.5,
                active: true,
            },
            { expected: 0.9, observed: 0.8, represented: true, requestServed: true },
        );
        expect(history.representation).toBeGreaterThan(0.2);
        expect(history.requestDebt).toBeLessThan(0.5);
        const joined = updatePresence(null, "new", "joined", 0);
        const active = updatePresence(joined, "new", "active", 2 * 60_000);
        expect(joined.weight).toBe(0.15);
        expect(active.weight).toBeGreaterThan(joined.weight);
        expect(updatePresence(active, "new", "left", 3 * 60_000).weight).toBe(0);
    });
});
