import type { TrackProfile, TrackSection, TrackSectionType } from "./track-profile";

export interface MusicalTension {
    energy: number;
    tension: number;
    anticipation: number;
    resolution: number;
}

export interface MusicalTensionSection extends MusicalTension {
    sectionIndex: number;
    type: TrackSectionType;
    start: number;
    end: number;
}

export interface PayoffCutAssessment {
    cutSec: number;
    blocked: boolean;
    anticipation: number;
    payoffSection: number | null;
    payoffAtSec: number | null;
    waitSec: number | null;
    reason: string;
}

const ANTICIPATION: Partial<Record<TrackSectionType, number>> = {
    build: 0.96,
    "pre-chorus": 0.9,
    break: 0.72,
    bridge: 0.58,
};
const RESOLUTION: Partial<Record<TrackSectionType, number>> = { drop: 0.94, chorus: 0.88, outro: 0.62 };
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

function tensionFor(section: TrackSection, next?: TrackSection): MusicalTension {
    const anticipation = clamp01(
        (ANTICIPATION[section.type] ?? 0.2) +
            (next && next.energy > section.energy ? (next.energy - section.energy) * 0.18 : 0),
    );
    const resolution = clamp01(RESOLUTION[section.type] ?? (next && next.energy < section.energy ? 0.45 : 0.12));
    const forwardContrast = next ? Math.max(0, next.energy - section.energy) : 0;
    const tension = clamp01(anticipation * 0.68 + forwardContrast * 0.24 + section.drums * 0.08 - resolution * 0.25);
    return {
        energy: round(section.energy),
        tension: round(tension),
        anticipation: round(anticipation),
        resolution: round(resolution),
    };
}

export function analyzeMusicalTension(profile: Pick<TrackProfile, "sections">): MusicalTensionSection[] {
    return profile.sections.map((section, sectionIndex, sections) => ({
        sectionIndex,
        type: section.type,
        start: section.start,
        end: section.end,
        ...tensionFor(section, sections[sectionIndex + 1]),
    }));
}

/** Refuse a cut when an imminent drop/chorus is carrying a strong unresolved promise. */
export function assessPayoffCut(
    profile: Pick<TrackProfile, "sections">,
    cutSec: number,
    maxWaitSec = 24,
): PayoffCutAssessment {
    const tension = analyzeMusicalTension(profile);
    const current = tension.find((section) => cutSec >= section.start && cutSec < section.end);
    if (!current) {
        return {
            cutSec,
            blocked: false,
            anticipation: 0,
            payoffSection: null,
            payoffAtSec: null,
            waitSec: null,
            reason: "cut is outside analyzed sections",
        };
    }
    const payoff = tension.find(
        (section) =>
            section.sectionIndex > current.sectionIndex &&
            section.resolution >= 0.75 &&
            section.start - cutSec <= maxWaitSec,
    );
    const waitSec = payoff ? Math.max(0, payoff.end - cutSec) : null;
    const blocked = current.anticipation >= 0.85 && payoff !== undefined;
    return {
        cutSec,
        blocked,
        anticipation: current.anticipation,
        payoffSection: payoff?.sectionIndex ?? null,
        payoffAtSec: payoff?.end ?? null,
        waitSec: waitSec === null ? null : round(waitSec),
        reason: blocked
            ? `${current.type} anticipation ${current.anticipation.toFixed(2)} resolves through ${payoff!.type}`
            : `no imminent high-anticipation payoff at ${cutSec.toFixed(1)}s`,
    };
}
