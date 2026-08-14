const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

export interface StemPerceptualQuality {
    objectiveMetric: number;
    perceptualListeningQuality: number;
    stemIsolationQuality: number;
    stemInMixQuality: number;
    mixContextTested: boolean;
}

export function evaluateStemQuality(input: StemPerceptualQuality): {
    usable: boolean;
    score: number;
    dimensions: StemPerceptualQuality;
} {
    const score =
        input.objectiveMetric * 0.2 +
        input.perceptualListeningQuality * 0.25 +
        input.stemIsolationQuality * 0.15 +
        input.stemInMixQuality * 0.4;
    return {
        usable: input.mixContextTested && input.stemInMixQuality >= 0.55 && score >= 0.55,
        score: round(clamp01(score)),
        dimensions: { ...input },
    };
}

export type PerformanceExperience = "chill" | "love" | "energy" | "party" | "wild";

export function stemArtifactBudget(input: {
    experience: PerformanceExperience;
    masking: number;
    vocalExposure: number;
}): { tolerance: number; risk: number } {
    const base = { chill: 0.12, love: 0.1, energy: 0.3, party: 0.45, wild: 0.6 }[input.experience];
    const tolerance = clamp01(base + clamp01(input.masking) * 0.35 - clamp01(input.vocalExposure) * 0.3);
    return { tolerance: round(tolerance), risk: round(1 - tolerance) };
}

export interface SegmentStretchRisk {
    ratio: number;
    percussionDensity: number;
    transientDensity: number;
    vocalPresence: number;
}

export function segmentStretchBudget(
    risk: SegmentStretchRisk,
    segmentType: "percussive-drop" | "pad-intro" | "vocal-verse" | "other",
): { maxRatioDelta: number; artifactRisk: number } {
    const ratioDelta = Math.abs(1 - risk.ratio);
    const signalRisk =
        risk.percussionDensity * 0.3 + risk.transientDensity * 0.3 + risk.vocalPresence * 0.25 + ratioDelta * 2 * 0.15;
    const typeMultiplier = { "percussive-drop": 1.2, "pad-intro": 0.55, "vocal-verse": 1.1, other: 0.85 }[segmentType];
    const artifactRisk = clamp01(signalRisk * typeMultiplier);
    return { maxRatioDelta: round(Math.max(0.01, 0.1 * (1 - artifactRisk * 0.75))), artifactRisk: round(artifactRisk) };
}

export type LoudnessContext = "album" | "playlist" | "party" | "love" | "chill" | "energy";
export interface LoudnessPolicy {
    context: LoudnessContext;
    preserveAlbumRelativeDynamics: boolean;
    consistency: number;
    dynamicPreservation: number;
    impactPreservation: number;
    identicalPeakTarget: false;
}

export function loudnessPolicy(context: LoudnessContext): LoudnessPolicy {
    const values = {
        album: [true, 0.3, 0.95, 0.8],
        playlist: [false, 0.8, 0.55, 0.65],
        party: [false, 0.95, 0.4, 0.95],
        love: [false, 0.55, 0.9, 0.75],
        chill: [false, 0.5, 0.95, 0.65],
        energy: [false, 0.9, 0.5, 0.9],
    }[context] as [boolean, number, number, number];
    return {
        context,
        preserveAlbumRelativeDynamics: values[0],
        consistency: values[1],
        dynamicPreservation: values[2],
        impactPreservation: values[3],
        identicalPeakTarget: false,
    };
}

export interface TransitionPersonality {
    subtlety: number;
    length: number;
    effectIntensity: number;
    stemAggressiveness: number;
    tempoFlexibility: number;
    structuralFreedom: number;
}

export type TransitionPersonalityPreset = "natural" | "smooth" | "expressive" | "club" | "wild";
export const TRANSITION_PERSONALITIES: Record<TransitionPersonalityPreset, TransitionPersonality> = {
    natural: {
        subtlety: 0.95,
        length: 0.45,
        effectIntensity: 0.1,
        stemAggressiveness: 0.05,
        tempoFlexibility: 0.2,
        structuralFreedom: 0.1,
    },
    smooth: {
        subtlety: 0.85,
        length: 0.75,
        effectIntensity: 0.2,
        stemAggressiveness: 0.2,
        tempoFlexibility: 0.35,
        structuralFreedom: 0.25,
    },
    expressive: {
        subtlety: 0.4,
        length: 0.55,
        effectIntensity: 0.65,
        stemAggressiveness: 0.55,
        tempoFlexibility: 0.55,
        structuralFreedom: 0.6,
    },
    club: {
        subtlety: 0.5,
        length: 0.8,
        effectIntensity: 0.45,
        stemAggressiveness: 0.5,
        tempoFlexibility: 0.7,
        structuralFreedom: 0.5,
    },
    wild: {
        subtlety: 0.1,
        length: 0.5,
        effectIntensity: 1,
        stemAggressiveness: 0.9,
        tempoFlexibility: 0.9,
        structuralFreedom: 1,
    },
};

export interface GenreMixingPolicy {
    genreFamily: "house-techno" | "hip-hop" | "pop" | "rock" | "dnb" | "ambient" | "live";
    preferredTechniques: string[];
    beatmixReliance: number;
    trackAnalysisRequired: true;
    independentFromExperience: true;
}

export function genreMixingPolicy(genreFamily: GenreMixingPolicy["genreFamily"]): GenreMixingPolicy {
    const policies: Record<GenreMixingPolicy["genreFamily"], [string[], number]> = {
        "house-techno": [["phrase-blend", "bass-swap", "eq"], 0.9],
        "hip-hop": [["cut", "echo", "short-blend"], 0.55],
        pop: [["phrase", "vocal-safe", "energy-bridge"], 0.55],
        rock: [["phrase", "loudness", "short-blend"], 0.35],
        dnb: [["double-drop", "bass-swap", "phrase"], 0.85],
        ambient: [["timbre", "long-fade", "loudness"], 0.05],
        live: [["dynamic-tempo", "phrase", "natural"], 0.25],
    };
    return {
        genreFamily,
        preferredTechniques: [...policies[genreFamily][0]],
        beatmixReliance: policies[genreFamily][1],
        trackAnalysisRequired: true,
        independentFromExperience: true,
    };
}

export type FeatureConfidence = "high" | "med-high" | "medium";
const FEATURE_MATRIX_ROWS = [
    ["beat-aware-transitions", "high"],
    ["phrase-aware-transitions", "high"],
    ["harmonic-mixing", "med-high"],
    ["structure-aware-mixing", "high"],
    ["energy-aware-sequencing", "high"],
    ["groove-modeling", "high"],
    ["familiarity-modeling", "high"],
    ["repeat-overplay", "high"],
    ["mood-aware-recommendation", "med-high"],
    ["crowd-taste", "high"],
    ["crowd-mood-inference", "medium"],
    ["crowd-fairness", "med-high"],
    ["transition-effects", "med-high"],
    ["stem-mixing", "high"],
    ["stem-perceptual-quality", "high"],
    ["dynamic-loudness", "high"],
    ["context-aware-taste", "high"],
    ["genre-specific-policies", "high"],
    ["transition-simulation", "med-high"],
    ["long-horizon-routing", "med-high"],
] as const satisfies readonly (readonly [string, FeatureConfidence])[];
export const RESEARCH_FEATURE_MATRIX: { feature: string; confidence: FeatureConfidence }[] = FEATURE_MATRIX_ROWS.map(
    ([feature, confidence]) => ({ feature, confidence }),
);

export interface EvidenceSignal {
    source: "audio-model" | "genre-policy" | "user-feedback" | "listening-test";
    value: number;
    calibration: number;
}

export function fuseTransitionEvidence(signals: readonly EvidenceSignal[]): {
    expectedQuality: number;
    sourceContributions: Record<string, number>;
} {
    const weighted = signals.map((signal) => ({ ...signal, weight: clamp01(signal.calibration) }));
    const total = weighted.reduce((sum, signal) => sum + signal.weight, 0);
    return {
        expectedQuality: round(
            weighted.reduce((sum, signal) => sum + clamp01(signal.value) * signal.weight, 0) / Math.max(1, total),
        ),
        sourceContributions: Object.fromEntries(
            weighted.map((signal) => [
                signal.source,
                round((clamp01(signal.value) * signal.weight) / Math.max(1, total)),
            ]),
        ),
    };
}

export interface MixingTasteProfile {
    preferredNoticeability: number;
    preferredTransitionLength: number;
    preferredEffectIntensity: number;
    preferredTempoManipulation: number;
    preferredStemUsage: number;
}

export function routeTransitionFeedback(
    feedback: "bad-transition" | "good-transition",
    fromTrackId: string,
    toTrackId: string,
): { learningTarget: "mixing-taste"; musicTasteChanged: false; pair: string; delta: number } {
    return {
        learningTarget: "mixing-taste",
        musicTasteChanged: false,
        pair: `${fromTrackId}->${toTrackId}`,
        delta: feedback === "good-transition" ? 0.1 : -0.1,
    };
}

export interface EffectHistoryEntry {
    effect: string;
    appropriateness: number;
}
export function effectFatigue(
    effect: string,
    history: readonly EffectHistoryEntry[],
): { repetition: number; fatiguePenalty: number; novelty: number; appropriateness: number } {
    const recent = history.slice(-8);
    const occurrences = recent.filter((entry) => entry.effect === effect);
    const repetition = occurrences.length / Math.max(1, recent.length);
    const appropriateness = occurrences.length
        ? occurrences.reduce((sum, entry) => sum + entry.appropriateness, 0) / occurrences.length
        : 0.5;
    return {
        repetition: round(repetition),
        fatiguePenalty: round(clamp01(repetition * (1.2 - appropriateness * 0.4))),
        novelty: round(1 - repetition),
        appropriateness: round(appropriateness),
    };
}

export interface MultidimensionalSurpriseBudget {
    trackNovelty: number;
    genreNovelty: number;
    transitionNovelty: number;
    rhythmicNovelty: number;
    journeyNovelty: number;
}

export function distributeSurprise(
    requested: MultidimensionalSurpriseBudget,
    chaosAllowed: boolean,
): { budget: MultidimensionalSurpriseBudget; total: number; adjusted: boolean } {
    const entries = Object.entries(requested) as [keyof MultidimensionalSurpriseBudget, number][];
    const total = entries.reduce((sum, [, value]) => sum + clamp01(value), 0);
    if (chaosAllowed || total <= 2)
        return {
            budget: Object.fromEntries(
                entries.map(([key, value]) => [key, round(clamp01(value))]),
            ) as unknown as MultidimensionalSurpriseBudget,
            total: round(total),
            adjusted: false,
        };
    const scale = 2 / total;
    const budget = Object.fromEntries(
        entries.map(([key, value]) => [key, round(clamp01(value) * scale)]),
    ) as unknown as MultidimensionalSurpriseBudget;
    return { budget, total: 2, adjusted: true };
}

export interface CognitiveLoadInput {
    trackNovelty: number;
    transitionSalience: number;
    genreDistance: number;
    tempoShock: number;
    harmonicShock: number;
}
export function adaptiveCognitiveLoad(
    input: CognitiveLoadInput,
    experience: PerformanceExperience,
    negativeCrowdReaction: number,
): { load: number; max: number; allowed: boolean } {
    const raw = Object.values(input).reduce((sum, value) => sum + clamp01(value), 0);
    const base = { chill: 1.1, love: 1.5, energy: 2.3, party: 3.2, wild: 4.2 }[experience];
    const max = Math.max(0.6, base - clamp01(negativeCrowdReaction) * 1.2);
    return { load: round(raw), max: round(max), allowed: raw <= max };
}

export interface CandidateFitLayers {
    songFit: number;
    momentFit: number;
    journeyFit: number;
    mixFit: number;
    experienceFit: number;
}
export function ultimateCandidateDecision(
    fits: CandidateFitLayers,
    hardBlocked = false,
): { decision: "play" | "defer" | "reject"; score: number; weakestLayer: keyof CandidateFitLayers } {
    const entries = Object.entries(fits) as [keyof CandidateFitLayers, number][];
    const weakest = [...entries].sort((a, b) => a[1] - b[1])[0]!;
    const score = entries.reduce((product, [, value]) => product * clamp01(value), 1) ** (1 / entries.length);
    return {
        decision: hardBlocked || weakest[1] < 0.3 ? "reject" : score >= 0.65 && weakest[1] >= 0.5 ? "play" : "defer",
        score: round(score),
        weakestLayer: weakest[0],
    };
}

export const ADDITIONAL_EVIDENCE_SOURCES = {
    automaticDj: 2,
    grooveEnergy: 2,
    familiarityRepetition: 5,
    context: 3,
    diversityDiscovery: 2,
    stemsDsp: 3,
    loudness: 1,
    groupRecommendation: 1,
    userDjReports: 10,
} as const;
