import type { SessionJourneyPhase } from "./session-journey";
import type { TransitionType } from "./transition-planner";

export type SurpriseClass = "normal" | "genre-switch" | "double-drop" | "mashup" | "stem-moment" | "abrupt-cut";

export interface SurpriseBudget {
    version: 1;
    event: SurpriseClass;
    capacity: number;
    used: number;
    remaining: number;
    cost: number;
    allowed: boolean;
    penalty: number;
    reasons: string[];
}

const COST: Record<SurpriseClass, number> = {
    normal: 0.04,
    "genre-switch": 0.55,
    "double-drop": 0.78,
    mashup: 0.72,
    "stem-moment": 0.68,
    "abrupt-cut": 0.48,
};
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

export function classifySurprise(
    transitionType: TransitionType,
    genreChanged: boolean,
    outgoingType?: string,
    incomingType?: string,
): SurpriseClass {
    if (transitionType === "acapella") return "stem-moment";
    if (transitionType === "bassdrop" && outgoingType === "drop" && incomingType === "drop") return "double-drop";
    if (genreChanged) return "genre-switch";
    if (transitionType === "cut" || transitionType === "spinback") return "abrupt-cut";
    if (transitionType === "roll") return "mashup";
    return "normal";
}

export function assessSurpriseBudget(input: {
    event: SurpriseClass;
    phase: SessionJourneyPhase;
    recentEvents: readonly SurpriseClass[];
}): SurpriseBudget {
    const peakCapacity =
        input.phase === "peak" || input.phase === "finale" ? 1 : input.phase === "warmup" ? 0.62 : 0.78;
    let used = 0;
    input.recentEvents.slice(-8).forEach((event, index, recent) => {
        const recency = (index + 1) / recent.length;
        used += COST[event] * recency * 0.22;
    });
    used = clamp01(used);
    const remaining = clamp01(peakCapacity - used);
    const cost = COST[input.event];
    const allowed = input.event === "normal" || cost <= remaining + 0.08;
    const penalty = allowed ? 0 : clamp01((cost - remaining) / Math.max(0.1, cost));
    return {
        version: 1,
        event: input.event,
        capacity: round(peakCapacity),
        used: round(used),
        remaining: round(remaining),
        cost,
        allowed,
        penalty: round(penalty),
        reasons: [
            `${input.phase} surprise capacity ${peakCapacity.toFixed(2)}`,
            `${input.event} costs ${cost.toFixed(2)}`,
            allowed ? "surprise fits the remaining budget" : "reserve surprise for a stronger session moment",
        ],
    };
}
