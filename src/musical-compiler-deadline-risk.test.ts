import { describe, expect, test } from "bun:test";
import {
    BEATGRID_BENCHMARK_CASES,
    BUILD_AUDIO_INNOVATIONS,
    compileMusicalIr,
    composedMusicalRisk,
    deadlineTask,
    LOOKAHEAD_SCHEDULE,
    MUSICAL_COMPILER_PASSES,
    PRECISION_WHERE_IT_MATTERS,
    PROTOTYPE_AUDIO_INNOVATIONS,
    perceptualMixingCanvas,
    RESEARCH_AUDIO_INNOVATIONS,
    STEM_BENCHMARK_DIMENSIONS,
} from "./musical-compiler-deadline-risk";

describe("musical compiler, deadlines and risk", () => {
    test("schedules intelligence before the realtime deadline", () => {
        expect(LOOKAHEAD_SCHEDULE.map((item) => item.secondsBefore)).toEqual([30, 20, 10, 5, 0]);
        expect(LOOKAHEAD_SCHEDULE.at(-1)?.task).toBe("execute-realtime");
    });
    test("skips late work and chooses deterministic fallbacks", () => {
        expect(deadlineTask("prepare-stems", 90, 100, 20)).toEqual({ execute: false, fallback: "classic-mix" });
        expect(deadlineTask("render-preview", 50, 100, 20)).toEqual({ execute: true, fallback: "none" });
    });
    test("composes stacked musical risks nonlinearly", () => {
        expect(composedMusicalRisk({ gridRisk: 0.5, harmonicRisk: 0.5, stemRisk: 0, manipulationRisk: 0 })).toEqual({
            combined: 0.75,
            stacked: true,
            action: "clean-cut",
        });
        expect(
            composedMusicalRisk({ gridRisk: 0.8, harmonicRisk: 0.8, stemRisk: 0.8, manipulationRisk: 0.8 }).action,
        ).toBe("bridge-track");
    });
    test("finds empty perceptual canvas", () => {
        expect(
            perceptualMixingCanvas(
                { density: 1, foregroundCount: 3, spectralOccupancy: 1, rhythmicDensity: 1 },
                { density: 0, foregroundCount: 0, spectralOccupancy: 0, rhythmicDensity: 1 },
            ),
        ).toMatchObject({ available: 0.5, preferredRoles: ["drums", "low-end"] });
    });
    test("compiles stable Musical IR through seven passes", () => {
        const ir = {
            version: 1 as const,
            beatMesh: "mesh",
            tempoMap: "tempo",
            grooveField: "groove",
            meterMap: "meter",
            structureGraph: "structure",
            harmonyTimeline: "harmony",
            roleTimeline: "roles",
            complexityTimeline: "complexity",
            stemCapabilities: ["vocals"],
            confidenceMap: { beat: 0.9 },
            modelVersions: { beat: "v1" },
        };
        const result = compileMusicalIr(ir, "select-dsp");
        expect(result).toMatchObject({ compiled: true, deterministicAudioProgram: true, stableIrBoundary: true });
        expect(result.passes).toHaveLength(7);
        expect(result.passes.find((pass) => pass.pass === "select-dsp")?.status).toBe("fallback");
        expect(MUSICAL_COMPILER_PASSES).toHaveLength(7);
    });
    test("separates build, prototype and research investments", () => {
        expect(BUILD_AUDIO_INNOVATIONS).toContain("musical-ir");
        expect(PROTOTYPE_AUDIO_INNOVATIONS).toContain("stem-mosaic");
        expect(RESEARCH_AUDIO_INNOVATIONS).toContain("learned-transition-embeddings");
    });
    test("benchmarks hard musical cases and perceptual stems", () => {
        expect(BEATGRID_BENCHMARK_CASES).toContain("polyrhythm");
        expect(BEATGRID_BENCHMARK_CASES).toContain("beatless-intro");
        expect(STEM_BENCHMARK_DIMENSIONS).toContain("transition-usefulness");
    });
    test("spends precision only where decisions need it", () => {
        expect(PRECISION_WHERE_IT_MATTERS).toEqual({
            refineRelevantRegion: true,
            requestOnlyNeededStems: true,
            preserveGroove: true,
            searchMinimalIntervention: true,
            testFailureModes: true,
            conservativeElsewhere: true,
        });
    });
});
