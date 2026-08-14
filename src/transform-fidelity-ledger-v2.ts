const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export type MetadataClassV2 =
    | "codec-delay"
    | "gapless"
    | "channel-layout"
    | "objects"
    | "spatial"
    | "loudness"
    | "source-provenance";
export interface AudioTransformContractV2 {
    preservesSamples: boolean;
    preservesTiming: boolean;
    preservesMetadata: MetadataClassV2[];
    preservesSpatialScene: boolean;
    introducesLoss: boolean;
}

export function metadataPreservationTest(
    contract: AudioTransformContractV2,
    required: readonly MetadataClassV2[],
): { passed: boolean; missing: MetadataClassV2[]; trueHdAtmosMetadataAtRisk: boolean } {
    const missing = required.filter((item) => !contract.preservesMetadata.includes(item));
    return {
        passed: missing.length === 0 && contract.preservesTiming,
        missing,
        trueHdAtmosMetadataAtRisk: required.includes("objects") && !contract.preservesSpatialScene,
    };
}

export interface DerivedAudioAssetV2 {
    sourceHash: string;
    transformations: { operation: string; contract: AudioTransformContractV2 }[];
    outputFormat: string;
    reversible: boolean;
    sourceImmutable: true;
}
export function sourceFidelityLedger(input: Omit<DerivedAudioAssetV2, "sourceImmutable">): DerivedAudioAssetV2 {
    return { ...input, sourceImmutable: true };
}

export interface RendererDivergenceBudgetV1 {
    loudness: number;
    balance: number;
    spatialPosition: number;
    transitionTiming: number;
}
export function postRendererTransitionCritic(input: {
    pcmQuality: number;
    codecQuality: number;
    rendererQuality: number;
    deviceTwinQuality: number;
    divergence: RendererDivergenceBudgetV1;
}): { finalRisk: number; stages: readonly string[]; passed: boolean } {
    const qualityRisk =
        1 -
        Math.min(
            clamp01(input.pcmQuality),
            clamp01(input.codecQuality),
            clamp01(input.rendererQuality),
            clamp01(input.deviceTwinQuality),
        );
    const divergenceRisk = Math.max(...Object.values(input.divergence).map(clamp01));
    const finalRisk = round(Math.max(qualityRisk, divergenceRisk));
    return {
        finalRisk,
        stages: [
            "musical-plan",
            "float-pcm-critic",
            "codec-roundtrip-critic",
            "renderer-critic",
            "output-device-twin",
            "final-risk",
        ],
        passed: finalRisk <= 0.25,
    };
}

export interface PortableSpatialTransitionV1 {
    roles: {
        role: string;
        ownership: "outgoing" | "incoming" | "shared";
        timing: number;
        spatialIntent: "front" | "wide" | "rear" | "height" | "background";
    }[];
    bakedChannels: false;
    formatNeutral: true;
}
export function renderSpecificAutomation(input: {
    renderer: "speaker" | "binaural";
    baseWidth: number;
    baseOverlapSec: number;
}): { width: number; overlapSec: number; musicalIdentityChanged: false } {
    return input.renderer === "binaural"
        ? { width: round(input.baseWidth * 0.7), overlapSec: input.baseOverlapSec, musicalIdentityChanged: false }
        : { width: input.baseWidth, overlapSec: round(input.baseOverlapSec * 1.2), musicalIdentityChanged: false };
}

export interface DspDependencyV1 {
    name: string;
    license: string;
    commercialAllowed: boolean;
    attributionRequired: boolean;
    platformSupport: string[];
}
export function dependencyCapability(
    dependency: DspDependencyV1,
    platform: string,
    commercialProduct: boolean,
): { usable: boolean; reason: string; licenseTracked: true } {
    const usable =
        dependency.platformSupport.includes(platform) && (!commercialProduct || dependency.commercialAllowed);
    return {
        usable,
        reason: usable ? "capability-and-license-compatible" : "platform-or-license-blocked",
        licenseTracked: true,
    };
}

export const STRETCH_BENCHMARK_REGIONS = [
    "drum-loop",
    "vocal-chorus",
    "bass-heavy-drop",
    "piano",
    "acoustic-guitar",
    "full-mix",
] as const;
export const STRETCH_BENCHMARK_RATIOS = [0.92, 0.96, 1.04, 1.08, 1.15] as const;
export function stretchRoute(requiredRatio: number): {
    action: "stretch" | "find-bridge-track";
    extremeThreshold: 0.2;
} {
    return { action: Math.abs(requiredRatio - 1) > 0.2 ? "find-bridge-track" : "stretch", extremeThreshold: 0.2 };
}

export type DspArtifactV2 =
    | "transient-smear"
    | "phasiness"
    | "flanging"
    | "granulation"
    | "formant-shift"
    | "stereo-collapse"
    | "bass-instability"
    | "pre-echo"
    | "clipping"
    | "pumping"
    | "spatial-drift";
export function artifactRepair(artifact: DspArtifactV2): string {
    return (
        (
            {
                "transient-smear": "change-stretch-mode-or-shorten-blend",
                phasiness: "change-phase-channel-policy",
                "formant-shift": "enable-formant-preservation",
                "spatial-drift": "reject-stem-or-spatial-manipulation",
                clipping: "reduce-post-mix-gain",
            } as Partial<Record<DspArtifactV2, string>>
        )[artifact] ?? "reduce-processing-tier"
    );
}

export interface SampleRateTransformV2 {
    inputRate: number;
    outputRate: number;
    reason: "engine" | "device" | "codec" | "analysis";
    backend: string;
}
export function resamplingGraph(transforms: readonly SampleRateTransformV2[]): {
    transforms: SampleRateTransformV2[];
    doubleResampling: boolean;
    warnings: string[];
} {
    const active = transforms.filter((item) => item.inputRate !== item.outputRate);
    const repeatedRate = active.some((item, index) =>
        active.slice(index + 1).some((later) => later.outputRate === item.inputRate),
    );
    return {
        transforms: [...transforms],
        doubleResampling: active.length > 1 && repeatedRate,
        warnings: active.length > 1 && repeatedRate ? ["unexpected-resampling-chain"] : [],
    };
}

export interface FidelityStageV2 {
    format: string;
    sampleRate: number;
    bitDepth?: number;
    lossless: boolean;
    verified: boolean;
}
export interface FidelityChainV2 {
    source: FidelityStageV2;
    decode: FidelityStageV2;
    dsp: FidelityStageV2;
    transport: FidelityStageV2;
    output: FidelityStageV2;
}
export function fidelityStatus(chain: FidelityChainV2): {
    simpleLabel: "Lossless" | "Spatial" | "High Quality";
    endToEndLossless: boolean;
    advanced: FidelityChainV2;
    brandingInferenceUsed: false;
} {
    const endToEndLossless = Object.values(chain).every((stage) => stage.lossless && stage.verified);
    const spatial = /spatial|iamf|atmos|asaf/i.test(chain.source.format);
    return {
        simpleLabel: endToEndLossless ? "Lossless" : spatial ? "Spatial" : "High Quality",
        endToEndLossless,
        advanced: chain,
        brandingInferenceUsed: false,
    };
}

export const AUDIO_ROUTE_TEST_MATRIX_V2 = {
    devices: ["mac-speakers", "wired-dac", "airpods", "bluetooth-speaker", "hdmi-avr", "usb-interface"],
    sourceRates: [44_100, 48_000, 96_000],
    representations: ["stereo", "spatial"],
    states: ["playback", "transition", "stretch", "stems"],
} as const;
export const AC4_RESEARCH_POLICY = {
    status: "watch-validate-independently",
    productClaimAllowed: false,
    vendorEvidenceIsSpecification: false,
} as const;
