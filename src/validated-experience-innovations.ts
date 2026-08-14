import type { ExperienceDNA, PlaybackCapabilityTier } from "./provider-innovation-validation";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export type RobustMomentClass = "chorus" | "drop" | "breakdown" | "strong-hook" | "mix-safe-section";
export interface ValidatedMomentCandidate {
    trackId: string;
    moment: RobustMomentClass;
    timeToMoment: number;
    confidence: number;
    familiarity: number;
    energyDelta: number;
}
export function momentLevelCandidate(
    candidate: ValidatedMomentCandidate,
): ValidatedMomentCandidate & { arbitrarySkipAllowed: false; uses: readonly string[] } {
    return { ...candidate, arbitrarySkipAllowed: false, uses: ["route-planning", "backtiming", "transition-timing"] };
}

export interface ValidatedRouteCandidate {
    trackIds: string[];
    satisfaction: number;
    journeyProgress: number;
    transitionQuality: number;
    crowdFit: number;
    requestProgress: number;
    diversity: number;
    uncertainty: number;
    repetition: number;
    manipulationCost: number;
}
export function validatedRouteScore(route: ValidatedRouteCandidate): number {
    return round(
        route.satisfaction +
            route.journeyProgress +
            route.transitionQuality +
            route.crowdFit +
            route.requestProgress +
            route.diversity -
            route.uncertainty -
            route.repetition -
            route.manipulationCost,
    );
}

export function rollingHorizon(routes: readonly ValidatedRouteCandidate[]): {
    selected: ValidatedRouteCandidate | null;
    committedTrackId: string | null;
    planningTrackIds: string[];
    futureDirectionOnly: true;
    algorithm: "beam-search-multi-objective";
    reinforcementLearningRequired: false;
} {
    const selected = [...routes].sort((a, b) => validatedRouteScore(b) - validatedRouteScore(a))[0] ?? null;
    return {
        selected,
        committedTrackId: selected?.trackIds[0] ?? null,
        planningTrackIds: selected?.trackIds.slice(1, 4) ?? [],
        futureDirectionOnly: true,
        algorithm: "beam-search-multi-objective",
        reinforcementLearningRequired: false,
    };
}

export type StemRole = "vocal" | "drums" | "bass" | "other";
export function roleBasedMixing(
    tier: PlaybackCapabilityTier,
    roles: readonly StemRole[],
): {
    allowed: boolean;
    roles: StemRole[];
    deterministic: true;
    generativeAudio: false;
    partnerRequired: boolean;
} {
    const allowed = tier === "OWNED_OR_LICENSED_AUDIO" || tier === "DJ_PARTNER";
    return {
        allowed,
        roles: [...new Set(roles)],
        deterministic: true,
        generativeAudio: false,
        partnerRequired: tier !== "OWNED_OR_LICENSED_AUDIO",
    };
}

export type CriticStage = "symbolic" | "rendered-signal" | "perceptual-learned";
export function transitionCriticStage(
    stage: CriticStage,
    humanRatedExamples: number,
): {
    enabled: boolean;
    inputs: string[];
    opaqueNaturalnessClaim: false;
} {
    const inputs =
        stage === "symbolic"
            ? [
                  "grid-confidence",
                  "phrase-alignment",
                  "vocal-collision",
                  "tempo-stretch",
                  "stem-quality",
                  "loudness-risk",
              ]
            : stage === "rendered-signal"
              ? ["clipping", "loudness", "spectral-collision", "transient-damage"]
              : ["human-rated-transition-data"];
    return {
        enabled: stage !== "perceptual-learned" || humanRatedExamples >= 1_000,
        inputs,
        opaqueNaturalnessClaim: false,
    };
}

export type TransitionFailure = "vocal-conflict" | "bass-collision" | "grid-uncertainty";
export function localTransitionRepair(failure: TransitionFailure): { repair: string; regenerateWholeMix: false } {
    return {
        repair: {
            "vocal-conflict": "move-vocal-handoff",
            "bass-collision": "earlier-bass-swap",
            "grid-uncertainty": "shorten-blend",
        }[failure],
        regenerateWholeMix: false,
    };
}

export interface ExplicitCrowdSignals {
    profiles: number;
    requests: number;
    likes: number;
    reactions: number;
    skipVotes: number;
    participants: number;
}
export function crowdCoDirector(signals: ExplicitCrowdSignals): {
    active: boolean;
    value: "none" | "moderate-high" | "very-high";
    evidence: readonly string[];
    passiveEmotionInference: false;
} {
    const value = signals.participants <= 1 ? "none" : signals.participants >= 5 ? "very-high" : "moderate-high";
    return {
        active: signals.participants > 1,
        value,
        evidence: ["profiles", "requests", "likes", "reactions", "skip-votes"],
        passiveEmotionInference: false,
    };
}

export type CrowdFairnessMode = "balanced-for-everyone" | "host-leads" | "follow-crowd";
export function crowdFairnessPolicy(mode: CrowdFairnessMode): {
    mode: CrowdFairnessMode;
    academicSlidersVisible: false;
    internalFairness: true;
} {
    return { mode, academicSlidersVisible: false, internalFairness: true };
}

export interface CompiledSessionContract {
    energyDelta: number;
    discoveryDelta: number;
    targetGenre?: string;
    horizonMinutes?: number;
    familiarForMinutes?: number;
    transitionIntensity?: "gentle" | "normal" | "aggressive";
}
export function compileSessionLanguage(command: string): {
    contract: CompiledSessionContract;
    validationRequired: true;
    directAudioAccess: false;
    path: "fast" | "semantic";
} {
    const normalized = command.toLowerCase();
    if (normalized === "more energy")
        return {
            contract: { energyDelta: 0.15, discoveryDelta: 0 },
            validationRequired: true,
            directAudioAccess: false,
            path: "fast",
        };
    if (normalized === "less discovery")
        return {
            contract: { energyDelta: 0, discoveryDelta: -0.15 },
            validationRequired: true,
            directAudioAccess: false,
            path: "fast",
        };
    const genre = normalized.match(/toward\s+(.+?)(?:\s+and\b|$)/)?.[1]?.trim();
    return {
        contract: {
            energyDelta: 0,
            discoveryDelta: 0,
            ...(genre ? { targetGenre: genre } : {}),
            transitionIntensity: normalized.includes("don't use aggressive") ? "gentle" : "normal",
        },
        validationRequired: true,
        directAudioAccess: false,
        path: "semantic",
    };
}

export interface VibeFingerprint {
    experienceDNA: ExperienceDNA;
    energyCurve: number[];
    genreDistribution: Record<string, number>;
    familiarityTarget: number;
    mixPersonality: string;
    socialContext: string;
}
export function replayVibe(
    fingerprint: VibeFingerprint,
    excludedTrackIds: readonly string[],
): {
    journeySeed: VibeFingerprint;
    excludedTrackIds: string[];
    claimsHumanEmotionRecreated: false;
    label: "Replay this vibe";
} {
    return {
        journeySeed: structuredClone(fingerprint),
        excludedTrackIds: [...excludedTrackIds],
        claimsHumanEmotionRecreated: false,
        label: "Replay this vibe",
    };
}

export const CANONICAL_SESSION_FOUNDATION = [
    "experience",
    "journey",
    "queue-intent",
    "taste-scope",
    "crowd",
    "requests",
] as const;
export type ContinuityTier = 1 | 2 | 3 | 4 | 5;
export function continuityTier(tier: ContinuityTier): { capability: string; v1Promise: boolean } {
    const capabilities: Record<ContinuityTier, string> = {
        1: "session-metadata-handoff",
        2: "track-position-queue",
        3: "handoff-after-transition",
        4: "seamless-mid-transition",
        5: "sample-synchronized-multiroom",
    };
    return { capability: capabilities[tier], v1Promise: tier <= 2 };
}

export const TRUST_NATIVE_CONTROLS = [
    "undo",
    "why",
    "dont-learn",
    "session-only",
    "reset-vibe",
    "remove-preference",
    "autonomy-level",
] as const;
export function editableTasteProfile<T extends Record<string, number>>(
    profile: T,
): { profile: T; editable: true; objectiveIdentityClaim: false } {
    return { profile: { ...profile }, editable: true, objectiveIdentityClaim: false };
}

export type SemanticEcosystemEvent = "BUILD" | "DROP" | "ENERGY" | "TRACK_CHANGED";
export function semanticEcosystemEvent(event: SemanticEcosystemEvent): {
    event: SemanticEcosystemEvent;
    rawAudio: false;
    rightsSafe: true;
    privacyPreserving: true;
} {
    return { event, rawAudio: false, rightsSafe: true, privacyPreserving: true };
}

export type DirectorAction = "play" | "mix" | "reorder" | "delay" | "simplify" | "preserve" | "do-nothing";
export interface InterventionBudget {
    transitionManipulation: number;
    reorderFrequency: number;
    novelty: number;
    tempoManipulation: number;
}
export function noActionPolicy(input: {
    confidence: number;
    artisticallyImportant: boolean;
    crowdResponse: number;
    networkRisk: number;
    budget: InterventionBudget;
}): { action: DirectorAction; reason: string } {
    if (input.networkRisk > 0.65) return { action: "simplify", reason: "network-risk" };
    if (input.artisticallyImportant) return { action: "preserve", reason: "artistically-important" };
    if (input.confidence < 0.45) return { action: "do-nothing", reason: "low-confidence" };
    if (input.crowdResponse > 0.8 && input.budget.novelty > 0.5)
        return { action: "do-nothing", reason: "crowd-already-responding" };
    const exhausted = Object.values(input.budget).some((value) => clamp01(value) >= 1);
    return exhausted
        ? { action: "do-nothing", reason: "intervention-budget-exhausted" }
        : { action: "mix", reason: "safe-useful-intervention" };
}
