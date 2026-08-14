import { analyzeDynamicBeatgrid, type DynamicBeatgridAnalysis } from "./dynamic-beatgrid";
import { buildSharedMusicAnalysis, type SharedMusicAnalysis } from "./multi-task-analysis";
import { type MusicalTime, secondsToMusicalTime } from "./musical-timeline";
import { type SectionImportance, scoreSectionImportance } from "./section-importance";
import {
    assessStructuralCut,
    inferStructuralDependencies,
    type StructuralCutAssessment,
    type StructuralDependency,
} from "./structural-dependencies";
import type { TrackProfile } from "./track-profile";

export interface TrackJourneyIntelligence {
    trackId: string;
    timeline: DynamicBeatgridAnalysis | null;
    transitionTime: MusicalTime | null;
    sharedAnalysis: SharedMusicAnalysis;
    sectionImportance: SectionImportance[];
    structuralDependencies: StructuralDependency[];
    structuralCut: StructuralCutAssessment;
}

export interface JourneyIntelligence {
    version: 1;
    current: TrackJourneyIntelligence;
    next: TrackJourneyIntelligence;
}

function analyzeTrack(profile: TrackProfile, transitionSec: number): TrackJourneyIntelligence {
    const timeline = profile.dynamicBeatgrid ?? (profile.beatGrid ? analyzeDynamicBeatgrid(profile.beatGrid) : null);
    const structuralDependencies = inferStructuralDependencies(profile);
    return {
        trackId: profile.trackId,
        timeline,
        transitionTime: timeline ? secondsToMusicalTime(timeline.tempoMap, transitionSec) : null,
        sharedAnalysis: buildSharedMusicAnalysis(profile),
        sectionImportance: scoreSectionImportance(profile),
        structuralDependencies,
        structuralCut: assessStructuralCut(profile, structuralDependencies, transitionSec),
    };
}

/** Pair-level view of the shared musical timeline, analysis frame and structure graph. */
export function buildJourneyIntelligence(
    current: TrackProfile,
    next: TrackProfile,
    currentTransitionSec: number,
    nextTransitionSec: number,
): JourneyIntelligence {
    return {
        version: 1,
        current: analyzeTrack(current, currentTransitionSec),
        next: analyzeTrack(next, nextTransitionSec),
    };
}
