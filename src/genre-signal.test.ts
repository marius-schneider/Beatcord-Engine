import { describe, expect, test } from "bun:test";

import { assessGenreEvidence, genreTransitionSignal } from "./genre-signal";

const audio = (percussiveness: number, centroid: number, energy: number) => ({
    spectral: { centroid, rolloff: 6_000, flatness: 0.08, flux: 0.3 },
    percussiveness,
    bpm: 124,
    energy,
});

describe("genre as a bounded signal", () => {
    test("matching audio and metadata produce strong but bounded evidence", () => {
        const evidence = assessGenreEvidence(audio(0.6, 3_500, 0.8), "Deep House", "DJ");
        expect(evidence.genre).toBe("edm");
        expect(evidence.confidence).toBeGreaterThan(0.9);
        const signal = genreTransitionSignal(evidence, evidence, "blend");
        expect(signal.weight).toBe(0.1);
        expect(signal.contribution).toBeLessThanOrEqual(10);
    });

    test("a chill keyword cannot overrule energetic audio with high certainty", () => {
        const evidence = assessGenreEvidence(audio(0.7, 3_600, 0.9), "Ambient Chill House", "DJ");
        expect(evidence.genre).toBe("chill");
        expect(evidence.conflicted).toBe(true);
        expect(evidence.confidence).toBeLessThan(0.5);
    });

    test("unknown evidence stays near neutral for every move", () => {
        const unknown = assessGenreEvidence(null, "Track 01");
        expect(genreTransitionSignal(unknown, unknown, "cut").score).toBeCloseTo(72, 0);
        expect(genreTransitionSignal(unknown, unknown, "blend").score).toBeCloseTo(72, 0);
    });
});
