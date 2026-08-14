const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export interface InnovationAssessment {
    userValue: number;
    technicalFeasibility: number;
    differentiation: number;
    rightsDependency: number;
    validationStrength: number;
}
export type InnovationDecision = "build" | "prototype" | "partner-dependent" | "defer";
export function validateInnovation(input: InnovationAssessment): { score: number; decision: InnovationDecision } {
    const score =
        (input.userValue +
            input.technicalFeasibility +
            input.differentiation +
            input.rightsDependency +
            input.validationStrength) /
        5;
    const decision =
        input.rightsDependency <= 2
            ? "partner-dependent"
            : input.technicalFeasibility <= 2 || input.validationStrength <= 2
              ? "defer"
              : score >= 4
                ? "build"
                : "prototype";
    return { score: Math.round(score * 100) / 100, decision };
}

export const MARKET_BASELINE_2026 = [
    "beatmatching",
    "time-stretching",
    "smart-reorder",
    "lyrics",
    "shared-queue",
    "prompt-playlists",
    "stem-dj-workflow",
] as const;
export const SYSTEM_DIFFERENTIATION_LOOP = [
    "intent",
    "journey",
    "moment",
    "track",
    "transition",
    "critic",
    "crowd-reaction",
    "replan",
] as const;

export type PlaybackCapabilityTier = "CONTROL_ONLY" | "PLAYBACK_ONLY" | "DJ_PARTNER" | "OWNED_OR_LICENSED_AUDIO";
export interface ProviderCapabilities {
    queueControl: boolean;
    metadata: boolean;
    providerPlayback: boolean;
    approvedMixing: boolean;
    rawAudio: boolean;
    stems: boolean;
    previewRendering: boolean;
}
export function providerCapabilities(tier: PlaybackCapabilityTier): ProviderCapabilities {
    if (tier === "CONTROL_ONLY")
        return {
            queueControl: true,
            metadata: true,
            providerPlayback: false,
            approvedMixing: false,
            rawAudio: false,
            stems: false,
            previewRendering: false,
        };
    if (tier === "PLAYBACK_ONLY")
        return {
            queueControl: true,
            metadata: true,
            providerPlayback: true,
            approvedMixing: false,
            rawAudio: false,
            stems: false,
            previewRendering: false,
        };
    if (tier === "DJ_PARTNER")
        return {
            queueControl: true,
            metadata: true,
            providerPlayback: true,
            approvedMixing: true,
            rawAudio: true,
            stems: false,
            previewRendering: true,
        };
    return {
        queueControl: true,
        metadata: true,
        providerPlayback: true,
        approvedMixing: true,
        rawAudio: true,
        stems: true,
        previewRendering: true,
    };
}

export function assertProviderAction(
    tier: PlaybackCapabilityTier,
    action: "control" | "playback" | "mix" | "stems" | "render-preview",
): { allowed: boolean; reason: string } {
    const capabilities = providerCapabilities(tier);
    const allowed = {
        control: capabilities.queueControl,
        playback: capabilities.providerPlayback,
        mix: capabilities.approvedMixing,
        stems: capabilities.stems,
        "render-preview": capabilities.previewRendering,
    }[action];
    return { allowed, reason: allowed ? `${tier} permits ${action}` : `${tier} does not license or expose ${action}` };
}

export interface ExperienceDNA {
    energy: number;
    familiarity: number;
    discovery: number;
    mixIntensity: number;
    warmth: number;
    surprise: number;
}
export type ExperienceDnaPreset = "chill" | "love" | "energy" | "party";
export const EXPERIENCE_DNA_PRESETS: Record<ExperienceDnaPreset, ExperienceDNA> = {
    chill: { energy: 0.25, familiarity: 0.65, discovery: 0.35, mixIntensity: 0.2, warmth: 0.75, surprise: 0.2 },
    love: { energy: 0.45, familiarity: 0.75, discovery: 0.25, mixIntensity: 0.25, warmth: 0.9, surprise: 0.2 },
    energy: { energy: 0.8, familiarity: 0.55, discovery: 0.45, mixIntensity: 0.65, warmth: 0.45, surprise: 0.45 },
    party: { energy: 0.95, familiarity: 0.7, discovery: 0.3, mixIntensity: 0.8, warmth: 0.5, surprise: 0.55 },
};

export function morphExperienceDna(
    current: ExperienceDNA,
    target: ExperienceDNA,
    input: { confidence: number; manualIntent: boolean; maxStep: number },
): ExperienceDNA {
    const weight = Math.min(input.manualIntent ? 1 : clamp01(input.confidence), clamp01(input.maxStep));
    return Object.fromEntries(
        (Object.keys(current) as (keyof ExperienceDNA)[]).map((key) => [
            key,
            clamp01(current[key] + (target[key] - current[key]) * weight),
        ]),
    ) as unknown as ExperienceDNA;
}

export const VALIDATION_MATRIX: Record<string, InnovationDecision> = {
    "experience-dna": "build",
    "moment-level-recommendation": "prototype",
    "rolling-horizon": "build",
    "role-based-mixing": "partner-dependent",
    "transition-critic": "prototype",
    "crowd-co-director": "build",
    "music-copilot": "build",
    "replay-the-vibe": "build",
    "living-continuity": "build",
    "trust-native-ai": "build",
    "open-ecosystem": "build",
    "no-action": "build",
};
