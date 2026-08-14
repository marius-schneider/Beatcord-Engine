import { describe, expect, test } from "bun:test";
import { EXPERIENCE_DNA_PRESETS } from "./provider-innovation-validation";
import {
    CANONICAL_SESSION_FOUNDATION,
    compileSessionLanguage,
    continuityTier,
    crowdCoDirector,
    crowdFairnessPolicy,
    editableTasteProfile,
    localTransitionRepair,
    momentLevelCandidate,
    noActionPolicy,
    replayVibe,
    roleBasedMixing,
    rollingHorizon,
    semanticEcosystemEvent,
    TRUST_NATIVE_CONTROLS,
    transitionCriticStage,
    validatedRouteScore,
} from "./validated-experience-innovations";

const route = {
    trackIds: ["b", "c", "d", "e"],
    satisfaction: 0.8,
    journeyProgress: 0.7,
    transitionQuality: 0.9,
    crowdFit: 0.6,
    requestProgress: 0.5,
    diversity: 0.4,
    uncertainty: 0.2,
    repetition: 0.1,
    manipulationCost: 0.1,
};
describe("validated experience innovations", () => {
    test("uses robust moments without arbitrary default skipping", () => {
        expect(
            momentLevelCandidate({
                trackId: "x",
                moment: "chorus",
                timeToMoment: 30,
                confidence: 0.9,
                familiarity: 0.6,
                energyDelta: 0.2,
            }),
        ).toMatchObject({ arbitrarySkipAllowed: false, uses: ["route-planning", "backtiming", "transition-timing"] });
    });
    test("scores routes transparently and commits only the next action", () => {
        expect(validatedRouteScore(route)).toBe(3.5);
        expect(rollingHorizon([route])).toMatchObject({
            committedTrackId: "b",
            planningTrackIds: ["c", "d", "e"],
            futureDirectionOnly: true,
            reinforcementLearningRequired: false,
        });
    });
    test("limits role mixing to deterministic four-stem capability tiers", () => {
        expect(roleBasedMixing("PLAYBACK_ONLY", ["vocal", "drums"]).allowed).toBeFalse();
        expect(roleBasedMixing("OWNED_OR_LICENSED_AUDIO", ["vocal", "drums", "bass", "other"])).toMatchObject({
            allowed: true,
            deterministic: true,
            generativeAudio: false,
            partnerRequired: false,
        });
    });
    test("stages the critic and refuses learned claims without human labels", () => {
        expect(transitionCriticStage("symbolic", 0)).toMatchObject({ enabled: true, opaqueNaturalnessClaim: false });
        expect(transitionCriticStage("perceptual-learned", 999).enabled).toBeFalse();
        expect(transitionCriticStage("perceptual-learned", 1_000).enabled).toBeTrue();
    });
    test("repairs transition faults locally", () => {
        expect(localTransitionRepair("vocal-conflict")).toEqual({
            repair: "move-vocal-handoff",
            regenerateWholeMix: false,
        });
        expect(localTransitionRepair("grid-uncertainty").repair).toBe("shorten-blend");
    });
    test("activates Crowd Co-Director only for groups and explicit signals", () => {
        expect(
            crowdCoDirector({ profiles: 1, requests: 0, likes: 0, reactions: 0, skipVotes: 0, participants: 1 }).value,
        ).toBe("none");
        expect(
            crowdCoDirector({ profiles: 8, requests: 2, likes: 4, reactions: 5, skipVotes: 1, participants: 8 }),
        ).toMatchObject({ active: true, value: "very-high", passiveEmotionInference: false });
        expect(crowdFairnessPolicy("balanced-for-everyone").academicSlidersVisible).toBeFalse();
    });
    test("compiles language into validated contracts without audio access", () => {
        expect(compileSessionLanguage("More energy")).toMatchObject({
            path: "fast",
            contract: { energyDelta: 0.15 },
            directAudioAccess: false,
        });
        expect(compileSessionLanguage("Bring us toward techno and don't use aggressive transitions")).toMatchObject({
            path: "semantic",
            contract: { targetGenre: "techno", transitionIntensity: "gentle" },
        });
    });
    test("replays musical characteristics without claiming human emotion", () => {
        const fingerprint = {
            experienceDNA: EXPERIENCE_DNA_PRESETS.party,
            energyCurve: [0.4, 0.9],
            genreDistribution: { house: 1 },
            familiarityTarget: 0.6,
            mixPersonality: "smooth",
            socialContext: "friends",
        };
        expect(replayVibe(fingerprint, ["old"])).toMatchObject({
            label: "Replay this vibe",
            claimsHumanEmotionRecreated: false,
            excludedTrackIds: ["old"],
        });
    });
    test("builds continuity in feasible tiers", () => {
        expect(CANONICAL_SESSION_FOUNDATION).toContain("queue-intent");
        expect(continuityTier(2).v1Promise).toBeTrue();
        expect(continuityTier(4).v1Promise).toBeFalse();
    });
    test("makes trust controls cheap, editable and non-essentializing", () => {
        expect(TRUST_NATIVE_CONTROLS).toContain("dont-learn");
        expect(editableTasteProfile({ house: 0.8 })).toEqual({
            profile: { house: 0.8 },
            editable: true,
            objectiveIdentityClaim: false,
        });
    });
    test("keeps ecosystem events semantic and rights-safe", () => {
        expect(semanticEcosystemEvent("DROP")).toEqual({
            event: "DROP",
            rawAudio: false,
            rightsSafe: true,
            privacyPreserving: true,
        });
    });
    test("treats no-action as an explicit intelligent decision", () => {
        const budget = { transitionManipulation: 0.2, reorderFrequency: 0.2, novelty: 0.2, tempoManipulation: 0.2 };
        expect(
            noActionPolicy({
                confidence: 0.2,
                artisticallyImportant: false,
                crowdResponse: 0.2,
                networkRisk: 0.1,
                budget,
            }),
        ).toEqual({ action: "do-nothing", reason: "low-confidence" });
        expect(
            noActionPolicy({ confidence: 1, artisticallyImportant: true, crowdResponse: 0.2, networkRisk: 0.1, budget })
                .action,
        ).toBe("preserve");
        expect(
            noActionPolicy({
                confidence: 1,
                artisticallyImportant: false,
                crowdResponse: 0.2,
                networkRisk: 0.8,
                budget,
            }).action,
        ).toBe("simplify");
    });
});
