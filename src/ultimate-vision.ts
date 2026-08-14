import type { JourneyIntelligence } from "./journey-intelligence";
import type { ManipulationBudget, TransitionIntent } from "./music-director";
import type { PerformanceStyleSelection } from "./performance-style";
import type { ProgressiveTransitionPlan } from "./progressive-planning";
import type { SessionJourneyPlan } from "./session-journey";
import type { TrackCompatibilityRoute } from "./track-compatibility";
import type { TransitionPlan } from "./transition-planner";

export interface UltimateVisionDecision {
    version: 1;
    what: {
        nextTrackId: string;
        route: string[];
        compatibility: number;
    };
    when: {
        atSec: number;
        musicalTime: JourneyIntelligence["current"]["transitionTime"];
        structuralRisk: number;
    };
    how: {
        strategy: TransitionPlan["type"];
        intent: TransitionIntent["style"];
        performanceStyle: PerformanceStyleSelection["id"];
    };
    howMuch: {
        manipulationBudget: number;
        tempoFlexibility: number;
        structurePreservation: number;
    };
    why: string[];
    whatIf: {
        playableFallback: TransitionPlan["type"];
        lifecycle: ProgressiveTransitionPlan["state"];
        rescueRequired: boolean;
    };
    whereNext: {
        horizonMinutes: number;
        targetEnergy: number[];
        trackRoute: string[];
    };
}

export function buildUltimateVisionDecision(input: {
    nextTrackId: string;
    plan: TransitionPlan;
    cueAtSec: number;
    intent: TransitionIntent;
    budget: ManipulationBudget;
    performanceStyle: PerformanceStyleSelection;
    progressivePlan: ProgressiveTransitionPlan;
    intelligence: JourneyIntelligence;
    journey: SessionJourneyPlan;
    route: TrackCompatibilityRoute;
    reasons: readonly string[];
}): UltimateVisionDecision {
    return {
        version: 1,
        what: {
            nextTrackId: input.nextTrackId,
            route: [...input.route.trackIds],
            compatibility: input.route.score,
        },
        when: {
            atSec: input.cueAtSec,
            musicalTime: input.intelligence.current.transitionTime,
            structuralRisk: input.intelligence.current.structuralCut.penalty,
        },
        how: {
            strategy: input.plan.type,
            intent: input.intent.style,
            performanceStyle: input.performanceStyle.id,
        },
        howMuch: {
            manipulationBudget: input.budget.total,
            tempoFlexibility: input.performanceStyle.style.tempoFlexibility,
            structurePreservation: input.performanceStyle.style.structurePreservation,
        },
        why: [...input.reasons],
        whatIf: {
            playableFallback: "fade",
            lifecycle: input.progressivePlan.state,
            rescueRequired: input.progressivePlan.horizon.rescueRequired,
        },
        whereNext: {
            horizonMinutes: Math.min(60, Math.max(20, input.journey.horizon.length * 4)),
            targetEnergy: input.journey.horizon.map((step) => step.targetEnergy),
            trackRoute: [...input.route.trackIds],
        },
    };
}
