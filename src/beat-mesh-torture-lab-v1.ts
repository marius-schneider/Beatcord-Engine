const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export const BEAT_MESH_TORTURE_BUCKETS_V1 = [
    "straight-edm-control",
    "half-double-time-dnb",
    "trap-halftime",
    "live-disco-tempo-drift",
    "live-rock",
    "funk-swing",
    "jazz",
    "ballad-rubato",
    "classical-expressive-tempo",
    "beatless-intro-outro",
    "3-4",
    "6-8",
    "changing-meter",
    "latin-afro-diasporic",
    "polyrhythm",
    "syncopated-electronic",
    "false-transients",
    "tempo-ramps",
] as const;

export type BeatMeshTortureBucketV1 = (typeof BEAT_MESH_TORTURE_BUCKETS_V1)[number];
export interface BeatMeshExperimentResultV1 {
    domain: BeatMeshTortureBucketV1;
    accuracy: number;
    calibration: number;
    computeCost: number;
    transitionFailures: number;
    latencyRegression: number;
    batteryRegression: number;
    falseCorrectionRate: number;
}

export function annotationInformationGain(input: {
    disagreement: number;
    downstreamImpact: number;
    futureReuse: number;
}): number {
    return round(clamp01(input.disagreement) * clamp01(input.downstreamImpact) * clamp01(input.futureReuse));
}

export function selectAnnotationWindows<
    T extends { id: string; disagreement: number; downstreamImpact: number; futureReuse: number },
>(windows: readonly T[], limit: number): (T & { annotationValue: number })[] {
    return windows
        .map((window) => ({ ...window, annotationValue: annotationInformationGain(window) }))
        .sort((a, b) => b.annotationValue - a.annotationValue || a.id.localeCompare(b.id))
        .slice(0, Math.max(0, limit));
}

export function compareBeatMeshEnsemble(input: {
    single: BeatMeshExperimentResultV1;
    ensemble: BeatMeshExperimentResultV1;
}): {
    accuracyGain: number;
    calibrationGain: number;
    failuresPrevented: number;
    computeIncrease: number;
} {
    return {
        accuracyGain: round(input.ensemble.accuracy - input.single.accuracy),
        calibrationGain: round(input.ensemble.calibration - input.single.calibration),
        failuresPrevented: input.single.transitionFailures - input.ensemble.transitionFailures,
        computeIncrease: round(input.ensemble.computeCost - input.single.computeCost),
    };
}

export function localRefinementValue(input: {
    fullTrackQuality: number;
    localWindowQuality: number;
    fullTrackCompute: number;
    localWindowCompute: number;
}): { qualityEquivalent: boolean; computeSaved: number; preferFoveation: boolean } {
    const qualityEquivalent = input.localWindowQuality >= input.fullTrackQuality - 0.02;
    const computeSaved = round(input.fullTrackCompute - input.localWindowCompute);
    return { qualityEquivalent, computeSaved, preferFoveation: qualityEquivalent && computeSaved > 0 };
}

export function beatMeshActiveTeachingValue(input: {
    correctionSeconds: 0 | 5 | 10;
    beatImprovement: number;
    phraseImprovement: number;
    transitionImprovement: number;
    futureReuse: number;
}): number {
    if (input.correctionSeconds === 0) return 0;
    const benefit =
        clamp01(input.beatImprovement) * 0.25 +
        clamp01(input.phraseImprovement) * 0.2 +
        clamp01(input.transitionImprovement) * 0.35 +
        clamp01(input.futureReuse) * 0.2;
    return round(benefit / input.correctionSeconds);
}

export function beatMeshPromotionRule(results: readonly BeatMeshExperimentResultV1[]): {
    promotedDomains: BeatMeshTortureBucketV1[];
    escalationDomains: BeatMeshTortureBucketV1[];
    globalDefault: boolean;
} {
    const promotedDomains = results
        .filter(
            (result) =>
                result.transitionFailures <= 1 &&
                result.calibration >= 0.8 &&
                result.latencyRegression <= 0.05 &&
                result.batteryRegression <= 0.05 &&
                result.falseCorrectionRate <= 0.02,
        )
        .map((result) => result.domain);
    const promoted = new Set(promotedDomains);
    const escalationDomains = results.filter((result) => !promoted.has(result.domain)).map((result) => result.domain);
    return {
        promotedDomains,
        escalationDomains,
        globalDefault: results.length === BEAT_MESH_TORTURE_BUCKETS_V1.length && escalationDomains.length === 0,
    };
}

export const BEAT_MESH_EXPERIMENTS_V1 = {
    ensemble: ["single-strongest-tracker", "multi-evidence-beat-mesh"],
    stemEvidence: ["full-mix", "full-mix-drums", "full-mix-kick-snare-bass"],
    refinement: ["full-track-hq", "cheap-global-hq-window"],
    activeTeachingSeconds: [0, 5, 10],
    measurements: ["accuracy", "confidence-calibration", "compute", "transition-outcome"],
    domainBenchmark: "raveform-edm-dj-metrical-structure",
} as const;
