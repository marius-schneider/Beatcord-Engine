import type { TrackProfile, TrackSection, TrackSectionType } from "./track-profile";

export interface SectionImportance {
    sectionIndex: number;
    type: TrackSectionType;
    start: number;
    end: number;
    recognition: number;
    emotionalImportance: number;
    structuralImportance: number;
    transitionUtility: number;
    mustPlayScore: number;
    shouldMixAfterScore: number;
}

const RECOGNITION: Record<TrackSectionType, number> = {
    intro: 0.2,
    verse: 0.5,
    "pre-chorus": 0.62,
    chorus: 0.91,
    bridge: 0.66,
    break: 0.48,
    build: 0.7,
    drop: 0.93,
    outro: 0.28,
    unknown: 0.42,
};

const STRUCTURAL: Record<TrackSectionType, number> = {
    intro: 0.45,
    verse: 0.58,
    "pre-chorus": 0.75,
    chorus: 0.94,
    bridge: 0.72,
    break: 0.55,
    build: 0.82,
    drop: 0.96,
    outro: 0.42,
    unknown: 0.5,
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

function score(section: TrackSection, sectionIndex: number, sections: readonly TrackSection[]): SectionImportance {
    const sameType = sections.filter((candidate) => candidate.type === section.type);
    const occurrence = sameType.indexOf(section);
    const finalRepeatBonus = sameType.length > 1 && occurrence === sameType.length - 1 ? 0.06 : 0;
    const recognition = clamp01(RECOGNITION[section.type] + finalRepeatBonus);
    const emotionalImportance = clamp01(section.energy * 0.48 + section.vocals * 0.34 + recognition * 0.18);
    const structuralImportance = STRUCTURAL[section.type];
    const transitionUtility = clamp01(
        section.exitQuality * 0.5 +
            (1 - section.vocals) * 0.22 +
            section.phraseConfidence * 0.18 +
            (section.type === "outro" ? 0.1 : 0),
    );
    const mustPlayScore = clamp01(recognition * 0.36 + emotionalImportance * 0.28 + structuralImportance * 0.36);
    return {
        sectionIndex,
        type: section.type,
        start: section.start,
        end: section.end,
        recognition: round(recognition),
        emotionalImportance: round(emotionalImportance),
        structuralImportance: round(structuralImportance),
        transitionUtility: round(transitionUtility),
        mustPlayScore: round(mustPlayScore),
        shouldMixAfterScore: round(transitionUtility * (1 - mustPlayScore * 0.72)),
    };
}

export function scoreSectionImportance(profile: Pick<TrackProfile, "sections">): SectionImportance[] {
    return profile.sections.map((section, index, sections) => score(section, index, sections));
}
