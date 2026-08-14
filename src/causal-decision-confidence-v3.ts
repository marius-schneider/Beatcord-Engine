const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export interface TasteRelationV2 {
    consumptionAffinity: number;
    voluntaryAffinity: number;
    recommendationAffinity: number;
    exposureBiasRisk: number;
    confidence: number;
}

export function counterfactualTasteMemory(input: {
    consumptionSignals: number[];
    voluntarySignals: number[];
    recommendationSignals: number[];
}): TasteRelationV2 {
    const mean = (values: number[]) =>
        values.length ? values.reduce((sum, value) => sum + clamp01(value), 0) / values.length : 0;
    const consumptionAffinity = round(mean(input.consumptionSignals));
    const voluntaryAffinity = round(mean(input.voluntarySignals));
    const recommendationAffinity = round(mean(input.recommendationSignals));
    const exposureBiasRisk = round(clamp01(recommendationAffinity - voluntaryAffinity));
    const evidenceCount =
        input.consumptionSignals.length + input.voluntarySignals.length + input.recommendationSignals.length;
    return {
        consumptionAffinity,
        voluntaryAffinity,
        recommendationAffinity,
        exposureBiasRisk,
        confidence: round(Math.min(1, evidenceCount / 20)),
    };
}

export interface PropensityLog {
    candidateId: string;
    probability: number;
    policy: "safe-micro-randomization";
    qualityFloor: number;
}

export function microRandomizedRecommendation(
    candidates: readonly { id: string; quality: number }[],
    qualityFloor: number,
    seed: number,
): { selected: string | null; propensities: PropensityLog[]; unsafeCandidatesExcluded: true } {
    const safe = candidates
        .filter((candidate) => candidate.quality >= qualityFloor)
        .sort((a, b) => b.quality - a.quality)
        .slice(0, 3);
    if (!safe.length) return { selected: null, propensities: [], unsafeCandidatesExcluded: true };
    const weights = safe.map((candidate) => Math.exp((candidate.quality - qualityFloor) * 4));
    const total = weights.reduce((sum, value) => sum + value, 0);
    const propensities = safe.map((candidate, index) => ({
        candidateId: candidate.id,
        probability: round((weights[index] ?? 0) / total),
        policy: "safe-micro-randomization" as const,
        qualityFloor,
    }));
    const point = ((seed >>> 0) % 10_000) / 10_000;
    let cumulative = 0;
    const selected =
        propensities.find((entry) => (cumulative += entry.probability) >= point)?.candidateId ??
        propensities.at(-1)?.candidateId ??
        null;
    return { selected, propensities, unsafeCandidatesExcluded: true };
}

export function causalTasteFirewallV2(input: {
    agency: number;
    contextSpecific: boolean;
    algorithmicExposure: number;
    repeatCount: number;
    sessionOnly: boolean;
    signal: number;
}): { persistentWeight: number; sessionWeight: number; steps: readonly string[]; policyContamination: number } {
    const repeatDiscount = 1 / Math.sqrt(Math.max(1, input.repeatCount + 1));
    const weight =
        clamp01(input.agency) *
        (1 - clamp01(input.algorithmicExposure)) *
        repeatDiscount *
        Math.max(-1, Math.min(1, input.signal));
    return {
        persistentWeight: input.sessionOnly || input.contextSpecific ? 0 : round(weight),
        sessionWeight: round(weight),
        steps: [
            "identify-agency",
            "identify-context",
            "identify-algorithm-exposure",
            "discount-repetition",
            "separate-session-global",
            "update-confidence",
        ],
        policyContamination: round(clamp01(input.algorithmicExposure)),
    };
}

export interface FeedbackLoopHealth {
    selfInfluence: number;
    algorithmicExposureConcentration: number;
    artistConcentration: number;
    genreConcentration: number;
    voluntarySearchDiversity: number;
    discoveryAcceptance: number;
    recommendationOriginShare: number;
}

export function selfInfluenceAlarm(metrics: FeedbackLoopHealth): { alarm: boolean; actions: string[]; threshold: 0.8 } {
    const alarm = metrics.selfInfluence >= 0.8 || metrics.recommendationOriginShare >= 0.8;
    return {
        alarm,
        actions: alarm ? ["increase-voluntary-signal-weight", "reduce-repetition", "introduce-safe-discovery"] : [],
        threshold: 0.8,
    };
}

export interface EvidenceConfidenceV3 {
    rawModelConfidence: number;
    calibratedConfidence: number;
    domainCalibration: number;
    sectionCalibration: number;
}
export interface DecisionConfidenceV3 {
    relevantEvidence: number;
    planRobustness: number;
    finalConfidence: number;
}

export function confidenceStack(
    evidence: readonly { confidence: EvidenceConfidenceV3; relevance: number }[],
    planRobustness: number,
): DecisionConfidenceV3 {
    const relevant = evidence.filter((item) => item.relevance > 0);
    const totalWeight = relevant.reduce((sum, item) => sum + item.relevance, 0);
    const relevantEvidence = totalWeight
        ? relevant.reduce(
              (sum, item) =>
                  sum +
                  Math.min(
                      item.confidence.calibratedConfidence,
                      item.confidence.domainCalibration,
                      item.confidence.sectionCalibration,
                  ) *
                      item.relevance,
              0,
          ) / totalWeight
        : 0;
    return {
        relevantEvidence: round(relevantEvidence),
        planRobustness: round(clamp01(planRobustness)),
        finalConfidence: round(relevantEvidence * clamp01(planRobustness)),
    };
}

export type ConfidenceFeature = "beat-grid" | "harmony" | "stem-quality" | "vocals";
export type ConfidencePlan = "eq-blend" | "drum-swap" | "vocal-mashup";
export const DECISION_RELEVANCE_MATRIX: Record<ConfidencePlan, Record<ConfidenceFeature, number>> = {
    "eq-blend": { "beat-grid": 1, harmony: 1, "stem-quality": 0.2, vocals: 0.5 },
    "drum-swap": { "beat-grid": 1, harmony: 0.1, "stem-quality": 0.6, vocals: 0.1 },
    "vocal-mashup": { "beat-grid": 1, harmony: 1, "stem-quality": 1, vocals: 1 },
};

export function transitionMonteCarlo(input: {
    baseQuality: number;
    bpmUncertainty: number;
    phaseUncertainty: number;
    keyUncertainty: number;
    stemUncertainty: number;
    qualityFloor: number;
}): { successfulRuns: number; totalRuns: number; robustness: number } {
    const factors = [-1, -0.5, 0, 0.5, 1];
    const penalty =
        input.bpmUncertainty * 0.2 +
        input.phaseUncertainty * 0.25 +
        input.keyUncertainty * 0.25 +
        input.stemUncertainty * 0.3;
    const successfulRuns = factors.filter(
        (factor) => input.baseQuality - Math.abs(factor) * penalty >= input.qualityFloor,
    ).length;
    return { successfulRuns, totalRuns: factors.length, robustness: round(successfulRuns / factors.length) };
}

export function safeActionSet(
    actions: readonly { action: string; robustness: number }[],
    coverage = 0.8,
): { safe: string[]; risky: string[]; conformalInspired: true } {
    return {
        safe: actions.filter((action) => action.robustness >= coverage).map((action) => action.action),
        risky: actions.filter((action) => action.robustness < coverage).map((action) => action.action),
        conformalInspired: true,
    };
}

export function confidenceUx(input: { normalUser: boolean; fallback: string; reason: string }): {
    automaticFallback: string;
    explanation?: string;
    mlTerminologyExposed: false;
} {
    return input.normalUser
        ? { automaticFallback: input.fallback, mlTerminologyExposed: false }
        : { automaticFallback: input.fallback, explanation: input.reason, mlTerminologyExposed: false };
}

export function calibrationBenchmark(
    rows: readonly { predicted: number; correct: boolean; catastrophic?: boolean }[],
): { ece: number; brier: number; catastrophicHighConfidenceErrorRate: number; samples: number } {
    if (!rows.length) return { ece: 0, brier: 0, catastrophicHighConfidenceErrorRate: 0, samples: 0 };
    const ece =
        rows.reduce((sum, row) => sum + Math.abs(clamp01(row.predicted) - (row.correct ? 1 : 0)), 0) / rows.length;
    const brier =
        rows.reduce((sum, row) => sum + (clamp01(row.predicted) - (row.correct ? 1 : 0)) ** 2, 0) / rows.length;
    const highConfidence = rows.filter((row) => row.predicted >= 0.8);
    const catastrophic = highConfidence.filter((row) => !row.correct && row.catastrophic).length;
    return {
        ece: round(ece),
        brier: round(brier),
        catastrophicHighConfidenceErrorRate: round(catastrophic / Math.max(1, highConfidence.length)),
        samples: rows.length,
    };
}

export function calibrationDrift(input: {
    baselineError: number;
    currentError: number;
    modelVersionChanged: boolean;
    domainShift: number;
}): { drift: boolean; recalibrate: boolean; dimensions: readonly string[] } {
    const drift =
        input.currentError - input.baselineError > 0.05 || input.modelVersionChanged || input.domainShift > 0.2;
    return { drift, recalibrate: drift, dimensions: ["model-version", "genre", "provider", "device", "time"] };
}

export const CAUSAL_TASTE_EXPERIMENT = {
    durationWeeks: "8-12",
    variants: ["behavioral-update", "exposure-aware-causal-update"],
    metrics: [
        "long-term-satisfaction",
        "voluntary-searches",
        "artist-diversity",
        "discovery-acceptance",
        "repeat-fatigue",
        "profile-stability",
    ],
} as const;
export const DECISION_CONFIDENCE_EXPERIMENT = {
    variants: ["raw-threshold", "calibrated-decision-relevant"],
    metrics: ["transition-failure", "fallback-use", "naturalness", "complex-transition-success"],
} as const;
