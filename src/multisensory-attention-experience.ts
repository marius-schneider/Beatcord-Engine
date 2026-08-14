const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
export interface MovementProfile {
    cadence: number;
    accentPattern: number[];
    groove: number;
    contactPattern: number[];
}
export function embodiedDiscoveryScore(a: MovementProfile, b: MovementProfile): number {
    const cadence = 1 - Math.min(1, Math.abs(a.cadence - b.cadence) / Math.max(1, a.cadence));
    const accent = 1 - Math.abs((a.accentPattern[0] ?? 0) - (b.accentPattern[0] ?? 0));
    const groove = 1 - Math.abs(a.groove - b.groove);
    return round(cadence * 0.4 + accent * 0.3 + groove * 0.3);
}
export interface MomentOutput {
    channel: "audio" | "spatial" | "haptics" | "lighting" | "visuals";
    offsetMs: number;
    payload: string;
    importance: "low" | "high" | "very-high";
}
export function multisensoryMomentPlan(
    presentationTime: number,
    outputs: readonly MomentOutput[],
): {
    presentationTime: number;
    events: {
        channel: MomentOutput["channel"];
        scheduledAt: number;
        payload: string;
        importance: MomentOutput["importance"];
    }[];
    oneMomentClock: true;
} {
    return {
        presentationTime,
        events: outputs.map((output) => ({
            channel: output.channel,
            scheduledAt: presentationTime + output.offsetMs,
            payload: output.payload,
            importance: output.importance,
        })),
        oneMomentClock: true,
    };
}
export function importancePrecision(importance: MomentOutput["importance"]): {
    targetJitterMs: number;
    priority: number;
} {
    return importance === "very-high"
        ? { targetJitterMs: 10, priority: 1 }
        : importance === "high"
          ? { targetJitterMs: 50, priority: 0.7 }
          : { targetJitterMs: 500, priority: 0.2 };
}

export type AttentionDemand = "navigation" | "conversation" | "phone-call" | "game-dialogue";
export function attentionPreservingQueue(input: {
    demand?: AttentionDemand;
    importantMomentInSec: number;
    extensibleSafeSection: boolean;
}): { action: "continue" | "extend-safe-section" | "defer-important-moment"; momentProtected: boolean } {
    if (!input.demand) return { action: "continue", momentProtected: false };
    return {
        action: input.extensibleSafeSection ? "extend-safe-section" : "defer-important-moment",
        momentProtected: input.importantMomentInSec <= 15,
    };
}
export function experienceResumePoint(input: {
    interruptedSection: "build" | "verse" | "drop" | "other";
    interruptionMinutes: number;
    replayAllowed: boolean;
}): { resume: "timestamp" | "safe-buildup" | "section-start" } {
    if (input.interruptionMinutes >= 5 && input.interruptedSection === "build" && input.replayAllowed)
        return { resume: "safe-buildup" };
    if (input.interruptionMinutes >= 1 && input.replayAllowed) return { resume: "section-start" };
    return { resume: "timestamp" };
}
export type ListeningEffortIntent = "focused" | "natural" | "immersive";
export function listeningEffortPolicy(intent: ListeningEffortIntent): {
    intent: ListeningEffortIntent;
    userChosen: true;
    hearingAbilityInferred: false;
    spatialStrength: number;
} {
    return {
        intent,
        userChosen: true,
        hearingAbilityInferred: false,
        spatialStrength: { focused: 0.2, natural: 0.5, immersive: 0.8 }[intent],
    };
}
export function contextualSilence(context: "conversation" | "memorial" | "game-dialogue" | "meditation" | "normal"): {
    action: "silence-hold" | "music";
    engineFailure: false;
} {
    return { action: context === "normal" ? "music" : "silence-hold", engineFailure: false };
}

export interface FutureSection {
    type: string;
    startsInSec: number;
    energy: number;
    confidence: number;
}
export function sectionAwareIntent(input: {
    desiredEnergy: number;
    currentEnergy: number;
    futureSections: readonly FutureSection[];
}): { action: "wait-current-track" | "replace-track"; section?: FutureSection; opportunityCost: number } {
    const target = [...input.futureSections]
        .filter((section) => section.energy >= input.desiredEnergy && section.confidence >= 0.7)
        .sort((a, b) => a.startsInSec - b.startsInSec)[0];
    if (target && target.startsInSec <= 45)
        return { action: "wait-current-track", section: target, opportunityCost: round(target.startsInSec / 45) };
    return { action: "replace-track", opportunityCost: round(Math.abs(input.desiredEnergy - input.currentEnergy)) };
}
export function temporalOpportunityCost(input: {
    skipLosesMomentValue: number;
    waitSeconds: number;
    desiredStateUrgency: number;
}): { skipCost: number; waitCost: number; choice: "skip" | "wait" } {
    const skipCost = clamp01(input.skipLosesMomentValue);
    const waitCost = round(Math.min(1, input.waitSeconds / 60) * clamp01(input.desiredStateUrgency));
    return { skipCost, waitCost, choice: waitCost <= skipCost ? "wait" : "skip" };
}
export const ADAPTIVE_PRECISION_PIPELINE_V2 = [
    "cheap-whole-track",
    "uncertainty-calibration",
    "decision-relevance",
    "targeted-refinement",
    "active-correction-high-value",
    "minimal-safe-intervention",
] as const;

export interface ExperienceProgram {
    audio: string;
    spatial?: string;
    haptics?: string;
    lighting?: string;
    visuals?: string;
    futureMoments: { at: number; type: string }[];
    confidence: number;
    fallback: string;
}
export function compileExperienceProgram(
    input: ExperienceProgram,
    rights: { audio: boolean; spatial: boolean },
): ExperienceProgram {
    const audio = rights.audio ? input.audio : input.fallback;
    if (rights.spatial) return { ...input, audio };
    const { spatial: _spatial, ...withoutSpatial } = input;
    return { ...withoutSpatial, audio };
}
export const ROUND_II_BUILD = [
    "perceptual-playback-twin",
    "causal-taste-memory",
    "exposure-context",
    "confidence-calibration",
    "decision-confidence",
    "active-teaching-hooks",
    "stem-portfolio",
    "compute-choreography",
    "decision-provenance",
] as const;
export const ROUND_II_PROTOTYPES = [
    "semantic-transparency",
    "ambient-clarity",
    "spatial-role-handoff",
    "haptic-stem-compiler",
    "motion-resonance",
    "conformal-envelope",
    "version-assisted-separation",
    "mixture-preserving-reconstruction",
    "novelty-firewall",
    "multisensory-transition",
] as const;
export const ROUND_II_RESEARCH = [
    "room-aware-rendering",
    "bioadaptive-emotion",
    "open-vocabulary-realtime-separation",
    "mobile-diffusion-refinement",
    "beatcord-hrtf-generation",
    "automatic-spatial-remix",
] as const;
export const PERCEPTUAL_OS_QUESTIONS = [
    "what",
    "when",
    "how-here",
    "intervention-amount",
    "participating-senses-devices",
    "decision-confidence",
] as const;
