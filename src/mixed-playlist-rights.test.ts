import { describe, expect, test } from "bun:test";
import {
    CONVERSATIONAL_DIFFERENTIATION,
    capabilityAwareTransition,
    MIXING_INNOVATION_RADAR,
    PARTICIPATORY_PLAYBACK_LAYERS,
    type PortableTransitionRecipe,
    recipeLifecycle,
    sharedRights,
    type TrackRightsCapabilities,
    validateMixedPlaylist,
} from "./mixed-playlist-rights";

const recipe: PortableTransitionRecipe = {
    id: "r",
    fromTrackId: "a",
    toTrackId: "b",
    entryWindow: { start: 0, end: 8 },
    exitWindow: { start: 120, end: 128 },
    tempoPlan: { sourceBpm: 120, targetBpm: 124, preservePitch: true },
    stemHandoff: "vocals-after-8-bars",
    eqAutomation: [],
    effects: [],
    author: "human",
    portable: true,
};
const full: TrackRightsCapabilities = {
    playback: true,
    crossfade: true,
    beatmatch: true,
    eqMix: true,
    stems: true,
    remix: true,
    export: true,
};

describe("mixed playlists and rights", () => {
    test("treats a mixed playlist as tracks plus transitions, automation and journey intent", () => {
        expect(
            validateMixedPlaylist({
                tracks: ["a", "b"],
                transitions: [recipe],
                automation: [],
                sequenceIntent: { energy: [0.5, 0.8], semantics: ["nostalgic", "uplifting"] },
            }),
        ).toEqual({ valid: true, failures: [], mediaObject: "mixed-playlist" });
    });

    test("rejects transition recipes outside adjacent playlist pairs", () => {
        expect(
            validateMixedPlaylist({ tracks: ["a", "c", "b"], transitions: [recipe], automation: [] }).failures,
        ).toEqual(["non-adjacent:r"]);
    });

    test("keeps portable recipes separate from rendered audio", () => {
        expect(recipeLifecycle(recipe, "share")).toEqual({
            recipeId: "r",
            action: "share",
            sourcePreserved: true,
            renderedAudioRequired: false,
        });
        expect(recipeLifecycle(recipe, "remix").sourcePreserved).toBe(true);
    });

    test("intersects rights across both tracks", () => {
        const restricted = { ...full, stems: false, remix: false, export: false };
        expect(sharedRights(full, restricted)).toEqual(restricted);
    });

    test("falls back from forbidden stems to a classic EQ transition", () => {
        const result = capabilityAwareTransition(full, { ...full, stems: false }, ["stems", "eqMix", "beatmatch"]);
        expect(result.strategy).toBe("classic-eq-transition");
        expect(result.denied).toEqual(["stems"]);
        expect(result.allowed).toEqual(["eqMix", "beatmatch"]);
    });

    test("separates participatory operations for provider-specific rights", () => {
        expect(PARTICIPATORY_PLAYBACK_LAYERS).toEqual(["play", "mix", "arrange", "personalize", "participate"]);
        expect(MIXING_INNOVATION_RADAR.consumerMixingValidated).toBe(true);
    });

    test("differentiates session-behavior requests from basic music requests", () => {
        expect(CONVERSATIONAL_DIFFERENTIATION).toEqual({
            mainstreamScale: true,
            basicRequest: "request-music",
            beatcord: "request-session-behavior",
        });
    });
});
