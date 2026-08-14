const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export function losslessCacheStrategy(input: {
    durationSec: number;
    channels: number;
    sampleRate: number;
    lookaheadBars: number;
}): { storeWholeDecodedLibrary: false; assets: readonly string[]; lookaheadBars: number } {
    return {
        storeWholeDecodedLibrary: false,
        assets: ["encoded-lossless-source", "small-decoded-lookahead", "analysis-cache"],
        lookaheadBars: Math.min(32, Math.max(1, input.lookaheadBars)),
    };
}

export function masterIntegrityHash(samples: readonly number[]): string {
    let hash = 0x811c9dc5;
    for (const sample of samples) {
        const normalized = Math.round(sample * 1_000_000);
        hash ^= normalized;
        hash = Math.imul(hash, 0x01000193);
    }
    return `pcm-fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
export function pcmIntegrityTest(
    original: readonly number[],
    decoded: readonly number[],
): { exact: boolean; originalHash: string; decodedHash: string } {
    const originalHash = masterIntegrityHash(original);
    const decodedHash = masterIntegrityHash(decoded);
    return { exact: original.length === decoded.length && originalHash === decodedHash, originalHash, decodedHash };
}
export function dspNullTest(
    input: readonly number[],
    output: readonly number[],
    tolerance = 1e-7,
): { passed: boolean; maxError: number; hiddenProcessingDetected: boolean } {
    const maxError = input.reduce(
        (max, value, index) => Math.max(max, Math.abs(value - (output[index] ?? Number.POSITIVE_INFINITY))),
        0,
    );
    return {
        passed: input.length === output.length && maxError <= tolerance,
        maxError: round(maxError),
        hiddenProcessingDetected: maxError > tolerance,
    };
}

export interface RoundTripBenchmarkV1 {
    codec: string;
    delaySamples: number;
    paddingSamples: number;
    loudnessDelta: number;
    truePeakDelta: number;
    transientError: number;
    spectralDifference: number;
}
export function codecRoundTripBenchmark(rows: readonly RoundTripBenchmarkV1[]): {
    passed: boolean;
    worstCodec: string | null;
    scores: { codec: string; risk: number }[];
} {
    const scores = rows
        .map((row) => ({
            codec: row.codec,
            risk: round(
                clamp01(Math.abs(row.delaySamples) / 1024) * 0.15 +
                    clamp01(Math.abs(row.paddingSamples) / 1024) * 0.1 +
                    clamp01(Math.abs(row.loudnessDelta)) * 0.15 +
                    clamp01(Math.abs(row.truePeakDelta)) * 0.2 +
                    clamp01(row.transientError) * 0.2 +
                    clamp01(row.spectralDifference) * 0.2,
            ),
        }))
        .sort((a, b) => b.risk - a.risk);
    return { passed: (scores[0]?.risk ?? 0) <= 0.25, worstCodec: scores[0]?.codec ?? null, scores };
}

export function renderMatrixBenchmark(
    rows: readonly {
        renderer: "stereo" | "binaural" | "5.1" | "7.1.4";
        roleBalance: number;
        loudness: number;
        localization: number;
        bass: number;
        foregroundClarity: number;
        transitionIntegrity: number;
    }[],
): { rendererSpecific: boolean; minimumQuality: number; qualities: { renderer: string; quality: number }[] } {
    const qualities = rows.map((row) => ({
        renderer: row.renderer,
        quality: round(
            (row.roleBalance +
                row.loudness +
                row.localization +
                row.bass +
                row.foregroundClarity +
                row.transitionIntegrity) /
                6,
        ),
    }));
    const minimumQuality = round(Math.min(...qualities.map((row) => row.quality)));
    return { rendererSpecific: minimumQuality < 0.7, minimumQuality, qualities };
}

export interface SpatialHandoffV2 {
    role: string;
    outgoingPosition: [number, number, number];
    incomingPosition: [number, number, number];
    widthCurve: number[];
    distanceCurve: number[];
}
export const SPATIAL_ROLE_OWNERSHIP_V2 = [
    "gain-ownership",
    "frequency-ownership",
    "foreground-ownership",
    "spatial-ownership",
] as const;
export function spatialHandoffPolicy(
    handoff: SpatialHandoffV2,
    purpose: "transition" | "separation" | "creative-intent" | "decoration",
): { allowed: boolean; stableImagePreferred: boolean; purpose: string } {
    const complete = handoff.widthCurve.length > 0 && handoff.distanceCurve.length > 0;
    return { allowed: complete && purpose !== "decoration", stableImagePreferred: purpose === "decoration", purpose };
}
export function immersiveCollision(input: {
    frequencyOverlap: number;
    foregroundOverlap: number;
    spatialDistance: number;
    roleConflict: number;
}): { risk: number; dimensions: readonly string[] } {
    return {
        risk: round(
            clamp01(input.frequencyOverlap) * 0.25 +
                clamp01(input.foregroundOverlap) * 0.25 +
                (1 - clamp01(input.spatialDistance)) * 0.3 +
                clamp01(input.roleConflict) * 0.2,
        ),
        dimensions: ["time", "frequency", "role", "spatial-position"],
    };
}

export type DspQualityTierV3 = 0 | 1 | 2 | 3 | 4 | 5;
export function minimumDspTier(input: {
    processing: "none" | "gain-crossfade" | "eq-dj" | "hq-stretch" | "stems" | "spatial";
}): { tier: DspQualityTierV3; minimumNecessary: true } {
    return {
        tier: { none: 0, "gain-crossfade": 1, "eq-dj": 2, "hq-stretch": 3, stems: 4, spatial: 5 }[
            input.processing
        ] as DspQualityTierV3,
        minimumNecessary: true,
    };
}
export type DeliveryQualityTierV1 = "lossless" | "high-quality-lossy" | "adaptive-lossy" | "low-bandwidth-fallback";
export function codecAwareQoe(input: {
    bandwidthKbps: number;
    losslessRequiredKbps: number;
    currentTier: DeliveryQualityTierV1;
}): { deliveryTier: DeliveryQualityTierV1; continuityOverBadge: true; dspTierIndependent: true } {
    const ratio = input.bandwidthKbps / Math.max(1, input.losslessRequiredKbps);
    const deliveryTier =
        ratio >= 1.2
            ? input.currentTier
            : ratio >= 0.6
              ? "high-quality-lossy"
              : ratio >= 0.3
                ? "adaptive-lossy"
                : "low-bandwidth-fallback";
    return { deliveryTier, continuityOverBadge: true, dspTierIndependent: true };
}

export const BEATCORD_QUALITY_HIERARCHY = [
    "correct-master",
    "no-clipping",
    "gapless-timing",
    "good-transition",
    "correct-loudness",
    "good-resampling",
    "no-dropouts",
    "correct-spatial-render",
] as const;
