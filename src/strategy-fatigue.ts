import type { TransitionType } from "./transition-planner";

export interface StrategyFatigue {
    strategyId: TransitionType;
    recentUsage: number;
    consecutiveUsage: number;
    fatigue: number;
    penalty: number;
}

const round = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 1000) / 1000;

export function assessStrategyFatigue(
    strategyId: TransitionType,
    history: readonly { type: TransitionType | string }[],
): StrategyFatigue {
    const recent = history.slice(-8).map((entry) => entry.type);
    const recentUsage = recent.filter((type) => type === strategyId).length;
    let consecutiveUsage = 0;
    for (let index = recent.length - 1; index >= 0 && recent[index] === strategyId; index--) consecutiveUsage++;
    const recencyWeighted = recent.reduce(
        (sum, type, index) => sum + (type === strategyId ? (index + 1) / Math.max(1, recent.length) : 0),
        0,
    );
    const fatigue = round(recencyWeighted / 2.6 + Math.max(0, consecutiveUsage - 1) * 0.22);
    return {
        strategyId,
        recentUsage,
        consecutiveUsage,
        fatigue,
        penalty: round(fatigue * 0.35),
    };
}
