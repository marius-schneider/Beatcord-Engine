import { describe, expect, test } from "bun:test";
import {
    applyCuratorProfile,
    artistExposureContribution,
    assessHomogenizationSafety,
    buildCrowdColdStart,
    buildTrackColdStart,
    buildUserColdStart,
    explainRecommendation,
    hybridRecommendationScore,
    intentAwareMetric,
    mergeCandidateSources,
    personalizeDiversityWeights,
    weightsFromControls,
} from "./hybrid-recommendation";
import type { RecommendationObjectives } from "./recommendation-intelligence";

const objectives: RecommendationObjectives = {
    userSatisfaction: 0.8,
    crowdSatisfaction: 0.7,
    sessionFit: 0.9,
    musicalCompatibility: 0.8,
    discovery: 0.6,
    diversity: 0.6,
    novelty: 0.5,
    requestPriority: 0,
    fairness: 0.6,
    trendRelevance: 0.5,
    localRelevance: 0.8,
    transitionQuality: 0.9,
};

describe("cold start and hybrid recommendation", () => {
    test("creates bounded user, crowd and track cold-start representations", () => {
        const user = buildUserColdStart(
            {
                artistIds: ["a"],
                genres: ["house"],
                trackIds: ["1", "2", "3", "4", "5"],
                experiences: ["party"],
                familiarityVsDiscovery: 0.6,
            },
            1_000,
        );
        expect(user.confidence).toBeGreaterThan(0.5);
        expect(user.profile.genreAffinity.house?.value).toBe(0.78);
        const crowd = buildCrowdColdStart([
            { userId: "a", taste: { house: 0.9, pop: 0.4 }, satisfaction: 0.5, fairnessDebt: 0, active: true },
            { userId: "b", taste: { house: 0.5, pop: 0.9 }, satisfaction: 0.5, fairnessDebt: 0, active: true },
        ]);
        expect(crowd.bridgeGenres).toContain("house");
        const track = buildTrackColdStart({
            trackId: "new",
            audioFeatures: 0.9,
            genreConfidence: 0.8,
            artistGraphConfidence: 0.7,
            lyricsConfidence: 0.6,
            moodConfidence: 0.7,
            embeddingConfidence: 0.9,
            metadataConfidence: 0.8,
        });
        expect(track.collaborativeWeight).toBe(0);
        expect(track.contentConfidence).toBeGreaterThan(0.7);
    });

    test("enforces candidate-source quotas, deduplicates and retains attribution", () => {
        const merged = mergeCandidateSources(
            {
                "personal-cf": [
                    { id: "shared", value: 1, retrievalScore: 0.8 },
                    { id: "personal", value: 2, retrievalScore: 0.7 },
                ],
                social: [{ id: "shared", value: 1, retrievalScore: 0.9 }],
                requests: [{ id: "request", value: 3, retrievalScore: 1 }],
            },
            {
                "personal-cf": 1,
                "content-similarity": 0,
                social: 1,
                charts: 0,
                "new-releases": 0,
                "long-tail-discovery": 0,
                "director-bridge": 0,
                requests: 1,
            },
        );
        expect(merged.find((item) => item.id === "shared")?.sources).toEqual(["personal-cf", "social"]);
        expect(merged.some((item) => item.id === "personal")).toBe(false);
    });

    test("fuses available hybrid signals without allowing one subsystem to decide alone", () => {
        const score = hybridRecommendationScore({
            collaborative: 0.9,
            content: 0.8,
            knowledgeGraph: 0.7,
            sessionContext: 0.9,
            socialGraph: 0.6,
            chartsTrends: 0.5,
            directorFeatures: 0.85,
        });
        expect(score.score).toBeGreaterThan(0.7);
        expect(Object.keys(score.contributions)).toHaveLength(7);
    });

    test("produces source-backed UI reasons rather than a generic AI claim", () => {
        const explanation = explainRecommendation(
            { sources: ["personal-cf", "social", "director-bridge"] },
            objectives,
            { artistAffinity: 0.8, hiddenGem: 0.8 },
        );
        expect(explanation.categories).toContain("because-you-like");
        expect(explanation.categories).toContain("friends-listening");
        expect(explanation.categories).toContain("great-next-mix");
        expect(explanation.reasons.join(" ")).not.toContain("AI picked");
    });

    test("maps user controls and personal fairness preferences to objective weights", () => {
        const controlled = weightsFromControls("party", {
            familiarDiscover: 0.8,
            popularHiddenGems: 0.9,
            smoothSurprise: 0.7,
            personalCrowd: 0.75,
        });
        expect(controlled.discovery).toBe(0.8);
        expect(controlled.crowdSatisfaction).toBe(0.75);
        const personalized = personalizeDiversityWeights(controlled, {
            diversityPreference: 0.9,
            fairnessPreference: 0.2,
            artistDiversityPreference: 0.8,
            genreDiversityPreference: 0.7,
        });
        expect(personalized.fairness).toBe(0.2);
        expect(personalized.diversity).toBe(0.8);
    });

    test("gates artist exposure by relevance and detects homogenization", () => {
        expect(artistExposureContribution(0.4, 1, 1).allowed).toBe(false);
        expect(artistExposureContribution(0.8, 1, 0.5).contribution).toBeGreaterThan(0);
        expect(
            assessHomogenizationSafety({
                satisfaction: 0.95,
                diversity: 0.1,
                novelty: 0.05,
                discovery: 0.05,
                artistDiversity: 0.1,
                genreDiversity: 0.1,
                longTailExposure: 0.02,
                sessionCoherence: 0.8,
            }).safe,
        ).toBe(false);
    });

    test("personalizes inside curator constraints and interprets metrics by intent", () => {
        const curated = applyCuratorProfile(
            [
                { trackId: "seed", genres: ["house"], quality: 0.8, personalFit: 0.4 },
                { trackId: "personal", genres: ["house"], quality: 0.9, personalFit: 0.9 },
                { trackId: "wrong", genres: ["rock"], quality: 1, personalFit: 1 },
            ],
            {
                id: "house",
                name: "House Essentials",
                seedTrackIds: ["seed"],
                allowedGenres: ["house"],
                minimumQuality: 0.75,
                journeyStyle: "rising",
            },
        );
        expect(curated.map((item) => item.trackId)).toEqual(["seed", "personal"]);
        expect(intentAwareMetric("discover", "skip").value).toBeGreaterThan(
            intentAwareMetric("favorites", "skip").value,
        );
        expect(intentAwareMetric("discover", "save").value).toBeGreaterThan(
            intentAwareMetric("background", "save").value,
        );
    });
});
