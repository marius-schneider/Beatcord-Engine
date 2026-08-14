import { describe, expect, test } from "bun:test";
import { genomeSimilarity, trackVector } from "./genome";
import type { AnalysisRecord } from "./prefetch";

// Minimal fake grid — only the fields trackVector reads.
function rec(over: {
    bpm?: number;
    energy?: number;
    dance?: number;
    perc?: number;
    centroid?: number;
    rolloff?: number;
    flatness?: number;
    flux?: number;
    genre?: AnalysisRecord["genre"];
}): AnalysisRecord {
    return {
        filePath: "/x.opus",
        genre: over.genre ?? "edm",
        complete: true,
        grid: {
            bpm: over.bpm ?? 128,
            key: { camelot: "8A", name: "A minor", confidence: 1 },
            energy: { energy: over.energy ?? 0.7, percussiveness: over.perc ?? 0.5, danceability: over.dance ?? 2 },
            spectral: {
                centroid: over.centroid ?? 3000,
                rolloff: over.rolloff ?? 8000,
                flatness: over.flatness ?? 0.1,
                flux: over.flux ?? 0.2,
            },
        } as unknown as AnalysisRecord["grid"],
    };
}

describe("DJ genome", () => {
    test("no grid → no vector", () => {
        expect(trackVector({ filePath: "x", genre: "edm", complete: true, grid: null })).toBeNull();
        expect(trackVector(undefined)).toBeNull();
    });

    test("vector dims are all normalized 0..1", () => {
        const v = trackVector(rec({}))!;
        expect(v.length).toBe(13);
        for (const x of v) {
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThanOrEqual(1);
        }
    });

    test("identical DNA → similarity 1", () => {
        const a = trackVector(rec({}));
        expect(genomeSimilarity(a, a)).toBeCloseTo(1, 6);
    });

    test("same BPM but different feel scores far apart", () => {
        // Both 128 BPM. One bright, driving, danceable EDM; one dark, sparse chill.
        const edm = trackVector(rec({ bpm: 128, energy: 0.85, dance: 2.6, perc: 0.7, centroid: 4200, genre: "edm" }));
        const chill = trackVector(
            rec({ bpm: 128, energy: 0.25, dance: 0.6, perc: 0.2, centroid: 1400, genre: "chill" }),
        );
        const sim = genomeSimilarity(edm, chill);
        expect(sim).toBeLessThan(0.6); // same tempo, but clearly different DNA
    });

    test("similar tracks beat dissimilar ones", () => {
        const cur = trackVector(rec({ energy: 0.8, dance: 2.4, centroid: 3800, genre: "edm" }));
        const near = trackVector(rec({ energy: 0.78, dance: 2.5, centroid: 3600, genre: "edm" }));
        const far = trackVector(rec({ energy: 0.3, dance: 0.8, centroid: 1500, genre: "chill" }));
        expect(genomeSimilarity(cur, near)).toBeGreaterThan(genomeSimilarity(cur, far));
    });

    test("unknown vectors → neutral 0.5", () => {
        expect(genomeSimilarity(null, trackVector(rec({})))).toBe(0.5);
    });
});
