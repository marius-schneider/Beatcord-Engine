import { describe, expect, test } from "bun:test";
import {
    ACCESSIBLE_CONTROL_METHODS,
    crossDeviceSearchScore,
    eventDeliveryPolicy,
    externalContextWeight,
    integrationDiscovery,
    integrationHealth,
    lyricsAccessibility,
    OBS_STREAMER_POLICY,
    revokeIntegrationGrant,
    SEARCH_ARCHITECTURE,
    sdkSurface,
    semanticHomeEvent,
    visualMotionPolicy,
    visualMusicMap,
} from "./integration-sdk-accessibility-search";

describe("integration SDK, accessibility and search", () => {
    test("discovers integrations in context instead of a giant catalog", () => {
        expect(integrationDiscovery({ kind: "discord", detected: true, context: "Party" })).toMatchObject({
            visible: true,
            prompt: "Show Beatcord on Discord",
            contextual: true,
            globalCatalogRequired: false,
        });
        expect(integrationDiscovery({ kind: "hue", detected: false, context: "Party" }).visible).toBeFalse();
    });

    test("makes integration health visible", () => {
        expect(integrationHealth("game", "disconnected")).toEqual({
            integration: "game",
            status: "disconnected",
            visibleToUser: true,
        });
    });

    test("shows reversible read and action grants", () => {
        const revoked = revokeIntegrationGrant({
            integration: "discord",
            canRead: ["track"],
            canDo: ["show-join"],
            reversible: true,
        });
        expect(revoked).toMatchObject({ canRead: [], canDo: [], reversible: true });
    });

    test("separates observation from restricted control", () => {
        expect(sdkSurface("observation")).toMatchObject({ canMutatePlayback: false, directDspMemoryAccess: false });
        expect(sdkSurface("observation").methods).toContain("onBeat");
        expect(sdkSurface("control").methods).toEqual(["requestTrack", "setExternalContext", "suggestExperience"]);
    });

    test("fades stale external context after its TTL", () => {
        const context = { source: "game", state: "combat", confidence: 0.8, receivedAt: 1_000, expiresIn: 1_000 };
        expect(externalContextWeight(context, 1_500)).toBe(0.8);
        expect(externalContextWeight(context, 3_000, 2_000)).toBe(0.4);
        expect(externalContextWeight(context, 4_001, 2_000)).toBe(0);
    });

    test("exposes rights-aware OBS surfaces without assuming audio rebroadcast", () => {
        expect(OBS_STREAMER_POLICY).toMatchObject({ rightsCheckRequired: true, audioRebroadcastAssumed: false });
        expect(OBS_STREAMER_POLICY.surfaces).toContain("lyrics");
    });

    test("sends semantic events while the home chooses actions", () => {
        expect(semanticHomeEvent("drop", 1.2, 0.9)).toEqual({ event: "drop", energy: 1, confidence: 0.9 });
    });

    test("declares latency classes and safe transports", () => {
        expect(eventDeliveryPolicy({ frequency: "realtime", remote: true })).toMatchObject({
            latencyClass: "A",
            transports: ["local-ipc"],
        });
        expect(eventDeliveryPolicy({ frequency: "interactive", remote: true }).latencyClass).toBe("B");
        expect(eventDeliveryPolicy({ frequency: "social", remote: true }).latencyClass).toBe("C");
        expect(eventDeliveryPolicy({ frequency: "analytics", remote: true })).toMatchObject({
            latencyClass: "D",
            transports: ["webhook"],
        });
    });

    test("supports non-touch control methods", () => {
        expect(ACCESSIBLE_CONTROL_METHODS).toContain("rotary");
        expect(ACCESSIBLE_CONTROL_METHODS).toContain("switch-control");
        expect(ACCESSIBLE_CONTROL_METHODS).toContain("screen-reader");
    });

    test("never lets experience energy override reduced motion", () => {
        expect(visualMotionPolicy("off", 1)).toEqual({
            motion: "off",
            visualIntensity: 0,
            energyOverrideBlocked: true,
        });
        expect(visualMotionPolicy("reduced", 1).visualIntensity).toBe(0.25);
    });

    test("supports readable lyrics with optional animation", () => {
        expect(
            lyricsAccessibility({
                fontScale: 4,
                highContrast: true,
                screenReader: true,
                lineFocus: true,
                translation: true,
                animation: "off",
            }),
        ).toMatchObject({
            fontScale: 3,
            animationOptional: true,
            screenReader: true,
        });
    });

    test("maps music visually without waveform literacy", () => {
        expect(
            visualMusicMap({ energy: 0.8, mood: "warm", instrumentation: ["vocal"], structure: "build approaching" }),
        ).toMatchObject({
            energy: 0.8,
            waveformLiteracyRequired: false,
        });
    });

    test("combines multilingual, typo, graph and contextual search", () => {
        expect(
            crossDeviceSearchScore({
                lexical: 0.2,
                semantic: 0.9,
                transliteration: 0.8,
                typo: 0.7,
                artistGraph: 0.6,
                userContext: 0.5,
            }),
        ).toBe(0.606);
        expect(SEARCH_ARCHITECTURE.optimizedQueries).toEqual(["tail", "misspelled", "cross-lingual"]);
    });
});
