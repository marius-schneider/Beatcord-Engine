const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const round = (v: number) => Math.round(v * 1000) / 1000;

export type UnmaskingAction =
    | "change-plan"
    | "eq-carve"
    | "stem-attenuation"
    | "shorter-overlap"
    | "alternative-segment"
    | "none";
export function chooseUnmaskingAction(
    masking: number,
    planningAlternative: boolean,
    masteredTrackRisk: number,
): { action: UnmaskingAction; dynamicEqAmount: number; conservative: true } {
    if (masking < 0.35) return { action: "none", dynamicEqAmount: 0, conservative: true };
    if (planningAlternative) return { action: "change-plan", dynamicEqAmount: 0, conservative: true };
    if (masking >= 0.75)
        return {
            action: masteredTrackRisk > 0.6 ? "shorter-overlap" : "stem-attenuation",
            dynamicEqAmount: 0,
            conservative: true,
        };
    return { action: "eq-carve", dynamicEqAmount: round(Math.min(0.18, masking * 0.2)), conservative: true };
}

export interface CriticForegroundProbability {
    vocal: number;
    melodicLead: number;
    solo: number;
    signatureHook: number;
}
export function foregroundPriority(foreground: CriticForegroundProbability): {
    dominantRole: keyof CriticForegroundProbability;
    attention: number;
    protection: number;
} {
    const entries = Object.entries(foreground) as [keyof CriticForegroundProbability, number][];
    const dominant = [...entries].sort((a, b) => b[1] - a[1])[0]!;
    const vocalBonus = dominant[0] === "vocal" ? 0.15 : 0;
    return {
        dominantRole: dominant[0],
        attention: round(clamp01(dominant[1] + vocalBonus)),
        protection: round(clamp01(dominant[1] * 0.8 + vocalBonus)),
    };
}

export function temporalMaskingRisk(input: {
    impactTime: number;
    subtleEntryTime: number;
    impactMagnitude: number;
    entryForeground: number;
}): number {
    const distance = Math.abs(input.subtleEntryTime - input.impactTime);
    return round(clamp01(input.impactMagnitude * input.entryForeground * 2 ** (-distance / 0.25)));
}

export interface TransientQuality {
    attackPreservation: number;
    smearing: number;
    crestChange: number;
}
export function transientQuality(input: TransientQuality): number {
    return round(
        clamp01(
            input.attackPreservation * 0.55 + (1 - input.smearing) * 0.3 + (1 - Math.abs(input.crestChange)) * 0.15,
        ),
    );
}
export function stretchTransientRisk(input: {
    ratio: number;
    segmentType: "kick" | "hats" | "vocal" | "pad";
    transientDensity: number;
    stemType: string;
}): number {
    const delta = Math.abs(1 - input.ratio);
    const type = { kick: 1, hats: 0.85, vocal: 0.75, pad: 0.3 }[input.segmentType];
    return round(clamp01(delta * 5 * 0.45 + input.transientDensity * type * 0.55));
}

export interface LoudnessFeatures {
    samplePeak: number;
    truePeak: number;
    rms: number;
    shortTermLufs: number;
    integratedLufs: number;
    perceivedImpact: number;
    crestFactor: number;
}
export function loudnessMatchGain(
    referenceLufs: number,
    candidateLufs: number,
): { gainDb: number; mandatoryBeforeEvaluation: true; biasRisk: number } {
    const gainDb = referenceLufs - candidateLufs;
    return { gainDb: round(gainDb), mandatoryBeforeEvaluation: true, biasRisk: round(clamp01(Math.abs(gainDb) / 1.5)) };
}

export function contextualArtifactSalience(input: {
    artifactMagnitude: number;
    audibility: number;
    foregroundAttention: number;
    exposureDuration: number;
    masking: number;
}): number {
    return round(
        clamp01(
            input.artifactMagnitude *
                input.audibility *
                input.foregroundAttention *
                clamp01(input.exposureDuration / 4) *
                (1 - input.masking * 0.7),
        ),
    );
}

export interface TransitionCriticResultV2 {
    technicalIntegrity: number;
    perceptualClarity: number;
    musicalCoherence: number;
    experienceFit: number;
    transitionNaturalness: number;
    uncertainty: number;
}
export interface TransitionCriticInput {
    clipping: number;
    dropout: number;
    stemArtifact: number;
    stretchArtifact: number;
    phaseError: number;
    loudnessDiscontinuity: number;
    masking: number;
    foregroundCollision: number;
    lowEndCompetition: number;
    transientDamage: number;
    spectralCongestion: number;
    beat: number;
    downbeat: number;
    phrase: number;
    structure: number;
    harmony: number;
    payoff: number;
    energyDirection: number;
    experienceFit: number;
    heuristicNaturalness: number;
    learnedNaturalness: number;
    humanEvidence: number;
}
export function evaluateTransitionCriticV2(input: TransitionCriticInput): TransitionCriticResultV2 {
    const technicalIntegrity =
        1 -
        (input.clipping * 0.2 +
            input.dropout * 0.25 +
            input.stemArtifact * 0.13 +
            input.stretchArtifact * 0.13 +
            input.phaseError * 0.16 +
            input.loudnessDiscontinuity * 0.13);
    const perceptualClarity =
        1 -
        (input.masking * 0.24 +
            input.foregroundCollision * 0.25 +
            input.lowEndCompetition * 0.2 +
            input.transientDamage * 0.16 +
            input.spectralCongestion * 0.15);
    const musicalCoherence =
        input.beat * 0.1 +
        input.downbeat * 0.12 +
        input.phrase * 0.18 +
        input.structure * 0.16 +
        input.harmony * 0.12 +
        input.payoff * 0.17 +
        input.energyDirection * 0.15;
    const transitionNaturalness =
        input.heuristicNaturalness * 0.35 + input.learnedNaturalness * 0.3 + input.humanEvidence * 0.35;
    const dimensions = [
        technicalIntegrity,
        perceptualClarity,
        musicalCoherence,
        input.experienceFit,
        transitionNaturalness,
    ].map(clamp01);
    return {
        technicalIntegrity: round(dimensions[0]!),
        perceptualClarity: round(dimensions[1]!),
        musicalCoherence: round(dimensions[2]!),
        experienceFit: round(dimensions[3]!),
        transitionNaturalness: round(dimensions[4]!),
        uncertainty: round(Math.max(...dimensions) - Math.min(...dimensions)),
    };
}

export interface SourceContribution {
    time: number;
    deckA: number;
    deckB: number;
}
export interface CriticRoleOwnershipConflict {
    bass: number;
    vocals: number;
    drums: number;
    lead: number;
}
export function roleOwnership(curves: Record<keyof CriticRoleOwnershipConflict, SourceContribution[]>): {
    conflicts: CriticRoleOwnershipConflict;
    handoffSmoothness: number;
} {
    const conflict = (points: SourceContribution[]) =>
        points.reduce((sum, point) => sum + Math.min(point.deckA, point.deckB), 0) / Math.max(1, points.length);
    const conflicts = {
        bass: round(conflict(curves.bass)),
        vocals: round(conflict(curves.vocals)),
        drums: round(conflict(curves.drums)),
        lead: round(conflict(curves.lead)),
    };
    return {
        conflicts,
        handoffSmoothness: round(clamp01(1 - Object.values(conflicts).reduce((a, b) => a + b, 0) / 4)),
    };
}

export type StructureGenre = "pop" | "edm" | "hip-hop";
export const STRUCTURE_VOCABULARY: Record<StructureGenre, readonly string[]> = {
    pop: ["intro", "verse", "pre", "chorus", "bridge", "outro"],
    edm: ["intro", "groove", "breakdown", "build", "drop", "break", "second-drop", "outro"],
    "hip-hop": ["intro", "verse", "hook", "verse", "hook", "outro"],
};
export const DJ_STRUCTURE_DATASET = { name: "raveform", domain: "edm-dj", metricAndFunctionalStructure: true } as const;

export interface CriticTransitionWindow {
    start: number;
    dominanceHandoff: number;
    end: number;
}
export function learnedSwitchPointPrior(input: {
    outgoingStructure: number;
    incomingStructure: number;
    genrePrior: number;
    energyFit: number;
    phraseFit: number;
}): { handoffProgress: number; priorOnly: true } {
    return {
        handoffProgress: round(
            clamp01(
                input.outgoingStructure * 0.15 +
                    input.incomingStructure * 0.2 +
                    input.genrePrior * 0.15 +
                    input.energyFit * 0.2 +
                    input.phraseFit * 0.3,
            ),
        ),
        priorOnly: true,
    };
}

export function timbralContinuity(
    a: readonly number[],
    b: readonly number[],
): { continuity: number; shock: number; compensation: "none" | "transition-only-gentle-eq"; remastersTrack: false } {
    const n = Math.max(a.length, b.length);
    const difference =
        Array.from({ length: n }, (_, i) => Math.abs((a[i] ?? 0) - (b[i] ?? 0))).reduce((s, v) => s + v, 0) /
        Math.max(1, n);
    const shock = clamp01(difference);
    return {
        continuity: round(1 - shock),
        shock: round(shock),
        compensation: shock > 0.35 ? "transition-only-gentle-eq" : "none",
        remastersTrack: false,
    };
}
export function contextualEqBridge(
    shock: number,
    bars = 8,
): { outgoingReduction: number; incomingRestoreBars: number; guardianLimited: true } {
    return {
        outgoingReduction: round(Math.min(0.15, clamp01(shock) * 0.15)),
        incomingRestoreBars: Math.max(1, bars),
        guardianLimited: true,
    };
}

export interface CriticCandidate {
    id: string;
    symbolicScore: number;
    featureScore: number;
    previewScore?: number;
    fullScore?: number;
    result?: TransitionCriticResultV2;
}
export function criticCascade(
    candidates: readonly CriticCandidate[],
    fullPreviewLimit = 2,
): { symbolic: number; simulated: number; lowResolution: number; fullPreview: string[] } {
    const stage1 = candidates.filter((c) => c.symbolicScore >= 0.45);
    const stage2 = stage1.filter((c) => c.featureScore >= 0.55);
    const stage3 = stage2.filter((c) => (c.previewScore ?? 0) >= 0.6);
    return {
        symbolic: candidates.length,
        simulated: stage1.length,
        lowResolution: stage2.length,
        fullPreview: [...stage3]
            .sort((a, b) => (b.previewScore ?? 0) - (a.previewScore ?? 0))
            .slice(0, fullPreviewLimit)
            .map((c) => c.id),
    };
}
export function criticDisagreement(result: TransitionCriticResultV2): {
    spread: number;
    weakest: keyof Omit<TransitionCriticResultV2, "uncertainty">;
    requiresRepair: boolean;
} {
    const entries = Object.entries(result).filter(([key]) => key !== "uncertainty") as [
        keyof Omit<TransitionCriticResultV2, "uncertainty">,
        number,
    ][];
    const sorted = [...entries].sort((a, b) => a[1] - b[1]);
    return {
        spread: round(sorted.at(-1)![1] - sorted[0]![1]),
        weakest: sorted[0]![0],
        requiresRepair: sorted[0]![1] < 0.65,
    };
}
export function criticCounterexample(reason: "vocal-collision" | "phrase-mismatch" | "timbre-shock" | "low-end"): {
    rejectedBecause: string;
    repair: string;
} {
    return {
        rejectedBecause: reason,
        repair: {
            "vocal-collision": "move-handoff-after-vocal",
            "phrase-mismatch": "align-next-strong-boundary",
            "timbre-shock": "apply-gentle-eq-bridge",
            "low-end": "move-bass-swap-earlier",
        }[reason],
    };
}
export function runPlanningLoop(
    initialPlan: string,
    critiques: readonly { accepted: boolean; repair?: string }[],
    maxIterations = 3,
): { finalPlan: string; iterations: number; committed: boolean; budgetBounded: true } {
    let plan = initialPlan;
    let iterations = 0;
    for (const critique of critiques.slice(0, maxIterations)) {
        iterations++;
        if (critique.accepted) return { finalPlan: plan, iterations, committed: true, budgetBounded: true };
        if (critique.repair) plan = `${plan}+${critique.repair}`;
    }
    return { finalPlan: plan, iterations, committed: false, budgetBounded: true };
}
