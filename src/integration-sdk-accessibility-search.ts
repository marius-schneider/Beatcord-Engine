const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export type IntegrationKind = "discord" | "hue" | "game" | "obs" | "home";
export function integrationDiscovery(input: { kind: IntegrationKind; detected: boolean; context: string }): {
    visible: boolean;
    prompt: string | null;
    contextual: true;
    globalCatalogRequired: false;
} {
    const prompts: Record<IntegrationKind, string> = {
        discord: "Show Beatcord on Discord",
        hue: `Sync lights for ${input.context}`,
        game: "Adapt gently to this game",
        obs: "Add Beatcord surfaces to OBS",
        home: "Share musical moments with your home",
    };
    return {
        visible: input.detected,
        prompt: input.detected ? prompts[input.kind] : null,
        contextual: true,
        globalCatalogRequired: false,
    };
}

export type IntegrationHealthStatus = "healthy" | "degraded" | "disconnected";
export interface IntegrationHealth {
    integration: IntegrationKind;
    status: IntegrationHealthStatus;
    visibleToUser: true;
    retryAt?: number;
}

export function integrationHealth(
    integration: IntegrationKind,
    status: IntegrationHealthStatus,
    retryAt?: number,
): IntegrationHealth {
    return retryAt === undefined
        ? { integration, status, visibleToUser: true }
        : { integration, status, visibleToUser: true, retryAt };
}

export interface IntegrationPermissionGrant {
    integration: IntegrationKind;
    canRead: string[];
    canDo: string[];
    reversible: true;
}

export function revokeIntegrationGrant(grant: IntegrationPermissionGrant): IntegrationPermissionGrant {
    return { ...grant, canRead: [], canDo: [], reversible: true };
}

export const OBSERVATION_API = ["onTrack", "onBeat", "onSection", "onExperience", "onTransition"] as const;
export const CONTROL_API = ["requestTrack", "setExternalContext", "suggestExperience"] as const;
export function sdkSurface(api: "observation" | "control"): {
    methods: readonly string[];
    directDspMemoryAccess: false;
    canMutatePlayback: boolean;
} {
    return {
        methods: api === "observation" ? OBSERVATION_API : CONTROL_API,
        directDspMemoryAccess: false,
        canMutatePlayback: api === "control",
    };
}

export interface ExternalContext<T> {
    source: string;
    state: T;
    confidence: number;
    receivedAt: number;
    expiresIn: number;
}

export function externalContextWeight<T>(context: ExternalContext<T>, now: number, fadeMs = 2_000): number {
    const expiresAt = context.receivedAt + Math.max(0, context.expiresIn);
    if (now <= expiresAt) return clamp01(context.confidence);
    return clamp01(context.confidence) * clamp01(1 - (now - expiresAt) / Math.max(1, fadeMs));
}

export const OBS_STREAMER_POLICY = {
    surfaces: ["now-playing", "lyrics", "journey", "requests", "crowd-reactions"],
    rightsCheckRequired: true,
    audioRebroadcastAssumed: false,
} as const;

export interface SemanticHomeEvent {
    event: "build" | "drop" | "break" | "energy-change";
    energy: number;
    confidence: number;
    suggestedAction?: never;
}

export function semanticHomeEvent(
    event: SemanticHomeEvent["event"],
    energy: number,
    confidence: number,
): SemanticHomeEvent {
    return { event, energy: clamp01(energy), confidence: clamp01(confidence) };
}

export type EventTransport = "local-ipc" | "websocket" | "webhook";
export type LatencyClass = "A" | "B" | "C" | "D";
export function eventDeliveryPolicy(input: {
    frequency: "realtime" | "interactive" | "social" | "analytics";
    remote: boolean;
}): {
    latencyClass: LatencyClass;
    targetLatency: string;
    transports: EventTransport[];
    sampleAccurateInternetWebhook: false;
} {
    if (input.frequency === "realtime")
        return {
            latencyClass: "A",
            targetLatency: "<10ms",
            transports: ["local-ipc"],
            sampleAccurateInternetWebhook: false,
        };
    if (input.frequency === "interactive")
        return {
            latencyClass: "B",
            targetLatency: "<100ms",
            transports: input.remote ? ["websocket"] : ["local-ipc", "websocket"],
            sampleAccurateInternetWebhook: false,
        };
    if (input.frequency === "social")
        return {
            latencyClass: "C",
            targetLatency: "<1s",
            transports: ["websocket", "webhook"],
            sampleAccurateInternetWebhook: false,
        };
    return {
        latencyClass: "D",
        targetLatency: "eventual",
        transports: ["webhook"],
        sampleAccurateInternetWebhook: false,
    };
}

export const ACCESSIBLE_CONTROL_METHODS = [
    "touch",
    "keyboard",
    "rotary",
    "voice",
    "switch-control",
    "screen-reader",
    "external-media-keys",
] as const;

export type MotionPreference = "full" | "reduced" | "off";
export function visualMotionPolicy(
    preference: MotionPreference,
    experienceEnergy: number,
): {
    motion: MotionPreference;
    visualIntensity: number;
    energyOverrideBlocked: true;
} {
    return {
        motion: preference,
        visualIntensity:
            preference === "off"
                ? 0
                : preference === "reduced"
                  ? Math.min(0.25, clamp01(experienceEnergy))
                  : clamp01(experienceEnergy),
        energyOverrideBlocked: true,
    };
}

export interface LyricsAccessibility {
    fontScale: number;
    highContrast: boolean;
    screenReader: boolean;
    lineFocus: boolean;
    translation: boolean;
    animation: MotionPreference;
}

export function lyricsAccessibility(input: LyricsAccessibility): LyricsAccessibility & { animationOptional: true } {
    return { ...input, fontScale: Math.max(1, Math.min(3, input.fontScale)), animationOptional: true };
}

export interface VisualMusicMap {
    energy: number;
    mood: string;
    instrumentation: string[];
    structure: string;
    waveformLiteracyRequired: false;
}

export function visualMusicMap(input: Omit<VisualMusicMap, "waveformLiteracyRequired">): VisualMusicMap {
    return { ...input, energy: clamp01(input.energy), waveformLiteracyRequired: false };
}

export interface SearchSignals {
    lexical: number;
    semantic: number;
    transliteration: number;
    typo: number;
    artistGraph: number;
    userContext: number;
}

export function crossDeviceSearchScore(signals: SearchSignals): number {
    const score =
        clamp01(signals.lexical) * 0.24 +
        clamp01(signals.semantic) * 0.24 +
        clamp01(signals.transliteration) * 0.14 +
        clamp01(signals.typo) * 0.14 +
        clamp01(signals.artistGraph) * 0.12 +
        clamp01(signals.userContext) * 0.12;
    return Math.round(score * 1_000_000) / 1_000_000;
}

export const SEARCH_ARCHITECTURE = {
    retrieval: ["lexical", "semantic", "transliteration", "typo", "artist-graph", "user-context"],
    optimizedQueries: ["tail", "misspelled", "cross-lingual"],
    crossDevice: true,
} as const;
