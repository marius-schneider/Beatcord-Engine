const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export type SemanticListeningLevel = 0 | 1 | 2 | 3;
export type EnvironmentEvent =
    | "speech-nearby"
    | "user-speaking"
    | "warning"
    | "announcement"
    | "traffic"
    | "quiet"
    | "crowd";
export type SemanticListenerMode = "immersive" | "balanced" | "aware" | "custom";

export interface SemanticControl {
    mode: SemanticListenerMode;
    alwaysAllow: EnvironmentEvent[];
    allow: EnvironmentEvent[];
    ignore: EnvironmentEvent[];
    explicit: true;
}

export function semanticListeningLevel(level: SemanticListeningLevel): {
    level: SemanticListeningLevel;
    capability: "off" | "scene-classification" | "important-event-detection" | "selective-source-enhancement";
    production: boolean;
} {
    const capability = (
        ["off", "scene-classification", "important-event-detection", "selective-source-enhancement"] as const
    )[level];
    return { level, capability, production: level <= 1 };
}

export function semanticListeningBus(input: {
    event: EnvironmentEvent;
    confidence: number;
    locallyExtracted: boolean;
    rawAudioStored: boolean;
}): {
    event: EnvironmentEvent;
    confidence: number;
    route: readonly string[];
    rawAudioStored: false;
    accepted: boolean;
} {
    return {
        event: input.event,
        confidence: round(clamp01(input.confidence)),
        route: [
            "environment-input",
            "scene-classifier",
            "attention-event-detector",
            "semantic-policy",
            "music-director-and-playback-twin",
        ],
        rawAudioStored: false,
        accepted: input.locallyExtracted && !input.rawAudioStored && input.confidence >= 0.8,
    };
}

export function semanticResponse(
    event: EnvironmentEvent,
    confidence: number,
    importantMomentInSec: number,
): {
    dsp: "none" | "spectral-pocket" | "safety-duck";
    director: "continue" | "defer-moment" | "safety-override";
    safetyWins: boolean;
} {
    if ((event === "warning" || event === "traffic") && confidence >= 0.8)
        return { dsp: "safety-duck", director: "safety-override", safetyWins: true };
    if ((event === "speech-nearby" || event === "user-speaking" || event === "announcement") && confidence >= 0.9)
        return {
            dsp: "spectral-pocket",
            director: importantMomentInSec <= 15 ? "defer-moment" : "continue",
            safetyWins: false,
        };
    return { dsp: "none", director: "continue", safetyWins: false };
}

export function spectralConversationPocket(input: { allowed: boolean; validated: boolean; speechConfidence: number }): {
    enabled: boolean;
    rangeHz: readonly [1000, 4000];
    masterDuckDb: 0;
    maxEqReductionDb: number;
} {
    const enabled = input.allowed && input.validated && input.speechConfidence >= 0.9;
    return { enabled, rangeHz: [1000, 4000], masterDuckDb: 0, maxEqReductionDb: enabled ? 3 : 0 };
}

export function semanticMomentProtection(input: {
    event: EnvironmentEvent;
    eventConfidence: number;
    momentInSec: number;
    lowForegroundAvailable: boolean;
}): { action: "continue" | "delay-transition" | "choose-low-foreground"; protected: boolean } {
    if (input.eventConfidence < 0.9 || input.momentInSec > 15) return { action: "continue", protected: false };
    return { action: input.lowForegroundAvailable ? "choose-low-foreground" : "delay-transition", protected: true };
}

export function applySemanticControl(
    event: EnvironmentEvent,
    control: SemanticControl,
): { allowed: boolean; userBoundaryHonored: true } {
    if (control.alwaysAllow.includes(event)) return { allowed: true, userBoundaryHonored: true };
    if (control.ignore.includes(event)) return { allowed: false, userBoundaryHonored: true };
    return { allowed: control.allow.includes(event) || control.mode === "aware", userBoundaryHonored: true };
}

export function semanticHardwareBoundary(
    level: SemanticListeningLevel,
    integration: "app" | "os" | "earbud",
): { available: boolean; coreOwnsPolicy: true; deepManipulationPartnerDependent: boolean } {
    const deep = level >= 2;
    return { available: !deep || integration !== "app", coreOwnsPolicy: true, deepManipulationPartnerDependent: deep };
}

export const SEMANTIC_LISTENING_EXPERIMENT = {
    conditions: ["normal-music", "volume-duck", "spectral-pocket", "director-moment-defer"],
    scenarios: ["short-conversation", "announcement", "street-warning", "quiet-office"],
    metrics: [
        "speech-comprehension",
        "music-continuity",
        "annoyance",
        "missed-musical-moment",
        "perceived-intelligence",
    ],
    intrusiveActionPriority: "precision-over-recall",
} as const;
export const SEMANTIC_LISTENING_VERDICT = {
    build: ["semantic-policy", "event-interfaces", "scene-classification"],
    partnerResearch: ["realtime-environmental-separation", "os-anc-transparency-control"],
    hardwareDependency: "high",
} as const;
