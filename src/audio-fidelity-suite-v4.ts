const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export const AUDIO_ARCHITECTURE_V4 = [
    "immutable-source",
    "format-ingest",
    "content-timeline",
    "float-pcm-core",
    "dsp-stems-spatial-ir",
    "music-compiler",
    "transition-plan",
    "preview-lab",
    "realtime-execution",
    "presentation-renderer",
    "device-route",
] as const;
export const CODEC_SPATIAL_INDEPENDENCE = {
    formatsAreBackends: true,
    musicalIntentOwnedByBeatcord: true,
    codecDoesNotDefineSpatialScene: true,
} as const;
export const AUDIO_IMPLEMENTATION_PHASES_V4 = {
    core: [
        "flac-alac-regression",
        "immutable-source",
        "source-resolution",
        "content-normalization",
        "gapless-corpus",
        "float32",
        "resampling-provenance",
        "true-peak",
        "bit-perfect-capability",
    ],
    dsp: [
        "stretch-benchmark",
        "r2-r3-routing",
        "resampler-benchmark",
        "final-dither",
        "null-tests",
        "artifact-taxonomy",
        "codec-roundtrip-critic",
        "delivery-path",
    ],
    openImmersive: [
        "immersive-ir",
        "iamf-ingest-export",
        "oar-binaural",
        "oar-speakers",
        "downmix-benchmark",
        "spatial-transition",
        "role-collision",
        "binaural-critic",
    ],
    commercialImmersive: [
        "asaf-feasibility",
        "dolby-partnership",
        "ac4-research",
        "native-atmos-access",
        "metadata-preservation",
        "native-scene-transitions",
    ],
} as const;

export type FidelityBenchNameV4 =
    | "lossless-roundtrip"
    | "gapless"
    | "resample"
    | "stretch"
    | "true-peak"
    | "codec-roundtrip"
    | "spatial-render"
    | "downmix"
    | "route-change"
    | "metadata-preservation";
export const AUDIO_FIDELITY_SUITE_V4: readonly FidelityBenchNameV4[] = [
    "lossless-roundtrip",
    "gapless",
    "resample",
    "stretch",
    "true-peak",
    "codec-roundtrip",
    "spatial-render",
    "downmix",
    "route-change",
    "metadata-preservation",
];

export function fidelityBenchResult(
    name: FidelityBenchNameV4,
    metrics: readonly number[],
    threshold = 0.8,
): { name: FidelityBenchNameV4; score: number; passed: boolean; measuredNotClaimed: true } {
    const score = metrics.length ? round(metrics.reduce((sum, value) => sum + clamp01(value), 0) / metrics.length) : 0;
    return { name, score, passed: score >= threshold, measuredNotClaimed: true };
}

export const LOSSLESS_FIXTURES_V4 = ["16-44.1", "24-44.1", "24-48", "24-96", "24-192"] as const;
export const GAPLESS_FIXTURES_V4 = ["live-album", "dj-mix", "concept-album", "sample-accurate-synthetic"] as const;
export const RESAMPLE_METRICS_V4 = [
    "passband",
    "alias-rejection",
    "phase",
    "impulse",
    "noise",
    "cpu",
    "latency",
    "perceptual-ab",
] as const;
export const STRETCH_METRICS_V4 = [
    "artifact-rate",
    "transient-integrity",
    "vocal-naturalness",
    "bass-stability",
    "stereo-image",
    "cpu",
] as const;
export const METADATA_OPERATIONS_V4 = ["copy", "trim", "join", "remux", "decode", "encode"] as const;

export function qualityGuardianV4(input: {
    canBypass: boolean;
    requiredProcessingTier: number;
    deliveryValidation: number;
}): {
    action: "bypass" | "execute-minimum" | "fallback";
    processingTier: number;
    actualDeliveryValidated: boolean;
    maximumAvailableProcessingUsed: false;
} {
    if (input.canBypass)
        return {
            action: "bypass",
            processingTier: 0,
            actualDeliveryValidated: input.deliveryValidation >= 0.8,
            maximumAvailableProcessingUsed: false,
        };
    if (input.deliveryValidation < 0.5)
        return {
            action: "fallback",
            processingTier: Math.min(1, input.requiredProcessingTier),
            actualDeliveryValidated: false,
            maximumAvailableProcessingUsed: false,
        };
    return {
        action: "execute-minimum",
        processingTier: Math.max(0, input.requiredProcessingTier),
        actualDeliveryValidated: true,
        maximumAvailableProcessingUsed: false,
    };
}

export const AUDIO_RESEARCH_PRIORITY_V4 = {
    buildNow: [
        "robust-lossless-ingest",
        "canonical-content-timeline",
        "gapless-priming",
        "float-dsp",
        "true-peak",
        "resampling-provenance",
        "bit-perfect-lane",
        "codec-roundtrip-architecture",
    ],
    prototypeNext: [
        "r2-r3-router",
        "delivery-aware-critic",
        "format-neutral-immersive-ir",
        "iamf-oar",
        "spatial-role-handoff",
        "downmix-robustness",
    ],
    partnerWatch: ["native-dolby-objects", "ac4-encoding", "asaf-apac", "provider-spatial-objects"],
} as const;
