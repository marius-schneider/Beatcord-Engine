import { describe, expect, test } from "bun:test";
import {
    applySemanticControl,
    semanticHardwareBoundary,
    semanticListeningBus,
    semanticListeningLevel,
    semanticMomentProtection,
    semanticResponse,
    spectralConversationPocket,
} from "./semantic-listening-v1";

describe("semantic listening v1", () => {
    test("builds scene classification first", () => {
        expect(semanticListeningLevel(1)).toEqual({ level: 1, capability: "scene-classification", production: true });
        expect(semanticListeningLevel(3).production).toBeFalse();
    });

    test("keeps raw microphone audio out of the semantic bus", () => {
        const result = semanticListeningBus({
            event: "announcement",
            confidence: 0.95,
            locallyExtracted: true,
            rawAudioStored: false,
        });
        expect(result.rawAudioStored).toBeFalse();
        expect(result.accepted).toBeTrue();
        expect(result.route.at(-1)).toBe("music-director-and-playback-twin");
    });

    test("separates DSP response from Director moment response", () => {
        expect(semanticResponse("announcement", 0.95, 8)).toEqual({
            dsp: "spectral-pocket",
            director: "defer-moment",
            safetyWins: false,
        });
    });

    test("lets safety events override every experience", () => {
        expect(semanticResponse("warning", 0.9, 30)).toEqual({
            dsp: "safety-duck",
            director: "safety-override",
            safetyWins: true,
        });
    });

    test("requires high precision for intrusive speech actions", () => {
        expect(
            spectralConversationPocket({ allowed: true, validated: true, speechConfidence: 0.7 }).enabled,
        ).toBeFalse();
        expect(
            semanticMomentProtection({
                event: "speech-nearby",
                eventConfidence: 0.95,
                momentInSec: 10,
                lowForegroundAvailable: true,
            }).action,
        ).toBe("choose-low-foreground");
    });

    test("honors explicit listener controls", () => {
        const control = {
            mode: "custom" as const,
            alwaysAllow: ["warning" as const],
            allow: ["user-speaking" as const],
            ignore: ["crowd" as const],
            explicit: true as const,
        };
        expect(applySemanticControl("warning", control).allowed).toBeTrue();
        expect(applySemanticControl("crowd", control).allowed).toBeFalse();
    });

    test("marks deep manipulation as partner dependent", () => {
        expect(semanticHardwareBoundary(3, "app")).toEqual({
            available: false,
            coreOwnsPolicy: true,
            deepManipulationPartnerDependent: true,
        });
    });
});
