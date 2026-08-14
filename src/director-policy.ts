import {
    type CapabilityPlan,
    FULL_PLAYBACK_CAPABILITIES,
    gatePlanByCapabilities,
    type PlaybackCapabilities,
    planSonicRoute,
} from "./capability-selection";
import type { ConcreteExperienceId } from "./experience-engine";
import type { TrackProfile } from "./track-profile";
import type { TransitionPlan, TransitionType } from "./transition-planner";

export const DIRECTOR_PRIORITY_STACK = [
    "audio-safety",
    "explicit-user-action",
    "provider-capabilities",
    "hard-queue",
    "song-integrity",
    "experience-intent",
    "session-journey",
    "personalization",
    "diversity",
    "surprise",
] as const;
export type DirectorPriority = (typeof DIRECTOR_PRIORITY_STACK)[number];

export type AutomixControlMode = "simple" | "advanced" | "lab";
export const AUTOMIX_CONTROLS: Record<AutomixControlMode, string[]> = {
    simple: ["experience", "intensity"],
    advanced: [
        "experience",
        "intensity",
        "transition-style",
        "preserve-structure",
        "tempo-flexibility",
        "stem-intensity",
    ],
    lab: ["all-policy-signals", "candidate-scores", "preview-render", "parameter-search", "provenance"],
};

export interface PolicyCandidate<T> {
    value: T;
    expectedQuality: number;
    uncertainty: number;
    capabilityAllowed: boolean;
    qualityApproved: boolean;
    queueAllowed: boolean;
    songIntegrityPreserved: boolean;
    stemQuality?: number;
    score?: number;
}

export interface GatedCandidates<T> {
    eligible: PolicyCandidate<T>[];
    rejected: { candidate: PolicyCandidate<T>; gate: DirectorPriority; reason: string }[];
}

/** Binary gates run before weighted ranking so unsafe plans can never win by compensation. */
export function applyHardGates<T>(
    candidates: readonly PolicyCandidate<T>[],
    minimumStemQuality = 0.7,
): GatedCandidates<T> {
    const eligible: PolicyCandidate<T>[] = [];
    const rejected: GatedCandidates<T>["rejected"] = [];
    for (const candidate of candidates) {
        const failure = !candidate.qualityApproved
            ? (["audio-safety", "quality guardian rejected"] as const)
            : !candidate.capabilityAllowed
              ? (["provider-capabilities", "provider cannot execute candidate"] as const)
              : !candidate.queueAllowed
                ? (["hard-queue", "candidate violates explicit queue order"] as const)
                : !candidate.songIntegrityPreserved
                  ? (["song-integrity", "candidate edits protected song structure"] as const)
                  : candidate.stemQuality !== undefined && candidate.stemQuality < minimumStemQuality
                    ? (["audio-safety", "stem quality below reconstruction gate"] as const)
                    : null;
        if (failure) rejected.push({ candidate, gate: failure[0], reason: failure[1] });
        else eligible.push(candidate);
    }
    return { eligible, rejected };
}

export interface UnifiedQualityGuardianInput {
    clippingRisk: number;
    loudnessDiscontinuity: number;
    spectralCollision: number;
    vocalCollision: number;
    phaseRisk: number;
    stretchArtifacts: number;
    stemArtifacts: number;
    rhythmicMismatch: number;
}

export interface UnifiedQualityGuardianResult extends UnifiedQualityGuardianInput {
    approved: boolean;
    totalRisk: number;
    reasons: string[];
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

export function assessUnifiedQuality(input: UnifiedQualityGuardianInput): UnifiedQualityGuardianResult {
    const values = Object.entries(input) as [keyof UnifiedQualityGuardianInput, number][];
    const weights: Record<keyof UnifiedQualityGuardianInput, number> = {
        clippingRisk: 0.18,
        loudnessDiscontinuity: 0.1,
        spectralCollision: 0.12,
        vocalCollision: 0.16,
        phaseRisk: 0.12,
        stretchArtifacts: 0.12,
        stemArtifacts: 0.12,
        rhythmicMismatch: 0.08,
    };
    const normalized = Object.fromEntries(
        values.map(([key, value]) => [key, clamp01(value)]),
    ) as unknown as UnifiedQualityGuardianInput;
    const totalRisk = round(values.reduce((sum, [key]) => sum + normalized[key] * weights[key], 0));
    const reasons = values.filter(([key]) => normalized[key] >= 0.65).map(([key]) => key);
    const catastrophic = values.some(([key]) => normalized[key] >= 0.9);
    return { ...normalized, approved: !catastrophic && totalRisk < 0.48 && reasons.length < 3, totalRisk, reasons };
}

export interface StemReconstructionResult {
    approved: boolean;
    reconstructionError: number;
    correlation: number;
    maximumStemIntensity: number;
    reason: string;
}

export function assessStemReconstruction(input: {
    originalRms: number;
    reconstructedRms: number;
    correlation: number;
    spectralError: number;
}): StemReconstructionResult {
    const levelError =
        Math.abs(input.originalRms - input.reconstructedRms) / Math.max(0.0001, Math.abs(input.originalRms));
    const reconstructionError = clamp01(levelError * 0.45 + clamp01(input.spectralError) * 0.55);
    const correlation = clamp01(input.correlation);
    const approved = reconstructionError <= 0.28 && correlation >= 0.82;
    return {
        approved,
        reconstructionError: round(reconstructionError),
        correlation: round(correlation),
        maximumStemIntensity: approved ? round(Math.min(1, correlation * (1 - reconstructionError))) : 0,
        reason: approved
            ? "stem sum reconstructs original within tolerance"
            : "stem reconstruction deviates from original",
    };
}

export function stemActivationGains(progress: number): { original: number; reconstructed: number } {
    const t = clamp01(progress);
    return { original: round(Math.cos((t * Math.PI) / 2)), reconstructed: round(Math.sin((t * Math.PI) / 2)) };
}

export type TransitionPhase = "prepare" | "enter" | "blend" | "handoff" | "exit" | "tail" | "complete";

export interface TransitionPhaseState {
    phase: TransitionPhase;
    progress: number;
    beat: number;
    tailDetached: boolean;
}

export function transitionPhaseAt(beat: number, durationBeats: number, hasTail: boolean): TransitionPhaseState {
    const duration = Math.max(1, durationBeats);
    const normalized = beat / duration;
    const phase: TransitionPhase =
        normalized < 0
            ? "prepare"
            : normalized < 0.15
              ? "enter"
              : normalized < 0.7
                ? "blend"
                : normalized < 0.82
                  ? "handoff"
                  : normalized < 1
                    ? "exit"
                    : hasTail && normalized < 1.35
                      ? "tail"
                      : "complete";
    const ranges: Record<TransitionPhase, [number, number]> = {
        prepare: [-0.2, 0],
        enter: [0, 0.15],
        blend: [0.15, 0.7],
        handoff: [0.7, 0.82],
        exit: [0.82, 1],
        tail: [1, 1.35],
        complete: [1.35, 1.35],
    };
    const [start, end] = ranges[phase];
    return {
        phase,
        progress: end === start ? 1 : clamp01((normalized - start) / (end - start)),
        beat,
        tailDetached: phase === "tail" || phase === "complete",
    };
}

export interface FxTail {
    id: string;
    sourceDeck: string;
    endsAtSessionSec: number;
    gain: number;
}

/** FX tails live on the master-side bus and survive source deck teardown. */
export class TailBus {
    readonly #tails = new Map<string, FxTail>();

    add(tail: FxTail): void {
        this.#tails.set(tail.id, { ...tail, gain: clamp01(tail.gain) });
    }

    activeAt(sessionTimeSec: number): FxTail[] {
        for (const [id, tail] of this.#tails) if (tail.endsAtSessionSec <= sessionTimeSec) this.#tails.delete(id);
        return [...this.#tails.values()].map((tail) => ({ ...tail }));
    }
}

export interface TransitionParameters {
    durationBeats: number;
    handoffBeat: number;
    crossfadeCurve: "equal-power" | "linear" | "s-curve";
}

export interface OptimizedTransitionParameters {
    parameters: TransitionParameters;
    score: number;
    evaluated: number;
}

/** Search only a bounded musical parameter grid; the renderer remains deterministic. */
export function optimizeTransitionParameters(
    scorePreview: (parameters: TransitionParameters) => number,
    options: {
        durations?: readonly number[];
        handoffs?: readonly number[];
        curves?: readonly TransitionParameters["crossfadeCurve"][];
        maximumRenders?: number;
    } = {},
): OptimizedTransitionParameters {
    const candidates: TransitionParameters[] = [];
    for (const durationBeats of options.durations ?? [8, 16, 32]) {
        for (const handoffBeat of options.handoffs ?? [1, 9, 17]) {
            if (handoffBeat > durationBeats) continue;
            for (const crossfadeCurve of options.curves ?? ["equal-power", "linear", "s-curve"])
                candidates.push({ durationBeats, handoffBeat, crossfadeCurve });
        }
    }
    const bounded = candidates.slice(0, options.maximumRenders ?? 18);
    const ranked = bounded
        .map((parameters) => ({ parameters, score: scorePreview(parameters) }))
        .sort((a, b) => b.score - a.score);
    return {
        ...(ranked[0] ?? {
            parameters: { durationBeats: 8, handoffBeat: 1, crossfadeCurve: "equal-power" as const },
            score: 0,
        }),
        evaluated: bounded.length,
    };
}

export type QueueOrigin = "explicit" | "auto";
export interface DirectorQueueItem {
    trackId: string;
    origin: QueueOrigin;
    allowReorder?: boolean;
}

/** Explicit tracks keep their order; only allowed auto windows are optimized. */
export function orderDirectorQueue(
    items: readonly DirectorQueueItem[],
    compatibility: (fromTrackId: string | null, toTrackId: string) => number,
    smartWindow = 3,
): DirectorQueueItem[] {
    const result: DirectorQueueItem[] = [];
    for (let index = 0; index < items.length; ) {
        const item = items[index]!;
        if (item.origin === "explicit" || item.allowReorder === false) {
            result.push({ ...item });
            index++;
            continue;
        }
        const window: DirectorQueueItem[] = [];
        while (
            index < items.length &&
            window.length < smartWindow &&
            items[index]!.origin === "auto" &&
            items[index]!.allowReorder !== false
        )
            window.push(items[index++]!);
        let previous = result.at(-1)?.trackId ?? null;
        while (window.length) {
            window.sort((a, b) => compatibility(previous, b.trackId) - compatibility(previous, a.trackId));
            const selected = window.shift()!;
            result.push({ ...selected });
            previous = selected.trackId;
        }
    }
    return result;
}

export type TimedRequestIntent =
    | { kind: "next" }
    | { kind: "within"; minutes: number }
    | { kind: "at"; sessionTimeSec: number };
export interface TrackRequest {
    id: string;
    trackId: string;
    requestedBy: string;
    intent: TimedRequestIntent;
    allowBridge: boolean;
}

export interface RoutedRequest {
    requestId: string;
    route: string[];
    etaSec: number;
    onTime: boolean;
    reason: string;
}

export function routeTrackRequest(
    request: TrackRequest,
    currentId: string,
    profiles: readonly TrackProfile[],
    nowSessionSec: number,
): RoutedRequest {
    const direct = [currentId, request.trackId];
    const sonic = request.allowBridge ? planSonicRoute(currentId, request.trackId, profiles, 3, 12) : null;
    const route = sonic?.reachedTarget ? sonic.trackIds : direct;
    const bridges = Math.max(0, route.length - 2);
    const etaSec = request.intent.kind === "next" ? 0 : bridges * 210;
    const deadline =
        request.intent.kind === "within"
            ? nowSessionSec + Math.max(0, request.intent.minutes) * 60
            : request.intent.kind === "at"
              ? request.intent.sessionTimeSec
              : nowSessionSec;
    const onTime = nowSessionSec + etaSec <= deadline;
    return {
        requestId: request.id,
        route: onTime ? route : direct,
        etaSec: onTime ? etaSec : 0,
        onTime,
        reason:
            onTime && bridges
                ? `${bridges} musical bridge(s) before request`
                : onTime
                  ? "direct request"
                  : "bridge removed to meet deadline",
    };
}

export interface DirectorPolicyInput {
    requestedPlan: TransitionPlan;
    experience: ConcreteExperienceId;
    capabilities?: PlaybackCapabilities;
    quality: UnifiedQualityGuardianResult;
    explicitUserAction?: TransitionPlan | null;
    queueAllows: boolean;
    songIntegrityPreserved: boolean;
    stemReconstruction?: StemReconstructionResult | null;
}

export interface DirectorPolicyDecision {
    intent: { experience: ConcreteExperienceId; requestedType: TransitionType; explicit: boolean };
    capability: CapabilityPlan;
    plan: TransitionPlan;
    approved: boolean;
    appliedPriorities: DirectorPriority[];
    reasons: string[];
}

/** Policy-only Director: chooses a constrained intent and plan; it performs no DSP. */
export function decideDirectorPolicy(input: DirectorPolicyInput): DirectorPolicyDecision {
    const requested = input.explicitUserAction ?? input.requestedPlan;
    const reasons: string[] = [];
    const appliedPriorities: DirectorPriority[] = ["audio-safety"];
    if (input.explicitUserAction) appliedPriorities.push("explicit-user-action");
    const gated = applyHardGates([
        {
            value: requested,
            expectedQuality: 1 - input.quality.totalRisk,
            uncertainty: input.quality.totalRisk,
            capabilityAllowed: true,
            qualityApproved: input.quality.approved,
            queueAllowed: input.queueAllows,
            songIntegrityPreserved: input.songIntegrityPreserved,
            ...(requested.type === "acapella" && input.stemReconstruction
                ? { stemQuality: input.stemReconstruction.maximumStemIntensity }
                : {}),
        },
    ]);
    let base = requested;
    if (!gated.eligible.length) {
        reasons.push(...gated.rejected.map((rejection) => `${rejection.gate}: ${rejection.reason}`));
        base = {
            type: "fade",
            fadeSec: Math.max(4, requested.fadeSec),
            eqSweep: false,
            tempoRatio: 1,
            reason: `${requested.reason}; policy safety fallback`,
        };
    }
    appliedPriorities.push("provider-capabilities");
    const capability = gatePlanByCapabilities(base, input.capabilities ?? FULL_PLAYBACK_CAPABILITIES, input.experience);
    reasons.push(...capability.reasons);
    if (!input.queueAllows) appliedPriorities.push("hard-queue");
    if (!input.songIntegrityPreserved) appliedPriorities.push("song-integrity");
    appliedPriorities.push("experience-intent");
    return {
        intent: {
            experience: input.experience,
            requestedType: input.requestedPlan.type,
            explicit: Boolean(input.explicitUserAction),
        },
        capability,
        plan: capability.plan,
        approved: input.quality.approved && gated.eligible.length > 0,
        appliedPriorities,
        reasons,
    };
}
