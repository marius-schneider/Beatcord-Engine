import { describe, expect, test } from "bun:test";
import {
    createSessionOverride,
    editJourneyPoint,
    editSessionContract,
    isOverrideActive,
    nearbyDiscovery,
    type PresencePrivacy,
    permissionPrompt,
    presenceForContext,
    privateSessionToggle,
    progressiveControls,
    recommendationExplanation,
    routeGuestRequest,
    SOCIAL_EXPERIENCE,
    separateQueueAndJourney,
    socialJoinToken,
    socialRecommendationValue,
    ZERO_CONFIGURATION_EXPERIENCE,
} from "./social-privacy-journey-ux";

const visible: PresencePrivacy = {
    shareListening: true,
    shareTrack: true,
    shareExperience: true,
    shareParticipants: false,
    allowJoin: true,
    audience: "friends",
};

describe("social privacy and journey UX", () => {
    test("applies contextual presence policies", () => {
        const hidden = privateSessionToggle(false).privacy;
        expect(presenceForContext("work", visible, [{ contextId: "work", privacy: hidden }])).toEqual(hidden);
        expect(presenceForContext("gaming", visible, [])).toEqual(visible);
    });

    test("turns off every social leak with one private-session action", () => {
        const privateMode = privateSessionToggle(true);
        expect(privateMode.privacy.audience).toBe("nobody");
        expect(privateMode.socialHistory).toBeFalse();
        expect(privateMode.memorySharing).toBeFalse();
        expect(privateMode.persistentTasteLearning).toBeTrue();
    });

    test("requires opt-in and rotating nearby identifiers", () => {
        expect(nearbyDiscovery(false, "ephemeral", 1_000).identifier).toBeNull();
        expect(nearbyDiscovery(true, "ephemeral", 1_000, 500)).toMatchObject({
            identifier: "ephemeral",
            expiresAt: 1_500,
            persistentIdentifierBroadcast: false,
        });
    });

    test("uses expiring single-use join tokens with privacy approval", () => {
        expect(socialJoinToken("once", 100, true, 50)).toEqual({
            token: "once",
            expiresAt: 150,
            singleUse: true,
            approvalRequired: true,
        });
    });

    test("progressively discloses controls", () => {
        expect(progressiveControls("listener")).toEqual(["experience", "familiar-discover", "queue"]);
        expect(progressiveControls("dj")).toContain("stems");
        expect(progressiveControls("developer-lab")).toContain("critic");
    });

    test("expires contextual overrides and labels their scope", () => {
        const next = createSessionOverride("energy", 1.2, "next-track", 1_000);
        const session = createSessionOverride("mix-aggression", 0.2, "session", 1_000, 2_000);
        expect(next.value).toBe(1);
        expect(isOverrideActive(next, 1_000, true)).toBeFalse();
        expect(isOverrideActive(session, 2_001, false)).toBeFalse();
    });

    test("routes language and direct manipulation through one contract", () => {
        const base = { energy: 0.4, discovery: 0.2, mixAggression: 0.3, crowdInfluence: 0.5, revision: 1 };
        const spoken = editSessionContract(base, { source: "natural-language", field: "energy", value: 0.8 });
        const dragged = editSessionContract(spoken, { source: "direct-manipulation", field: "energy", value: 0.7 });
        expect(dragged).toMatchObject({ energy: 0.7, revision: 3, lastEditSource: "direct-manipulation" });
    });

    test("explains permissions in user language and supports zero configuration", () => {
        expect(permissionPrompt("guest-requests")).toBe("Let friends add requests to this session?");
        expect(ZERO_CONFIGURATION_EXPERIENCE).toMatchObject({ primaryAction: "play", requiredTechnicalChoices: 0 });
    });

    test("offers explanation depth only on demand", () => {
        const input = { bpm: 128, key: "8A", phraseFit: 0.9, confidence: 0.8 };
        expect(recommendationExplanation("short", input)).toBe("Fits the vibe");
        expect(recommendationExplanation("technical", input)).toContain("128 BPM");
    });

    test("edits visual journeys and triggers replanning", () => {
        const result = editJourneyPoint([{ id: "peak", offsetMinutes: 30, energy: 0.8, label: "Party peak" }], "peak", {
            offsetMinutes: 45,
            energy: 0.95,
        });
        expect(result).toMatchObject({ replanRequired: true, points: [{ offsetMinutes: 45, energy: 0.95 }] });
    });

    test("keeps explicit queue tracks separate from journey intention", () => {
        const result = separateQueueAndJourney({
            explicitTrackIds: ["a"],
            journey: [{ id: "p", offsetMinutes: 10, energy: 0.7, label: "Peak" }],
        });
        expect(result.queue.kind).toBe("explicit-tracks");
        expect(result.journey.kind).toBe("musical-direction");
    });

    test("routes guest requests with ETA unless direct queue is allowed", () => {
        expect(routeGuestRequest(false, 8.2)).toEqual({ route: "request", etaMinutes: 8, hostCanPlaySooner: true });
        expect(routeGuestRequest(true, 0).route).toBe("direct-queue");
    });

    test("weights recommendations by relationship, trust, taste and fit", () => {
        expect(
            socialRecommendationValue({
                relationshipStrength: 0.8,
                senderTrust: 0.9,
                tasteCompatibility: 0.5,
                trackFit: 0.75,
            }),
        ).toBe(0.27);
    });

    test("keeps social ambient and music-first", () => {
        expect(SOCIAL_EXPERIENCE.musicRemainsPrimary).toBeTrue();
        expect(SOCIAL_EXPERIENCE.forbiddenMechanics).toContain("infinite-feed");
        expect(SOCIAL_EXPERIENCE.surfaces).toContain("session-memories");
    });
});
