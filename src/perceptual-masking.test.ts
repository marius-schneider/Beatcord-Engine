import { expect, test } from "bun:test";

import { assessPerceptualMasking } from "./perceptual-masking";
import type { TrackProfile, TrackSection } from "./track-profile";

function section(start: number, end: number, values: Partial<TrackSection> = {}): TrackSection {
    return {
        type: "unknown",
        start,
        end,
        energy: 0.6,
        vocals: 0.2,
        drums: 0.6,
        bass: 0.5,
        entryQuality: 0.8,
        exitQuality: 0.8,
        phraseConfidence: 0.9,
        structureConfidence: 0.9,
        ...values,
    };
}

function profile(id: string, sections: TrackSection[], overrides: Partial<TrackProfile> = {}): TrackProfile {
    return {
        trackId: id,
        bpm: 124,
        bpmConfidence: 0.9,
        key: "A minor",
        mode: "minor",
        keyConfidence: 0.9,
        genres: [{ genre: "edm", confidence: 0.9 }],
        energy: 0.7,
        valence: 0.5,
        danceability: 0.8,
        acousticness: 0.1,
        vocalness: 0.3,
        intensity: 0.75,
        complexity: 0.55,
        loudness: -10,
        dynamicRange: 8,
        beatGrid: null,
        sections,
        vocalRegions: [],
        confidence: { beatGrid: 0.9, phrase: 0.9, key: 0.9, structure: 0.9, vocals: 0.9, stems: 0, overall: 0.9 },
        provenance: {},
        ...overrides,
    };
}

test("perceptual masking detects vocal and low-end ownership collisions", () => {
    const current = profile("a", [section(0, 180, { type: "chorus", vocals: 0.95, bass: 0.9, drums: 0.8 })]);
    const next = profile("b", [section(0, 180, { type: "chorus", vocals: 0.95, bass: 0.9, drums: 0.8 })]);
    const result = assessPerceptualMasking({
        current,
        next,
        currentDurationSec: 180,
        overlapSec: 12,
        transitionType: "acapella",
    });
    expect(result.vocalCollision).toBeGreaterThan(0.9);
    expect(result.foregroundCollision).toBeGreaterThan(0.9);
    expect(result.risk).toBeGreaterThan(0.6);
    expect(result.recommendation).not.toBe("clear");
    expect(result.reasons.join(" ")).toContain("vocal collision");
});

test("bass swap exposes less low-end conflict than an unstructured blend", () => {
    const current = profile("a", [section(0, 180, { bass: 0.95, vocals: 0.1 })]);
    const next = profile("b", [section(0, 180, { bass: 0.95, vocals: 0.1 })]);
    const common = { current, next, currentDurationSec: 180, overlapSec: 10 } as const;
    const blend = assessPerceptualMasking({ ...common, transitionType: "blend" });
    const swap = assessPerceptualMasking({ ...common, transitionType: "bassdrop" });
    expect(swap.bassCompetition).toBeLessThan(blend.bassCompetition * 0.4);
    expect(swap.risk).toBeLessThan(blend.risk);
});

test("a clean instrumental handoff remains low risk", () => {
    const current = profile("a", [section(0, 180, { type: "outro", vocals: 0.05, bass: 0.15, drums: 0.2 })]);
    const next = profile("b", [section(0, 180, { type: "intro", vocals: 0.05, bass: 0.2, drums: 0.25 })]);
    const result = assessPerceptualMasking({
        current,
        next,
        currentDurationSec: 180,
        overlapSec: 8,
        transitionType: "blend",
    });
    expect(result.risk).toBeLessThan(0.25);
    expect(result.recommendation).toBe("clear");
    expect(result.reasons[0]).toContain("clear role handoff");
});
