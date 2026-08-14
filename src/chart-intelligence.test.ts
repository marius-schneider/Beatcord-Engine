import { describe, expect, test } from "bun:test";
import {
    assessPopularityBias,
    assessSocialChartPrivacy,
    assessTrend,
    assessTrendAuthenticity,
    buildChart,
    buildGenreChart,
    buildPersonalCharts,
    buildSocialChart,
    CHART_DATA_SOURCES,
    type ChartTrack,
    chartEntryConfidence,
    chartTasteFit,
} from "./chart-intelligence";

const now = 2_000_000_000_000;
const track = (
    trackId: string,
    artistId: string,
    rank: number,
    previousRank: number,
    popularity = 0.5,
): ChartTrack => ({
    trackId,
    artistId,
    releasedAtMs: now - 20 * 86_400_000,
    popularity,
    personalAffinity: 0.6,
    discoveryScore: 0.7,
    communityScore: 0.5,
    signal: {
        rank,
        previousRank,
        velocity: previousRank - rank,
        acceleration: 20,
        uniqueListeners: 10_000,
        totalListens: 50_000,
        saveRate: 0.6,
        completionRate: 0.8,
        geographicSpread: 0.7,
        communitySpread: 0.7,
        ageDays: 20,
    },
});

describe("chart and popularity intelligence", () => {
    test("penalizes popularity domination relative to user and session preference", () => {
        expect(assessPopularityBias(0.95, 0.4, 0.9).popularityBiasPenalty).toBeGreaterThan(0);
        expect(assessPopularityBias(0.8, 0.8, 0.7).popularityBiasPenalty).toBe(0);
    });

    test("distinguishes a static hit from a low-ranked fast mover", () => {
        const hit = assessTrend(track("hit", "a", 8, 7, 0.95).signal);
        const mover = assessTrend(track("mover", "b", 88, 630, 0.3).signal);
        expect(mover.momentum).toBeGreaterThan(hit.momentum);
        expect(["breaking", "viral"]).toContain(mover.class);
    });

    test("builds transparent product charts with artist anti-domination", () => {
        const chart = buildChart(
            [
                track("a1", "artist-a", 1, 10, 1),
                track("a2", "artist-a", 2, 20, 0.99),
                track("a3", "artist-a", 3, 30, 0.98),
                track("b1", "artist-b", 50, 500, 0.4),
            ],
            "trending",
            { maxPerArtist: 2, nowMs: now },
        );
        expect(chart.filter((item) => item.artistId === "artist-a")).toHaveLength(2);
        expect(chart[0]?.methodology).toContain("artist-cap");
    });

    test("keeps external chart sources behind license review", () => {
        expect(CHART_DATA_SOURCES).toHaveLength(3);
        expect(CHART_DATA_SOURCES.every((source) => source.licenseReviewRequired)).toBe(true);
    });

    test("produces personal growth/context charts beyond play counts", () => {
        const interactions = [
            {
                trackId: "old-favorite",
                artistId: "old",
                genre: "house",
                playedAtMs: now - 100 * 86_400_000,
                completed: true,
                discovery: false,
            },
            {
                trackId: "new-one",
                artistId: "rising",
                genre: "dnb",
                context: "night",
                playedAtMs: now - 2 * 86_400_000,
                completed: true,
                discovery: true,
            },
            {
                trackId: "new-two",
                artistId: "rising",
                genre: "dnb",
                context: "night",
                playedAtMs: now - 86_400_000,
                completed: true,
                discovery: true,
            },
        ];
        const charts = buildPersonalCharts(interactions, now);
        expect(charts.risingArtists[0]?.artistId).toBe("rising");
        expect(charts.forgottenFavorites).toContain("old-favorite");
        expect(charts.contextTracks.night).toEqual(["new-one", "new-two"]);
    });

    test("scores social charts by unique people, sharing, parties and discoveries", () => {
        const chart = buildSocialChart([
            {
                trackId: "social",
                userId: "a",
                shared: true,
                addedToParty: true,
                lovedDiscovery: false,
                observedAtMs: now,
            },
            {
                trackId: "social",
                userId: "b",
                shared: true,
                addedToParty: false,
                lovedDiscovery: true,
                observedAtMs: now,
            },
            {
                trackId: "solo",
                userId: "a",
                shared: false,
                addedToParty: false,
                lovedDiscovery: false,
                observedAtMs: now,
            },
        ]);
        expect(chart[0]?.trackId).toBe("social");
        expect(chart[0]?.uniqueUsers).toBe(2);
    });

    test("multiplies chart momentum by taste and session compatibility", () => {
        expect(chartTasteFit(0.9, 0.8, 0.7)).toBeCloseTo(0.504, 3);
        expect(chartTasteFit(1, 0, 1)).toBe(0);
    });

    test("weights genre charts continuously by genre confidence", () => {
        const chart = buildGenreChart(
            [
                {
                    trackId: "house",
                    baseScore: 1,
                    genres: [
                        { genre: "house", confidence: 0.94 },
                        { genre: "pop", confidence: 0.21 },
                    ],
                },
                {
                    trackId: "pop",
                    baseScore: 1,
                    genres: [
                        { genre: "pop", confidence: 0.95 },
                        { genre: "house", confidence: 0.2 },
                    ],
                },
            ],
            "house",
        );
        expect(chart[0]).toMatchObject({ trackId: "house", genreConfidence: 0.94 });
        expect(chart[1]?.score).toBe(0.2);
    });

    test("suppresses small/private local charts and hides exact social counts", () => {
        expect(assessSocialChartPrivacy({ scope: "friend-circle", uniqueListeners: 4 }).publishable).toBe(false);
        expect(assessSocialChartPrivacy({ scope: "party", uniqueListeners: 20, groupPrivate: true }).publishable).toBe(
            false,
        );
        const publicCommunity = assessSocialChartPrivacy({ scope: "community", uniqueListeners: 30 });
        expect(publicCommunity.publishable).toBe(true);
        expect(publicCommunity.exactCountsVisible).toBe(false);
    });

    test("reduces trend confidence for manipulation anomalies", () => {
        const suspicious = assessTrendAuthenticity({
            uniqueListeners: 20,
            totalListens: 20_000,
            accountAgeDiversity: 0.05,
            geographicDistribution: 0.03,
            saveRate: 0.01,
            completionRate: 0.1,
            organicSpread: 0.03,
        });
        const organic = assessTrendAuthenticity({
            uniqueListeners: 20_000,
            totalListens: 80_000,
            accountAgeDiversity: 0.8,
            geographicDistribution: 0.75,
            saveRate: 0.35,
            completionRate: 0.8,
            organicSpread: 0.85,
        });
        expect(suspicious.suspicious).toBe(true);
        expect(organic.authenticity).toBeGreaterThan(suspicious.authenticity);
        expect(organic.confidenceMultiplier).toBeGreaterThan(suspicious.confidenceMultiplier);
    });

    test("reports noisier confidence for party charts than global charts", () => {
        const base = {
            uniqueListeners: 500,
            sampleSize: 2_000,
            sourceAgreement: 0.8,
            geographicCoverage: 0.7,
            authenticity: 0.9,
        };
        expect(chartEntryConfidence({ ...base, scope: "global" })).toBeGreaterThan(
            chartEntryConfidence({ ...base, scope: "party" }),
        );
    });
});
