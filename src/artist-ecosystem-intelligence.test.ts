import { describe, expect, test } from "bun:test";
import {
    ARTIST_WORLD_GRAPH,
    artistCuratedJourney,
    artistDiscoveryQuality,
    artistIntentScore,
    artistOpportunity,
    counterfactualSupplierEvaluation,
    developArtistRelationship,
    diversityAudit,
    dominantAttribution,
    engagementQuality,
    eraAwareArtistAffinity,
    exposureBuckets,
    FAN_STUDY,
    marketSignal,
    opportunityNormalizedFairness,
    qualifiedDiscoveryRates,
    releaseOpportunity,
} from "./artist-ecosystem-intelligence";

const base = {
    stage: "discovered" as const,
    affinity: 0.3,
    familiarity: 0.2,
    intentionalListening: 0.1,
    repeatBehavior: 0,
    catalogDepth: 0.1,
    confidence: 0.5,
};
describe("artist ecosystem intelligence", () => {
    test("develops fan relationship from intentional signals, not stream count alone", () => {
        const result = developArtistRelationship(base, ["playlist-add", "manual-second-track", "album-exploration"]);
        expect(result.stage).toBe("returning");
        expect(result.relationshipValue).toBeGreaterThan(0.7);
    });
    test("captures super-listener and playlist-add relationship evidence", () => {
        expect(FAN_STUDY).toEqual({
            superListenerShare: 0.02,
            superListenerStreamShareAbove: 0.18,
            playlistAddStreamLift: 0.41,
            playlistAddProfileVisitLift: 0.12,
        });
    });
    test("balances relationship opportunity with artist saturation guard", () => {
        expect(
            artistOpportunity({ ...base, affinity: 0.9, intentionalListening: 0.8 }, 0.9, 0.2).opportunity,
        ).toBeGreaterThan(0.5);
        expect(artistOpportunity(base, 0.8, 0.9).floodGuard).toBe(true);
    });
    test("keeps local fandom independent from global popularity", () => {
        expect(
            marketSignal({ market: "DE", listeners: 100, fanIntensity: 0.9, trend: 0.8, confidence: 0.9 }, 0.2),
        ).toEqual({ localFandom: 0.87, globalPopularity: 0.2, independent: true });
    });
    test("uses releases as relationship-aware candidate sources, not hard boosts", () => {
        expect(
            releaseOpportunity(
                { releaseAgeDays: 2, isNewRelease: true, isFocusTrack: true, artistRelationshipStage: 3 },
                0.9,
                0.9,
                false,
            ),
        ).toMatchObject({ hardBoost: false, candidateSource: true });
        expect(
            releaseOpportunity(
                { releaseAgeDays: 2, isNewRelease: true, isFocusTrack: true, artistRelationshipStage: 3 },
                0.9,
                0.9,
                true,
            ).boost,
        ).toBe(0);
    });
    test("keeps artist intent behind user, rights, session and quality gates", () => {
        const intent = {
            focusTrack: "new",
            entryTracks: ["entry"],
            fanFavorites: ["signature"],
            deepCuts: ["deep"],
            releasePriority: 1,
        };
        expect(
            artistIntentScore(intent, "new", {
                userHardPreferences: true,
                rights: true,
                sessionFit: 0.9,
                quality: 0.9,
            }),
        ).toEqual({ eligible: true, score: 0.15, softSignal: true });
        expect(
            artistIntentScore(intent, "new", {
                userHardPreferences: false,
                rights: true,
                sessionFit: 0.9,
                quality: 0.9,
            }).score,
        ).toBe(0);
        expect(artistCuratedJourney(intent)).toEqual(["entry", "signature", "deep", "new"]);
    });
    test("models artist worlds and era-specific affinity", () => {
        expect(ARTIST_WORLD_GRAPH).toHaveLength(10);
        expect(eraAwareArtistAffinity([{ artistId: "a", eraId: "club", affinity: 0.9 }], "a", "club")).toEqual({
            affinity: 0.9,
            wholeArtistAssumption: false,
        });
    });
    test("normalizes supplier fairness by qualified opportunity", () => {
        expect(
            opportunityNormalizedFairness({
                impressions: 10,
                plays: 5,
                qualifiedImpressions: 8,
                exposureShare: 0.2,
                catalogShare: 0.5,
                opportunityShare: 0.25,
            }),
        ).toEqual({ fairness: 0.8, catalogShareNotDefinition: true, qualifiedOnly: true });
    });
    test("audits popularity tiers without forcing equal distribution", () => {
        expect(
            exposureBuckets([
                { tier: "top-1", exposure: 0.4 },
                { tier: "long-tail", exposure: 0.2 },
            ]),
        ).toEqual({ "top-1": 0.4, "long-tail": 0.2 });
    });
    test("measures track, genre, artist and label diversity separately", () => {
        const audit = diversityAudit([
            { trackId: "1", genre: "house", artistId: "a", labelId: "l" },
            { trackId: "2", genre: "house", artistId: "b", labelId: "l" },
        ]);
        expect(audit).toMatchObject({ track: 1, genre: 0.5, artist: 1, label: 0.5, labelExposureConcentration: 1 });
    });
    test("shadow-evaluates supplier fairness before online exposure", () => {
        expect(
            counterfactualSupplierEvaluation({
                relevanceBefore: 0.9,
                relevanceAfter: 0.85,
                fairnessBefore: 0.4,
                fairnessAfter: 0.7,
            }),
        ).toMatchObject({ fairnessChange: 0.3, satisfactionRisk: 0.05, shadowOnly: true });
    });
    test("requires user fit, session fit and bridge potential for good artist discovery", () => {
        expect(
            artistDiscoveryQuality({ userFit: 0.9, sessionFit: 0.8, bridgePotential: 0.9, obscureOnly: false }).quality,
        ).toBeGreaterThan(0.8);
        expect(
            artistDiscoveryQuality({ userFit: 0.2, sessionFit: 0.2, bridgePotential: 0.2, obscureOnly: true })
                .artificialInsertion,
        ).toBe(true);
    });
    test("separates engagement quality from royalty value and passive streams", () => {
        expect(
            engagementQuality({ activeChoice: 1, completion: 1, repeat: 0.8, save: 0.9, sessionIntentionality: 1 }),
        ).toMatchObject({ royaltyValue: false, activeRelationship: true });
    });
    test("attributes recommendations to their real dominant source", () => {
        expect(
            dominantAttribution({
                userIntent: 0.2,
                artistAffinity: 0.3,
                crowd: 0.1,
                discovery: 0.4,
                social: 0.1,
                chart: 0.1,
                transitionUtility: 0.9,
            }).source,
        ).toBe("transitionUtility");
    });
    test("reports qualified discovery funnel rates through artist revisits", () => {
        expect(
            qualifiedDiscoveryRates({
                candidates: 100,
                eligible: 50,
                recommended: 20,
                completed: 15,
                saved: 5,
                artistRevisits: 2,
            }),
        ).toEqual({ eligibility: 0.5, recommendation: 0.4, completion: 0.75, save: 1 / 3, revisit: 0.4 });
    });
});
