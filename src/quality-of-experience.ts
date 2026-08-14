const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export interface QualityOfExperience {
    playback: number;
    startup: number;
    navigation: number;
    search: number;
    recommendationLatency: number;
    sessionSync: number;
    handoff: number;
    integrationHealth: number;
}

export function qualityOfExperienceScore(qoe: QualityOfExperience): number {
    const weights: Record<keyof QualityOfExperience, number> = {
        playback: 0.24,
        startup: 0.12,
        navigation: 0.1,
        search: 0.12,
        recommendationLatency: 0.1,
        sessionSync: 0.12,
        handoff: 0.1,
        integrationHealth: 0.1,
    };
    return round(
        (Object.keys(weights) as (keyof QualityOfExperience)[]).reduce(
            (score, key) => score + clamp01(qoe[key]) * weights[key],
            0,
        ),
    );
}

export function perceivedQoe(input: { technical: number; behavioral: number; userFeedback?: number }): number {
    const feedback = input.userFeedback;
    const weights = feedback === undefined ? [0.6, 0.4, 0] : [0.45, 0.3, 0.25];
    return round(
        clamp01(input.technical) * weights[0]! +
            clamp01(input.behavioral) * weights[1]! +
            clamp01(feedback ?? 0) * weights[2]!,
    );
}

export function momentWeightedStallCost(
    durationSeconds: number,
    momentImportance: number,
    experienceImportance: number,
): number {
    return round(Math.max(0, durationSeconds) * clamp01(momentImportance) * clamp01(experienceImportance));
}

export type CriticalMusicalMoment = "normal" | "drop" | "transition" | "target-chorus";
export function adaptiveBufferHorizon(input: {
    baseSeconds: number;
    moment: CriticalMusicalMoment;
    networkQuality: number;
    complexTransition: boolean;
}): { targetSeconds: number; criticalMomentProtected: boolean } {
    const momentMargin = input.moment === "normal" ? 0 : input.moment === "transition" ? 5 : 3;
    const networkMargin = (1 - clamp01(input.networkQuality)) * 8;
    const complexityMargin = input.complexTransition ? 4 : 0;
    return {
        targetSeconds: round(Math.max(0, input.baseSeconds) + momentMargin + networkMargin + complexityMargin),
        criticalMomentProtected: input.moment !== "normal",
    };
}

export function transitionReadiness(
    bufferedSeconds: number,
    requiredSeconds: number,
): {
    action: "proceed" | "delay-fancy-transition";
    qualityBeforeImmediacy: true;
} {
    return {
        action: bufferedSeconds >= requiredSeconds ? "proceed" : "delay-fancy-transition",
        qualityBeforeImmediacy: true,
    };
}

export function qoeAwareRouteScore(input: {
    musicalFit: number;
    availabilityConfidence: number;
    bufferReadiness: number;
}): number {
    return round(
        clamp01(input.musicalFit) * 0.55 +
            clamp01(input.availabilityConfidence) * 0.25 +
            clamp01(input.bufferReadiness) * 0.2,
    );
}

export type StreamQuality = "lossless" | "high-lossy" | "lower-bitrate";
export function streamingDegradation(
    networkQuality: number,
    providerAllowsAlternatives: boolean,
): {
    quality: StreamQuality;
    stallPreferred: false;
} {
    const quality: StreamQuality =
        !providerAllowsAlternatives || networkQuality >= 0.75
            ? "lossless"
            : networkQuality >= 0.4
              ? "high-lossy"
              : "lower-bitrate";
    return { quality, stallPreferred: false };
}

export type DspQuality = "stem-hq" | "stem-fast" | "classic-mix" | "crossfade";
export function dspDegradation(cpuHeadroom: number): { quality: DspQuality; continuityWins: true } {
    const quality: DspQuality =
        cpuHeadroom >= 0.7
            ? "stem-hq"
            : cpuHeadroom >= 0.45
              ? "stem-fast"
              : cpuHeadroom >= 0.2
                ? "classic-mix"
                : "crossfade";
    return { quality, continuityWins: true };
}

export interface SearchQoeSlo {
    p50Ms: number;
    p95Ms: number;
    noResultRate: number;
    correctionRate: number;
}
export function assessSearchQoe(slo: SearchQoeSlo): {
    healthy: boolean;
    failures: (keyof SearchQoeSlo)[];
    releaseCritical: true;
} {
    const failures: (keyof SearchQoeSlo)[] = [];
    if (slo.p50Ms > 250) failures.push("p50Ms");
    if (slo.p95Ms > 800) failures.push("p95Ms");
    if (slo.noResultRate > 0.05) failures.push("noResultRate");
    if (slo.correctionRate > 0.1) failures.push("correctionRate");
    return { healthy: failures.length === 0, failures, releaseCritical: true };
}

export type AiResponseRoute = "local-structured" | "semantic-planner";
export function aiResponseRoute(command: string): {
    route: AiResponseRoute;
    latencyClass: "interactive" | "planned";
    cloudRequired: boolean;
} {
    const simple = /^(more|less)\s+(energy|familiar)|^(skip|like)$|^(party|chill)$/i.test(command.trim());
    return simple
        ? { route: "local-structured", latencyClass: "interactive", cloudRequired: false }
        : { route: "semantic-planner", latencyClass: "planned", cloudRequired: true };
}

export const QOE_DIMENSIONS = ["audio", "navigation", "search", "ai", "social-sync", "integration"] as const;
