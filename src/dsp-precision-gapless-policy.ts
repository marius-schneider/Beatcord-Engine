export interface QuantizationPolicyV1 {
    destinationBits: number;
    dither: "none" | "triangular" | "highpass-triangular" | "noise-shaped";
}

export function internalDspPrecision(
    job: "realtime" | "offline-measurement" | "long-fir" | "research" | "mastering-analysis",
): { format: "float32" | "float64"; intermediateQuantization: false; realtimeSuitable: boolean } {
    const format = job === "realtime" ? "float32" : "float64";
    return { format, intermediateQuantization: false, realtimeSuitable: format === "float32" };
}

export function finalQuantization(
    destinationBits: number,
    noiseShaping = false,
): QuantizationPolicyV1 & { ditherApplications: 0 | 1; internalUiExposed: false } {
    const dither = destinationBits >= 24 ? "none" : noiseShaping ? "noise-shaped" : "highpass-triangular";
    return { destinationBits, dither, ditherApplications: dither === "none" ? 0 : 1, internalUiExposed: false };
}

export function sampleRateLane(input: {
    sourceRate: number;
    deviceRate: number;
    processingRequested: boolean;
    spatial: boolean;
}): {
    lane: "native-bypass" | "canonical-48khz";
    workingRate: number;
    resampled: boolean;
    highRateQualityClaim: false;
} {
    if (!input.processingRequested && !input.spatial && input.sourceRate === input.deviceRate)
        return { lane: "native-bypass", workingRate: input.sourceRate, resampled: false, highRateQualityClaim: false };
    return {
        lane: "canonical-48khz",
        workingRate: 48_000,
        resampled: input.sourceRate !== 48_000,
        highRateQualityClaim: false,
    };
}

export function bitPerfectBypass(input: {
    lossless: boolean;
    processingRequested: boolean;
    sourceRate: number;
    deviceRate: number;
    outputIntegerCompatible: boolean;
    systemMixerTransparent: boolean;
}): { verified: boolean; claim: "bit-perfect" | "minimal-path" | "adaptive"; blockers: string[] } {
    const blockers: string[] = [];
    if (!input.lossless) blockers.push("lossy-source");
    if (input.processingRequested) blockers.push("dsp-requested");
    if (input.sourceRate !== input.deviceRate) blockers.push("sample-rate-conversion");
    if (!input.outputIntegerCompatible) blockers.push("output-format-conversion");
    if (!input.systemMixerTransparent) blockers.push("system-mixer-unverified");
    return {
        verified: blockers.length === 0,
        claim: blockers.length === 0 ? "bit-perfect" : input.processingRequested ? "adaptive" : "minimal-path",
        blockers,
    };
}

export interface DecodedAudioExtentV1 {
    rawDecodedStart: number;
    contentStart: number;
    contentEnd: number;
    encoderDelay?: number;
    endPadding?: number;
}
export function canonicalContentTimeline(
    extent: DecodedAudioExtentV1,
    rawSample: number,
): { contentSample: number; insideContent: boolean; encodedPacketTimeIgnored: true } {
    const contentSample = rawSample - extent.contentStart;
    return {
        contentSample,
        insideContent: rawSample >= extent.contentStart && rawSample < extent.contentEnd,
        encodedPacketTimeIgnored: true,
    };
}

export function gaplessIntegrity(input: {
    missingSamples: number;
    duplicateSamples: number;
    addedSilenceSamples: number;
    phaseDiscontinuity: number;
    timingOffsetSamples: number;
}): { passed: boolean; errors: string[]; sampleAccounting: true } {
    const errors: string[] = [];
    if (input.missingSamples) errors.push("missing-samples");
    if (input.duplicateSamples) errors.push("duplicate-samples");
    if (input.addedSilenceSamples) errors.push("added-silence");
    if (input.phaseDiscontinuity > 0.01) errors.push("phase-discontinuity");
    if (input.timingOffsetSamples) errors.push("timing-offset");
    return { passed: errors.length === 0, errors, sampleAccounting: true };
}

export type ImmersiveDeliveryV1 =
    | "PCM_ADM"
    | "EAC3_JOC"
    | "TRUEHD_ATMOS"
    | "AC4"
    | "IAMF"
    | "APAC"
    | "BINAURAL_PCM"
    | "MULTICHANNEL_PCM";
export function immersiveDeliveryCapability(delivery: ImmersiveDeliveryV1): {
    open: boolean;
    partnerDependent: boolean;
    sceneIndependentOfCodec: true;
} {
    const partnerDependent = ["EAC3_JOC", "TRUEHD_ATMOS", "AC4", "APAC"].includes(delivery);
    return {
        open: delivery === "IAMF" || delivery === "BINAURAL_PCM" || delivery === "MULTICHANNEL_PCM",
        partnerDependent,
        sceneIndependentOfCodec: true,
    };
}

export const RESAMPLER_POLICY = {
    realtime: "libswresample",
    hqOffline: "soxr-28bit",
    supports: ["sample-rate", "channel-rematrix", "sample-format"],
    canonicalAdaptiveRate: 48_000,
} as const;
