import { classifyTransitionHorizon, type TransitionHorizon, type TransitionState } from "./transition-lifecycle";
import type { TransitionPlan } from "./transition-planner";

export type PlanningEvidence = "fallback" | "beat-phrase" | "stems" | "preview";

export interface ProgressivePlanStage {
    evidence: PlanningEvidence;
    availableAtLeadSec: number;
    plan: TransitionPlan;
    ready: boolean;
    reason: string;
}

export interface ProgressiveTransitionPlan {
    version: 1;
    state: TransitionState;
    horizon: TransitionHorizon;
    activeEvidence: PlanningEvidence;
    playable: true;
    plan: TransitionPlan;
    stages: ProgressivePlanStage[];
}

export interface ProgressivePlanningInput {
    selectedPlan: TransitionPlan;
    secondsUntilCue: number;
    beatPhraseReady: boolean;
    stemsReady: boolean;
    previewValidated: boolean;
    planHorizonSec?: number;
    commitHorizonSec?: number;
}

/** Build an anytime plan: the safe fallback exists first and richer evidence may only upgrade it. */
export function buildProgressiveTransitionPlan(input: ProgressivePlanningInput): ProgressiveTransitionPlan {
    const safe: TransitionPlan = {
        type: "fade",
        fadeSec: Math.min(8, Math.max(2, input.selectedPlan.fadeSec)),
        eqSweep: false,
        tempoRatio: 1,
        reason: "anytime safe crossfade",
    };
    const stages: ProgressivePlanStage[] = [
        {
            evidence: "fallback",
            availableAtLeadSec: 30,
            plan: safe,
            ready: true,
            reason: "safe executable plan requires no expensive evidence",
        },
        {
            evidence: "beat-phrase",
            availableAtLeadSec: 20,
            plan: input.selectedPlan,
            ready: input.beatPhraseReady,
            reason: "beat/downbeat/phrase analysis enables musical alignment",
        },
        {
            evidence: "stems",
            availableAtLeadSec: 12,
            plan: input.selectedPlan,
            ready: input.stemsReady,
            reason: "quality-gated stems enable role-aware transitions",
        },
        {
            evidence: "preview",
            availableAtLeadSec: 8,
            plan: input.selectedPlan,
            ready: input.previewValidated,
            reason: "preview validation approves the final render strategy",
        },
    ];
    const usable = stages.filter((stage) => stage.ready);
    const selected = usable.at(-1) ?? stages[0]!;
    const horizon = classifyTransitionHorizon(input.secondsUntilCue, input.planHorizonSec, input.commitHorizonSec);
    const state: TransitionState =
        horizon.zone === "active"
            ? "active"
            : horizon.zone === "committed"
              ? "committed"
              : selected.evidence === "preview"
                ? "validated"
                : selected.evidence === "fallback"
                  ? "proposed"
                  : "preparing";
    return {
        version: 1,
        state,
        horizon,
        activeEvidence: selected.evidence,
        playable: true,
        plan: { ...selected.plan },
        stages,
    };
}
