const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const round = (v: number) => Math.round(v * 1000) / 1000;

export const REALTIME_ARCHITECTURE = {
    planning: ["analysis", "recommendation", "director", "simulation", "stem-preparation"],
    boundary: "immutable-plans",
    realtime: ["decode-buffers", "resample", "mix", "automation", "dsp", "output"],
    intelligenceOnCriticalPath: false,
} as const;
export interface RealtimeAudioClock {
    renderedSample: bigint;
    sampleRate: number;
    hostTime: bigint;
    outputLatencyFrames: number;
}
export function samplePresentationTime(
    clock: RealtimeAudioClock,
    eventSample: bigint,
): { renderTimeSec: number; presentationTimeSec: number } {
    const renderTimeSec = Number(eventSample - clock.renderedSample) / clock.sampleRate;
    return {
        renderTimeSec: round(renderTimeSec),
        presentationTimeSec: round(renderTimeSec + clock.outputLatencyFrames / clock.sampleRate),
    };
}

export interface ClockMapping {
    sourceClock: string;
    targetClock: string;
    offset: number;
    driftPpm: number;
    confidence: number;
}
export function convertClock(value: number, mapping: ClockMapping): { value: number; uncertainty: number } {
    return {
        value: round(value * (1 + mapping.driftPpm / 1_000_000) + mapping.offset),
        uncertainty: round(1 - clamp01(mapping.confidence)),
    };
}
export function estimateClockDrift(observations: readonly { source: number; target: number }[]): {
    driftPpm: number;
    slowResamplingRatio: number;
    hardJump: false;
} {
    if (observations.length < 2) return { driftPpm: 0, slowResamplingRatio: 1, hardJump: false };
    const first = observations[0]!,
        last = observations.at(-1)!;
    const sourceDelta = last.source - first.source;
    const targetDelta = last.target - first.target;
    const ratio = targetDelta / Math.max(0.001, sourceDelta);
    return {
        driftPpm: round((ratio - 1) * 1_000_000),
        slowResamplingRatio: round(Math.max(0.999, Math.min(1.001, ratio))),
        hardJump: false,
    };
}

export type AudioTransport = "internal" | "wired" | "usb" | "bluetooth" | "airplay" | "network";
export interface AudioRoute {
    transport: AudioTransport;
    estimatedLatencyMs: number;
    latencyConfidence: number;
    sampleRate: number;
    channels: number;
    interactiveSafe: boolean;
}
export function assessAudioRoute(route: AudioRoute): {
    clubPerformanceSafe: boolean;
    precisionClaimAllowed: boolean;
    rendererVsPresentationSeparated: true;
} {
    const wireless = route.transport === "bluetooth" || route.transport === "airplay" || route.transport === "network";
    return {
        clubPerformanceSafe: route.interactiveSafe && !wireless && route.latencyConfidence >= 0.8,
        precisionClaimAllowed: route.latencyConfidence >= 0.85,
        rendererVsPresentationSeparated: true,
    };
}
export function compensatePresentation(
    renderTimeMs: number,
    outputLatencyMs: number,
    transportLatencyMs: number,
    confidence: number,
): { presentationTimeMs: number; predictiveWindowMs: number; exactClaim: boolean } {
    return {
        presentationTimeMs: round(renderTimeMs + outputLatencyMs + transportLatencyMs),
        predictiveWindowMs: round((1 - clamp01(confidence)) * Math.max(20, outputLatencyMs + transportLatencyMs)),
        exactClaim: confidence >= 0.9,
    };
}

export interface DecoderDescriptor {
    codec: "mp3" | "aac" | "opus" | "flac" | "alac" | "wav";
    sampleRate: number;
    channels: number;
    encoderDelayFrames?: number;
    paddingFrames?: number;
    corrupt?: boolean;
}
export function prepareGaplessHandoff(
    current: DecoderDescriptor,
    next: DecoderDescriptor,
): {
    prepareNextEarly: true;
    trimLeadingFrames: number;
    trimTrailingFrames: number;
    resample: boolean;
    remixChannels: boolean;
    fallbackRequired: boolean;
    metadataTrustedAlone: false;
} {
    return {
        prepareNextEarly: true,
        trimLeadingFrames: Math.max(0, next.encoderDelayFrames ?? 0),
        trimTrailingFrames: Math.max(0, current.paddingFrames ?? 0),
        resample: current.sampleRate !== next.sampleRate,
        remixChannels: current.channels !== next.channels,
        fallbackRequired: Boolean(current.corrupt || next.corrupt),
        metadataTrustedAlone: false,
    };
}

export class RealtimeRingBuffer {
    readonly #capacity: number;
    #available = 0;
    constructor(capacityFrames: number) {
        this.#capacity = Math.max(1, capacityFrames);
    }
    write(frames: number): number {
        const accepted = Math.min(Math.max(0, frames), this.#capacity - this.#available);
        this.#available += accepted;
        return accepted;
    }
    read(frames: number): number {
        const taken = Math.min(Math.max(0, frames), this.#available);
        this.#available -= taken;
        return taken;
    }
    health(targetFrames: number, previousFrames: number): BufferHealth {
        return bufferHealth(this.#available, targetFrames, previousFrames);
    }
}
export interface BufferHealth {
    availableFrames: number;
    targetFrames: number;
    underrunRisk: number;
    trend: number;
}
export function bufferHealth(availableFrames: number, targetFrames: number, previousFrames: number): BufferHealth {
    return {
        availableFrames,
        targetFrames,
        underrunRisk: round(clamp01(1 - availableFrames / Math.max(1, targetFrames))),
        trend: round(availableFrames - previousFrames),
    };
}

export interface RealtimeBudget {
    blockDeadlineMs: number;
    cpuLoad: number;
    dspLoad: number;
    decoderLoad: number;
    xruns: number;
}
export type DspQualityLevel = "full-hq-stems" | "realtime-stems" | "classic-eq" | "gain-only" | "safe-playback";
export function chooseDspQuality(budget: RealtimeBudget): {
    level: DspQualityLevel;
    analysisMayPause: true;
    audioMustContinue: true;
} {
    const load = Math.max(budget.cpuLoad, budget.dspLoad, budget.decoderLoad);
    const level: DspQualityLevel =
        budget.xruns > 0 || load > 0.95
            ? "safe-playback"
            : load > 0.85
              ? "gain-only"
              : load > 0.72
                ? "classic-eq"
                : load > 0.58
                  ? "realtime-stems"
                  : "full-hq-stems";
    return { level, analysisMayPause: true, audioMustContinue: true };
}
export const REALTIME_MEMORY_RULES = [
    "no-blocking-locks",
    "no-network",
    "no-file-io",
    "no-dynamic-allocation",
    "no-unbounded-logging",
    "no-ml-inference",
    "no-database",
    "no-ui-synchronization",
] as const;

export interface CompiledAutomation {
    parameter: string;
    segments: AutomationSegment[];
}
export interface AutomationSegment {
    startSample: bigint;
    endSample: bigint;
    startValue: number;
    endValue: number;
    curve: "linear" | "equal-power" | "exponential";
}
export interface RenderTransitionPlan {
    startSample: bigint;
    endSample: bigint;
    automation: readonly CompiledAutomation[];
    stems: readonly string[];
    fxGraph: string;
    committed: true;
    immutable: true;
}
export function compileRenderPlan(
    plan: Omit<RenderTransitionPlan, "committed" | "immutable">,
): Readonly<RenderTransitionPlan> {
    return Object.freeze({
        ...plan,
        automation: plan.automation.map((a) =>
            Object.freeze({ ...a, segments: a.segments.map((s) => Object.freeze({ ...s })) }),
        ),
        stems: Object.freeze([...plan.stems]),
        committed: true,
        immutable: true,
    });
}

export type RouteRecoveryState =
    | "route-stable"
    | "route-change-detected"
    | "mute-hold"
    | "rebuild-graph"
    | "recalibrate"
    | "fade-back";
export function nextRouteRecoveryState(state: RouteRecoveryState): RouteRecoveryState {
    const order: RouteRecoveryState[] = [
        "route-stable",
        "route-change-detected",
        "mute-hold",
        "rebuild-graph",
        "recalibrate",
        "fade-back",
        "route-stable",
    ];
    return order[order.indexOf(state) + 1] ?? "route-stable";
}
export interface SessionRecoverySnapshot {
    activeTrack: string;
    sourcePosition: number;
    queue: string[];
    experience: string;
    committedTransition?: string;
    checksum: string;
}
export function createRecoverySnapshot(input: Omit<SessionRecoverySnapshot, "checksum">): SessionRecoverySnapshot {
    const checksum = `${input.activeTrack}:${Math.round(input.sourcePosition)}:${input.queue.length}:${input.experience}:${input.committedTransition ?? "none"}`;
    return { ...input, queue: [...input.queue], checksum };
}

export const AUDIO_TEST_MATRIX = {
    sampleRates: [44_100, 48_000, 96_000],
    formats: ["s16", "s24", "float"],
    codecs: ["mp3", "aac", "opus", "flac", "alac", "wav"],
    channels: ["mono", "stereo"],
    routes: ["bluetooth", "usb", "internal", "airplay-network"],
    faults: ["cpu-throttling", "buffer-starvation", "route-change"],
} as const;
export const OBJECTIVE_AUDIO_CHECKS = [
    "clipping",
    "true-peak",
    "dc-offset",
    "nan-inf",
    "denormals",
    "buffer-underruns",
    "discontinuities",
    "unexpected-silence",
    "phase-inversion",
    "channel-swaps",
    "sample-rate-mismatch",
] as const;
export function listeningTestStandard(target: "transition-strategy" | "tiny-artifact"): {
    method: "mushra-like" | "bs1116-inspired";
    panel: readonly string[];
} {
    return target === "transition-strategy"
        ? { method: "mushra-like", panel: LISTENING_PANELS }
        : { method: "bs1116-inspired", panel: LISTENING_PANELS };
}
export const LISTENING_PANELS = ["trained-audio-listeners", "djs", "music-producers", "normal-listeners"] as const;
