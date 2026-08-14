import { describe, expect, test } from "bun:test";
import {
    ACCOUNT_SYNC_SCOPE,
    artistDiscoveryMemory,
    CONSISTENCY_MODELS,
    CORE_STATE_VIEWS,
    CROWD_MODERATION_ACTIONS,
    cloudOutagePlan,
    commandPaletteAction,
    confidenceActionPolicy,
    confidencePresentation,
    directorHistory,
    ECOSYSTEM_BRAIN_LAYERS,
    FULL_PLATFORM_FLOW,
    memoryJourneySeed,
    mergePlaylistOperations,
    OFFLINE_DIRECTOR_TIER,
    offlineMemorySync,
    PUBLIC_SESSION_SAFETY,
    parseSemanticMusicDescription,
    projectCoreState,
    quietJoin,
    requestRateLimit,
    resolveSearchIntent,
    reversibleDirectorAction,
    SOCIAL_RETENTION,
    socialAvailability,
    undoDirectorAction,
} from "./platform-search-sync-resilience";

describe("platform search, sync and resilience", () => {
    test("shows ambiguous search intents after contextual ranking", () => {
        const result = resolveSearchIntent(
            [
                { kind: "song", score: 0.7 },
                { kind: "artist", score: 0.69 },
                { kind: "album", score: 0.3 },
            ],
            "artist",
        );
        expect(result.ranked[0]?.kind).toBe("artist");
        expect(result.ambiguous).toBeTrue();
    });

    test("understands natural musical descriptions", () => {
        expect(parseSemanticMusicDescription("song with female vocal and trumpet from 2010s")).toMatchObject({
            vocal: "female",
            instruments: ["trumpet"],
            decade: 2010,
        });
    });

    test("routes universal command palette actions", () => {
        expect(commandPaletteAction("play Animals")).toMatchObject({ action: "play", argument: "Animals" });
        expect(commandPaletteAction("move to TV").action).toBe("move-device");
        expect(commandPaletteAction("Animals").action).toBe("search");
    });

    test("keeps calibration and downloads device-local", () => {
        expect(ACCOUNT_SYNC_SCOPE.shared).toContain("session-memories");
        expect(ACCOUNT_SYNC_SCOPE.deviceLocal).toEqual(["audio-device-calibration", "downloads"]);
    });

    test("merges stable playlist operations instead of last-write-wins", () => {
        const local = [
            {
                operationId: "a",
                actorId: "mia",
                lamport: 1,
                type: "insert" as const,
                itemId: "item-a",
                trackId: "track-a",
            },
        ];
        const remote = [
            ...local,
            {
                operationId: "b",
                actorId: "zoe",
                lamport: 1,
                type: "annotate" as const,
                itemId: "item-a",
                annotation: "opener",
            },
        ];
        expect(mergePlaylistOperations(local, remote).map((operation) => operation.operationId)).toEqual(["a", "b"]);
        expect(CONSISTENCY_MODELS.sharedQueue.ordering).not.toBe(CONSISTENCY_MODELS.collaborativePlaylist.ordering);
    });

    test("continues local music during cloud outages", () => {
        expect(cloudOutagePlan(true)).toEqual({
            playback: "continue-local",
            localQueue: true,
            director: "local-safe-mode",
            socialUpdates: "paused",
            cloudDegradationInterruptsAudio: false,
        });
        expect(OFFLINE_DIRECTOR_TIER.cloudRequired).toBeFalse();
        expect(offlineMemorySync("night", false).sync).toBe("pending");
    });

    test("retains social data according to sensitivity", () => {
        expect(SOCIAL_RETENTION).toMatchObject({
            presence: "ephemeral",
            analytics: "aggregated",
            rawSocialTelemetryForever: false,
        });
        expect(socialAvailability(true, false)).toEqual({ visible: true, joinable: false, independent: true });
        expect(quietJoin(true)).toMatchObject({ joined: true, playbackInterrupted: false, hostNotification: "subtle" });
    });

    test("rate-limits requests and exposes host moderation", () => {
        expect(requestRateLimit(4, 3).allowed).toBeFalse();
        expect(CROWD_MODERATION_ACTIONS).toContain("lock-queue");
        expect(PUBLIC_SESSION_SAFETY.initialAudience).toBe("private-friend-groups");
    });

    test("bridges session memories into artist relationships and journeys", () => {
        expect(artistDiscoveryMemory("Artist X").recap).toBe("You discovered Artist X together.");
        expect(memoryJourneySeed("friday", "Friday Night")).toMatchObject({
            seedType: "explicit-journey",
            prompt: "Continue the vibe from Friday Night",
        });
    });

    test("uses confidence bands without fake precision", () => {
        expect(confidencePresentation(0.6, 0.9)).toEqual({ state: "high", confidence: "medium", fakePrecision: false });
        expect(confidenceActionPolicy(0.2).behavior).toBe("ask");
        expect(confidenceActionPolicy(0.5).behavior).toBe("conservative");
    });

    test("makes non-realtime Director changes visible and reversible", () => {
        const action = reversibleDirectorAction({
            id: "1",
            at: 10,
            description: "Queue reordered",
            before: ["a", "b"],
            after: ["b", "a"],
            realtime: false,
        });
        expect(action.undoAvailable).toBeTrue();
        expect(undoDirectorAction(action)).toEqual(["a", "b"]);
        expect(
            directorHistory([
                { at: 2, description: "B", reason: "b" },
                { at: 1, description: "A", reason: "a" },
            ])[0]?.description,
        ).toBe("A");
    });

    test("projects one core state into many views", () => {
        expect(projectCoreState({ track: "x", energy: 0.8 }, ["track"])).toEqual({ track: "x" });
        expect(CORE_STATE_VIEWS).toHaveLength(6);
        expect(ECOSYSTEM_BRAIN_LAYERS).toHaveLength(7);
        expect(FULL_PLATFORM_FLOW.at(-1)).toBe("session-sync");
    });
});
