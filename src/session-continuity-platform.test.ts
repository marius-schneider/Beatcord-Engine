import { describe, expect, test } from "bun:test";
import {
    adaptMediaSession,
    assignDeviceRoles,
    CONTINUITY_PRINCIPLE,
    capabilityAwareHandoff,
    complementaryPartyDevices,
    continuityAction,
    intelligentHandoffTiming,
    OS_INTEGRATION_ARCHITECTURE,
    surfaceControls,
    validateHandoffState,
} from "./session-continuity-platform";

const state = {
    currentTrack: "x",
    playbackPosition: 154,
    queue: ["x", "y"],
    history: ["a"],
    experience: "party",
    journey: ["build", "peak"],
    crowd: { sessionId: "c", members: 5 },
    requests: ["r"],
    currentContext: "home",
    tasteProfileScope: "party",
    plannedRoute: ["x", "y"],
    committedTransition: "t",
};
const mac = {
    deviceId: "mac",
    roles: ["audio-master" as const, "controller" as const],
    dspTier: 3 as const,
    stems: true,
    sampleRate: 48000,
};
describe("session continuity platform", () => {
    test("serializes full session continuity beyond track position", () => {
        expect(validateHandoffState(state)).toEqual({
            complete: true,
            missing: [],
            sessionContinuityNotOnlyPlayback: true,
        });
    });
    test("distinguishes playback transfer from remote control", () => {
        expect(continuityAction("transfer", "mac", "phone")).toEqual({
            renderer: "phone",
            controller: "phone",
            playbackMoves: true,
        });
        expect(continuityAction("remote-control", "mac", "phone")).toEqual({
            renderer: "mac",
            controller: "phone",
            playbackMoves: false,
        });
    });
    test("allows devices to carry multiple explicit roles", () => {
        expect(assignDeviceRoles(mac)).toEqual({ roles: ["audio-master", "controller"], multipleRolesAllowed: true });
    });
    test("moves before commit horizon or after protected transition", () => {
        expect(
            intelligentHandoffTiming({
                secondsToTransition: 12,
                transitionCommitted: true,
                complexStemHandoff: true,
                secondsToTrackEnd: 60,
            }).safety,
        ).toBe("after-transition");
        expect(
            intelligentHandoffTiming({
                secondsToTransition: 60,
                transitionCommitted: false,
                complexStemHandoff: false,
                secondsToTrackEnd: 60,
            }).safety,
        ).toBe("now");
    });
    test("degrades DSP capability while preserving experience", () => {
        const result = capabilityAwareHandoff(
            mac,
            { deviceId: "watch", roles: ["controller"], dspTier: 0, stems: false, sampleRate: 44100 },
            "party",
        );
        expect(result).toEqual({ experience: "party", dspTier: 0, stems: false, degradedGracefully: true });
    });
    test("adapts one platform-neutral media session to OS surfaces", () => {
        const result = adaptMediaSession(
            {
                sessionId: "s",
                state: "playing",
                currentTrack: "x",
                position: 1,
                commands: ["play", "skip"],
                customCommands: ["energy-up"],
            },
            "android-media3",
        );
        expect(result).toEqual({
            adapter: "android-media3",
            coreSessionId: "s",
            supportedCommands: ["play", "skip", "energy-up"],
            coreFeatureSetPreserved: true,
        });
    });
    test("keeps features core-first and OS adapters replaceable", () => {
        expect(OS_INTEGRATION_ARCHITECTURE.adapters).toHaveLength(6);
        expect(OS_INTEGRATION_ARCHITECTURE.productBehaviorBoundToOsApi).toBe(false);
        expect(OS_INTEGRATION_ARCHITECTURE.systemSurfacesPrimary).toBe(true);
    });
    test("shows surface-aware controls instead of duplicating desktop UI", () => {
        expect(surfaceControls("lock-screen").controls).toEqual(["play", "pause", "skip", "like"]);
        expect(surfaceControls("car").interaction).toBe("voice-first");
        expect(surfaceControls("desktop").controls).toEqual(["full-director"]);
    });
    test("assigns complementary roles across party devices", () => {
        expect(complementaryPartyDevices()).toEqual({
            desktop: ["audio", "director"],
            tv: ["lyrics", "visuals", "crowd"],
            phones: ["requests", "reactions"],
            watch: ["haptic", "quick-control"],
        });
    });
    test("prohibits queue rebuild, restart and context loss on handoff", () => {
        expect(CONTINUITY_PRINCIPLE).toMatchObject({
            queueRebuildForbidden: true,
            trackRestartForbidden: true,
            sessionContextLossForbidden: true,
            oneTapHandoff: true,
            continuityInDataModel: true,
        });
    });
});
