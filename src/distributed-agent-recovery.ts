const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
export interface DistributedClockState {
    sessionEpoch: bigint;
    offsetNs: number;
    driftPpm: number;
    jitterNs: number;
    confidence: number;
}
export type FollowerCapability = "lighting" | "visualizer" | "haptics" | "remote-ui" | "remote-audio";
export function clockSynchronization(
    clock: DistributedClockState,
    capability: FollowerCapability,
): {
    authority: "master-audio-device";
    follower: FollowerCapability;
    syncConfidence: number;
    framePerfectClaimAllowed: boolean;
    multiroomAudioCapabilityRequired: boolean;
} {
    const timingPenalty = Math.min(0.6, Math.abs(clock.driftPpm) / 200 + clock.jitterNs / 100_000_000);
    const audioPenalty = capability === "remote-audio" ? 0.2 : 0;
    const syncConfidence = clamp01(clock.confidence - timingPenalty - audioPenalty);
    return {
        authority: "master-audio-device",
        follower: capability,
        syncConfidence,
        framePerfectClaimAllowed: syncConfidence >= 0.95,
        multiroomAudioCapabilityRequired: capability === "remote-audio",
    };
}

export type FutureEventType = "UPCOMING_BAR" | "UPCOMING_DROP" | "UPCOMING_TRANSITION";
export type EventReliability = "sample-locked" | "predicted-high" | "predicted-medium";
export interface FutureSessionEvent {
    event: FutureEventType;
    sessionSample: number;
    sessionTime: number;
    confidence: number;
    reliability: EventReliability;
}
export function scheduleFutureEvent(
    event: Omit<FutureSessionEvent, "reliability">,
    currentSessionTime: number,
): FutureSessionEvent & { scheduleLocally: true; sentEarly: boolean } {
    const reliability: EventReliability =
        event.confidence >= 0.98 ? "sample-locked" : event.confidence >= 0.85 ? "predicted-high" : "predicted-medium";
    return { ...event, reliability, scheduleLocally: true, sentEarly: event.sessionTime > currentSessionTime };
}

export function jitterBufferWindow(input: { jitterMs: number; renderLatencyMs: number; predictionHorizonMs: number }): {
    bufferMs: number;
    usableHorizonMs: number;
    sendNowCommandForbidden: true;
} {
    const bufferMs = Math.max(20, Math.ceil(input.jitterMs * 3 + input.renderLatencyMs));
    return {
        bufferMs,
        usableHorizonMs: Math.max(0, input.predictionHorizonMs - bufferMs),
        sendNowCommandForbidden: true,
    };
}

export function networkFailurePolicy(
    localScheduledEvents: number,
    disconnectedMs: number,
): { action: "continue-scheduled" | "stop-horizon" | "resync"; abruptJump: false } {
    if (disconnectedMs < 2_000 && localScheduledEvents > 0) return { action: "continue-scheduled", abruptJump: false };
    if (disconnectedMs < 10_000) return { action: "stop-horizon", abruptJump: false };
    return { action: "resync", abruptJump: false };
}

export const MULTI_DEVICE_POLICY = {
    v1AudioOutputs: 1,
    externalFollowers: ["lighting", "visualizer", "haptics", "remote-ui"],
    multiroomAudioSeparateCapability: true,
    requiredForMultiroom: ["clock-sync", "latency-compensation", "drift-resampling", "jitter-handling"],
} as const;

export const DIRECTOR_STATE_GRAPH = [
    "understand-intent",
    "resolve-entities",
    "retrieve-candidates",
    "rank",
    "plan-journey",
    "validate",
    "commit-future-plan",
] as const;
export type StateNodeOutcome = "success" | "recoverable-failure" | "hard-failure";
export const AI_FAILURE_TYPES = [
    "intent-misread",
    "entity-resolution",
    "unavailable-track",
    "bad-retrieval",
    "bad-ranking",
    "constraint-violation",
    "hallucinated-attribute",
    "timeout",
    "tool-failure",
    "stale-context",
] as const;
export type AiFailureType = (typeof AI_FAILURE_TYPES)[number];
export interface StateNodeResult {
    node: (typeof DIRECTOR_STATE_GRAPH)[number];
    outcome: StateNodeOutcome;
    failure?: AiFailureType;
}
export function nextDirectorState(result: StateNodeResult): {
    action: "advance" | "recover" | "safe-stop";
    playbackContinues: boolean;
} {
    if (result.outcome === "success") return { action: "advance", playbackContinues: true };
    if (result.outcome === "recoverable-failure") return { action: "recover", playbackContinues: true };
    return { action: "safe-stop", playbackContinues: true };
}

export interface EntityCandidate {
    id: string;
    label: string;
    contextConfidence: number;
    available: boolean;
}
export function recoverConversationEntity(candidates: readonly EntityCandidate[]): {
    selected: string | null;
    showNonBlockingAmbiguityUi: boolean;
    playbackContinues: true;
} {
    const available = candidates
        .filter((candidate) => candidate.available)
        .sort((a, b) => b.contextConfidence - a.contextConfidence);
    const leader = available[0];
    const runnerUp = available[1];
    const clear = Boolean(
        leader &&
            leader.contextConfidence >= 0.85 &&
            (!runnerUp || leader.contextConfidence - runnerUp.contextConfidence >= 0.2),
    );
    return {
        selected: clear ? (leader?.id ?? null) : null,
        showNonBlockingAmbiguityUi: !clear,
        playbackContinues: true,
    };
}

export interface RecommendationAgentMetrics {
    intentSuccess: number;
    entityResolutionAccuracy: number;
    constraintViolationRate: number;
    toolRecoveryRate: number;
    medianLatencyMs: number;
    planApplicationSuccess: number;
}
export function recommendationAgentSlo(metrics: RecommendationAgentMetrics): { met: boolean; failures: string[] } {
    const failures = [
        metrics.intentSuccess < 0.95 && "intent",
        metrics.entityResolutionAccuracy < 0.98 && "entity-resolution",
        metrics.constraintViolationRate > 0.005 && "constraints",
        metrics.toolRecoveryRate < 0.95 && "tool-recovery",
        metrics.medianLatencyMs > 1_000 && "latency",
        metrics.planApplicationSuccess < 0.99 && "plan-application",
    ].filter((value): value is string => Boolean(value));
    return { met: failures.length === 0, failures };
}

export const LLM_MUSIC_BENCHMARK = [
    "intent-parsing",
    "catalog-grounding",
    "constraint-following",
    "explanation-truthfulness",
    "music-relevance",
    "session-compatibility",
    "latency",
    "recovery",
] as const;
export const MUSIC_QUALITY_JUDGES = ["signal-metrics", "specialized-models", "human-tests"] as const;

export type BeatgridOverrideKind = "beat" | "downbeat" | "phrase";
export interface BeatgridOverride {
    kind: BeatgridOverrideKind;
    valueSeconds: number;
    source: "power-user";
    priority: "highest";
}
export function applyBeatgridOverrides(
    model: Readonly<Record<BeatgridOverrideKind, number>>,
    overrides: readonly BeatgridOverride[],
): Record<BeatgridOverrideKind, number> {
    const result = { ...model };
    for (const override of overrides) result[override.kind] = override.valueSeconds;
    return result;
}
export function confidenceSeparation(
    syncConfidence: number,
    transitionConfidence: number,
): { syncConfidence: number; transitionConfidence: number; fused: false } {
    return {
        syncConfidence: clamp01(syncConfidence),
        transitionConfidence: clamp01(transitionConfidence),
        fused: false,
    };
}

export type RecoveryDomain = "recommendation" | "transition" | "audio" | "network" | "device" | "crowd";
export interface RecoveryFailure {
    domain: RecoveryDomain;
    localRepairAvailable: boolean;
    capability: string;
}
export function unifiedRecovery(failure: RecoveryFailure): {
    steps: string[];
    safeContinuation: true;
    replanFuture: true;
} {
    return {
        steps: failure.localRepairAvailable
            ? ["detect", "local-repair", "validate"]
            : ["detect", `downgrade:${failure.capability}`, "safe-continuation", "replan-future"],
        safeContinuation: true,
        replanFuture: true,
    };
}

export const ENGINE_PHILOSOPHY_V2 = {
    planAhead: "do-not-improvise-in-realtime",
    knowUncertainty: "confidence-is-part-of-feature",
    degradeGracefully: "simple-correct-beats-broken-intelligence",
    groundEverything: "catalog-and-audio-evidence-required",
    recoveryPreferredOverFreeAutonomy: true,
} as const;
