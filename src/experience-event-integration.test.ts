import { describe, expect, test } from "bun:test";
import {
    applySessionEnvelope,
    canSessionAction,
    DEFAULT_SESSION_PERMISSIONS,
    discordPresence,
    eventClass,
    eventDelivery,
    gameIntegrationPolicy,
    integrationCircuitBreaker,
    integrationIsolation,
    LIVE_MUSIC_AGENT_ROLES,
    lightingIntent,
    NORMAL_PLAYBACK_AGENT_ROLES,
    ownershipIndicator,
    pluginAuthorization,
    sessionJoinConsent,
    sharedActionConsistency,
} from "./experience-event-integration";

describe("experience event integration", () => {
    test("enforces a role-based shared-session permission matrix", () => {
        expect(canSessionAction(DEFAULT_SESSION_PERMISSIONS, "guest", "canRequest")).toBe(true);
        expect(canSessionAction(DEFAULT_SESSION_PERMISSIONS, "guest", "canSkip")).toBe(false);
    });
    test("makes joining and ownership permanently obvious", () => {
        expect(sessionJoinConsent({ userConfirmed: false, sessionVisible: true, joinAllowed: true })).toEqual({
            joined: false,
            obviousSharedState: true,
        });
        expect(ownershipIndicator(4, "Marius", "Mac")).toEqual({
            text: "Party with 4 people • Audio: Marius's Mac",
            permanentWhileShared: true,
        });
    });
    test("detects missed revisions and requests authoritative resync", () => {
        expect(applySessionEnvelope(2n, { revision: 3n, serverTime: 1, stateHash: "h", payload: {} })).toMatchObject({
            action: "apply",
            acknowledgeRevision: 3n,
            authoritative: true,
        });
        expect(applySessionEnvelope(2n, { revision: 5n, serverTime: 1, stateHash: "h", payload: {} }).action).toBe(
            "resync",
        );
    });
    test("keeps reactions optimistic and playback/queue actions authoritative", () => {
        expect(sharedActionConsistency("reaction").execution).toBe("optimistic");
        expect(sharedActionConsistency("skip").execution).toBe("authoritative");
        expect(sharedActionConsistency("queue-reorder").execution).toBe("authoritative");
    });
    test("publishes Discord join only with privacy consent and never rebroadcasts audio", () => {
        expect(
            discordPresence({
                experience: "Party",
                people: 5,
                track: "X",
                sessionId: "s",
                joinSecret: "j",
                privacyAllowsJoin: true,
            }),
        ).toMatchObject({ join: { sessionId: "s", secret: "j" }, rebroadcastAudio: false });
        expect(
            discordPresence({ experience: "Chill", people: 1, track: "X", privacyAllowsJoin: false }),
        ).not.toHaveProperty("join");
    });
    test("isolates adapter failures and opens circuit breaker without retry storms", () => {
        expect(integrationIsolation("discord", true)).toEqual({
            adapter: "discord",
            corePlaybackAffected: false,
            status: "failed-isolated",
        });
        expect(integrationCircuitBreaker(3)).toEqual({
            state: "open",
            retryStormPrevented: true,
            temporaryDisable: true,
        });
    });
    test("classifies realtime, musical, product and social events", () => {
        expect(eventClass("beat")).toBe("realtime");
        expect(eventClass("drop")).toBe("musical");
        expect(eventClass("track-started")).toBe("product");
        expect(eventClass("session-joined")).toBe("social");
    });
    test("keeps raw callbacks local and network events predicted", () => {
        expect(eventDelivery("beat", "local-plugin")).toMatchObject({
            precision: "high-local",
            rawAudioCallbackExposed: false,
        });
        expect(eventDelivery("drop", "network-api").precision).toBe("future-predicted");
    });
    test("grants plugins only approved capabilities in a sandbox", () => {
        expect(pluginAuthorization(["read-track", "control-playback"], ["read-track"])).toEqual({
            granted: ["read-track"],
            denied: ["control-playback"],
            audioThreadCodeAllowed: false,
            privateTasteAutomaticAccess: false,
        });
    });
    test("emits semantic lighting intent while integration chooses aesthetics", () => {
        expect(lightingIntent({ energy: 0.9, tension: 0.8, moment: "drop", confidence: 0.95 })).toMatchObject({
            moment: "drop",
            colorsChosenByIntegration: true,
        });
    });
    test("uses reliable game context softly unless adaptive gaming is explicit", () => {
        expect(
            gameIntegrationPolicy({ state: "combat", intensity: 1, confidence: 0.8, adaptiveGamingMode: false }),
        ).toMatchObject({ energyTarget: 0.64, influence: "soft", abruptReplacementForbidden: true });
        expect(
            gameIntegrationPolicy({ state: "cutscene", intensity: 0.2, confidence: 1, adaptiveGamingMode: true })
                .reduceVocalForeground,
        ).toBe(true);
    });
    test("keeps normal playback in director/curator roles", () => {
        expect(LIVE_MUSIC_AGENT_ROLES).toHaveLength(5);
        expect(NORMAL_PLAYBACK_AGENT_ROLES).toEqual(["director", "curator"]);
    });
});
