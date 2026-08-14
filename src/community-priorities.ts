import type { SessionJourneyPlan } from "./session-journey";
import { scoreJourneyAlignment } from "./session-journey";

export interface CommunityPriorityInput {
    complexity: number;
    confidence: number;
    compatibility: number;
    routeFutureScore: number;
    beat: number;
    downbeat: number;
    phrase: number;
    structure: number;
    vocals: number;
    candidateEnergy: number;
    journey: SessionJourneyPlan;
}

/** Auditable implementation of the five community-derived product priorities. */
export interface CommunityPriorityAssessment {
    version: 1;
    trackSelection: number;
    musicalMoment: number;
    confidenceOverComplexity: number;
    structureOverCrossfade: number;
    arrangementSafety: number;
    sessionJourney: number;
    overall: number;
    eligible: boolean;
    fixedTimestampFallback: boolean;
    reasons: string[];
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const round = (value: number, digits = 3) => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

function weightedOverall(assessment: Omit<CommunityPriorityAssessment, "overall" | "eligible" | "reasons">): number {
    return clamp01(
        assessment.trackSelection * 0.2 +
            assessment.musicalMoment * 0.2 +
            assessment.confidenceOverComplexity * 0.18 +
            assessment.structureOverCrossfade * 0.15 +
            assessment.arrangementSafety * 0.12 +
            assessment.sessionJourney * 0.15,
    );
}

/**
 * Evaluate a transition candidate against the hierarchy learned from recurring
 * Auto-DJ failure reports. Values are normalized to 0..1 and remain replayable.
 */
export function assessCommunityPriorities(input: CommunityPriorityInput): CommunityPriorityAssessment {
    const complexity = clamp01(input.complexity);
    const trackSelection = clamp01(input.compatibility * 0.7 + input.routeFutureScore * 0.3);
    const musicalMoment = clamp01(
        (input.phrase / 100) * 0.45 + (input.downbeat / 100) * 0.35 + (input.beat / 100) * 0.2,
    );
    const confidenceOverComplexity = clamp01(input.confidence + (1 - complexity) * 0.32 - complexity * 0.18);
    const structureOverCrossfade = clamp01(input.structure / 100);
    const arrangementSafety = clamp01(input.vocals / 100);
    const sessionJourney = scoreJourneyAlignment(input.journey, input.candidateEnergy, input.routeFutureScore).score;
    const base = {
        version: 1 as const,
        trackSelection: round(trackSelection),
        musicalMoment: round(musicalMoment),
        confidenceOverComplexity: round(confidenceOverComplexity),
        structureOverCrossfade: round(structureOverCrossfade),
        arrangementSafety: round(arrangementSafety),
        sessionJourney: round(sessionJourney),
        fixedTimestampFallback: false,
    };
    const overall = round(weightedOverall(base));
    const blockers: string[] = [];
    if (complexity >= 0.62 && confidenceOverComplexity < 0.55) blockers.push("confidence cannot support complexity");
    if (complexity >= 0.62 && musicalMoment < 0.48) blockers.push("musical moment too weak for a complex move");
    if (complexity >= 0.62 && structureOverCrossfade < 0.4) blockers.push("structure too weak for a complex move");
    if (complexity >= 0.62 && arrangementSafety < 0.38) blockers.push("arrangement conflict too high");
    return {
        ...base,
        overall,
        eligible: blockers.length === 0,
        reasons: [
            `track selection ${trackSelection.toFixed(2)} > transition trick`,
            `musical moment ${musicalMoment.toFixed(2)} > fixed timestamp`,
            `confidence/complexity ${confidenceOverComplexity.toFixed(2)}`,
            `structure ${structureOverCrossfade.toFixed(2)}, arrangement ${arrangementSafety.toFixed(2)}`,
            `session journey ${sessionJourney.toFixed(2)} > isolated pair`,
            ...blockers,
        ],
    };
}

const GRID_SCORE: Record<string, number> = { phrase: 1, bar: 0.84, beat: 0.62, target: 0.3, start: 0.24 };

/** Replace proxy moment evidence with the cue that will actually be played. */
export function finalizeCommunityPriorities(
    assessment: CommunityPriorityAssessment,
    cue: { aGrid: string; bGrid: string },
    regionConfidence?: number | null,
): CommunityPriorityAssessment {
    const boundary = ((GRID_SCORE[cue.aGrid] ?? 0.2) + (GRID_SCORE[cue.bGrid] ?? 0.2)) / 2;
    const region = regionConfidence == null ? boundary : clamp01(regionConfidence);
    const musicalMoment = clamp01(assessment.musicalMoment * 0.45 + boundary * 0.35 + region * 0.2);
    const fixedTimestampFallback = [cue.aGrid, cue.bGrid].some((kind) => kind === "target" || kind === "start");
    const base = { ...assessment, musicalMoment: round(musicalMoment), fixedTimestampFallback };
    return {
        ...base,
        overall: round(weightedOverall(base)),
        reasons: [
            ...assessment.reasons,
            fixedTimestampFallback
                ? `cue ${cue.aGrid}→${cue.bGrid}: fixed-time fallback retained for safety`
                : `cue ${cue.aGrid}→${cue.bGrid}: musical boundary selected`,
        ],
    };
}
