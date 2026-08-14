import type { AlbumTrackContext } from "./album-integrity";
import type { BeatGrid } from "./beatgrid";
import type { Section } from "./deep-analysis";
import { analyzeDynamicBeatgrid, type DynamicBeatgridAnalysis } from "./dynamic-beatgrid";
import type { GenreHint } from "./genre";
import type { LoudnessStats } from "./loudness";
import { buildMixRegions, type MixRegion } from "./mix-regions";
import type { AnalysisRecord } from "./prefetch";
import { identifyTrack, type TrackIdentity } from "./track-identity";
import type { TimeRegion, TrackInfo } from "./track-profile.types";

export type { TimeRegion } from "./track-profile.types";

export type TrackSectionType =
    | "intro"
    | "verse"
    | "pre-chorus"
    | "chorus"
    | "bridge"
    | "break"
    | "build"
    | "drop"
    | "outro"
    | "unknown";

export interface TrackSection extends TimeRegion {
    type: TrackSectionType;
    energy: number;
    vocals: number;
    drums: number;
    bass: number;
    entryQuality: number;
    exitQuality: number;
    phraseConfidence: number;
    structureConfidence: number;
}

export interface AnalysisConfidence {
    beatGrid: number;
    phrase: number;
    key: number;
    structure: number;
    vocals: number;
    stems: number;
    overall: number;
}

/** Canonical musical representation consumed by every director-level component. */
export interface TrackProfile {
    trackId: string;
    durationSec?: number;
    artist?: string;
    identity?: TrackIdentity;
    albumContext?: AlbumTrackContext;
    bpm: number;
    bpmConfidence: number;
    key: string;
    mode: "major" | "minor";
    keyConfidence: number;
    genres: { genre: string; confidence: number }[];
    energy: number;
    valence: number;
    danceability: number;
    acousticness: number;
    vocalness: number;
    intensity: number;
    complexity: number;
    loudness: number;
    dynamicRange: number;
    beatGrid: BeatGrid | null;
    /** Local tempo changes and the canonical bar/beat/tick timeline when a grid exists. */
    dynamicBeatgrid?: DynamicBeatgridAnalysis;
    sections: TrackSection[];
    mixInRegions?: MixRegion[];
    mixOutRegions?: MixRegion[];
    vocalRegions: TimeRegion[];
    intro?: TimeRegion;
    outro?: TimeRegion;
    drops?: TimeRegion[];
    choruses?: TimeRegion[];
    breaks?: TimeRegion[];
    confidence: AnalysisConfidence;
    provenance: Record<string, "measured" | "derived" | "metadata" | "missing">;
}

export interface BuildTrackProfileOptions {
    loudness?: LoudnessStats | null;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function finite(value: string | number | undefined, fallback: number): number {
    const number = typeof value === "number" ? value : Number.parseFloat(value ?? "");
    return Number.isFinite(number) ? number : fallback;
}

function genreConfidence(genre: GenreHint, hasGrid: boolean): number {
    if (genre === "unknown") return 0.2;
    return hasGrid ? 0.78 : 0.55;
}

function mapSection(section: Section, vocalness: number, percussiveness: number): TrackSection {
    const type: TrackSectionType = section.kind === "body" ? "unknown" : section.kind;
    const boundary = type === "intro" || type === "outro" || type === "break" ? 0.82 : 0.62;
    return {
        type,
        start: section.startSec,
        end: section.endSec,
        energy: clamp01(section.level),
        vocals: type === "intro" || type === "break" ? vocalness * 0.45 : vocalness,
        drums: clamp01(percussiveness * (type === "drop" ? 1.2 : 1)),
        bass: clamp01(section.level * percussiveness),
        entryQuality: boundary,
        exitQuality: boundary,
        phraseConfidence: 0.58,
        structureConfidence: 0.62,
    };
}

function region(section: TrackSection): TimeRegion {
    return { start: section.start, end: section.end };
}

/**
 * Consolidate the existing analysis pipeline into the roadmap's TrackProfile.
 * Features that are not measured by a dedicated model yet are conservative,
 * explicitly marked derived estimates so downstream policy can discount them.
 */
export function buildTrackProfile(
    track: Pick<
        TrackInfo,
        | "id"
        | "title"
        | "durationMs"
        | "bpm"
        | "uploader"
        | "album"
        | "albumId"
        | "discNumber"
        | "trackNumber"
        | "continuityGroup"
        | "gapless"
        | "originalGapSec"
        | "conceptAlbum"
        | "recordingId"
        | "isrc"
        | "fingerprint"
        | "version"
        | "userSelectedVersion"
    >,
    record: Pick<AnalysisRecord, "grid" | "genre" | "sections" | "vocalActivity" | "stemQuality" | "health">,
    options: BuildTrackProfileOptions = {},
): TrackProfile {
    const grid = record.grid;
    const dynamicBeatgrid = grid ? analyzeDynamicBeatgrid(grid) : null;
    const identity = identifyTrack(track);
    const energy = clamp01(grid?.energy.energy ?? 0.45);
    const percussiveness = clamp01(grid?.energy.percussiveness ?? 0.3);
    const danceability = clamp01((grid?.energy.danceability ?? percussiveness * 2.2) / 3);
    const brightness = clamp01((grid?.spectral.centroid ?? 2200) / 5000);
    const flatness = clamp01((grid?.spectral.flatness ?? 0.08) / 0.35);
    const vocalness = clamp01(record.vocalActivity?.averageDensity ?? record.stemQuality?.vocalDensity ?? 0.35);
    const acousticness = clamp01(1 - percussiveness * 0.5 - flatness * 0.3 - danceability * 0.2);
    const minor = grid?.key.name.toLowerCase().includes("minor") ?? false;
    // Audio-only valence is deliberately low-confidence: mode, brightness and
    // energy provide a useful direction without pretending to know emotion.
    const valence = clamp01(0.5 + (minor ? -0.14 : 0.12) + (brightness - 0.5) * 0.2 + (energy - 0.5) * 0.15);
    const intensity = clamp01(energy * 0.55 + percussiveness * 0.3 + danceability * 0.15);
    const complexity = clamp01(
        (record.sections?.length ?? 1) / 12 + (grid?.spectral.flux ?? 0.2) * 0.5 + vocalness * 0.2,
    );
    const derivedBeatConfidence = grid
        ? clamp01(0.45 + Math.min(grid.beats.length, 64) / 160 + percussiveness * 0.25)
        : 0;
    const beatConfidence = grid?.analysisConfidence?.tempo.confidence ?? derivedBeatConfidence;
    const keyConfidence = grid
        ? (grid.analysisConfidence?.key.confidence ?? clamp01((grid.key.confidence + 1) / 2))
        : 0;
    const structureConfidence = record.sections?.length
        ? clamp01(0.48 + Math.min(record.sections.length, 8) * 0.05)
        : 0;
    const vocalConfidence = record.vocalActivity ? 0.82 : record.stemQuality ? 0.68 : 0.2;
    const stemConfidence = record.stemQuality ? clamp01(record.stemQuality.score / 100) : 0;
    const phraseConfidence =
        grid && record.sections?.length ? clamp01(beatConfidence * 0.65 + structureConfidence * 0.35) : 0.2;
    const confidenceParts = [beatConfidence, keyConfidence, structureConfidence, vocalConfidence];
    const overall = clamp01(confidenceParts.reduce((sum, value) => sum + value, 0) / confidenceParts.length);
    const sections = (record.sections ?? []).map((section) => mapSection(section, vocalness, percussiveness));
    const vocalRegions =
        record.vocalActivity?.segments
            .filter((segment) => segment.active)
            .map((segment) => ({ start: segment.startSec, end: segment.endSec })) ?? [];
    const introSection = sections.find((section) => section.type === "intro");
    const outroSection = [...sections].reverse().find((section) => section.type === "outro");
    const drops = sections.filter((section) => section.type === "drop").map(region);
    const breaks = sections.filter((section) => section.type === "break").map(region);
    const loudness = finite(options.loudness?.input_i, -14);
    const dynamicRange = finite(options.loudness?.input_lra, 8);
    const mixRegions = buildMixRegions({
        sections,
        beatGrid: grid,
        ...(dynamicBeatgrid ? { dynamicBeatgrid } : {}),
        durationSec: track.durationMs / 1000,
        trackEnergy: energy,
        vocalness,
        complexity,
    });

    return {
        trackId: track.id,
        durationSec: track.durationMs / 1000,
        ...(track.uploader ? { artist: track.uploader } : {}),
        identity,
        ...(track.album
            ? {
                  albumContext: {
                      ...(track.albumId ? { albumId: track.albumId } : {}),
                      albumTitle: track.album,
                      ...(track.uploader ? { artist: track.uploader } : {}),
                      ...(track.discNumber ? { discNumber: track.discNumber } : {}),
                      ...(track.trackNumber ? { trackNumber: track.trackNumber } : {}),
                      ...(track.continuityGroup ? { continuityGroup: track.continuityGroup } : {}),
                      ...(track.gapless !== undefined ? { gapless: track.gapless } : {}),
                      ...(track.originalGapSec !== undefined && track.originalGapSec !== null
                          ? { originalGapSec: track.originalGapSec }
                          : {}),
                      ...(track.conceptAlbum !== undefined ? { conceptAlbum: track.conceptAlbum } : {}),
                  },
              }
            : {}),
        bpm: grid?.bpm ?? track.bpm ?? 0,
        bpmConfidence: beatConfidence,
        key: grid?.key.name ?? "unknown",
        mode: minor ? "minor" : "major",
        keyConfidence,
        genres: [{ genre: record.genre, confidence: genreConfidence(record.genre, !!grid) }],
        energy,
        valence,
        danceability,
        acousticness,
        vocalness,
        intensity,
        complexity,
        loudness,
        dynamicRange,
        beatGrid: grid,
        sections,
        mixInRegions: mixRegions.mixIn,
        mixOutRegions: mixRegions.mixOut,
        vocalRegions,
        ...(introSection
            ? { intro: region(introSection) }
            : grid?.introSec
              ? { intro: { start: 0, end: grid.introSec } }
              : {}),
        ...(outroSection
            ? { outro: region(outroSection) }
            : grid && grid.musicalEndSec < track.durationMs / 1000
              ? { outro: { start: grid.musicalEndSec, end: track.durationMs / 1000 } }
              : {}),
        ...(drops.length ? { drops } : {}),
        ...(breaks.length ? { breaks } : {}),
        confidence: {
            beatGrid: beatConfidence,
            phrase: phraseConfidence,
            key: keyConfidence,
            structure: structureConfidence,
            vocals: vocalConfidence,
            stems: stemConfidence,
            overall,
        },
        provenance: {
            bpm: grid ? "measured" : track.bpm ? "metadata" : "missing",
            key: grid ? "measured" : "missing",
            genre: grid ? "derived" : "metadata",
            energy: grid ? "measured" : "missing",
            valence: "derived",
            danceability: grid?.energy.danceability === undefined ? "derived" : "measured",
            acousticness: "derived",
            vocalness: record.vocalActivity || record.stemQuality ? "measured" : "derived",
            loudness: options.loudness ? "measured" : "missing",
            structure: record.sections ? "measured" : "missing",
        },
    };
}
