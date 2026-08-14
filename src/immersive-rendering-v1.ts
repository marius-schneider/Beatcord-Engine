const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export type SpatialSourceProvenanceV2 =
    | "native-multitrack"
    | "native-atmos"
    | "native-iamf"
    | "native-asaf"
    | "artist-spatial"
    | "generated-upmix"
    | "binaural-render"
    | "unknown";
export interface ImmersiveMusicIRV1 {
    beds: string[];
    objects: { id: string; role: string; position: [number, number, number] }[];
    musicalRoles: string[];
    trajectories: string[];
    ambience?: string[];
    loudness: { integratedLkfs: number; truePeakDbtp: number };
    downmixIntent: "preserve-roles" | "renderer-specific";
    provenance: SpatialSourceProvenanceV2;
}

export function spatialPresentationName(
    provenance: SpatialSourceProvenanceV2,
): "Native Atmos" | "Native IAMF" | "Native ASAF" | "Beatcord Spatial Presentation" | "Stereo" {
    if (provenance === "native-atmos") return "Native Atmos";
    if (provenance === "native-iamf") return "Native IAMF";
    if (provenance === "native-asaf") return "Native ASAF";
    if (provenance === "generated-upmix" || provenance === "artist-spatial") return "Beatcord Spatial Presentation";
    return "Stereo";
}

export function atmosDeliveryValidation(input: {
    provenance: SpatialSourceProvenanceV2;
    bitDepth: number;
    sampleRate: number;
    integratedLkfs: number;
    truePeakDbtp: number;
    createdByDemixingStereo: boolean;
}): { validAppleMusicAtmos: boolean; localResearchOnly: boolean; reasons: string[] } {
    const reasons: string[] = [];
    if (input.provenance !== "native-atmos") reasons.push("not-native-atmos");
    if (input.bitDepth !== 24 || input.sampleRate !== 48_000) reasons.push("requires-24bit-48khz");
    if (input.integratedLkfs > -18) reasons.push("loudness-above-minus-18-lkfs");
    if (input.truePeakDbtp > -1) reasons.push("true-peak-above-minus-1-dbtp");
    if (input.createdByDemixingStereo) reasons.push("stereo-demix-prohibited");
    return {
        validAppleMusicAtmos: reasons.length === 0,
        localResearchOnly: input.createdByDemixingStereo || input.provenance === "generated-upmix",
        reasons,
    };
}

export const IMMERSIVE_BACKENDS = {
    stereo: "beatcord-stereo",
    binaural: "oar-binaural",
    multichannel: "oar-speakers",
    iamf: "iamf-oar",
    asaf: "apple-partner",
    dolby: "dolby-partner",
} as const;
export const OPEN_IMMERSIVE_LAB = ["musical-ir", "immersive-ir", "iamf", "oar", "binaural-or-speakers"] as const;
export const APPLE_AUDIO_FORMATS = {
    alac: "lossless-pcm-compression",
    asaf: "immersive-production-representation",
    apac: "immersive-delivery-codec",
} as const;
export const FFMPEG_LOUDNORM = {
    standard: "EBU-R128",
    modes: ["single-pass", "double-pass", "linear", "dynamic"],
    measures: ["integrated-loudness", "loudness-range", "maximum-true-peak"],
    dynamicOversamplingHz: 192_000,
    oversamplingPurpose: "intersample-true-peak-detection",
    highResolutionSoundClaim: false,
} as const;
export const LOUDNESS_HIERARCHY = [
    "source-loudness",
    "track-playback-gain",
    "transition-gain-automation",
    "session-loudness-policy",
    "safety-true-peak",
] as const;

export function transitionLoudnessPolicy(input: {
    albumDynamics: number;
    experienceDynamics: number;
    loudnessJump: number;
}): { targetAutomation: number; identicalMomentaryNormalization: false; preservesAlbumDynamics: boolean } {
    return {
        targetAutomation: round(Math.min(clamp01(input.loudnessJump), 0.5)),
        identicalMomentaryNormalization: false,
        preservesAlbumDynamics: input.albumDynamics >= input.experienceDynamics * 0.5,
    };
}

export interface FFmpegCapabilitiesV2 {
    decoders: string[];
    encoders: string[];
    demuxers: string[];
    muxers: string[];
    filters: string[];
    libraries: { rubberband: boolean; soxr: boolean; mpegh: boolean };
}
export function ffmpegRole(capabilities: FFmpegCapabilitiesV2): {
    offline: string[];
    realtimeCriticalPath: false;
    immersiveAware: boolean;
} {
    return {
        offline: ["probe", "demux", "decode", "metadata", "containers", "conversion", "export"],
        realtimeCriticalPath: false,
        immersiveAware: capabilities.decoders.includes("mpegh") || capabilities.muxers.includes("iamf"),
    };
}

export function truePeakGuard(input: { samplePeakDbfs: number; truePeakDbtp: number; targetDbtp: number }): {
    gainReductionDb: number;
    samplePeakIsTruePeak: false;
    postMix: true;
} {
    return {
        gainReductionDb: round(Math.max(0, input.truePeakDbtp - input.targetDbtp)),
        samplePeakIsTruePeak: false,
        postMix: true,
    };
}

export interface CodecRoundTripMetricsV1 {
    truePeakDelta: number;
    transientSmearing: number;
    preEcho: number;
    spectralChange: number;
    stereoImageChange: number;
    bassPhaseError: number;
}
export function codecRoundTripCritic(metrics: CodecRoundTripMetricsV1): {
    score: number;
    passed: boolean;
    preCodecOnly: false;
} {
    const risk = Object.values(metrics).reduce((sum, value) => sum + clamp01(value), 0) / 6;
    return { score: round(1 - risk), passed: risk <= 0.2, preCodecOnly: false };
}

export interface DeliveryPathV1 {
    codec?: string;
    bitrate?: number;
    sampleRate: number;
    renderer?: "stereo" | "binaural" | "speakers";
    device?: string;
}
export function renderRobustness(qualities: { stereo: number; binaural?: number; speakers?: number }): {
    score: number;
    renderInvariant: boolean;
    testedNotAssumed: true;
} {
    const relevant = [qualities.stereo, qualities.binaural, qualities.speakers]
        .filter((value): value is number => value !== undefined)
        .map(clamp01);
    const score = round(Math.min(...relevant));
    return { score, renderInvariant: score >= 0.75, testedNotAssumed: true };
}

export interface BinauralCriticV1 {
    externalization: number;
    localizationStability: number;
    spectralNaturalness: number;
    frontBackConfusionRisk: number;
    spatialIntegrity: number;
}
export function binauralQuality(critic: BinauralCriticV1): number {
    return round(
        (clamp01(critic.externalization) +
            clamp01(critic.localizationStability) +
            clamp01(critic.spectralNaturalness) +
            (1 - clamp01(critic.frontBackConfusionRisk)) +
            clamp01(critic.spatialIntegrity)) /
            5,
    );
}

export function spatialStemPolicy(input: {
    provenance: SpatialSourceProvenanceV2;
    spatialAwareMssQuality: number;
    nativeObjectsAvailable: boolean;
}): { action: "use-native-objects" | "spatial-aware-separation" | "preserve-master"; authenticAtmosClaim: boolean } {
    if (input.nativeObjectsAvailable)
        return { action: "use-native-objects", authenticAtmosClaim: input.provenance === "native-atmos" };
    if (input.spatialAwareMssQuality >= 0.85 && input.provenance !== "binaural-render")
        return { action: "spatial-aware-separation", authenticAtmosClaim: false };
    return { action: "preserve-master", authenticAtmosClaim: false };
}

export function spatialSafeMode(input: { nativeSpatial: boolean; generatedQuality: number; creativeMode: boolean }): {
    render: "native-spatial" | "creative-spatial" | "high-quality-stereo";
    spatializeBecauseDeviceSupports: false;
} {
    return {
        render: input.nativeSpatial
            ? "native-spatial"
            : input.creativeMode && input.generatedQuality >= 0.85
              ? "creative-spatial"
              : "high-quality-stereo",
        spatializeBecauseDeviceSupports: false,
    };
}
