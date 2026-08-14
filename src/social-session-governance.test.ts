import { describe, expect, test } from "bun:test";
import {
    ambientMusicPresence,
    authorizeSessionAction,
    createSharedMemory,
    SOCIAL_EXPERIENCE_PRINCIPLE,
    sessionPermissions,
    socialContextPolicy,
    socialPresenceLoop,
} from "./social-session-governance";

describe("social session governance", () => {
    test("implements see-to-join-to-memory social presence loop", () => {
        const result = socialPresenceLoop(
            {
                userId: "mia",
                activity: "listening",
                experience: "chill",
                sessionPreviewAllowed: true,
                quietJoinAllowed: true,
            },
            true,
        );
        expect(result.stages).toEqual([
            "friend-activity",
            "session-preview",
            "join-request",
            "shared-session",
            "reaction",
            "memory",
        ]);
        expect(result.chatRequired).toBe(false);
    });
    test("offers low-pressure ambient presence and quiet join", () => {
        expect(ambientMusicPresence("Mia", "Chill", true)).toEqual({
            text: "Mia is listening • Chill",
            action: "join-quietly",
            pressure: "low",
        });
    });
    test("treats couple mode differently from eight-person party mode", () => {
        const couple = socialContextPolicy("couple", 2);
        const party = socialContextPolicy("party", 8);
        expect(couple.sharedMemories).toBeGreaterThan(party.sharedMemories);
        expect(couple.bridgeTaste).toBeGreaterThan(party.bridgeTaste);
        expect(party.crowdResponse).toBeGreaterThan(couple.crowdResponse);
        expect(party.energyAdaptation).toBeGreaterThan(couple.energyAdaptation);
    });
    test("supports family, study, gaming, friends and artist events as distinct contexts", () => {
        expect(socialContextPolicy("family", 4).sharedMemories).toBe(0.8);
        expect(socialContextPolicy("study", 2).energyAdaptation).toBe(0.1);
        expect(socialContextPolicy("artist-event", 100).fairness).toBe(0.7);
    });
    test("gives hosts and co-hosts full base control", () => {
        expect(sessionPermissions("host", "host-approval")).toEqual([
            "experience",
            "queue",
            "playback",
            "requests",
            "mix-controls",
            "crowd-moderation",
        ]);
        expect(sessionPermissions("co-host", "anyone-controls")).toContain("crowd-moderation");
    });
    test("applies anyone-controls, request-only and queue-edit authority modes", () => {
        expect(sessionPermissions("guest", "anyone-controls")).toEqual(["requests", "playback", "queue"]);
        expect(sessionPermissions("guest", "requests-only")).toEqual(["requests"]);
        expect(sessionPermissions("guest", "queue-edits")).toEqual(["requests", "queue"]);
    });
    test("makes host approval explicit for non-host actions", () => {
        expect(authorizeSessionAction({ userId: "g", role: "guest" }, "requests", "host-approval")).toEqual({
            allowed: true,
            requiresHostApproval: true,
            authorityExplicit: true,
        });
        expect(authorizeSessionAction({ userId: "g", role: "guest" }, "playback", "host-approval").allowed).toBe(false);
    });
    test("stores shared social memories without requiring conversation", () => {
        expect(createSharedMemory("s", "family", 4, 10, ["a", "a", "b"])).toEqual({
            sessionId: "s",
            type: "family",
            participants: 4,
            reactions: 10,
            sharedTracks: ["a", "b"],
            conversationRequired: false,
        });
    });
    test("defines social music beyond track-link sharing and parties", () => {
        expect(SOCIAL_EXPERIENCE_PRINCIPLE).toEqual({
            loop: ["see", "join", "shared-experience", "reaction", "memory"],
            shareLinkOnlyInsufficient: true,
            partyNotOnlySocialMode: true,
            explicitAuthorityRequired: true,
        });
    });
});
