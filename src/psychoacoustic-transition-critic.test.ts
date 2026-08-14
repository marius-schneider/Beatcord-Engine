import { describe, expect, test } from "bun:test";
import {
    buildMaskingMatrix,
    perceptualMixClarity,
    psychoacousticGuardian,
    simultaneousMasking,
} from "./psychoacoustic-transition-critic";

describe("psychoacoustic transition critic", () => {
    const roles = [
        { role: "bass" as const, spectralEnergy: [1, 0.8, 0.1], onsetDensity: 0.8 },
        { role: "kick" as const, spectralEnergy: [1, 0.7, 0.1], onsetDensity: 0.9 },
        { role: "vocal" as const, spectralEnergy: [0.1, 0.8, 1], onsetDensity: 0.7 },
        { role: "lead" as const, spectralEnergy: [0.1, 0.9, 1], onsetDensity: 0.8 },
    ];
    test("builds directed spectral and temporal role masking", () => {
        const matrix = buildMaskingMatrix(roles);
        expect(matrix.sourceRoles).toHaveLength(12);
        expect(
            matrix.sourceRoles.find((r) => r.masker === "bass" && r.masked === "kick")?.spectralMasking,
        ).toBeGreaterThan(0.5);
    });
    test("measures simultaneous low-end and foreground competition", () => {
        const result = simultaneousMasking(buildMaskingMatrix(roles));
        expect(result.lowEndMuddiness).toBeGreaterThan(0.5);
        expect(result.foregroundCompetition).toBeGreaterThan(0.5);
    });
    test("models perceived clarity beyond raw frequency overlap", () => {
        const matrix = buildMaskingMatrix(roles);
        const clear = perceptualMixClarity(
            {
                perceptualLoudness: 0.7,
                masking: 0.2,
                clarity: 0.9,
                foregroundSeparation: 0.9,
                transientDefinition: 0.9,
                roughness: 0.1,
                spatialSeparation: 0.9,
            },
            matrix,
        );
        const muddy = perceptualMixClarity(
            {
                perceptualLoudness: 0.7,
                masking: 0.9,
                clarity: 0.2,
                foregroundSeparation: 0.1,
                transientDefinition: 0.2,
                roughness: 0.9,
                spatialSeparation: 0.1,
            },
            matrix,
        );
        expect(clear.clarityScore).toBeGreaterThan(muddy.clarityScore);
        expect(clear.rankCorrelationTarget).toBe("subjective-clarity");
    });
    test("selects a perceptual fallback when clarity is unsafe", () => {
        const matrix = buildMaskingMatrix(roles);
        const result = psychoacousticGuardian(
            {
                perceptualLoudness: 0.8,
                masking: 1,
                clarity: 0,
                foregroundSeparation: 0,
                transientDefinition: 0,
                roughness: 1,
                spatialSeparation: 0,
            },
            matrix,
            0.7,
        );
        expect(result.allowed).toBe(false);
        expect(["reduce-overlap", "isolate-role", "structural-cut"]).toContain(result.fallback);
    });
});
