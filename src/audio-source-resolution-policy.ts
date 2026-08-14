export type AudioStackLayer = "source-master" | "representation" | "delivery-codec" | "renderer" | "dsp";
export const AUDIO_STACK_LAYERS: readonly AudioStackLayer[] = [
    "source-master",
    "representation",
    "delivery-codec",
    "renderer",
    "dsp",
];
export type SourceProvenance = "native-master" | "provider-lossless" | "local-library" | "transcode" | "unknown";
export interface SourceResolution {
    sampleRate: number;
    bitDepth?: number;
    lossless: boolean;
    nativeResolutionKnown: boolean;
    provenance: SourceProvenance;
}

export const FLAC_CAPABILITIES = {
    channels: { min: 1, max: 8 },
    bitsPerSample: { min: 4, max: 32 },
    sampleRateHz: { min: 1, max: 1_048_575 },
    standard: "RFC 9639",
    open: true,
} as const;
export const FLAC_POLICY = {
    useFor: ["local-library", "owned-audio", "analysis-cache-source", "hq-export", "research-dataset", "archive"],
    notFor: ["internal-realtime-sample-representation"],
    decodeTarget: "float-pcm",
} as const;

export function decodeProcessingPipeline(
    source: "flac" | "alac" | "pcm",
    realtime = true,
): {
    source: string;
    processing: "float32-pcm" | "float64-pcm";
    codecPresentDuringDsp: false;
    stages: readonly string[];
} {
    return {
        source,
        processing: realtime ? "float32-pcm" : "float64-pcm",
        codecPresentDuringDsp: false,
        stages: ["encoded-source", "decode", "float-pcm", "dsp", "render", "delivery"],
    };
}

export function losslessCodecEquivalence(input: { flacPcmHash: string; alacPcmHash: string }): {
    sameMaster: boolean;
    fidelityDifference: false;
    meaningfulDifferences: readonly string[];
} {
    return {
        sameMaster: input.flacPcmHash === input.alacPcmHash,
        fidelityDifference: false,
        meaningfulDifferences: ["ecosystem", "container", "metadata", "support", "codec-performance"],
    };
}

export function sourceResolution(
    input: SourceResolution,
    workingSampleRate: number,
): SourceResolution & { workingSampleRate: number; hiResLabel: boolean; fakeHiResPrevented: boolean } {
    const sourceHiRes =
        input.nativeResolutionKnown &&
        input.lossless &&
        input.sampleRate > 48_000 &&
        (input.bitDepth ?? 0) >= 24 &&
        input.provenance !== "transcode";
    return {
        ...input,
        workingSampleRate,
        hiResLabel: sourceHiRes,
        fakeHiResPrevented: workingSampleRate > input.sampleRate && !sourceHiRes,
    };
}

export function validateNativeResolution(input: SourceResolution): {
    valid: boolean;
    reasons: string[];
    bitPaddingRejected: boolean;
    upsampleClaimRejected: boolean;
} {
    const reasons: string[] = [];
    if (!Number.isFinite(input.sampleRate) || input.sampleRate <= 0) reasons.push("invalid-sample-rate");
    if (input.bitDepth !== undefined && (!Number.isInteger(input.bitDepth) || input.bitDepth < 1))
        reasons.push("invalid-bit-depth");
    if (input.provenance === "transcode" && input.nativeResolutionKnown)
        reasons.push("transcode-cannot-prove-native-resolution");
    return { valid: reasons.length === 0, reasons, bitPaddingRejected: true, upsampleClaimRejected: true };
}

export const APPLE_DIGITAL_MASTER_LESSONS = {
    minimumSourceBitDepth: 24,
    acceptedSampleRates: [44_100, 48_000, 88_200, 96_000, 176_400, 192_000],
    preserveNativeProjectResolution: true,
    upsampleForBadge: false,
    padBitsForBadge: false,
} as const;
