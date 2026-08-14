const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export type LatencyClassV1 = "local-realtime" | "interactive" | "shared-room" | "remote-listening" | "broadcast";
export interface PresentationRequirementsV1 {
    latencyClass: LatencyClassV1;
    syncToleranceMs: number;
    lossTolerance: number;
    jitterToleranceMs: number;
    minimumQuality: "low" | "high" | "lossless";
    spatialRequired: boolean;
    fanout: number;
    bidirectional: boolean;
    presentationDeadline?: number;
}
export interface TransportCapabilityV1 {
    name: string;
    codecs: string[];
    latencyRangeMs: [number, number];
    packetLossRecovery: string[];
    maxChannels?: number;
    supportsBroadcast: boolean;
    supportsBidirectional: boolean;
    supportsTimedMetadata: boolean;
    maturity: "production" | "experimental" | "watch";
}

export function transportScore(input: {
    quality: number;
    reliability: number;
    syncPrecision: number;
    batteryEfficiency: number;
    latency: number;
    bandwidthCost: number;
    failureRisk: number;
}): number {
    return round(
        clamp01(input.quality) * 0.25 +
            clamp01(input.reliability) * 0.2 +
            clamp01(input.syncPrecision) * 0.2 +
            clamp01(input.batteryEfficiency) * 0.1 -
            clamp01(input.latency) * 0.1 -
            clamp01(input.bandwidthCost) * 0.05 -
            clamp01(input.failureRisk) * 0.1,
    );
}

export function compilePresentation(
    requirements: PresentationRequirementsV1,
    capabilities: readonly TransportCapabilityV1[],
): { transport: string | null; musicPlanChanged: false; deliveryPlanIndependent: true; reason: string } {
    const candidates = capabilities.filter(
        (item) =>
            item.latencyRangeMs[0] <= requirements.jitterToleranceMs + requirements.syncToleranceMs &&
            (!requirements.bidirectional || item.supportsBidirectional) &&
            (requirements.fanout <= 1 || item.supportsBroadcast),
    );
    const transport = candidates.sort((a, b) => a.latencyRangeMs[0] - b.latencyRangeMs[0])[0]?.name ?? null;
    return {
        transport,
        musicPlanChanged: false,
        deliveryPlanIndependent: true,
        reason: transport ? "capability-match" : "fallback-required",
    };
}

export function contextRequirements(
    context: "local-headphones" | "remote-party" | "tv-home",
): PresentationRequirementsV1 {
    if (context === "local-headphones")
        return {
            latencyClass: "local-realtime",
            syncToleranceMs: 10,
            lossTolerance: 0.01,
            jitterToleranceMs: 10,
            minimumQuality: "high",
            spatialRequired: false,
            fanout: 1,
            bidirectional: false,
        };
    if (context === "remote-party")
        return {
            latencyClass: "shared-room",
            syncToleranceMs: 25,
            lossTolerance: 0.05,
            jitterToleranceMs: 100,
            minimumQuality: "high",
            spatialRequired: false,
            fanout: 20,
            bidirectional: true,
        };
    return {
        latencyClass: "remote-listening",
        syncToleranceMs: 50,
        lossTolerance: 0.02,
        jitterToleranceMs: 200,
        minimumQuality: "lossless",
        spatialRequired: true,
        fanout: 1,
        bidirectional: false,
    };
}

export const LE_AUDIO_BASELINE = {
    codec: "LC3",
    features: ["multi-stream", "broadcast-audio", "auracast"],
    lc3plusAssumed: false,
} as const;
export function auracastArchitecture(input: { listeners: number; controlClients: number }): {
    audioPlane: "auracast-broadcast";
    controlPlane: "session-data-channel";
    planesSeparated: true;
    fanout: number;
} {
    return {
        audioPlane: "auracast-broadcast",
        controlPlane: "session-data-channel",
        planesSeparated: true,
        fanout: input.listeners,
    };
}

export interface WirelessAudioProfileV1 {
    codec: string;
    sampleRate: number;
    bitDepth?: number;
    measuredLatencyMs?: number;
    lossless: boolean;
    packetLossProtection?: string;
    confidence: number;
}
export function wirelessCapability(profile: WirelessAudioProfileV1): {
    profile: WirelessAudioProfileV1;
    verifiedLossless: boolean;
    brandingUsedAsEvidence: false;
    latencyClaim: "measured" | "unknown";
} {
    return {
        profile,
        verifiedLossless: profile.lossless && profile.confidence >= 0.9,
        brandingUsedAsEvidence: false,
        latencyClaim: profile.measuredLatencyMs === undefined ? "unknown" : "measured",
    };
}

export function lc3plusPolicy(input: {
    baselineLeAudio: boolean;
    lc3plusNegotiated: boolean;
    losslessProfileNegotiated: boolean;
}): { codec: "LC3" | "LC3plus"; lossless: boolean; vendorLatencyUniversalized: false } {
    return {
        codec: input.lc3plusNegotiated ? "LC3plus" : "LC3",
        lossless: input.lc3plusNegotiated && input.losslessProfileNegotiated,
        vendorLatencyUniversalized: false,
    };
}

export function opusRemotePolicy(input: { opusVersion: "1.6"; inputRate: number; testsShowHdValue: boolean }): {
    sampleRate: 48_000 | 96_000;
    lossless: false;
    dredAvailable: boolean;
    hdLabelMeansLossless: false;
} {
    return {
        sampleRate: input.inputRate >= 96_000 && input.testsShowHdValue ? 96_000 : 48_000,
        lossless: false,
        dredAvailable: true,
        hdLabelMeansLossless: false,
    };
}

export const CONTROL_AUDIO_PLANE_ARCHITECTURE = {
    sessionServerOwns: ["control", "state", "events"],
    audioMasterOwns: ["render", "clock", "audio-transport"],
    remoteControllersCarryAudio: false,
} as const;
