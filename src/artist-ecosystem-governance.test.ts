import { describe, expect, test } from "bun:test";
import {
    ARTIST_ECOSYSTEM_BRAIN,
    ARTIST_ECOSYSTEM_PRINCIPLE,
    ARTIST_RESEARCH_CONFIDENCE,
    AVOID_ARTIST_METRICS,
    artistCommunityCrowd,
    artistConsentTier,
    artistExperimentPlan,
    BETTER_ARTIST_METRICS,
    humanCuratedDirector,
    localArtistSignal,
    multiStakeholderUtility,
    ORGANIC_ACCOUNTING_BOUNDARY,
} from "./artist-ecosystem-governance";

describe("artist ecosystem governance", () => {
    test("runs hard constraints before multi-stakeholder utility", () => {
        const input = {
            listener: 1,
            session: 1,
            crowd: 1,
            journey: 1,
            artistRelationship: 1,
            discovery: 1,
            supplierFairness: 1,
            repetition: 0,
            artistSaturation: 0,
            popularityBias: 0,
            risk: 0,
        };
        expect(multiStakeholderUtility(input, false)).toMatchObject({
            eligible: false,
            utility: 0,
            hardConstraintsFirst: true,
        });
        expect(multiStakeholderUtility(input, true).utility).toBeGreaterThan(0.8);
    });
    test("caps artist relationship value below listener/session objectives", () => {
        const result = multiStakeholderUtility(
            {
                listener: 0.8,
                session: 0.8,
                crowd: 0,
                journey: 0,
                artistRelationship: 100,
                discovery: 0,
                supplierFairness: 0,
                repetition: 0,
                artistSaturation: 0,
                popularityBias: 0,
                risk: 0,
            },
            true,
        );
        expect(result.artistRelationshipContribution).toBe(0.12);
    });
    test("starts four artist experiments in shadow behind relevance floor", () => {
        expect(artistExperimentPlan("relationship-continuity", true)).toMatchObject({
            enabled: true,
            startsInShadow: true,
        });
        expect(artistExperimentPlan("artist-intent", false).enabled).toBe(false);
        expect(artistExperimentPlan("qualified-fairness", true).metrics).toContain("listener-satisfaction");
    });
    test("avoids algorithm-worthiness metrics in favor of relationship/context metrics", () => {
        expect(AVOID_ARTIST_METRICS).toEqual(["algorithm-score", "artist-quality-score", "recommendation-worthiness"]);
        expect(BETTER_ARTIST_METRICS).toHaveLength(7);
    });
    test("uses coarse local relevance only as privacy-safe soft discovery signal", () => {
        expect(
            localArtistSignal({ coarseRegionMatch: 1, userAffinity: 0.8, sessionFit: 0.9, privacySafeLocation: true }),
        ).toMatchObject({ nationalistPrioritization: false, locationStoredPrecisely: false });
    });
    test("models artist fan communities separately from generic crowds", () => {
        expect(artistCommunityCrowd("official-artist-session", 200)).toEqual({
            source: "official-artist-session",
            distinctFromGenericCrowd: true,
            aggregateMembers: 200,
        });
    });
    test("keeps narrative with human curator and technical sequencing with director", () => {
        const result = humanCuratedDirector(
            { mustPlay: ["a"], optional: ["b"], forbiddenTransitions: ["spinback"], storyBeats: ["origin"] },
            { timing: true, mixing: true, crowdAdaptation: true },
        );
        expect(result).toMatchObject({ curatorOwnsNarrative: true, directorOwnsTechnicalExecution: true });
        expect(result.boundaries.mustPlay).toEqual(["a"]);
    });
    test("respects artist preservation constraints over looser rights", () => {
        const result = artistConsentTier("creative-remix", {
            preserveIntro: true,
            preserveDrop: true,
            allowStemMixing: false,
            official: true,
        });
        expect(result.maximumTier).toBe("smart-transition");
        expect(result.preservation).toEqual(["intro", "drop"]);
        expect(result.stricterPolicyWins).toBe(true);
    });
    test("contains all six artist ecosystem brain layers", () => {
        expect(ARTIST_ECOSYSTEM_BRAIN).toEqual([
            "artist-knowledge",
            "fan-relationship",
            "artist-intent",
            "fairness",
            "provenance",
            "analytics",
        ]);
    });
    test("separates organic recommendation from commercial accounting", () => {
        expect(ORGANIC_ACCOUNTING_BOUNDARY).toMatchObject({
            royaltyPayoutAsRankFeature: false,
            attributionAuditable: true,
            streamAccountingAuditable: true,
        });
    });
    test("marks artist-world and preservation-at-scale work experimental", () => {
        expect(ARTIST_RESEARCH_CONFIDENCE.high).toContain("supplier-fairness");
        expect(ARTIST_RESEARCH_CONFIDENCE.experimental).toContain("artist-world-recommendation");
    });
    test("optimizes listener experience while relationships emerge naturally", () => {
        expect(ARTIST_ECOSYSTEM_PRINCIPLE).toBe(
            "great-listener-experiences-help-genuine-artist-relationships-emerge-naturally",
        );
    });
});
