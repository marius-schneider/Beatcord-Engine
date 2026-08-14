const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
export interface ExplorationLedgerEntry {
    trackId: string;
    policy: string;
    probability: number;
    reason: string;
    context: string;
    accepted?: boolean;
}
export function microExploration(input: {
    candidateDistance: number;
    genreFit: number;
    energyFit: number;
    transitionSafety: number;
}): { allowed: boolean; scope: "one-artist"; stableDimensions: readonly string[] } {
    return {
        allowed:
            input.candidateDistance <= 0.3 &&
            input.genreFit >= 0.75 &&
            input.energyFit >= 0.75 &&
            input.transitionSafety >= 0.8,
        scope: "one-artist",
        stableDimensions: ["genre", "energy", "transition"],
    };
}

export interface CalibrationObservation {
    analyzer: string;
    domain: string;
    predictedConfidence: number;
    correct: boolean;
}
export function calibratedConfidence(
    observations: readonly CalibrationObservation[],
    analyzer: string,
    domain: string,
    predictedConfidence: number,
): { calibrated: number; samples: number; domainConditional: true } {
    const bin = Math.round(clamp01(predictedConfidence) * 10) / 10;
    const matches = observations.filter(
        (row) => row.analyzer === analyzer && row.domain === domain && Math.abs(row.predictedConfidence - bin) <= 0.05,
    );
    const accuracy = matches.length
        ? matches.filter((row) => row.correct).length / matches.length
        : predictedConfidence * 0.7;
    return { calibrated: round(clamp01(accuracy)), samples: matches.length, domainConditional: true };
}
export function decisionConfidence(relevantEvidenceConfidence: number, planRobustness: number): number {
    return round(clamp01(relevantEvidenceConfidence) * clamp01(planRobustness));
}
export interface ActionEnvelope {
    safeTransitions: string[];
    unsafeTransitions: string[];
    confidenceLevel: number;
    researchPrototype: true;
}
export function conformalActionEnvelope(
    actions: readonly { transition: string; success: number }[],
    confidenceLevel: number,
): ActionEnvelope {
    const threshold = clamp01(confidenceLevel);
    return {
        safeTransitions: actions.filter((action) => action.success >= threshold).map((action) => action.transition),
        unsafeTransitions: actions.filter((action) => action.success < threshold).map((action) => action.transition),
        confidenceLevel: threshold,
        researchPrototype: true,
    };
}

export function activeTeachingValue(input: {
    uncertainty: number;
    expectedFutureUse: number;
    correctionValue: number;
    mode: "normal" | "dj-power";
}): { ask: boolean; score: number; normalListenerNagged: false } {
    const score = round(clamp01(input.uncertainty) * clamp01(input.expectedFutureUse) * clamp01(input.correctionValue));
    return { ask: input.mode === "dj-power" && score > 0.35, score, normalListenerNagged: false };
}
export type UserCorrectionType =
    | "tap-4-beats"
    | "move-downbeat"
    | "half-tempo"
    | "double-tempo"
    | "set-meter"
    | "lock-grid-region";
export function correctionPropagation(type: UserCorrectionType): string[] {
    if (type === "move-downbeat")
        return ["bar-numbering", "meter-phase", "phrase-boundaries", "transition-windows", "cue-points", "loop-safety"];
    if (type === "tap-4-beats") return ["tempo", "phase", "expressive-timing"];
    return ["beat-mesh", "transition-windows", "analyzer-routing"];
}
export function fewShotAdapter(input: {
    domain: string;
    corrections: number;
    highConfidenceLabels: number;
    globalModelMutation: false;
}): { create: boolean; name: string; localOnly: true; globalModelMutation: false } {
    return {
        create: input.corrections + input.highConfidenceLabels >= 5,
        name: `${input.domain.replace(/\W+/g, "") || "Domain"}Adapter`,
        localOnly: true,
        globalModelMutation: false,
    };
}
export function culturalDomainGuard(oodRisk: number): {
    intervention: "normal" | "reduced" | "preserve";
    westernFourFourAssumed: false;
} {
    return {
        intervention: oodRisk >= 0.8 ? "preserve" : oodRisk >= 0.5 ? "reduced" : "normal",
        westernFourFourAssumed: false,
    };
}
export function diffusionStemEscalation(input: {
    fastStemQuality: number;
    transitionImportance: number;
    computeAvailable: boolean;
    lookahead: boolean;
}): { useDiffusion: boolean; normalRealtimePath: false; fallback: "deterministic-separation" } {
    return {
        useDiffusion:
            input.fastStemQuality < 0.65 &&
            input.transitionImportance >= 0.8 &&
            input.computeAvailable &&
            input.lookahead,
        normalRealtimePath: false,
        fallback: "deterministic-separation",
    };
}
