const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export type TransitionCriticLayerV4 = "technical" | "perceptual" | "musical" | "experience";
export type EvaluatorExpertiseV4 = "casual-listener" | "music-enthusiast" | "dj" | "mix-engineer";
export type TransitionConditionV4 = "preserve" | "simple-eq" | "role-stem" | "expressive-fx";

export interface TransitionDiagnosticsV4 {
    loudnessControl: number;
    spectralCollision: number;
    spectralContinuity: number;
    trajectorySmoothness: number;
    stereoStability: number;
    beatConsistency: number;
    musicalPhrasing: number;
    journeyFit: number;
}

export interface RatedTransitionV4 {
    id: string;
    outgoingTrack: string;
    incomingTrack: string;
    outgoingWindow: [number, number];
    incomingWindow: [number, number];
    transitionPlan: TransitionConditionV4;
    renderedAudio: string;
    context: {
        experience: string;
        mixingStyle: string;
        listeningDevice: string;
        genrePair: string;
        expertise: EvaluatorExpertiseV4;
    };
    diagnostics: TransitionDiagnosticsV4;
    ratings: {
        naturalness: number;
        enjoyment: number;
        energyContinuity: number;
        surprise: number;
        keepListening: boolean;
    };
}

export interface PairwisePreferenceV4 {
    preferredId: string;
    rejectedId: string;
    expertise: EvaluatorExpertiseV4;
    labels: readonly string[];
}

export function transitionCriticV4(diagnostics: TransitionDiagnosticsV4): {
    layers: Record<TransitionCriticLayerV4, number>;
    dimensions: TransitionDiagnosticsV4;
    scalarForRankingOnly: number;
} {
    const quality = (riskOrQuality: number, risk = false) =>
        risk ? 1 - clamp01(riskOrQuality) : clamp01(riskOrQuality);
    const technical = (quality(diagnostics.loudnessControl) + quality(diagnostics.beatConsistency)) / 2;
    const perceptual =
        (quality(diagnostics.spectralCollision, true) +
            quality(diagnostics.spectralContinuity) +
            quality(diagnostics.stereoStability)) /
        3;
    const musical = (quality(diagnostics.trajectorySmoothness) + quality(diagnostics.musicalPhrasing)) / 2;
    const experience = quality(diagnostics.journeyFit);
    const layers = {
        technical: round(technical),
        perceptual: round(perceptual),
        musical: round(musical),
        experience: round(experience),
    };
    return {
        layers,
        dimensions: diagnostics,
        scalarForRankingOnly: round(Object.values(layers).reduce((sum, score) => sum + score, 0) / 4),
    };
}

export function preferenceGraph(preferences: readonly PairwisePreferenceV4[]): {
    wins: Record<string, number>;
    ranking: string[];
    absoluteRegressorUsed: false;
} {
    const wins: Record<string, number> = {};
    for (const preference of preferences) {
        wins[preference.preferredId] = (wins[preference.preferredId] ?? 0) + 1;
        wins[preference.rejectedId] ??= 0;
    }
    return {
        wins,
        ranking: Object.keys(wins).sort((a, b) => (wins[b] ?? 0) - (wins[a] ?? 0) || a.localeCompare(b)),
        absoluteRegressorUsed: false,
    };
}

export function mixPointPrior(input: {
    structuralMatch: number;
    genreMatch: number;
    energyMatch: number;
    roleMatch: number;
}): number {
    return round(
        clamp01(input.structuralMatch) * 0.4 +
            clamp01(input.genreMatch) * 0.15 +
            clamp01(input.energyMatch) * 0.2 +
            clamp01(input.roleMatch) * 0.25,
    );
}

export function transitionLabShipGate(input: {
    pairwisePreferenceGain: number;
    catastrophicRejectionGain: number;
    naturalnessGain: number;
    journeyFitGain: number;
    computeRegression: number;
    latencyRegression: number;
    reliabilityRegression: number;
}): { ship: boolean; improvedDimensions: string[]; regressionsAcceptable: boolean } {
    const improvements = [
        ["pairwise-preference", input.pairwisePreferenceGain],
        ["catastrophic-rejection", input.catastrophicRejectionGain],
        ["naturalness", input.naturalnessGain],
        ["journey-fit", input.journeyFitGain],
    ] as const;
    const improvedDimensions = improvements.filter(([, gain]) => gain > 0).map(([name]) => name);
    const regressionsAcceptable =
        Math.max(input.computeRegression, input.latencyRegression, input.reliabilityRegression) <= 0.05;
    return { ship: improvedDimensions.length > 0 && regressionsAcceptable, improvedDimensions, regressionsAcceptable };
}

export const TRANSITION_LAB_V4 = {
    criticLayers: ["technical", "perceptual", "musical", "experience"],
    measurableCore: [
        "loudness-control",
        "spectral-collision",
        "spectral-continuity",
        "trajectory-smoothness",
        "stereo-stability",
        "beat-consistency",
    ],
    functionalRegions: ["intro", "buildup", "breakdown", "drop", "cooldown", "bridge", "outro", "ambient-intro-outro"],
    conditions: ["preserve", "simple-eq", "role-stem", "expressive-fx"],
    expertiseGroups: ["casual-listener", "music-enthusiast", "dj", "mix-engineer"],
    corpusSources: ["raveform-mix-points", "expert-cue-points", "aimer-transition-corpus"],
    pairwisePreferred: true,
} as const;
