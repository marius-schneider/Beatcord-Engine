import { describe, expect, test } from "bun:test";
import {
    assessMoodGenreBias,
    bayesianTrendModel,
    behavioralGenrePreference,
    chartAsWeakPrior,
    estimateTrendState,
    GenreGraph,
    MixabilityGraph,
    normalizeGenre,
    sessionPlanningPopularity,
} from "./cultural-genre-trends";

describe("cultural genre and trend intelligence", () => {
    test("normalizes multilingual genres while preserving original tags", () => {
        const genre = normalizeGenre({
            preferredCanonical: "Drum and Bass",
            knownAliases: ["dnb", "drum & bass"],
            tags: [
                { tag: "drum'n'bass", source: "editor", language: "en" },
                { tag: "basse et batterie", source: "community", language: "fr" },
            ],
        });
        expect(genre.canonical).toBe("drum-and-bass");
        expect(genre.aliases).toContain("dnb");
        expect(genre.sourceTags[1]?.language).toBe("fr");
    });

    test("supports taxonomy, semantic, cultural, behavioral and transition edges", () => {
        const graph = new GenreGraph();
        for (const type of ["is-a", "similar-to", "often-tagged-with", "co-listened", "mixes-well-with"] as const)
            graph.add({ from: "house", to: "dance", type, weight: 0.8, provenance: "test" });
        expect(graph.neighbors("house")).toHaveLength(5);
        expect(graph.neighbors("house", ["mixes-well-with"])).toHaveLength(1);
    });

    test("keeps track mixability distinct from genre similarity", () => {
        const graph = new MixabilityGraph();
        graph.add({
            fromTrackId: "house-a",
            toTrackId: "pop-b",
            score: 0.9,
            tempoFit: 0.8,
            harmonicFit: 0.9,
            phraseFit: 1,
        });
        expect(graph.kind).toBe("track-mixability");
        expect(graph.between("house-a", "pop-b")?.score).toBe(0.9);
    });

    test("learns genre affinity from behavior and context instead of tag counts", () => {
        const strong = behavioralGenrePreference(
            { plays: 30, skips: 1, saves: 10, completionRate: 0.95, contextualUsage: { party: 0.9 } },
            "party",
        );
        const weak = behavioralGenrePreference(
            { plays: 30, skips: 20, saves: 0, completionRate: 0.3, contextualUsage: { party: 0.1 } },
            "party",
        );
        expect(strong.affinity).toBeGreaterThan(weak.affinity);
        expect(strong.confidence).toBeGreaterThan(0.8);
    });

    test("discounts genre-dominated emotion models on unseen genres", () => {
        const result = assessMoodGenreBias(
            [
                { genre: "pop", sampleSize: 900, valenceError: 0.1, arousalError: 0.1 },
                { genre: "jazz", sampleSize: 100, valenceError: 0.2, arousalError: 0.2 },
            ],
            "metal",
        );
        expect(result.requiresCrossGenreValidation).toBe(true);
        expect(result.confidenceMultiplier).toBeLessThan(0.25);
    });

    test("prioritizes perceived familiarity over catalog popularity", () => {
        const obscureKnown = sessionPlanningPopularity(
            { catalogPopularity: 0.1, perceivedFamiliarity: 1 },
            "singalong",
        );
        const globalUnknown = sessionPlanningPopularity(
            { catalogPopularity: 1, perceivedFamiliarity: 0.1 },
            "singalong",
        );
        expect(obscureKnown.score).toBeGreaterThan(globalUnknown.score);
        expect(obscureKnown.familiarityWeight).toBeGreaterThan(obscureKnown.popularityWeight);
    });

    test("uses charts only as weak retrieval priors", () => {
        expect(chartAsWeakPrior(1)).toEqual({
            source: "chart",
            retrievalBoost: 0.2,
            finalRankingAuthority: false,
            requiresPersonalAndSessionScoring: true,
        });
    });

    test("tracks momentum, acceleration, sample size and confidence", () => {
        const trend = estimateTrendState([
            { atMs: 1, listeners: 100 },
            { atMs: 2, listeners: 140 },
            { atMs: 3, listeners: 210 },
        ]);
        expect(trend.momentum).toBeGreaterThan(0);
        expect(trend.acceleration).toBeGreaterThan(0);
        expect(trend.confidence).toBeGreaterThan(0.9);
    });

    test("shrinks small-community percentage spikes with Bayesian uncertainty", () => {
        const small = bayesianTrendModel(3, 8);
        const large = bayesianTrendModel(300, 800);
        expect(small.rawGrowth).toBeCloseTo(large.rawGrowth, 3);
        expect(small.posteriorGrowth).toBeLessThan(large.posteriorGrowth);
        expect(small.confidence).toBeLessThan(large.confidence);
        expect(small.credibleInterval[1] - small.credibleInterval[0]).toBeGreaterThan(
            large.credibleInterval[1] - large.credibleInterval[0],
        );
    });
});
