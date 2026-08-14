import type { TrackProfile, TrackSection } from "./track-profile";

export interface Loopability {
    sectionIndex: number;
    start: number;
    end: number;
    beatStability: number;
    harmonicStability: number;
    vocalSafety: number;
    boundarySimilarity: number;
    energyStability: number;
    total: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

function boundarySimilarity(section: TrackSection, previous?: TrackSection, next?: TrackSection): number {
    const entry = previous ? (previous.energy + section.energy) / 2 : section.energy;
    const exit = next ? (next.energy + section.energy) / 2 : section.energy;
    return clamp01(1 - Math.abs(entry - exit));
}

/** Beat-perfect is necessary but insufficient: score musical seam safety as well. */
export function scoreLoopability(profile: TrackProfile, sectionIndex: number): Loopability {
    const section = profile.sections[sectionIndex];
    if (!section) throw new Error(`Unknown section index ${sectionIndex}`);
    const previous = profile.sections[sectionIndex - 1];
    const next = profile.sections[sectionIndex + 1];
    const beatStability = clamp01(profile.confidence.beatGrid * 0.65 + section.phraseConfidence * 0.35);
    const harmonicStability = clamp01(profile.keyConfidence * 0.7 + (1 - profile.complexity) * 0.3);
    const vocalSafety = clamp01(1 - section.vocals);
    const boundary = boundarySimilarity(section, previous, next);
    const neighborMean = previous && next ? (previous.energy + next.energy) / 2 : section.energy;
    const energyStability = clamp01(1 - Math.abs(section.energy - neighborMean));
    const total =
        beatStability * 0.26 + harmonicStability * 0.18 + vocalSafety * 0.24 + boundary * 0.18 + energyStability * 0.14;
    return {
        sectionIndex,
        start: section.start,
        end: section.end,
        beatStability: round(beatStability),
        harmonicStability: round(harmonicStability),
        vocalSafety: round(vocalSafety),
        boundarySimilarity: round(boundary),
        energyStability: round(energyStability),
        total: round(total),
    };
}

export function selectSafeLoop(profile: TrackProfile, beforeSec = Number.POSITIVE_INFINITY): Loopability | null {
    return (
        profile.sections
            .map((_, index) => scoreLoopability(profile, index))
            .filter((loop) => loop.start < beforeSec && loop.end - loop.start >= 4 && loop.vocalSafety >= 0.55)
            .sort((a, b) => b.total - a.total || b.end - a.end)[0] ?? null
    );
}
