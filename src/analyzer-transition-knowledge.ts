const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
export interface BeatgridFailureMetrics {
    beatF1: number;
    downbeatF1: number;
    octaveErrorRate: number;
    continuityBreakRate: number;
    downbeatShiftRate: number;
    catastrophicFailureRate: number;
    phaseErrorMs: number;
    tempoDrift: number;
    meterErrorRate: number;
    phraseConsistency: number;
}
export function transitionWeightedGridError(regions: readonly { error: number; transitionWeight: number }[]): number {
    const weight = regions.reduce((sum, region) => sum + region.transitionWeight, 0);
    return round(
        regions.reduce((sum, region) => sum + region.error * region.transitionWeight, 0) /
            Math.max(Number.EPSILON, weight),
    );
}

export interface AnalyzerTelemetry {
    analyzer: string;
    domain: string;
    section: string;
    confidence: number;
    success: number;
    samples: number;
}
export function analyzerRouter(
    rows: readonly AnalyzerTelemetry[],
    domain: string,
    section: string,
): { analyzer: string | null; empiricalReliability: number } {
    const candidates = rows.filter(
        (row) => row.domain === domain && (row.section === section || row.section === "any"),
    );
    const winner = [...candidates].sort(
        (a, b) => b.success * Math.min(1, b.samples / 20) - a.success * Math.min(1, a.samples / 20),
    )[0];
    return {
        analyzer: winner?.analyzer ?? null,
        empiricalReliability: winner ? round(winner.success * Math.min(1, winner.samples / 20)) : 0,
    };
}
export type AnalysisProvenance =
    | "official-metadata"
    | "provider-analysis"
    | "beatcord-model"
    | "user-correction"
    | "dj-correction"
    | "midi"
    | "official-stems";
const PROVENANCE_PRIORITY: Record<AnalysisProvenance, number> = {
    "official-metadata": 0.75,
    "provider-analysis": 0.65,
    "beatcord-model": 0.6,
    "user-correction": 0.95,
    "dj-correction": 1,
    midi: 0.85,
    "official-stems": 0.9,
};
export function provenanceWeightedAnalysis<T>(
    evidence: readonly { value: T; provenance: AnalysisProvenance; confidence: number }[],
): { value: T | null; provenance: AnalysisProvenance | null; confidence: number } {
    const selected = [...evidence].sort(
        (a, b) => PROVENANCE_PRIORITY[b.provenance] * b.confidence - PROVENANCE_PRIORITY[a.provenance] * a.confidence,
    )[0];
    return selected
        ? {
              value: selected.value,
              provenance: selected.provenance,
              confidence: round(PROVENANCE_PRIORITY[selected.provenance] * selected.confidence),
          }
        : { value: null, provenance: null, confidence: 0 };
}

export function personalizedSyncTightness(input: {
    style: "club-edm" | "funk-disco" | "other";
    userPreference: number;
}): number {
    const base = input.style === "club-edm" ? 0.95 : input.style === "funk-disco" ? 0.55 : 0.75;
    return round(clamp01(base * 0.7 + clamp01(input.userPreference) * 0.3));
}
export function requiredStemQuality(
    exposure: number,
    foregroundImportance: number,
    transitionDuration: number,
): number {
    return round(clamp01(exposure) * clamp01(foregroundImportance) * clamp01(transitionDuration));
}
export interface StemConfidenceRegion {
    start: number;
    end: number;
    confidence: number;
}
export function cleanStemRegion(
    regions: readonly StemConfidenceRegion[],
    minimum: number,
): StemConfidenceRegion | null {
    return (
        [...regions].filter((region) => region.confidence >= minimum).sort((a, b) => b.confidence - a.confidence)[0] ??
        null
    );
}
export function artifactAwareLoopScore(loopability: number, artifactRisk: number, repetitions: number): number {
    return round(clamp01(loopability) * (1 - clamp01(artifactRisk * Math.sqrt(Math.max(1, repetitions)))));
}

export interface TransitionFingerprint {
    rhythmic: number[];
    harmonic: number[];
    timbral: number[];
    roleHandoff: number[];
    energyCurve: number[];
}
export function transitionFingerprintSimilarity(a: TransitionFingerprint, b: TransitionFingerprint): number {
    const vectors = ["rhythmic", "harmonic", "timbral", "roleHandoff", "energyCurve"] as const;
    const diffs = vectors.flatMap((key) => a[key].map((value, index) => Math.abs(value - (b[key][index] ?? value))));
    return round(1 - diffs.reduce((sum, value) => sum + clamp01(value), 0) / Math.max(1, diffs.length));
}
export interface KnowledgeMixabilityEdge {
    fromMoment: string;
    toMoment: string;
    strategy: string;
    quality: number;
    context: string;
    outroType: string;
    introType: string;
    rolePlan: string;
}
export function transferableMixPattern(
    edges: readonly KnowledgeMixabilityEdge[],
    outroType: string,
    introType: string,
): KnowledgeMixabilityEdge | null {
    return (
        [...edges]
            .filter((edge) => edge.outroType === outroType && edge.introType === introType)
            .sort((a, b) => b.quality - a.quality)[0] ?? null
    );
}
export function distilledStrategyPrior(priors: readonly { strategy: string; probability: number }[]): {
    prior: string | null;
    deterministicValidationRequired: true;
} {
    return {
        prior: [...priors].sort((a, b) => b.probability - a.probability)[0]?.strategy ?? null,
        deterministicValidationRequired: true,
    };
}

export interface DegradationSignals {
    codecDamage: number;
    noise: number;
    clipping: number;
    bandwidthLoss: number;
}
export function degradationAwareEnhancement(
    signals: DegradationSignals,
    confidence: number,
): { enhance: boolean; reason: keyof DegradationSignals | "none" } {
    const entries = Object.entries(signals) as [keyof DegradationSignals, number][];
    const worst = [...entries].sort((a, b) => b[1] - a[1])[0];
    const enhance = Boolean(worst && worst[1] >= 0.6 && confidence >= 0.7);
    return { enhance, reason: enhance ? worst![0] : "none" };
}
export interface IdentityDifference {
    rhythm: number;
    melody: number;
    timbre: number;
    spatial: number;
}
export function identityDifference(input: IdentityDifference): number {
    return round(
        clamp01(input.rhythm) * 0.3 +
            clamp01(input.melody) * 0.3 +
            clamp01(input.timbre) * 0.2 +
            clamp01(input.spatial) * 0.2,
    );
}
export function djSafeRestoration(input: {
    transitionUtilityGain: number;
    identityDifference: number;
    threshold: number;
}): { allowed: boolean; artistIdentityGuarded: true } {
    return {
        allowed: input.transitionUtilityGain > 0 && input.identityDifference < input.threshold,
        artistIdentityGuarded: true,
    };
}
