const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export type RecoveryMethodV2 = "retransmit" | "fec" | "dred" | "plc" | "conceal";
export type MusicalQosClassV2 = "A" | "B" | "C" | "D";
export type MusicalBoundaryV2 = "beat" | "bar" | "phrase" | "section";

export interface MediaProtectionIntentV2 {
    importance: number;
    startTime: number;
    durationMs: number;
}

export interface ScheduledMediaObjectV2 {
    id: string;
    kind: "audio" | "lyrics" | "lights" | "haptics" | "visuals" | "reaction" | "analytics";
    presentationTime: number;
    deadline: number;
    priority: number;
    qosClass: MusicalQosClassV2;
    payloadRef: string;
}

export interface SyncReportV2 {
    clockOffsetMs: number;
    bufferMs: number;
    playoutDriftMs: number;
    lateObjects: number;
}

export interface EndpointLatencyProfileV2 {
    decodeMs: number;
    renderMs: number;
    deviceMs: number;
    transportMs: number;
    confidence: number;
}

export interface ComputeCapabilityV2 {
    device: "mac-m" | "mobile" | "browser";
    batteryLevel: number;
    thermalPressure: number;
    cachedStems: boolean;
}

export interface PresentationProgramV2 {
    renderPlan: string;
    transportPlan: string;
    bufferPlan: { targetMs: number; maximumMs: number };
    clockPlan: { clockFirst: true; syncFeedback: true };
    computePlan: string;
    fallbackPlan: string;
    musicPlanChanged: false;
}

export function choosePacketRecovery(input: {
    retransmissionEtaMs: number;
    timeUntilPlayoutMs: number;
    fecAvailable: boolean;
    dredAvailable: boolean;
    dredMaturity: "production" | "prototype" | "watch";
}): RecoveryMethodV2 {
    if (input.retransmissionEtaMs < input.timeUntilPlayoutMs) return "retransmit";
    if (input.fecAvailable) return "fec";
    if (input.dredAvailable && input.dredMaturity === "prototype") return "dred";
    return input.timeUntilPlayoutMs > 0 ? "plc" : "conceal";
}

export function momentAwareProtection(intent: MediaProtectionIntentV2): {
    importance: number;
    bufferMarginMs: number;
    redundancy: "standard" | "elevated" | "maximum";
    bitrateReserve: number;
    latencyInflationCapped: true;
} {
    const importance = clamp01(intent.importance);
    const redundancy = importance >= 0.85 ? "maximum" : importance >= 0.55 ? "elevated" : "standard";
    return {
        importance: round(importance),
        bufferMarginMs: Math.round(8 + importance * 32),
        redundancy,
        bitrateReserve: round(0.05 + importance * 0.2),
        latencyInflationCapped: true,
    };
}

export function qosForMedia(kind: ScheduledMediaObjectV2["kind"], transitionCritical = false): MusicalQosClassV2 {
    if (kind === "audio") return "A";
    if (["lyrics", "lights", "haptics", "visuals"].includes(kind)) return transitionCritical ? "A" : "B";
    if (kind === "reaction") return "C";
    return "D";
}

export function scheduleMediaObject(
    input: Omit<ScheduledMediaObjectV2, "deadline" | "qosClass"> & {
        endpoint: EndpointLatencyProfileV2;
        transitionCritical?: boolean;
    },
): ScheduledMediaObjectV2 & { requiredSendTime: number; confidenceQualified: boolean } {
    const totalLatency =
        input.endpoint.decodeMs + input.endpoint.renderMs + input.endpoint.deviceMs + input.endpoint.transportMs;
    const qosClass = qosForMedia(input.kind, input.transitionCritical);
    return {
        id: input.id,
        kind: input.kind,
        presentationTime: input.presentationTime,
        deadline: input.presentationTime - input.endpoint.deviceMs - input.endpoint.renderMs,
        priority: input.priority,
        qosClass,
        payloadRef: input.payloadRef,
        requiredSendTime: input.presentationTime - totalLatency,
        confidenceQualified: input.endpoint.confidence >= 0.8,
    };
}

export function beatSafeResynchronization(report: SyncReportV2): {
    action: "micro-correct" | "rate-correct" | "musical-rejoin";
    boundary: MusicalBoundaryV2 | null;
    arbitrarySampleJump: false;
} {
    const drift = Math.abs(report.playoutDriftMs);
    if (drift <= 12) return { action: "micro-correct", boundary: null, arbitrarySampleJump: false };
    if (drift <= 80) return { action: "rate-correct", boundary: "beat", arbitrarySampleJump: false };
    return { action: "musical-rejoin", boundary: drift > 250 ? "phrase" : "bar", arbitrarySampleJump: false };
}

export function compilePresentationProgram(input: {
    compute: ComputeCapabilityV2;
    networkQuality: number;
    syncReport: SyncReportV2;
    localMaster: boolean;
}): PresentationProgramV2 {
    const network = clamp01(input.networkQuality);
    const stressed = input.compute.batteryLevel < 0.2 || input.compute.thermalPressure > 0.75;
    const computePlan =
        input.compute.device === "mac-m" && !stressed
            ? "hq-stems-r3-spatial"
            : input.compute.device === "mobile"
              ? input.compute.cachedStems
                  ? "cached-stems-simple-stretch"
                  : "master-simple-stretch"
              : "stereo-decoder";
    const transportPlan = network >= 0.8 ? "high-quality-opus" : network >= 0.5 ? "protected-opus" : "reconnect-remote";
    return {
        renderPlan: input.compute.device === "browser" ? "stereo" : "capability-renderer",
        transportPlan,
        bufferPlan: { targetMs: network >= 0.8 ? 40 : network >= 0.5 ? 80 : 140, maximumMs: 180 },
        clockPlan: { clockFirst: true, syncFeedback: true },
        computePlan,
        fallbackPlan: input.localMaster ? "continue-local-master" : "preserve-master-stereo",
        musicPlanChanged: false,
    };
}

export function transportRecoveryPolicy(input: {
    staleObjects: readonly ScheduledMediaObjectV2[];
    nextSafeBoundaryTime: number;
}): { droppedIds: string[]; preservedQos: MusicalQosClassV2[]; rejoinAt: number; localPlaybackStops: false } {
    return {
        droppedIds: input.staleObjects
            .filter((item) => item.qosClass === "C" || item.qosClass === "D")
            .map((item) => item.id),
        preservedQos: ["A", "B"],
        rejoinAt: input.nextSafeBoundaryTime,
        localPlaybackStops: false,
    };
}

export const SESSION_FABRIC_V2 = {
    production: ["hls", "webrtc", "sockets"],
    prototypeWatch: ["opus-dred", "moq-session-fabric", "tempo-playout", "multiroom-moq"],
    tracks: [
        "audio/main",
        "lyrics",
        "beat-events",
        "musical-events",
        "session-state",
        "reactions",
        "haptics",
        "lighting",
    ],
    clockFirst: true,
} as const;

export const TRANSPORT_BENCHMARK_SUITE_V2 = [
    "TransportLatencyBench",
    "JitterBench",
    "PacketLossBench",
    "RecoveryBench",
    "SyncBench",
    "MultiroomBench",
    "RouteSwitchBench",
    "BatteryBench",
    "CodecSwitchBench",
    "DeadlineMissBench",
] as const;
