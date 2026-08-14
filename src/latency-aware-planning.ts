import type { TransitionPlan, TransitionType } from "./transition-planner";

export type PreparationResource = "buffer" | "analysis" | "stems" | "preview-render";
export type PreparationStatus = "not-started" | "running" | "ready" | "failed" | "not-required";

export interface PreparationReadiness {
    resource: PreparationResource;
    status: PreparationStatus;
    /** Best available completion estimate, 0..1. */
    progress: number;
    /** Remaining wall-clock work, null when it cannot be estimated. */
    estimatedRemainingMs: number | null;
    /** Confidence in the ETA rather than confidence in the musical analysis. */
    confidence: number;
    updatedAtMs: number;
    reason?: string;
}

export interface TransitionPreparationReadiness {
    buffer: PreparationReadiness;
    analysis: PreparationReadiness;
    stems: PreparationReadiness;
    previewRender: PreparationReadiness;
}

export interface LatencyPlanningContext {
    nowMs: number;
    requiredAtMs: number;
    resources: TransitionPreparationReadiness;
    /** True only when an offline render is the intended execution path. */
    previewRequiredForExecution?: boolean;
}

export interface ResourceDeadlineAssessment {
    resource: PreparationResource;
    required: boolean;
    status: PreparationStatus;
    progress: number;
    estimatedRemainingMs: number | null;
    slackMs: number | null;
    onTimeProbability: number;
    confidence: number;
    reason: string;
}

export type LatencyPlanningOutcome = "full" | "live-fallback" | "simplified" | "blocked";

export interface LatencyPlanningAssessment {
    version: 1;
    timeToNeedMs: number;
    outcome: LatencyPlanningOutcome;
    originalType: TransitionType;
    selectedType: TransitionType;
    degraded: boolean;
    executionMode: "planned" | "live" | "safe" | "blocked";
    bottleneck: PreparationResource | null;
    resources: Record<PreparationResource, ResourceDeadlineAssessment>;
    reasons: string[];
}

export interface LatencyGuardResult {
    plan: TransitionPlan;
    assessment: LatencyPlanningAssessment;
}

const ANALYSIS_TYPES = new Set<TransitionType>([
    "blend",
    "filter",
    "echo",
    "bassdrop",
    "spinback",
    "gate",
    "roll",
    "riser",
    "acapella",
]);

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function readyPreparation(
    resource: PreparationResource,
    nowMs: number,
    reason = "resource ready",
): PreparationReadiness {
    return {
        resource,
        status: "ready",
        progress: 1,
        estimatedRemainingMs: 0,
        confidence: 1,
        updatedAtMs: nowMs,
        reason,
    };
}

export function notRequiredPreparation(
    resource: PreparationResource,
    nowMs: number,
    reason = "not required for execution",
): PreparationReadiness {
    return {
        resource,
        status: "not-required",
        progress: 1,
        estimatedRemainingMs: 0,
        confidence: 1,
        updatedAtMs: nowMs,
        reason,
    };
}

/** Collapse per-track readiness into the slowest resource needed by a pair. */
export function combinePreparationReadiness(
    resource: PreparationResource,
    values: readonly PreparationReadiness[],
    nowMs: number,
): PreparationReadiness {
    if (!values.length) {
        return {
            resource,
            status: "not-started",
            progress: 0,
            estimatedRemainingMs: null,
            confidence: 0,
            updatedAtMs: nowMs,
            reason: "no readiness observations",
        };
    }
    if (values.every((value) => value.status === "ready" || value.status === "not-required")) {
        return readyPreparation(resource, nowMs, "all required tracks are ready");
    }
    const failure = values.find((value) => value.status === "failed");
    if (failure) return { ...failure, resource, updatedAtMs: nowMs };
    const running = values.some((value) => value.status === "running");
    const estimates = values.map((value) => value.estimatedRemainingMs).filter((value) => value !== null);
    return {
        resource,
        status: running ? "running" : "not-started",
        progress: Math.min(...values.map((value) => clamp01(value.progress))),
        estimatedRemainingMs: estimates.length ? Math.max(...estimates) : null,
        confidence: Math.min(...values.map((value) => clamp01(value.confidence))),
        updatedAtMs: nowMs,
        reason: `slowest of ${values.length} required preparation states`,
    };
}

function deadlineProbability(resource: PreparationReadiness, timeToNeedMs: number): number {
    if (resource.status === "ready" || resource.status === "not-required") return 1;
    if (resource.status === "failed") return 0;
    if (resource.status === "not-started" && resource.estimatedRemainingMs === null) return 0;
    const remaining = resource.estimatedRemainingMs;
    if (remaining === null) return clamp01(resource.progress * resource.confidence * 0.5);
    if (timeToNeedMs <= 0) return resource.progress >= 1 ? 1 : 0;
    const slack = timeToNeedMs - remaining;
    const uncertainty = Math.max(500, remaining * (0.2 + (1 - resource.confidence) * 0.8));
    const logistic = 1 / (1 + Math.exp(-slack / uncertainty));
    // Low-confidence ETAs stay cautious even when the point estimate fits.
    return clamp01(logistic * (0.55 + resource.confidence * 0.45));
}

function assessResource(
    readiness: PreparationReadiness,
    timeToNeedMs: number,
    required: boolean,
): ResourceDeadlineAssessment {
    const onTimeProbability = required ? deadlineProbability(readiness, timeToNeedMs) : 1;
    const slackMs = readiness.estimatedRemainingMs === null ? null : timeToNeedMs - readiness.estimatedRemainingMs;
    const timing = !required
        ? "optional for selected execution path"
        : readiness.status === "ready" || readiness.status === "not-required"
          ? "ready before deadline"
          : `${Math.round(onTimeProbability * 100)}% probability of meeting deadline`;
    return {
        resource: readiness.resource,
        required,
        status: readiness.status,
        progress: clamp01(readiness.progress),
        estimatedRemainingMs: readiness.estimatedRemainingMs,
        slackMs,
        onTimeProbability,
        confidence: clamp01(readiness.confidence),
        reason: readiness.reason ? `${timing}: ${readiness.reason}` : timing,
    };
}

function fallbackPlan(plan: TransitionPlan, type: "blend" | "fade", reason: string): TransitionPlan {
    const { stretch: _stretch, ...base } = plan;
    return {
        ...base,
        type,
        fadeSec: type === "fade" ? Math.min(8, Math.max(4, plan.fadeSec)) : plan.fadeSec,
        eqSweep: type === "blend" ? plan.eqSweep : false,
        tempoRatio: type === "blend" ? plan.tempoRatio : 1,
        reason: `${plan.reason}; ${reason}`,
        ...(type === "blend" && plan.stretch ? { stretch: plan.stretch } : {}),
    };
}

/**
 * Admit only work that is likely to exist when the cue fires. This function is
 * pure: streaming implementations can feed measured progress, local playback can
 * feed ready resources, and replay/debug produces the same answer.
 */
export function guardTransitionForLatency(plan: TransitionPlan, context: LatencyPlanningContext): LatencyGuardResult {
    const timeToNeedMs = Math.max(0, context.requiredAtMs - context.nowMs);
    const analysisRequired = ANALYSIS_TYPES.has(plan.type);
    const stemsRequired = plan.type === "acapella";
    const previewRequired = context.previewRequiredForExecution ?? false;
    const resources: Record<PreparationResource, ResourceDeadlineAssessment> = {
        buffer: assessResource(context.resources.buffer, timeToNeedMs, true),
        analysis: assessResource(context.resources.analysis, timeToNeedMs, analysisRequired),
        stems: assessResource(context.resources.stems, timeToNeedMs, stemsRequired),
        "preview-render": assessResource(context.resources.previewRender, timeToNeedMs, previewRequired),
    };
    const required = Object.values(resources).filter((resource) => resource.required);
    const bottleneck =
        required.length > 0
            ? required.reduce((worst, resource) =>
                  resource.onTimeProbability < worst.onTimeProbability ? resource : worst,
              ).resource
            : null;
    const reasons = required.map(
        (resource) =>
            `${resource.resource} ${(resource.progress * 100).toFixed(0)}%, ${(resource.onTimeProbability * 100).toFixed(0)}% on-time`,
    );

    let guardedPlan = plan;
    let outcome: LatencyPlanningOutcome = "full";
    let executionMode: LatencyPlanningAssessment["executionMode"] = "planned";
    if (resources.buffer.onTimeProbability < 0.9) {
        guardedPlan = fallbackPlan(plan, "fade", "latency guard: incoming audio not reliably ready");
        outcome = "blocked";
        executionMode = "blocked";
        reasons.push("incoming audio is not reliable enough to arm a transition");
    } else if (stemsRequired && resources.stems.onTimeProbability < 0.82) {
        const analysisReady = resources.analysis.onTimeProbability >= 0.75;
        guardedPlan = fallbackPlan(
            plan,
            analysisReady && plan.tempoRatio !== 1 ? "blend" : "fade",
            "latency guard: stems may miss deadline",
        );
        outcome = "simplified";
        executionMode = "safe";
        reasons.push("stem-dependent move removed before it can miss the handoff");
    } else if (analysisRequired && resources.analysis.onTimeProbability < 0.75) {
        guardedPlan = fallbackPlan(plan, "fade", "latency guard: analysis may miss deadline");
        outcome = "simplified";
        executionMode = "safe";
        reasons.push("beat/phrase-dependent move removed before deadline");
    } else if (previewRequired && resources["preview-render"].onTimeProbability < 0.75) {
        outcome = "live-fallback";
        executionMode = "live";
        reasons.push("offline preview/render may miss deadline; use live DSP for the same plan");
    }

    return {
        plan: guardedPlan,
        assessment: {
            version: 1,
            timeToNeedMs,
            outcome,
            originalType: plan.type,
            selectedType: guardedPlan.type,
            degraded: outcome !== "full",
            executionMode,
            bottleneck,
            resources,
            reasons,
        },
    };
}
