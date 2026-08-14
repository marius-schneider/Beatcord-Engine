export type TransitionState = "proposed" | "preparing" | "validated" | "committed" | "active" | "completed" | "aborted";

export type TransitionHorizonZone = "outside" | "speculative" | "prepared" | "committed" | "active";

export interface TransitionHorizon {
    planHorizonSec: number;
    commitHorizonSec: number;
    secondsUntilStart: number;
    zone: TransitionHorizonZone;
    replanningAllowed: boolean;
    rescueRequired: boolean;
}

const round = (value: number) => Math.round(value * 1000) / 1000;

export function classifyTransitionHorizon(
    secondsUntilStart: number,
    planHorizonSec = 180,
    commitHorizonSec = 8,
): TransitionHorizon {
    const seconds = Number.isFinite(secondsUntilStart) ? secondsUntilStart : planHorizonSec + 1;
    const plan = Math.max(1, planHorizonSec);
    const commit = Math.min(plan, Math.max(0.25, commitHorizonSec));
    const zone: TransitionHorizonZone =
        seconds <= 0
            ? "active"
            : seconds <= commit
              ? "committed"
              : seconds <= Math.max(commit * 2, 20)
                ? "prepared"
                : seconds <= plan
                  ? "speculative"
                  : "outside";
    return {
        planHorizonSec: plan,
        commitHorizonSec: commit,
        secondsUntilStart: round(seconds),
        zone,
        replanningAllowed: zone === "outside" || zone === "speculative" || zone === "prepared",
        rescueRequired: zone === "committed" || zone === "active",
    };
}

const LEGAL: Record<TransitionState, readonly TransitionState[]> = {
    proposed: ["preparing", "aborted"],
    preparing: ["validated", "aborted"],
    validated: ["committed", "preparing", "aborted"],
    committed: ["active", "aborted"],
    active: ["completed", "aborted"],
    completed: [],
    aborted: [],
};

export function advanceTransitionState(current: TransitionState, next: TransitionState): TransitionState {
    if (current === next) return current;
    if (!LEGAL[current].includes(next)) throw new Error(`Illegal transition lifecycle: ${current} -> ${next}`);
    return next;
}
