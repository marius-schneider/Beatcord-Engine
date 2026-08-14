export const CURRENT_ENGINE_FOUNDATION = [
    "pcm-mixing",
    "continuous-two-deck-mixer",
    "transition-planner",
    "transition-candidates",
    "transition-telemetry",
    "offline-rendering",
    "beatgrid",
    "tempo",
    "key",
    "genre",
    "spectral-analysis",
    "loudness",
    "stem-quality",
    "vocal-activity",
    "vocal-conflict",
    "voice-commands",
    "narration",
    "hls-mix-station",
] as const;

export const PLANNING_RENDERING_BOUNDARY = {
    planningDeterministic: true,
    planningBeforePlaybackDeadline: true,
    rendererExecutesValidatedPlan: true,
} as const;
export const MIX_DECK_REALTIME_FOUNDATION = {
    sampleRate: 48_000,
    floatSummation: true,
    reusableBuffers: true,
    actualFrameTracking: true,
    absoluteDeadlineScheduling: true,
    professionalDeviceClock: false,
} as const;

export type AudioClockProfile = "server-streaming" | "professional-local";
export function audioClockArchitecture(profile: AudioClockProfile): {
    orchestration: "typescript-bun";
    realtimeCore: "javascript-deadline-clock" | "native-platform-callback";
    rewriteNow: boolean;
} {
    return profile === "server-streaming"
        ? { orchestration: "typescript-bun", realtimeCore: "javascript-deadline-clock", rewriteNow: false }
        : { orchestration: "typescript-bun", realtimeCore: "native-platform-callback", rewriteNow: false };
}

export type TransportProfile = "hls" | "webrtc-low-latency" | "local-pcm" | "discord-pcm-opus";
export function transportProfile(profile: TransportProfile): {
    useCase: string;
    interactive: boolean;
    scalableRoom: boolean;
} {
    const profiles: Record<TransportProfile, { useCase: string; interactive: boolean; scalableRoom: boolean }> = {
        hls: { useCase: "shared-scalable-room-listening", interactive: false, scalableRoom: true },
        "webrtc-low-latency": { useCase: "interactive-remote-session", interactive: true, scalableRoom: false },
        "local-pcm": { useCase: "desktop-mobile-high-quality-playback", interactive: true, scalableRoom: false },
        "discord-pcm-opus": { useCase: "discord-integration", interactive: false, scalableRoom: true },
    };
    return profiles[profile];
}

export const DEFERRED_FEATURES = [
    "autonomous-crowd-emotion-recognition",
    "full-generative-transitions",
    "ten-track-fixed-journey",
    "seamless-mid-transition-cross-provider-handoff",
    "one-end-to-end-music-ai",
    "default-complex-fairness-controls",
] as const;
export const BEST_INNOVATION_EFFORT_RATIO = [
    "experience-dna",
    "session-copilot",
    "replay-the-vibe",
    "rolling-2-4-track-planning",
    "trust-controls",
    "no-action-graceful-fallback",
    "event-sdk",
] as const;
export const HIGH_MOAT_PROTOTYPES = [
    "transition-critic-repair",
    "moment-level-recommendation",
    "role-based-mixing",
    "crowd-co-director",
] as const;
export const LOW_STRATEGIC_VALUE = [
    "lossless",
    "lyrics",
    "crossfade",
    "standard-eq",
    "discord-rich-presence",
    "generic-ai-playlists",
    "basic-shared-queue",
] as const;
export const BEATCORD_MOAT = [
    "musical-analysis",
    "session-state",
    "transition-telemetry",
    "mixing-preference",
    "journey-feedback",
    "crowd-feedback",
    "critic-data",
    "experience-memories",
] as const;

export interface ProprietaryTransitionDatum {
    fromTrackId: string;
    toTrackId: string;
    context: string;
    experienceDnaHash: string;
    transitionPlan: string;
    technicalQuality: number;
    userReaction: string;
    crowdReaction?: string;
    laterSessionOutcome: string;
}
export function validateTransitionDatum(datum: ProprietaryTransitionDatum): {
    valid: boolean;
    personallyIdentifyingRawDataRequired: false;
    closedLoopLearning: true;
} {
    return {
        valid: Boolean(datum.fromTrackId && datum.toTrackId && datum.transitionPlan && datum.laterSessionOutcome),
        personallyIdentifyingRawDataRequired: false,
        closedLoopLearning: true,
    };
}

export const V1_INNOVATION_PACKAGE = [
    "experience-dna",
    "session-copilot",
    "2-3-track-route-planner",
    "transition-planner",
    "symbolic-transition-critic",
    "replay-the-vibe",
    "trust-controls",
] as const;
export const V2_INNOVATION_PACKAGE = [
    "moment-level-planning",
    "explicit-crowd-co-director",
    "role-based-four-stem-transitions",
    "rendered-transition-critic",
    "living-continuity",
    "ecosystem-event-sdk",
] as const;

export function productPackage(version: "v1" | "v2"): {
    capabilities: readonly string[];
    realistic: true;
    learnedNaturalnessRequired: false;
} {
    return {
        capabilities: version === "v1" ? V1_INNOVATION_PACKAGE : V2_INNOVATION_PACKAGE,
        realistic: true,
        learnedNaturalnessRequired: false,
    };
}
