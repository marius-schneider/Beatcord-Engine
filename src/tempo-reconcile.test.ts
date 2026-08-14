import { describe, expect, test } from "bun:test";

import type { BeatGrid } from "./beatgrid";
import { reconcileTempo } from "./beatgrid";

function grid(bpm: number, downbeatPhase = 0): BeatGrid {
    return {
        bpm,
        beats: [0, 60 / bpm, 120 / bpm],
        beatInterval: 60 / bpm,
        analysisOffset: 0,
        musicalEndSec: 180,
        key: { name: "8A", camelot: "8A", confidence: 1 },
        energy: { energy: 0.7, percussiveness: 0.5, danceability: 2 },
        spectral: { centroid: 3000, rolloff: 8000, flatness: 0.1, flux: 0.2 },
        downbeatPhase,
        introSec: 0,
    } as unknown as BeatGrid;
}

describe("reconcileTempo — TIDAL BPM octave correction", () => {
    test("no hint leaves the grid untouched", () => {
        const g = grid(64);
        expect(reconcileTempo(g, null)).toBe(g);
        expect(reconcileTempo(g, undefined).bpm).toBe(64);
    });

    test("detector caught half-time (64 vs 128) → doubled", () => {
        const r = reconcileTempo(grid(64), 128);
        expect(r.bpm).toBe(128);
        expect(r.beatInterval).toBeCloseTo(60 / 128, 6);
    });

    test("detector caught double-time (256 vs 128) → halved", () => {
        const r = reconcileTempo(grid(256), 128);
        expect(r.bpm).toBe(128);
        expect(r.beatInterval).toBeCloseTo(60 / 128, 6);
    });

    test("a genuine disagreement (100 vs 128, not an octave) is left alone", () => {
        expect(reconcileTempo(grid(100), 128).bpm).toBe(100);
    });

    test("a near match (127 vs 128) is left alone", () => {
        const result = reconcileTempo(grid(127), 128);
        expect(result.bpm).toBe(127);
        expect(result.analysisConfidence?.tempo.sources).toEqual(["audio-analysis", "metadata"]);
        expect(result.analysisConfidence?.tempo.confidence).toBeGreaterThan(0.85);
    });

    test("metadata disagreement is retained as low-confidence evidence", () => {
        const result = reconcileTempo(grid(100), 128);
        expect(result.analysisConfidence?.tempo.conflicted).toBe(true);
        expect(result.analysisConfidence?.tempo.confidence).toBeLessThan(0.3);
        expect(result.analysisConfidence?.tempo.alternatives).toHaveLength(2);
    });

    test("nonsense hints are ignored", () => {
        expect(reconcileTempo(grid(128), 5).bpm).toBe(128);
        expect(reconcileTempo(grid(128), 900).bpm).toBe(128);
    });

    test("downbeat phase is carried into the new octave", () => {
        expect(reconcileTempo(grid(64, 1), 128).downbeatPhase).toBe(2);
        expect(reconcileTempo(grid(256, 2), 128).downbeatPhase).toBe(1);
    });
});
