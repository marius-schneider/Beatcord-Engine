import { expect, test } from "bun:test";

import type { BeatGrid } from "./beatgrid";
import { buildMixRegions, type MixRegion, selectTransitionRegions } from "./mix-regions";
import type { TrackSection } from "./track-profile";

function section(type: TrackSection["type"], start: number, end: number, energy: number, vocals: number): TrackSection {
    return {
        type,
        start,
        end,
        energy,
        vocals,
        drums: type === "drop" ? 0.95 : 0.5,
        bass: type === "drop" ? 0.9 : 0.45,
        entryQuality: 0.8,
        exitQuality: 0.8,
        phraseConfidence: 0.9,
        structureConfidence: 0.85,
    };
}

function region(overrides: Partial<MixRegion>): MixRegion {
    return {
        kind: "unknown",
        start: 0,
        end: 16,
        energyStart: 0.5,
        energyEnd: 0.5,
        vocals: 0.1,
        drums: 0.6,
        bass: 0.5,
        mixInQuality: 0.7,
        mixOutQuality: 0.7,
        confidence: 0.8,
        source: "section",
        ...overrides,
    };
}

test("materializes intro/outro sections as rich mix regions", () => {
    const result = buildMixRegions({
        sections: [
            section("intro", 0, 16, 0.25, 0.05),
            section("drop", 16, 48, 0.9, 0.5),
            section("outro", 48, 72, 0.35, 0.08),
        ],
        beatGrid: null,
        durationSec: 72,
        trackEnergy: 0.65,
        vocalness: 0.3,
        complexity: 0.5,
    });

    const intro = result.mixIn.find((candidate) => candidate.kind === "intro");
    const outro = result.mixOut.find((candidate) => candidate.kind === "outro");
    expect(intro?.mixInQuality).toBeGreaterThan(0.75);
    expect(outro?.mixOutQuality).toBeGreaterThan(0.75);
    expect(outro?.energyStart).toBeGreaterThan(outro?.energyEnd ?? 1);
});

test("creates conservative phrase-sized regions from a beat grid when structure is missing", () => {
    const grid = {
        beatInterval: 0.5,
        introSec: 4,
        musicalEndSec: 100,
        energy: { energy: 0.6, percussiveness: 0.7 },
    } as BeatGrid;
    const result = buildMixRegions({
        sections: [],
        beatGrid: grid,
        durationSec: 105,
        trackEnergy: 0.6,
        vocalness: 0.2,
        complexity: 0.4,
    });

    expect(result.mixIn[0]).toMatchObject({ start: 0, end: 8, source: "beat-grid" });
    expect(result.mixOut[0]).toMatchObject({ start: 92, end: 100, source: "beat-grid" });
});

test("pair selection avoids a vocal collision even when the exposed chorus has a high raw quality", () => {
    const selection = selectTransitionRegions({
        current: {
            energy: 0.7,
            mixOutRegions: [
                region({ kind: "chorus", start: 80, end: 112, vocals: 0.95, mixOutQuality: 0.95 }),
                region({ kind: "outro", start: 112, end: 144, vocals: 0.05, mixOutQuality: 0.78 }),
            ],
        },
        next: { energy: 0.72, mixInRegions: [region({ kind: "intro", vocals: 0.8, mixInQuality: 0.82 })] },
        transitionType: "blend",
        fadeSec: 12,
        preserveStructure: 0.9,
        vocalOverlapTolerance: 0.1,
        targetEnergyDelta: 0.05,
    });

    expect(selection?.outgoing.kind).toBe("outro");
    expect(selection?.reason).toContain("outro");
});
