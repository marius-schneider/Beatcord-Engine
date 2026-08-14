const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
export interface PlaybackTwinConfidence {
    deviceIdentification: number;
    frequencyResponseKnowledge: number;
    environmentKnowledge: number;
    spatialProfileQuality: number;
    userPreferenceEvidence: number;
}
export function playbackTwinConfidence(input: PlaybackTwinConfidence): number {
    const values = Object.values(input).map(clamp01);
    return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
export interface DeviceAcousticProfile {
    deviceClass: string;
    headphoneModel?: string;
    form: "open" | "closed" | "in-ear" | "speaker" | "unknown";
    anc?: boolean;
    transparency?: boolean;
    spatialSupport?: boolean;
    frequencyResponseKnown: boolean;
    maxOutputKnown: boolean;
    latencyKnown: boolean;
}
export interface EnvironmentAcousticProfile {
    noiseLevelClass: "quiet" | "moderate" | "loud";
    scene?: "home" | "transport" | "street" | "office" | "crowd";
    speechActivity?: number;
    confidence: number;
    ephemeral: true;
}
export interface PerceptualDifferenceBudget {
    tonalChange: number;
    dynamicChange: number;
    spatialChange: number;
    loudnessChange: number;
}
export function perceptualDifferenceBudget(
    experience: "chill" | "party" | "accessibility",
    explicitOverride: boolean,
): PerceptualDifferenceBudget {
    const scale = explicitOverride || experience === "accessibility" ? 0.8 : experience === "party" ? 0.35 : 0.15;
    return { tonalChange: scale, dynamicChange: scale, spatialChange: scale * 0.5, loudnessChange: scale * 0.5 };
}
export function playbackTwinPolicy(input: {
    device: DeviceAcousticProfile;
    environment: EnvironmentAcousticProfile;
    confidence: PlaybackTwinConfidence;
}): { adaptations: string[]; originalMasterPrimary: true; proprietaryHrtfGenerated: false; confidence: number } {
    const adaptations: string[] = [
        "output-aware-loudness",
        "output-aware-bass-transients",
        "presentation-preference",
        "spatial-capability-routing",
    ];
    if (input.environment.noiseLevelClass !== "quiet") adaptations.push("environment-volume-recommendation");
    return {
        adaptations,
        originalMasterPrimary: true,
        proprietaryHrtfGenerated: false,
        confidence: playbackTwinConfidence(input.confidence),
    };
}
export type TwinControlMode = "automatic" | "suggested" | "manual";
export function playbackTwinExperiment(
    mode: TwinControlMode,
    metrics: { preference: number; clarity: number; naturalness: number; artistFidelity: number; fatigue: number },
): { mode: TwinControlMode; score: number; userControlBoundaryMeasured: true } {
    return {
        mode,
        score: round(
            clamp01(metrics.preference) * 0.25 +
                clamp01(metrics.clarity) * 0.2 +
                clamp01(metrics.naturalness) * 0.2 +
                clamp01(metrics.artistFidelity) * 0.25 +
                (1 - clamp01(metrics.fatigue)) * 0.1,
        ),
        userControlBoundaryMeasured: true,
    };
}

export type ExposureSourceV2 =
    | "user-search"
    | "user-queue"
    | "friend"
    | "artist-page"
    | "beatcord-recommendation"
    | "crowd"
    | "chart";
export interface ExposureLedgerEntryV2 {
    trackId: string;
    exposureSource: ExposureSourceV2;
    rankPosition?: number;
    explorationPolicy?: string;
    policyVersion?: string;
    estimatedPropensity?: number;
    context: string;
    recentAlgorithmicExposureCount: number;
}
const AGENCY_PRIORS: Record<string, number> = {
    "user-search": 1,
    "user-queue": 0.95,
    friend: 0.85,
    "beatcord-save": 0.75,
    "beatcord-complete": 0.35,
    "passive-no-skip": 0.15,
};
export function exposureAgencyWeight(
    entry: ExposureLedgerEntryV2,
    outcome: "save" | "complete" | "no-skip",
): { weight: number; heuristicPrior: true; saturationApplied: boolean } {
    const key =
        entry.exposureSource === "beatcord-recommendation"
            ? `beatcord-${outcome}`
            : outcome === "no-skip"
              ? "passive-no-skip"
              : entry.exposureSource;
    const base = AGENCY_PRIORS[key] ?? 0.4;
    const saturation =
        entry.exposureSource === "beatcord-recommendation"
            ? 1 / Math.sqrt(entry.recentAlgorithmicExposureCount + 1)
            : 1;
    return { weight: round(base * saturation), heuristicPrior: true, saturationApplied: saturation < 1 };
}
