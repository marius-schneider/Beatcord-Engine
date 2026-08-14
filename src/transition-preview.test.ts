import { expect, test } from "bun:test";

import type { BeatGrid } from "./beatgrid";
import type { MixRegion } from "./mix-regions";
import type { TrackProfile, TrackSection } from "./track-profile";
import type { TrackTraits } from "./transition-planner";
import { buildTransitionPreview } from "./transition-preview";

function grid(bpm: number, camelot: string): BeatGrid {
    return {
        bpm,
        beats: [0, 60 / bpm],
        beatInterval: 60 / bpm,
        analysisOffset: 0,
        musicalEndSec: 180,
        key: { name: camelot, camelot, confidence: 0.9 },
        energy: { energy: 0.82, percussiveness: 0.72, danceability: 2.5 },
        spectral: { centroid: 3_400, rolloff: 7_200, flatness: 0.1, flux: 0.38 },
        downbeatPhase: 0,
        introSec: 8,
    };
}

function region(kind: MixRegion["kind"], start: number, end: number, vocals = 0.1): MixRegion {
    return {
        kind,
        start,
        end,
        energyStart: 0.65,
        energyEnd: 0.72,
        vocals,
        drums: 0.72,
        bass: 0.68,
        mixInQuality: 0.82,
        mixOutQuality: 0.82,
        confidence: 0.9,
        source: "section",
    };
}

function section(type: TrackSection["type"], start: number, end: number, vocals = 0.1): TrackSection {
    return {
        type,
        start,
        end,
        energy: 0.72,
        vocals,
        drums: 0.72,
        bass: 0.68,
        entryQuality: 0.85,
        exitQuality: 0.85,
        phraseConfidence: 0.9,
        structureConfidence: 0.9,
    };
}

function profile(id: string, beatGrid: BeatGrid, confidence = 0.9, vocals = 0.1): TrackProfile {
    return {
        trackId: id,
        bpm: beatGrid.bpm,
        bpmConfidence: confidence,
        key: beatGrid.key.name,
        mode: "minor",
        keyConfidence: confidence,
        genres: [{ genre: "edm", confidence }],
        energy: 0.8,
        valence: 0.6,
        danceability: 0.84,
        acousticness: 0.12,
        vocalness: vocals,
        intensity: 0.78,
        complexity: 0.5,
        loudness: -10,
        dynamicRange: 8,
        beatGrid,
        sections: [
            section("intro", 0, 24, vocals),
            section("unknown", 24, 156, vocals),
            section("outro", 156, 180, vocals),
        ],
        mixInRegions: [region("intro", 0, 24, vocals)],
        mixOutRegions: [region("outro", 156, 180, vocals)],
        vocalRegions: [],
        confidence: {
            beatGrid: confidence,
            phrase: confidence,
            key: confidence,
            structure: confidence,
            vocals: confidence,
            stems: 0,
            overall: confidence,
        },
        provenance: {},
    };
}

function traits(title: string, beatGrid: BeatGrid): TrackTraits {
    return { title, uploader: "Artist", grid: beatGrid, durationMs: 190_000 };
}

test("transition preview produces deterministic, distinct A/B variants and a valid recommendation", () => {
    const aGrid = grid(128, "8A");
    const bGrid = grid(126, "8A");
    const input = [traits("A", aGrid), traits("B", bGrid), profile("a", aGrid), profile("b", bGrid)] as const;
    const options = { fadeSec: 8, maxFadeSec: 14, tempoTolerance: 0.08, now: () => 123 };
    const first = buildTransitionPreview(...input, options);
    const second = buildTransitionPreview(...input, options);

    expect(first).toEqual(second);
    expect(first.variants.length).toBeGreaterThanOrEqual(2);
    expect(first.variants.length).toBeLessThanOrEqual(3);
    expect(new Set(first.variants.map((variant) => variant.plan.type)).size).toBe(first.variants.length);
    expect(first.variants.some((variant) => variant.id === first.recommendedVariantId)).toBe(true);
    expect(first.variants[0]?.id).toBe(first.recommendedVariantId);
    expect(
        first.variants.every((variant) => variant.metrics.artifactRisk >= 0 && variant.metrics.artifactRisk <= 100),
    ).toBe(true);
});

test("low-confidence previews do not offer heroic impact transitions", () => {
    const aGrid = grid(128, "8A");
    const bGrid = grid(128, "8A");
    const preview = buildTransitionPreview(
        traits("A", aGrid),
        traits("B", bGrid),
        profile("a", aGrid, 0.22),
        profile("b", bGrid, 0.22),
        { fadeSec: 8, maxFadeSec: 14, tempoTolerance: 0.08 },
    );
    expect(preview.variants.length).toBeGreaterThanOrEqual(2);
    expect(preview.variants.every((variant) => ["fade", "blend", "echo"].includes(variant.plan.type))).toBe(true);
});

test("preview metrics expose increased collision risk for vocal-dense material", () => {
    const aGrid = grid(124, "8A");
    const bGrid = grid(124, "8A");
    const common = [traits("A", aGrid), traits("B", bGrid)] as const;
    const options = { fadeSec: 10, maxFadeSec: 14, tempoTolerance: 0.08 };
    const clean = buildTransitionPreview(...common, profile("a", aGrid), profile("b", bGrid), options);
    const dense = buildTransitionPreview(
        ...common,
        profile("a", aGrid, 0.9, 0.95),
        profile("b", bGrid, 0.9, 0.95),
        options,
    );
    const averageRisk = (preview: typeof clean) =>
        preview.variants.reduce((sum, variant) => sum + variant.metrics.artifactRisk, 0) / preview.variants.length;
    expect(averageRisk(dense)).toBeGreaterThan(averageRisk(clean));
});
