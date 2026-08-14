import type {
    GoldenMixCase,
    GoldenMixExpectation,
    GoldenTrackGroundTruth,
} from "../../src/golden-mix-benchmark";
import type { TrackSection, TrackSectionType } from "../../src/track-profile";

export interface TrackSeed {
    id: string;
    title: string;
    durationSec?: number;
    bpm: number;
    camelot: string;
    energy: number;
    danceability: number;
    acousticness?: number;
    valence?: number;
    vocalness?: number;
    complexity?: number;
    confidence?: number;
    downbeatOffset?: number;
    introSec?: number;
    outroSec?: number;
    sections?: TrackSection[];
    vocalRegions?: { start: number; end: number }[];
}

export function section(
    type: TrackSectionType,
    start: number,
    end: number,
    energy: number,
    vocals: number,
    drums: number,
    bass = drums * 0.8,
): TrackSection {
    const boundary = type === "intro" || type === "outro" || type === "break" ? 0.9 : 0.78;
    return {
        type,
        start,
        end,
        energy,
        vocals,
        drums,
        bass: Math.min(1, bass),
        entryQuality: boundary,
        exitQuality: boundary,
        phraseConfidence: 0.9,
        structureConfidence: 0.9,
    };
}

function boundaries(durationSec: number, bpm: number, beats: number, offset: number): number[] {
    const seconds = (60 / bpm) * beats;
    const result: number[] = [];
    for (let time = offset; time <= durationSec; time += seconds) result.push(Math.round(time * 1_000) / 1_000);
    return result;
}

export function goldenTrack(seed: TrackSeed): GoldenTrackGroundTruth {
    const durationSec = seed.durationSec ?? 192;
    const vocalness = seed.vocalness ?? 0.25;
    const introSec = seed.introSec ?? 16;
    const outroSec = seed.outroSec ?? 16;
    const drums = Math.min(1, seed.danceability * 0.9);
    const sections =
        seed.sections ??
        [
            section("intro", 0, introSec, seed.energy * 0.55, vocalness * 0.15, drums * 0.75),
            section("unknown", introSec, durationSec - outroSec, seed.energy, vocalness, drums),
            section("outro", durationSec - outroSec, durationSec, seed.energy * 0.55, vocalness * 0.15, drums * 0.7),
        ];
    const offset = seed.downbeatOffset ?? 0;
    return {
        id: seed.id,
        title: seed.title,
        durationSec,
        bpm: seed.bpm,
        camelot: seed.camelot,
        energy: seed.energy,
        danceability: seed.danceability,
        acousticness: seed.acousticness ?? Math.max(0.05, 1 - seed.energy * 0.65 - seed.danceability * 0.25),
        valence: seed.valence ?? 0.58,
        vocalness,
        complexity: seed.complexity ?? 0.5,
        confidence: seed.confidence ?? 0.9,
        downbeats: boundaries(durationSec, seed.bpm, 4, offset),
        phraseBoundaries: boundaries(durationSec, seed.bpm, 16, offset),
        sections,
        vocalRegions:
            seed.vocalRegions ??
            (vocalness >= 0.45 ? [{ start: introSec, end: Math.max(introSec + 1, durationSec - outroSec) }] : []),
    };
}

export function goldenCase(input: {
    id: string;
    difficulty: GoldenMixCase["difficulty"];
    description: string;
    current: TrackSeed;
    next: TrackSeed;
    expected: GoldenMixExpectation;
    panelRating: number;
    notes: string;
}): GoldenMixCase {
    return {
        version: 1,
        id: input.id,
        difficulty: input.difficulty,
        description: input.description,
        current: goldenTrack(input.current),
        next: goldenTrack(input.next),
        expected: input.expected,
        subjective: { panelRating: input.panelRating, notes: input.notes },
    };
}
