import { describe, expect, test } from "bun:test";
import {
    assertProviderAction,
    EXPERIENCE_DNA_PRESETS,
    MARKET_BASELINE_2026,
    morphExperienceDna,
    providerCapabilities,
    SYSTEM_DIFFERENTIATION_LOOP,
    VALIDATION_MATRIX,
    validateInnovation,
} from "./provider-innovation-validation";

describe("provider and innovation validation", () => {
    test("scores innovations against five hard criteria", () => {
        expect(
            validateInnovation({
                userValue: 5,
                technicalFeasibility: 5,
                differentiation: 4,
                rightsDependency: 5,
                validationStrength: 4,
            }),
        ).toEqual({ score: 4.6, decision: "build" });
        expect(
            validateInnovation({
                userValue: 5,
                technicalFeasibility: 3,
                differentiation: 5,
                rightsDependency: 2,
                validationStrength: 3,
            }).decision,
        ).toBe("partner-dependent");
    });
    test("treats commodity features as baseline and system integration as differentiation", () => {
        expect(MARKET_BASELINE_2026).toContain("beatmatching");
        expect(SYSTEM_DIFFERENTIATION_LOOP).toEqual([
            "intent",
            "journey",
            "moment",
            "track",
            "transition",
            "critic",
            "crowd-reaction",
            "replan",
        ]);
    });
    test("enforces provider capability tiers", () => {
        expect(providerCapabilities("CONTROL_ONLY")).toMatchObject({
            queueControl: true,
            providerPlayback: false,
            rawAudio: false,
        });
        expect(providerCapabilities("PLAYBACK_ONLY")).toMatchObject({ providerPlayback: true, approvedMixing: false });
        expect(providerCapabilities("OWNED_OR_LICENSED_AUDIO")).toMatchObject({
            approvedMixing: true,
            stems: true,
            previewRendering: true,
        });
        expect(assertProviderAction("PLAYBACK_ONLY", "mix").allowed).toBeFalse();
    });
    test("provides six-dimensional Experience DNA presets", () => {
        expect(Object.keys(EXPERIENCE_DNA_PRESETS.party)).toEqual([
            "energy",
            "familiarity",
            "discovery",
            "mixIntensity",
            "warmth",
            "surprise",
        ]);
        expect(EXPERIENCE_DNA_PRESETS.party.energy).toBeGreaterThan(EXPERIENCE_DNA_PRESETS.chill.energy);
    });
    test("morphs DNA with confidence and rate limits", () => {
        const result = morphExperienceDna(EXPERIENCE_DNA_PRESETS.chill, EXPERIENCE_DNA_PRESETS.party, {
            confidence: 1,
            manualIntent: false,
            maxStep: 0.2,
        });
        expect(result.energy).toBeCloseTo(0.39, 6);
        expect(result.energy).toBeLessThan(EXPERIENCE_DNA_PRESETS.party.energy);
    });
    test("keeps high-risk moat features in prototype or partner tracks", () => {
        expect(VALIDATION_MATRIX["moment-level-recommendation"]).toBe("prototype");
        expect(VALIDATION_MATRIX["role-based-mixing"]).toBe("partner-dependent");
        expect(VALIDATION_MATRIX["no-action"]).toBe("build");
    });
});
