import { describe, expect, test } from "bun:test";
import {
    audioClockArchitecture,
    BEATCORD_MOAT,
    BEST_INNOVATION_EFFORT_RATIO,
    CURRENT_ENGINE_FOUNDATION,
    DEFERRED_FEATURES,
    HIGH_MOAT_PROTOTYPES,
    LOW_STRATEGIC_VALUE,
    MIX_DECK_REALTIME_FOUNDATION,
    PLANNING_RENDERING_BOUNDARY,
    productPackage,
    transportProfile,
    V1_INNOVATION_PACKAGE,
    V2_INNOVATION_PACKAGE,
    validateTransitionDatum,
} from "./product-architecture-strategy";

describe("product architecture strategy", () => {
    test("recognizes the existing engine foundation", () => {
        expect(CURRENT_ENGINE_FOUNDATION).toContain("continuous-two-deck-mixer");
        expect(CURRENT_ENGINE_FOUNDATION).toContain("transition-telemetry");
        expect(PLANNING_RENDERING_BOUNDARY.rendererExecutesValidatedPlan).toBeTrue();
    });
    test("distinguishes deadline pacing from professional device clocks", () => {
        expect(MIX_DECK_REALTIME_FOUNDATION).toMatchObject({
            sampleRate: 48_000,
            absoluteDeadlineScheduling: true,
            professionalDeviceClock: false,
        });
        expect(audioClockArchitecture("server-streaming")).toMatchObject({
            realtimeCore: "javascript-deadline-clock",
            rewriteNow: false,
        });
        expect(audioClockArchitecture("professional-local")).toMatchObject({
            realtimeCore: "native-platform-callback",
            rewriteNow: false,
        });
    });
    test("uses multiple transports for distinct latency needs", () => {
        expect(transportProfile("hls")).toEqual({
            useCase: "shared-scalable-room-listening",
            interactive: false,
            scalableRoom: true,
        });
        expect(transportProfile("webrtc-low-latency").interactive).toBeTrue();
        expect(transportProfile("local-pcm").useCase).toContain("high-quality");
    });
    test("explicitly defers weakly validated complexity", () => {
        expect(DEFERRED_FEATURES).toContain("autonomous-crowd-emotion-recognition");
        expect(DEFERRED_FEATURES).toContain("seamless-mid-transition-cross-provider-handoff");
        expect(DEFERRED_FEATURES).toContain("one-end-to-end-music-ai");
    });
    test("separates efficient innovations, moat prototypes and commodities", () => {
        expect(BEST_INNOVATION_EFFORT_RATIO[0]).toBe("experience-dna");
        expect(HIGH_MOAT_PROTOTYPES).toContain("transition-critic-repair");
        expect(LOW_STRATEGIC_VALUE).toContain("crossfade");
        expect(BEATCORD_MOAT).toContain("journey-feedback");
    });
    test("validates a defensible closed-loop transition datum", () => {
        expect(
            validateTransitionDatum({
                fromTrackId: "a",
                toTrackId: "b",
                context: "party",
                experienceDnaHash: "hash",
                transitionPlan: "blend",
                technicalQuality: 0.9,
                userReaction: "like",
                crowdReaction: "fire",
                laterSessionOutcome: "continued",
            }),
        ).toEqual({ valid: true, personallyIdentifyingRawDataRequired: false, closedLoopLearning: true });
    });
    test("keeps v1 achievable and v2 prototype-driven", () => {
        expect(productPackage("v1")).toMatchObject({
            capabilities: V1_INNOVATION_PACKAGE,
            realistic: true,
            learnedNaturalnessRequired: false,
        });
        expect(productPackage("v2").capabilities).toEqual(V2_INNOVATION_PACKAGE);
    });
});
