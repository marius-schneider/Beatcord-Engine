const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
export const VERSION_ALIGNMENT_PIPELINE = [
    "version-fingerprint",
    "tempo-time-alignment",
    "loudness-spectral-alignment",
    "phase-aware-comparison",
    "weak-stem-prior",
] as const;
export function versionAssistedStem(input: {
    fingerprintMatch: number;
    timingMatch: number;
    spectralMatch: number;
    phaseCoherence: number;
}): { weakPrior: number; directSubtractionAllowed: false; status: "research" } {
    return {
        weakPrior: round(
            clamp01(input.fingerprintMatch) * 0.3 +
                clamp01(input.timingMatch) * 0.25 +
                clamp01(input.spectralMatch) * 0.2 +
                clamp01(input.phaseCoherence) * 0.25,
        ),
        directSubtractionAllowed: false,
        status: "research",
    };
}
export function reconstructionResidual(input: {
    originalEnergy: number;
    summedStemEnergy: number;
    coherence: number;
}): { magnitude: number; role: "preserve" | "separation-failure"; assignAllToOther: false } {
    const magnitude = round(Math.abs(input.originalEnergy - input.summedStemEnergy));
    return {
        magnitude,
        role: magnitude <= 0.15 && input.coherence >= 0.7 ? "preserve" : "separation-failure",
        assignAllToOther: false,
    };
}

export function spatialIntegrityGate(input: {
    interauralTiming: number;
    levelDifference: number;
    stereoWidth: number;
    localization: number;
    threshold?: number;
}): { quality: number; allowed: boolean; sdrOnly: false } {
    const quality = round(
        (clamp01(input.interauralTiming) +
            clamp01(input.levelDifference) +
            clamp01(input.stereoWidth) +
            clamp01(input.localization)) /
            4,
    );
    return { quality, allowed: quality >= (input.threshold ?? 0.7), sdrOnly: false };
}

export function perceptualStemBakeOff(
    candidates: readonly { model: string; objectiveQuality: number; humanUtility: number }[],
): { winner: string | null; objectiveOnly: false; scores: { model: string; score: number }[] } {
    const scores = candidates
        .map((candidate) => ({
            model: candidate.model,
            score: round(clamp01(candidate.objectiveQuality) * 0.45 + clamp01(candidate.humanUtility) * 0.55),
        }))
        .sort((a, b) => b.score - a.score);
    return { winner: scores[0]?.model ?? null, objectiveOnly: false, scores };
}

export interface StemPortfolioModel {
    id: string;
    roles: string[];
    sections: string[];
    realtime: boolean;
    spatialQuality: number;
    deviceTiers: string[];
    objectiveQuality: number;
    humanUtility: number;
    maxLatencyMs?: number;
}
export function routeStemJob(
    models: readonly StemPortfolioModel[],
    job: {
        role: string;
        sectionType: string;
        realtime: boolean;
        spatialRequirement: number;
        device: string;
        deadlineMs?: number;
    },
): StemPortfolioModel | null {
    return (
        [...models]
            .filter(
                (model) =>
                    model.roles.includes(job.role) &&
                    model.sections.includes(job.sectionType) &&
                    (!job.realtime || model.realtime) &&
                    model.spatialQuality >= job.spatialRequirement &&
                    model.deviceTiers.includes(job.device) &&
                    (job.deadlineMs === undefined ||
                        model.maxLatencyMs === undefined ||
                        model.maxLatencyMs <= job.deadlineMs),
            )
            .sort(
                (a, b) =>
                    b.objectiveQuality * 0.45 +
                    b.humanUtility * 0.55 -
                    (a.objectiveQuality * 0.45 + a.humanUtility * 0.55),
            )[0] ?? null
    );
}
export const TINY_LOCAL_SPECIALISTS = [
    "activity-classifier",
    "simple-intent-parser",
    "buffer-predictor",
    "rhythm-verifier",
    "warning-detector",
] as const;
export type ComputeNode = "audio-master" | "desktop-server" | "phone" | "wearable" | "semantic-server";
export function computePlacement(
    task: "realtime-dsp" | "heavy-stems" | "private-context" | "haptics" | "semantic-planning",
    available: readonly ComputeNode[],
): ComputeNode | null {
    const preferred: Record<typeof task, ComputeNode[]> = {
        "realtime-dsp": ["audio-master"],
        "heavy-stems": ["desktop-server"],
        "private-context": ["phone"],
        haptics: ["wearable"],
        "semantic-planning": ["semantic-server", "desktop-server", "phone"],
    };
    return preferred[task].find((node) => available.includes(node)) ?? null;
}
export function computeMigration(
    current: ComputeNode,
    joining: ComputeNode,
    task: "hq-analysis" | "realtime-dsp",
): { from: ComputeNode; to: ComputeNode; sessionChanged: false } {
    const to = task === "hq-analysis" && joining === "desktop-server" ? joining : current;
    return { from: current, to, sessionChanged: false };
}

export interface DecisionEvidence {
    source: string;
    weight: number;
    modelVersion: string;
}
export function decisionProvenanceGraph(
    action: string,
    evidence: readonly DecisionEvidence[],
): { action: string; evidence: DecisionEvidence[]; normalized: boolean; supports: readonly string[] } {
    const total = evidence.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
    return {
        action,
        evidence: evidence.map((item) => ({
            ...item,
            weight: round(Math.max(0, item.weight) / Math.max(Number.EPSILON, total)),
        })),
        normalized: true,
        supports: ["why", "debugging", "ab-experiments", "model-rollback", "artist-analytics", "user-corrections"],
    };
}
export function shadowDirector(
    decisions: readonly { model: string; trackId: string }[],
    propensityWeighted: boolean,
): {
    predictions: { model: string; trackId: string }[];
    affectsUser: false;
    trueRewardObservable: false;
    evaluation: "offline-only" | "propensity-controlled";
} {
    return {
        predictions: [...decisions],
        affectsUser: false,
        trueRewardObservable: false,
        evaluation: propensityWeighted ? "propensity-controlled" : "offline-only",
    };
}
export function recommendationSelfInfluence(
    algorithmicExposureContribution: number,
    totalTasteEvidence: number,
): { ratio: number; action: "none" | "increase-independent-discovery"; repeatedEvidenceReduced: boolean } {
    const ratio = round(algorithmicExposureContribution / Math.max(Number.EPSILON, totalTasteEvidence));
    return {
        ratio,
        action: ratio > 0.5 ? "increase-independent-discovery" : "none",
        repeatedEvidenceReduced: ratio > 0.5,
    };
}
