import type { ConcreteExperienceId } from "./experience-engine";
import type { SessionJourneyPhase } from "./session-journey";

export interface FamiliarityState {
    familiarityTarget: number;
    noveltyTarget: number;
    surpriseBudget: number;
    phase: SessionJourneyPhase;
    reason: string;
}

export interface FamiliarityCandidateScore {
    familiarity: number;
    fit: number;
    adjustment: number;
    userQueueProtected: boolean;
    reason: string;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

export function planFamiliarityBalance(
    experience: ConcreteExperienceId,
    phase: SessionJourneyPhase,
    templateTarget: number,
    recentFamiliarity = 0.5,
): FamiliarityState {
    const peak = phase === "peak" || phase === "finale";
    const experienceBias = experience === "party" ? (peak ? 0.14 : 0.02) : experience === "chill" ? -0.06 : 0;
    const familiarityTarget = clamp01(templateTarget + experienceBias + (0.5 - recentFamiliarity) * 0.12);
    return {
        familiarityTarget: round(familiarityTarget),
        noveltyTarget: round(1 - familiarityTarget),
        surpriseBudget: round(peak ? 0.82 : phase === "warmup" ? 0.62 : 0.5),
        phase,
        reason: `${experience}/${phase} targets ${(familiarityTarget * 100).toFixed(0)}% familiarity`,
    };
}

/** Familiarity is a small ranking nudge and never displaces an explicit queue choice. */
export function scoreFamiliarityCandidate(
    state: FamiliarityState,
    familiarity: number,
    userQueued: boolean,
): FamiliarityCandidateScore {
    const value = clamp01(familiarity);
    const fit = clamp01(1 - Math.abs(value - state.familiarityTarget));
    const adjustment = userQueued ? 0 : (fit - 0.5) * 6;
    return {
        familiarity: round(value),
        fit: round(fit),
        adjustment: round(adjustment),
        userQueueProtected: userQueued,
        reason: userQueued ? "explicit queue order is protected" : `soft familiarity fit ${fit.toFixed(2)}`,
    };
}
