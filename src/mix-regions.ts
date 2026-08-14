import type { BeatGrid } from "./beatgrid";
import type { TrackSection, TrackSectionType } from "./track-profile";
import type { TimeRegion } from "./track-profile.types";
import type { TransitionType } from "./transition-planner";

export type MixRegionSource = "section" | "beat-grid";

/** A musically coherent interval that can safely receive or release the mix. */
export interface MixRegion extends TimeRegion {
    kind: TrackSectionType;
    energyStart: number;
    energyEnd: number;
    vocals: number;
    drums: number;
    bass: number;
    mixInQuality: number;
    mixOutQuality: number;
    confidence: number;
    source: MixRegionSource;
}

export interface MixRegionSet {
    mixIn: MixRegion[];
    mixOut: MixRegion[];
}

export interface TransitionRegionSelection {
    outgoing: MixRegion;
    incoming: MixRegion;
    score: number;
    confidence: number;
    reason: string;
}

export interface BuildMixRegionsInput {
    sections: readonly TrackSection[];
    beatGrid: BeatGrid | null;
    durationSec: number;
    trackEnergy: number;
    vocalness: number;
    complexity: number;
}

export interface SelectTransitionRegionsInput {
    current: { mixOutRegions?: readonly MixRegion[]; energy: number };
    next: { mixInRegions?: readonly MixRegion[]; energy: number };
    transitionType: TransitionType;
    fadeSec: number;
    preserveStructure: number;
    vocalOverlapTolerance: number;
    targetEnergyDelta: number;
}

const HARD_ENTRY = new Set<TransitionType>(["cut", "spinback", "roll", "bassdrop", "riser"]);

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
}

function round(value: number, digits = 3): number {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function roleInBonus(kind: TrackSectionType): number {
    if (kind === "intro") return 1;
    if (kind === "break") return 0.9;
    if (kind === "drop" || kind === "build") return 0.78;
    if (kind === "unknown") return 0.52;
    return kind === "outro" ? 0.15 : 0.42;
}

function roleOutBonus(kind: TrackSectionType): number {
    if (kind === "outro") return 1;
    if (kind === "break") return 0.88;
    if (kind === "bridge" || kind === "unknown") return 0.58;
    if (kind === "drop") return 0.38;
    return kind === "intro" ? 0.12 : 0.45;
}

function sectionRegion(
    section: TrackSection,
    previous: TrackSection | undefined,
    next: TrackSection | undefined,
): MixRegion {
    const duration = Math.max(0, section.end - section.start);
    const durationQuality = clamp01(duration / 16);
    const phrase = clamp01(section.phraseConfidence * 0.6 + section.structureConfidence * 0.4);
    const energyStart = clamp01(previous ? (previous.energy + section.energy) / 2 : section.energy);
    const energyEnd = clamp01(next ? (section.energy + next.energy) / 2 : section.energy);
    const mixInQuality = clamp01(
        phrase * 0.2 +
            (1 - section.vocals) * 0.22 +
            section.drums * 0.13 +
            durationQuality * 0.1 +
            roleInBonus(section.type) * 0.2 +
            section.entryQuality * 0.15,
    );
    const mixOutQuality = clamp01(
        phrase * 0.2 +
            (1 - section.vocals) * 0.22 +
            (1 - Math.abs(energyEnd - energyStart)) * 0.1 +
            durationQuality * 0.1 +
            roleOutBonus(section.type) * 0.23 +
            section.exitQuality * 0.15,
    );
    return {
        kind: section.type,
        start: round(section.start),
        end: round(section.end),
        energyStart: round(energyStart),
        energyEnd: round(energyEnd),
        vocals: round(section.vocals),
        drums: round(section.drums),
        bass: round(section.bass),
        mixInQuality: round(mixInQuality),
        mixOutQuality: round(mixOutQuality),
        confidence: round(phrase),
        source: "section",
    };
}

function gridFallback(input: BuildMixRegionsInput): MixRegionSet {
    const grid = input.beatGrid;
    if (!grid || input.durationSec <= 0) return { mixIn: [], mixOut: [] };
    const phraseSec = Math.max(grid.beatInterval * 16, 4);
    const introEnd = Math.min(input.durationSec, Math.max(grid.introSec, phraseSec));
    const musicalEnd = Math.min(input.durationSec, Math.max(introEnd, grid.musicalEndSec || input.durationSec));
    const confidence = clamp01(0.35 + grid.energy.percussiveness * 0.3);
    const common = {
        energyStart: round(input.trackEnergy),
        energyEnd: round(input.trackEnergy),
        vocals: round(input.vocalness),
        drums: round(clamp01(grid.energy.percussiveness)),
        bass: round(clamp01(input.trackEnergy * grid.energy.percussiveness)),
        confidence: round(confidence),
        source: "beat-grid" as const,
    };
    const incoming: MixRegion = {
        ...common,
        kind: "intro",
        start: 0,
        end: round(introEnd),
        mixInQuality: round(clamp01(0.5 + (1 - input.vocalness) * 0.25 - input.complexity * 0.08)),
        mixOutQuality: 0.25,
    };
    const outgoing: MixRegion = {
        ...common,
        kind: "outro",
        start: round(Math.max(introEnd, musicalEnd - phraseSec)),
        end: round(musicalEnd),
        mixInQuality: 0.25,
        mixOutQuality: round(clamp01(0.52 + (1 - input.vocalness) * 0.25 - input.complexity * 0.08)),
    };
    return { mixIn: [incoming], mixOut: [outgoing] };
}

/** Build bounded, ranked region candidates once during TrackProfile materialization. */
export function buildMixRegions(input: BuildMixRegionsInput): MixRegionSet {
    if (!input.sections.length) return gridFallback(input);
    const regions = input.sections
        .filter((section) => section.end > section.start)
        .map((section, index, sections) => sectionRegion(section, sections[index - 1], sections[index + 1]));
    const mixIn = regions
        .filter((region) => region.kind !== "outro" || regions.length === 1)
        .sort((a, b) => b.mixInQuality - a.mixInQuality || a.start - b.start)
        .slice(0, 6);
    const mixOut = regions
        .filter((region) => region.kind !== "intro" || regions.length === 1)
        .sort((a, b) => b.mixOutQuality - a.mixOutQuality || b.end - a.end)
        .slice(0, 6);
    return {
        mixIn: mixIn.length ? mixIn : gridFallback(input).mixIn,
        mixOut: mixOut.length ? mixOut : gridFallback(input).mixOut,
    };
}

function durationFit(region: MixRegion, fadeSec: number): number {
    return clamp01((region.end - region.start) / Math.max(1, fadeSec));
}

/** Select the safest musical hand-off for this exact transition intent. */
export function selectTransitionRegions(input: SelectTransitionRegionsInput): TransitionRegionSelection | null {
    const outgoingRegions = input.current.mixOutRegions ?? [];
    const incomingRegions = input.next.mixInRegions ?? [];
    if (!outgoingRegions.length || !incomingRegions.length) return null;
    let best: TransitionRegionSelection | null = null;
    for (const outgoing of outgoingRegions) {
        for (const incoming of incomingRegions) {
            const overlapVocals = outgoing.vocals * incoming.vocals;
            const structureFit = (outgoing.confidence + incoming.confidence) / 2;
            const energyDelta = incoming.energyEnd - outgoing.energyStart;
            const energyFit = 1 - Math.min(1, Math.abs(energyDelta - input.targetEnergyDelta));
            const earlyEntry = 1 - clamp01(incoming.start / Math.max(incoming.end, 1));
            const hardEntryFit = HARD_ENTRY.has(input.transitionType)
                ? clamp01(incoming.drums * 0.65 + incoming.bass * 0.35)
                : 0.65;
            const vocalPenalty = overlapVocals * (1 - input.vocalOverlapTolerance) * 28;
            const score =
                outgoing.mixOutQuality * 24 +
                incoming.mixInQuality * 24 +
                durationFit(outgoing, input.fadeSec) * 8 +
                durationFit(incoming, input.fadeSec) * 8 +
                structureFit * input.preserveStructure * 12 +
                energyFit * 10 +
                earlyEntry * 7 +
                hardEntryFit * 7 -
                vocalPenalty;
            const confidence = clamp01(
                (outgoing.confidence + incoming.confidence + outgoing.mixOutQuality + incoming.mixInQuality) / 4,
            );
            const selection: TransitionRegionSelection = {
                outgoing,
                incoming,
                score: round(score),
                confidence: round(confidence),
                reason: `${outgoing.kind} ${outgoing.start.toFixed(1)}-${outgoing.end.toFixed(1)}s -> ${incoming.kind} ${incoming.start.toFixed(1)}-${incoming.end.toFixed(1)}s`,
            };
            if (!best || selection.score > best.score) best = selection;
        }
    }
    return best;
}
