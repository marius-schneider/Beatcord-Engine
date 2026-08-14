import { describe, expect, test } from "bun:test";
import type { BeatGrid } from "./beatgrid";
import { fuseCategoricalEvidence, fuseNumericEvidence, harmonicOverlapLimit } from "./confidence-fusion";
import { buildTrackProfile } from "./track-profile";

describe("confidence fusion", () => {
    test("independent matching tempo evidence is stronger than either analyzer", () => {
        const result = fuseNumericEvidence(
            [
                { source: "beat-a", value: 128, confidence: 0.91 },
                { source: "beat-b", value: 128, confidence: 0.87 },
                { source: "metadata", value: 128, confidence: 0.72 },
            ],
            { tolerance: 0.02, relative: true, precision: 1 },
        );

        expect(result.value).toBe(128);
        expect(result.confidence).toBeGreaterThan(0.97);
        expect(result.agreement).toBe(1);
        expect(result.conflicted).toBe(false);
        expect(result.sources).toEqual(["beat-a", "beat-b", "metadata"]);
    });

    test("correlated sources do not inflate confidence twice", () => {
        const result = fuseCategoricalEvidence([
            { source: "model-a", family: "same-model", value: "8A", confidence: 0.8 },
            { source: "model-a-copy", family: "same-model", value: "8A", confidence: 0.9 },
        ]);
        expect(result.confidence).toBe(0.9);
    });

    test("strongly disagreeing key detectors produce low confidence", () => {
        const result = fuseCategoricalEvidence([
            { source: "essentia", value: "11A", confidence: 0.86 },
            { source: "chroma", value: "11B", confidence: 0.79 },
        ]);

        expect(result.value).toBe("11A");
        expect(result.confidence).toBeLessThan(0.3);
        expect(result.conflicted).toBe(true);
        expect(result.alternatives).toHaveLength(2);
    });

    test("a numerical outlier loses to an agreeing pair", () => {
        const result = fuseNumericEvidence(
            [
                { source: "a", value: 127.8, confidence: 0.8 },
                { source: "b", value: 128.1, confidence: 0.75 },
                { source: "outlier", value: 101, confidence: 0.7 },
            ],
            { tolerance: 0.01, relative: true, precision: 1 },
        );
        expect(result.value).toBe(127.9);
        expect(result.sources).toEqual(["a", "b"]);
        expect(result.conflicted).toBe(false);
    });

    test("harmonic overlap becomes conservative on uncertain or conflicting keys", () => {
        expect(harmonicOverlapLimit(0.9)).toBe(Number.POSITIVE_INFINITY);
        expect(harmonicOverlapLimit(0.5)).toBe(6);
        expect(harmonicOverlapLimit(0.9, true)).toBe(4);
    });

    test("TrackProfile consumes fused confidence instead of a detector's raw score", () => {
        const tempo = fuseNumericEvidence(
            [
                { source: "aubio", value: 128, confidence: 0.8 },
                { source: "beatroot", value: 101, confidence: 0.75 },
            ],
            { tolerance: 0.02, relative: true },
        );
        const key = fuseCategoricalEvidence([
            { source: "essentia", value: "8A", confidence: 0.8 },
            { source: "chroma", value: "3B", confidence: 0.75 },
        ]);
        const grid: BeatGrid = {
            bpm: 128,
            beats: Array.from({ length: 32 }, (_, index) => index * (60 / 128)),
            beatInterval: 60 / 128,
            analysisOffset: 0,
            musicalEndSec: 180,
            key: { name: "A minor", camelot: "8A", confidence: 0.99 },
            analysisConfidence: { tempo, key },
            energy: { energy: 0.7, percussiveness: 0.6 },
            spectral: { centroid: 2_500, rolloff: 6_000, flatness: 0.1, flux: 0.2 },
            downbeatPhase: 0,
            introSec: 0,
        };
        const profile = buildTrackProfile({ id: "track", title: "Track", durationMs: 180_000 }, { grid, genre: "edm" });

        expect(profile.bpmConfidence).toBe(tempo.confidence);
        expect(profile.keyConfidence).toBe(key.confidence);
        expect(profile.keyConfidence).toBeLessThan(0.3);
    });
});
