import { describe, expect, test } from "bun:test";
import {
    ARTIST_ALGORITHM_TRANSPARENCY,
    ARTIST_FAN_RELATIONS,
    aggregateNonSelection,
    analyticsClaim,
    analyticsConfidence,
    artistExplorationBudget,
    artistMetadataCorrection,
    artistPath,
    CREATIVE_AUTONOMY_PRINCIPLE,
    contextFitAnalytics,
    creatorAffinity,
    creditDiscovery,
    multiSourceDescription,
    newArtistOpportunity,
    privacySafeArtistMetric,
    recommendationSourcePolicy,
    releaseListeningParty,
    rightsCapability,
    STREAMING_ECONOMICS_CONTEXT,
    superfanRelationshipScore,
} from "./artist-analytics-transparency";

describe("artist analytics transparency", () => {
    test("reports aggregated why-not-selected reasons without individual users", () => {
        const result = aggregateNonSelection(["session-mismatch", "session-mismatch", "stronger-candidate"]);
        expect(result.shares["session-mismatch"]).toBeCloseTo(2 / 3);
        expect(result.individualUsersExposed).toBe(false);
    });
    test("reports experience context fit, never an artist quality score", () => {
        const result = contextFitAnalytics({ chill: 0.81, party: 0.42 });
        expect(result.strongestExperiences[0]?.experience).toBe("chill");
        expect(result.artistQualityScoreForbidden).toBe(true);
    });
    test("suppresses small cohorts and labels causal strength", () => {
        expect(analyticsConfidence(12)).toBe("suppressed");
        expect(analyticsConfidence(12_000)).toBe("high");
        expect(
            analyticsClaim("Artwork correlates with streams", "observed-association", 0.6).falseCausalityForbidden,
        ).toBe(true);
    });
    test("documents thresholds/changelogs without reverse-engineering anecdotes", () => {
        expect(ARTIST_ALGORITHM_TRANSPARENCY).toMatchObject({
            secretThresholdMythology: false,
            principleLevelChangelog: true,
            reverseEngineerCompetitorFromAnecdotes: false,
        });
    });
    test("gates synchronized artist listening parties on rights", () => {
        expect(
            releaseListeningParty({ artistId: "a", curatedQueue: ["x"], crowdInteraction: true, rightsVerified: true })
                .features,
        ).toHaveLength(4);
        expect(
            releaseListeningParty({ artistId: "a", curatedQueue: [], crowdInteraction: false, rightsVerified: false })
                .enabled,
        ).toBe(false);
    });
    test("defines superfans through relationship depth, not heavy streams", () => {
        expect(
            superfanRelationshipScore({
                repeat: 1,
                catalogDepth: 1,
                activeChoice: 1,
                saves: 1,
                returnFrequency: 1,
                eventParticipation: 1,
            }),
        ).toBe(1);
        expect(ARTIST_FAN_RELATIONS).toHaveLength(6);
    });
    test("builds grounded creator paths through knowledge graph relations", () => {
        const result = artistPath(
            [
                { from: "a", to: "producer", relation: "produced-by", confidence: 0.9 },
                { from: "producer", to: "b", relation: "collaborated-with", confidence: 0.8 },
            ],
            "a",
            "b",
        );
        expect(result.path).toEqual(["a", "producer", "b"]);
        expect(result.grounded).toBe(true);
    });
    test("models playback, manipulation and AI rights separately", () => {
        const profile = {
            playback: "allowed" as const,
            recommendation: "allowed" as const,
            manipulation: {
                crossfade: "allowed" as const,
                beatmatch: "allowed" as const,
                stems: "forbidden" as const,
                remix: "forbidden" as const,
            },
            ai: { analysis: "allowed" as const, training: "unknown" as const },
        };
        expect(rightsCapability(profile, "stems")).toBe("forbidden");
        expect(rightsCapability(profile, "training")).toBe("unknown");
    });
    test("keeps intelligence separate from catalog ownership and economics", () => {
        expect(STREAMING_ECONOMICS_CONTEXT).toMatchObject({
            streamingShare: 0.69,
            intelligenceSeparateFromCatalogOwnership: true,
            economicsNotRankingFeature: true,
        });
    });
    test("uses verified credits as discovery and creator-affinity surfaces", () => {
        const credits = [
            { creatorId: "p", role: "producer" as const, verified: true, source: "label" },
            { creatorId: "w", role: "songwriter" as const, verified: true, source: "publisher" },
        ];
        expect(creditDiscovery(credits, "producer")).toEqual(["p"]);
        expect(creatorAffinity(credits, "p").mainArtistOnly).toBe(false);
    });
    test("supports new artists through fit and small uncertainty-aware tests", () => {
        const result = newArtistOpportunity({
            coldStartBoost: 1,
            semanticFit: 0.9,
            userFit: 0.8,
            sessionFit: 0.8,
            exposureConfidence: 0.2,
        });
        expect(result.safeTest).toBe(true);
        expect(result.collaborativeSignalsRequired).toBe(false);
        expect(artistExplorationBudget(0.5, 0.4)).toEqual({ knownArtistNewTrack: 0.3, newArtist: 0.2 });
    });
    test("accepts provenance-aware metadata corrections but no rank manipulation", () => {
        expect(artistMetadataCorrection("wrong-credit", "producer-x", true)).toMatchObject({
            accepted: true,
            provenance: "artist",
            rankManipulationAllowed: false,
            analysisKeptSeparate: true,
        });
    });
    test("fuses artist, community and audio descriptions without one source dominance", () => {
        expect(
            multiSourceDescription(
                { genres: ["melodic-techno"], provenance: "artist" },
                ["progressive-house"],
                ["techno"],
            ),
        ).toEqual({ sources: ["melodic-techno", "progressive-house", "techno"], noSingleSourceOverrides: true });
    });
    test("suppresses artist analytics below minimum cohort size", () => {
        expect(privacySafeArtistMetric(12, 0.8)).toEqual({ suppressed: true, value: null, aggregateOnly: true });
        expect(privacySafeArtistMetric(50, 0.8).value).toBe(0.8);
    });
    test("labels sponsored music and still enforces user/session/quality floors", () => {
        expect(recommendationSourcePolicy("sponsored", { hardDislike: false, sessionFit: 0.8, quality: 0.9 })).toEqual({
            allowed: true,
            labelRequired: true,
            organicDirectorSeparated: true,
        });
        expect(recommendationSourcePolicy("sponsored", { hardDislike: true, sessionFit: 1, quality: 1 }).allowed).toBe(
            false,
        );
    });
    test("protects creative autonomy", () => {
        expect(CREATIVE_AUTONOMY_PRINCIPLE).toBe("analytics-explain-audience-response-not-prescribe-art");
    });
});
