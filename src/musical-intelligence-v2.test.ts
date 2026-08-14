import { describe, expect, test } from "bun:test";

import { analyzeDynamicBeatgrid } from "./dynamic-beatgrid";
import { createTempoMap, musicalTimeToSample, musicalTimeToSeconds, secondsToMusicalTime } from "./musical-timeline";
import { scoreSectionImportance } from "./section-importance";
import { assessStructuralCut, inferStructuralDependencies } from "./structural-dependencies";
import type { TrackSection } from "./track-profile";

const section = (type: TrackSection["type"], start: number, end: number, energy = 0.7): TrackSection => ({
    type,
    start,
    end,
    energy,
    vocals: type === "chorus" ? 0.8 : 0.3,
    drums: 0.7,
    bass: 0.6,
    entryQuality: 0.7,
    exitQuality: type === "outro" ? 0.95 : 0.65,
    phraseConfidence: 0.8,
    structureConfidence: 0.8,
});

describe("musical timeline and structure", () => {
    test("round-trips bar/beat/tick time and resolves samples only at render time", () => {
        const map = createTempoMap({ beats: Array.from({ length: 24 }, (_, index) => index * 0.5) });
        const musical = secondsToMusicalTime(map, 4.25);
        expect(musical).toEqual({ bar: 3, beat: 1, tick: 480, phrase: 1 });
        expect(musicalTimeToSeconds(map, musical)).toBe(4.25);
        expect(musicalTimeToSample(map, musical, 48_000)).toBe(204_000);
    });

    test("detects a dynamic beatgrid instead of hiding tempo drift in one BPM", () => {
        const beats = [0];
        for (let index = 1; index < 80; index++) {
            const bpm = 118 + index * 0.04;
            beats.push(beats.at(-1)! + 60 / bpm);
        }
        const result = analyzeDynamicBeatgrid({ beats, bpm: 120, downbeatPhase: 0 });
        expect(result.variableTempo).toBe(true);
        expect(result.driftBpm).toBeGreaterThan(1.5);
        expect(result.tempoMap.tempoChanges.length).toBeGreaterThan(1);
    });

    test("protects builds and pre-choruses until their payoff", () => {
        const sections = [
            section("verse", 0, 20),
            section("pre-chorus", 20, 30),
            section("chorus", 30, 50),
            section("build", 50, 60),
            section("drop", 60, 80, 0.95),
            section("outro", 80, 95, 0.3),
        ];
        const dependencies = inferStructuralDependencies({ sections });
        expect(dependencies.some((dependency) => dependency.type === "expects")).toBe(true);
        expect(dependencies.some((dependency) => dependency.type === "resolves-to")).toBe(true);
        expect(assessStructuralCut({ sections }, dependencies, 55).blocked).toBe(true);
    });

    test("distinguishes must-play sections from technically useful exits", () => {
        const scores = scoreSectionImportance({
            sections: [section("chorus", 0, 20, 0.95), section("outro", 20, 40, 0.3)],
        });
        expect(scores[0]!.mustPlayScore).toBeGreaterThan(scores[1]!.mustPlayScore);
        expect(scores[1]!.shouldMixAfterScore).toBeGreaterThan(scores[0]!.shouldMixAfterScore);
    });
});
