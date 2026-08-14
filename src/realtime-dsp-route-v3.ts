export type StretchTierV3 = "fast-r2" | "hq-realtime-r3" | "offline-r3";
export function stretchQualityTier(input: { realtime: boolean; cpuHeadroom: number; preview: boolean }): {
    tier: StretchTierV3;
    initializedBeforeRealtime: true;
} {
    if (input.preview) return { tier: "offline-r3", initializedBeforeRealtime: true };
    return {
        tier: input.realtime && input.cpuHeadroom >= 0.5 ? "hq-realtime-r3" : "fast-r2",
        initializedBeforeRealtime: true,
    };
}

export function sectionAdaptiveStretch(section: "drums" | "vocals" | "ambient" | "bass"): {
    transient: string;
    phase: string;
    window: string;
    formants: boolean;
    channelsTogether: boolean;
} {
    if (section === "drums")
        return { transient: "crisp", phase: "independent", window: "short", formants: false, channelsTogether: true };
    if (section === "vocals")
        return { transient: "smooth", phase: "laminar", window: "long", formants: true, channelsTogether: true };
    if (section === "bass")
        return { transient: "mixed", phase: "laminar", window: "medium", formants: false, channelsTogether: true };
    return { transient: "smooth", phase: "laminar", window: "long", formants: false, channelsTogether: true };
}

export type DSPBackendV3 =
    | "rubberband"
    | "libswresample"
    | "soxr"
    | "vdsp"
    | "native-simd"
    | "oar"
    | "platform-renderer";
export function routeDspBackend(job: {
    type: "stretch" | "resample" | "spatial" | "loudness";
    realtime: boolean;
    platform: "apple" | "other";
    openImmersive: boolean;
    quality: "fast" | "hq";
}): DSPBackendV3 {
    if (job.type === "stretch") return "rubberband";
    if (job.type === "resample") return !job.realtime && job.quality === "hq" ? "soxr" : "libswresample";
    if (job.type === "spatial") return job.openImmersive ? "oar" : "platform-renderer";
    return job.platform === "apple" ? "vdsp" : "native-simd";
}

export interface AudioRouteFormatV2 {
    hardwareRate: number;
    channels: number;
    latencyMs: number;
    deviceId: string;
}
export function negotiateRoute(
    requestedRate: number,
    actual: AudioRouteFormatV2,
): { rate: number; requestedHonored: boolean; resampleRequired: boolean; queriedActualRoute: true } {
    return {
        rate: actual.hardwareRate,
        requestedHonored: requestedRate === actual.hardwareRate,
        resampleRequired: requestedRate !== actual.hardwareRate,
        queriedActualRoute: true,
    };
}

export const DSP_PREWARM = [
    "initialize",
    "prime-buffers",
    "warm-fft-plans",
    "preallocate",
    "crossfade-into-path",
] as const;
export const ROUTE_CHANGE_STATES_V2 = [
    "stable",
    "route-change-requested",
    "pause-complex-automation",
    "negotiate-format",
    "prime-output",
    "crossfade",
    "stable",
] as const;

export function rendererChange(input: {
    experience: string;
    energy: number;
    journeyTarget: string;
    currentTrack: string;
    from: string;
    to: string;
}): {
    experience: string;
    energy: number;
    journeyTarget: string;
    currentTrack: string;
    renderRecompiled: true;
    journeyReplanned: false;
    route: string;
} {
    return {
        experience: input.experience,
        energy: input.energy,
        journeyTarget: input.journeyTarget,
        currentTrack: input.currentTrack,
        renderRecompiled: true,
        journeyReplanned: false,
        route: `${input.from}->${input.to}`,
    };
}

export interface AudioCapabilityV2 {
    codecs: string[];
    spatial: string[];
    dsp: string[];
    sampleRates: number[];
    maxChannels: number;
    rawPcm: boolean;
}
export function capabilityMatrix(kind: "local-flac" | "provider-playback" | "dolby-adm" | "iamf"): AudioCapabilityV2 {
    if (kind === "local-flac")
        return {
            codecs: ["flac"],
            spatial: ["stereo"],
            dsp: ["full", "stems"],
            sampleRates: [44_100, 48_000, 96_000],
            maxChannels: 8,
            rawPcm: true,
        };
    if (kind === "dolby-adm")
        return {
            codecs: ["pcm-adm"],
            spatial: ["objects", "beds"],
            dsp: ["partner-renderer"],
            sampleRates: [48_000],
            maxChannels: 128,
            rawPcm: true,
        };
    if (kind === "iamf")
        return {
            codecs: ["iamf"],
            spatial: ["objects", "ambisonics", "channels"],
            dsp: ["oar"],
            sampleRates: [48_000],
            maxChannels: 64,
            rawPcm: true,
        };
    return {
        codecs: ["provider-defined"],
        spatial: ["provider-defined"],
        dsp: ["capability-dependent"],
        sampleRates: [],
        maxChannels: 2,
        rawPcm: false,
    };
}
