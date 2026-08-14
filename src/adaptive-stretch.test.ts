import { expect, test } from "bun:test";

import { classifyStretchMaterial, decideAdaptiveStretch } from "./adaptive-stretch";
import { tempoStretchFilter } from "./constants";
import type { TrackProfile } from "./track-profile";

function profile(overrides: Partial<TrackProfile> = {}): TrackProfile {
    return {
        trackId: "track",
        bpm: 124,
        bpmConfidence: 0.9,
        key: "A minor",
        mode: "minor",
        keyConfidence: 0.9,
        genres: [{ genre: "edm", confidence: 0.9 }],
        energy: 0.72,
        valence: 0.5,
        danceability: 0.75,
        acousticness: 0.1,
        vocalness: 0.2,
        intensity: 0.78,
        complexity: 0.5,
        loudness: -10,
        dynamicRange: 8,
        beatGrid: null,
        sections: [],
        vocalRegions: [],
        confidence: { beatGrid: 0.9, phrase: 0.9, key: 0.9, structure: 0.8, vocals: 0.8, stems: 0, overall: 0.85 },
        provenance: {},
        ...overrides,
    };
}

test("adaptive stretch routes drum material to crisp short-window processing", () => {
    const track = profile();
    expect(classifyStretchMaterial(track)).toBe("drums");
    const decision = decideAdaptiveStretch(track, 1.04);
    expect(decision.allowed).toBe(true);
    expect(decision.tuning.detector).toBe("percussive");
    expect(decision.tuning.window).toBe("short");
    const filter = tempoStretchFilter(decision.appliedRatio, "rubberband", decision.tuning);
    expect(filter).toContain("transients=crisp:detector=percussive");
    expect(filter).toContain("window=short");
});

test("adaptive stretch preserves vocal formants and reports material-specific risk", () => {
    const decision = decideAdaptiveStretch(profile({ vocalness: 0.9, danceability: 0.45 }), 0.95);
    expect(decision.material).toBe("vocals");
    expect(decision.preserveFormants).toBe(true);
    expect(decision.risk.vocalFormant).toBeGreaterThan(0.2);
    expect(decision.tuning.transients).toBe("mixed");
});

test("adaptive stretch rejects heroic tempo manipulation", () => {
    const decision = decideAdaptiveStretch(profile(), 1.15);
    expect(decision.allowed).toBe(false);
    expect(decision.appliedRatio).toBe(1);
    expect(decision.algorithm).toBe("none");
    expect(decision.reason).toContain("exceeds safe");
});

test("adaptive stretch applies a tighter bound to bass-heavy material", () => {
    const bass = profile({ energy: 0.9, danceability: 0.62, intensity: 0.55, vocalness: 0.1 });
    const decision = decideAdaptiveStretch(bass, 1.06);
    expect(decision.material).toBe("bass");
    expect(decision.allowed).toBe(false);
    expect(decision.appliedRatio).toBe(1);
    expect(decision.reason).toContain("safe 5.5% bound");
});
