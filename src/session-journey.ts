export type SessionJourneyPhase =
    | "warmup"
    | "build"
    | "momentum"
    | "peak"
    | "reset"
    | "rebuild"
    | "finale"
    | "cooldown";

export type SessionJourneyIntent = "introduce" | "build" | "hold" | "peak" | "breathe" | "rebuild" | "resolve";
export type SessionJourneyDirection = "up" | "hold" | "down";

export interface SessionJourneyFatigue {
    total: number;
    energyFlatness: number;
    vocalFatigue: number;
}

export interface SessionJourneyInput {
    phase: SessionJourneyPhase;
    currentEnergy: number;
    targetEnergy: number;
    recentEnergies: readonly number[];
    sessionAgeMinutes: number;
    peakReached: boolean;
    userSkips: number;
    userLikes: number;
    fatigue: SessionJourneyFatigue;
    horizonTracks?: number;
}

export interface SessionJourneyStep {
    offsetTracks: number;
    targetEnergy: number;
    role: "bridge" | "lift" | "hold" | "contrast" | "landing";
}

/** A compact, auditable plan for the session arc rather than one isolated pair. */
export interface SessionJourneyPlan {
    version: 1;
    phase: SessionJourneyPhase;
    intent: SessionJourneyIntent;
    direction: SessionJourneyDirection;
    currentEnergy: number;
    targetEnergy: number;
    nextTargetEnergy: number;
    horizon: SessionJourneyStep[];
    confidence: number;
    stability: number;
    reasons: string[];
}

export interface JourneyAlignment {
    score: number;
    energyFit: number;
    directionFit: number;
    futureFit: number;
    reason: string;
}

const INTENT: Record<SessionJourneyPhase, SessionJourneyIntent> = {
    warmup: "introduce",
    build: "build",
    momentum: "hold",
    peak: "peak",
    reset: "breathe",
    rebuild: "rebuild",
    finale: "peak",
    cooldown: "resolve",
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const round = (value: number, digits = 3) => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

function direction(delta: number): SessionJourneyDirection {
    if (delta > 0.025) return "up";
    if (delta < -0.025) return "down";
    return "hold";
}

function roleFor(
    index: number,
    length: number,
    intent: SessionJourneyIntent,
    contrast: boolean,
): SessionJourneyStep["role"] {
    if (contrast && index === 0) return "contrast";
    if (index === length - 1 && (intent === "breathe" || intent === "resolve")) return "landing";
    if (intent === "build" || intent === "rebuild" || intent === "peak") return "lift";
    if (intent === "hold") return "hold";
    return "bridge";
}

/**
 * Turn current session evidence into a short energy trajectory. Listener friction
 * reduces the next step; sustained flatness asks for controlled contrast instead
 * of solving every pair independently.
 */
export function planSessionJourney(input: SessionJourneyInput): SessionJourneyPlan {
    const currentEnergy = clamp01(input.currentEnergy);
    const targetEnergy = clamp01(input.targetEnergy);
    const intent = INTENT[input.phase];
    const friction = clamp01((input.userSkips - input.userLikes) / 5);
    const maxStep = 0.13 - friction * 0.065;
    let desiredDelta = Math.max(-maxStep, Math.min(maxStep, targetEnergy - currentEnergy));
    const flat = clamp01(input.fatigue.energyFlatness);
    const contrast = flat >= 0.58 && Math.abs(desiredDelta) < 0.055;
    if (contrast) {
        const descending = input.phase === "reset" || input.phase === "cooldown";
        desiredDelta = (descending ? -1 : 1) * (0.045 + flat * 0.035);
    }
    const nextTargetEnergy = clamp01(currentEnergy + desiredDelta);
    const horizonLength = Math.max(2, Math.min(8, Math.round(input.horizonTracks ?? 4)));
    const horizon = Array.from({ length: horizonLength }, (_, index): SessionJourneyStep => {
        const progress = (index + 1) / horizonLength;
        const eased = 1 - (1 - progress) ** 1.4;
        const phaseLift = intent === "peak" ? Math.sin(progress * Math.PI) * 0.025 : 0;
        const energy = clamp01(currentEnergy + (targetEnergy - currentEnergy) * eased + phaseLift);
        return {
            offsetTracks: index + 1,
            targetEnergy: round(index === 0 ? nextTargetEnergy : energy),
            role: roleFor(index, horizonLength, intent, contrast),
        };
    });
    const recent = input.recentEnergies.slice(-8).map(clamp01);
    const meanDelta =
        recent.length > 1
            ? recent.slice(1).reduce((sum, energy, index) => sum + Math.abs(energy - recent[index]!), 0) /
              (recent.length - 1)
            : 0;
    const stability = clamp01(1 - meanDelta / 0.28);
    const evidence = clamp01(recent.length / 6);
    const feedback = clamp01((input.userLikes + input.userSkips) / 8);
    const confidence = clamp01(0.35 + evidence * 0.38 + feedback * 0.12 + stability * 0.15 - friction * 0.12);
    const journeyDirection = direction(nextTargetEnergy - currentEnergy);
    const reasons = [
        `${input.phase} → ${intent}`,
        `energy ${currentEnergy.toFixed(2)} → ${nextTargetEnergy.toFixed(2)} → ${targetEnergy.toFixed(2)}`,
        `${recent.length} observed tracks, stability ${stability.toFixed(2)}`,
    ];
    if (contrast) reasons.push(`energy flatness ${flat.toFixed(2)} requests controlled contrast`);
    if (friction > 0) reasons.push(`listener friction ${friction.toFixed(2)} limits the next energy step`);
    if (input.fatigue.vocalFatigue >= 0.55) reasons.push("vocal fatigue asks the route planner for relief");
    if (input.peakReached) reasons.push("session peak already observed");
    return {
        version: 1,
        phase: input.phase,
        intent,
        direction: journeyDirection,
        currentEnergy: round(currentEnergy),
        targetEnergy: round(targetEnergy),
        nextTargetEnergy: round(nextTargetEnergy),
        horizon,
        confidence: round(confidence),
        stability: round(stability),
        reasons,
    };
}

/** Score one candidate against both the immediate journey step and route health. */
export function scoreJourneyAlignment(
    journey: SessionJourneyPlan,
    candidateEnergy: number,
    futureRouteScore: number,
): JourneyAlignment {
    const candidate = clamp01(candidateEnergy);
    const energyFit = clamp01(1 - Math.abs(candidate - journey.nextTargetEnergy) / 0.35);
    const candidateDirection = direction(candidate - journey.currentEnergy);
    const directionFit =
        journey.direction === "hold"
            ? clamp01(1 - Math.abs(candidate - journey.currentEnergy) / 0.2)
            : candidateDirection === journey.direction
              ? 1
              : 0.2;
    const futureFit = clamp01(futureRouteScore);
    const score = energyFit * 0.62 + directionFit * 0.2 + futureFit * 0.18;
    return {
        score: round(score),
        energyFit: round(energyFit),
        directionFit: round(directionFit),
        futureFit: round(futureFit),
        reason: `${journey.intent} journey fit ${score.toFixed(2)} (energy ${energyFit.toFixed(2)}, direction ${directionFit.toFixed(2)}, future ${futureFit.toFixed(2)})`,
    };
}
