import { describe, expect, test } from "bun:test";
import {
    AUDIO_RESEARCH_EXPERIMENTS_V2,
    evidenceUse,
    FORMAT_BACKEND_STRATEGY,
    fidelityAwareUtility,
    matchSceneRoles,
    nativeSpatialTransition,
    OPEN_IMMERSIVE_PROTOTYPE,
    spatialArtisticIntegrity,
    spatialDownmixCritic,
    spatialSceneCollision,
} from "./fidelity-spatial-director-v1";

describe("fidelity spatial director v1", () => {
    test("weights fidelity strongly for Pure and journey strongly for Party", () => {
        expect(
            fidelityAwareUtility({
                experience: "pure",
                experienceQuality: 1,
                fidelityPreservation: 1,
                manipulationCost: 0,
            }).fidelityWeight,
        ).toBe(0.65);
        expect(
            fidelityAwareUtility({
                experience: "party",
                experienceQuality: 1,
                fidelityPreservation: 1,
                manipulationCost: 0,
            }).experienceWeight,
        ).toBe(0.7);
    });
    test("preserves artist-authored spatial scenes by default", () => {
        const result = spatialArtisticIntegrity({
            nativeScene: true,
            creativeMode: false,
            transitionBoundary: true,
            selectedSafeRole: true,
        });
        expect(result.preserveScene).toBeTrue();
        expect(result.objectRepositioningDefault).toBeFalse();
        expect(result.allowedChanges).toContain("selected-safe-role");
    });
    test("mixes native objects at scene level", () => {
        expect(nativeSpatialTransition({ outgoingNativeObjects: true, incomingNativeObjects: true })).toEqual({
            mode: "scene-level",
            binauralMixingPreferred: false,
        });
    });
    test("matches ambience before foreground vocals", () => {
        const outgoing = [
            { role: "ambience" as const, location: "wide" as const, foreground: false },
            { role: "vocal" as const, location: "front" as const, foreground: true },
        ];
        const result = matchSceneRoles(outgoing, outgoing);
        expect(result.handoffOrder).toEqual(["ambience", "vocal"]);
        expect(result.matches.every((item) => item.compatible)).toBeTrue();
    });
    test("detects scene clutter and validates stereo fallback", () => {
        expect(
            spatialSceneCollision({
                foregroundObjects: 4,
                sameLocationPairs: 3,
                heightClutter: 1,
                rearOverload: 1,
                centerMasking: 1,
            }).risk,
        ).toBe(1);
        expect(
            spatialDownmixCritic({
                roleBalance: 0.8,
                foregroundClarity: 0.8,
                bassIntegrity: 0.8,
                transitionIntegrity: 0.8,
            }).stereoSafe,
        ).toBeTrue();
    });
    test("defines open spatial and controlled listening prototypes", () => {
        expect(OPEN_IMMERSIVE_PROTOTYPE).toContain("iamf-package");
        expect(AUDIO_RESEARCH_EXPERIMENTS_V2.spatialVsEq.variants).toHaveLength(3);
        expect(FORMAT_BACKEND_STRATEGY.dolby).toContain("official-partner-tools");
    });
    test("uses community sources only for hypotheses and failure discovery", () => {
        expect(evidenceUse("official-spec")).toBe("architecture-truth");
        expect(evidenceUse("peer-reviewed")).toBe("evidence");
        expect(evidenceUse("community")).toBe("hypothesis-and-failure-discovery");
    });
});
