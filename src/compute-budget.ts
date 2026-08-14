import { config } from "./config";
import { createLogger } from "./logger";
import { memoryBudgetGb, resources } from "./resources";
import type { TransitionPlan, TransitionType } from "./transition-planner";

const log = createLogger("compute");

export type ComputeTier = 0 | 1 | 2 | 3;
export type ComputeLane = "realtime" | "background";
export type ComputeTaskPriority = "critical" | "foreground" | "background" | "opportunistic";
export type ComputeTaskKind =
    | "audio-realtime"
    | "loudness"
    | "beat-grid"
    | "structure"
    | "stem-separation"
    | "stem-analysis"
    | "embedding"
    | "preview-render"
    | "simulation";

export interface ComputeBudget {
    realtimeCpu: number;
    backgroundCpu: number;
    gpuAvailable: boolean;
    memoryBudgetMb: number;
    batteryMode: boolean;
    tierOverride?: ComputeTier;
}

export interface ComputeTierPolicy {
    tier: ComputeTier;
    name: "safe" | "core" | "musical" | "ultra";
    beatAnalysis: boolean;
    phraseAnalysis: boolean;
    selectedStems: boolean;
    embeddings: boolean;
    simulation: boolean;
    highQualityStretch: boolean;
    allowedTransitions: readonly TransitionType[];
}

export const COMPUTE_TIER_POLICIES: Record<ComputeTier, ComputeTierPolicy> = {
    0: {
        tier: 0,
        name: "safe",
        beatAnalysis: false,
        phraseAnalysis: false,
        selectedStems: false,
        embeddings: false,
        simulation: false,
        highQualityStretch: false,
        allowedTransitions: ["fade", "blend"],
    },
    1: {
        tier: 1,
        name: "core",
        beatAnalysis: true,
        phraseAnalysis: false,
        selectedStems: false,
        embeddings: false,
        simulation: false,
        highQualityStretch: false,
        allowedTransitions: ["fade", "blend", "cut"],
    },
    2: {
        tier: 2,
        name: "musical",
        beatAnalysis: true,
        phraseAnalysis: true,
        selectedStems: true,
        embeddings: true,
        simulation: false,
        highQualityStretch: false,
        allowedTransitions: [
            "fade",
            "blend",
            "cut",
            "filter",
            "echo",
            "bassdrop",
            "spinback",
            "gate",
            "roll",
            "riser",
            "acapella",
        ],
    },
    3: {
        tier: 3,
        name: "ultra",
        beatAnalysis: true,
        phraseAnalysis: true,
        selectedStems: true,
        embeddings: true,
        simulation: true,
        highQualityStretch: true,
        allowedTransitions: [
            "fade",
            "blend",
            "cut",
            "filter",
            "echo",
            "bassdrop",
            "spinback",
            "gate",
            "roll",
            "riser",
            "acapella",
        ],
    },
};

export interface ComputeTaskRequest {
    id: string;
    kind: ComputeTaskKind;
    lane?: ComputeLane;
    priority?: ComputeTaskPriority;
    cpu?: number;
    memoryMb?: number;
    requiresGpu?: boolean;
    minimumTier?: ComputeTier;
    deadlineAtMs?: number;
    signal?: AbortSignal;
}

export type ComputeTaskOutcome<T> =
    | { status: "completed"; value: T; tier: ComputeTier }
    | { status: "deferred" | "cancelled"; reason: string; tier: ComputeTier };

export interface ComputeTaskContext {
    signal: AbortSignal;
    tier: ComputeTier;
}

export interface ComputeSchedulerRuntimeState {
    playbackActive: boolean;
    batteryMode: boolean;
    memoryPressure: number;
}

export interface ComputeSchedulerSnapshot {
    version: 1;
    tier: ComputeTier;
    policy: ComputeTierPolicy;
    budget: ComputeBudget;
    runtime: ComputeSchedulerRuntimeState;
    active: { realtimeCpu: number; backgroundCpu: number; memoryMb: number; gpuJobs: number };
    queued: number;
    completed: number;
    deferred: number;
    cancelled: number;
}

interface NormalizedTask extends ComputeTaskRequest {
    lane: ComputeLane;
    priority: ComputeTaskPriority;
    cpu: number;
    memoryMb: number;
    requiresGpu: boolean;
    minimumTier: ComputeTier;
}

interface QueuedTask<T> {
    sequence: number;
    request: NormalizedTask;
    controller: AbortController;
    run: (context: ComputeTaskContext) => Promise<T>;
    resolve: (outcome: ComputeTaskOutcome<T>) => void;
    reject: (error: unknown) => void;
    removeAbortListener?: () => void;
}

interface RunningTask {
    request: NormalizedTask;
    controller: AbortController;
}

const PRIORITY: Record<ComputeTaskPriority, number> = {
    critical: 0,
    foreground: 1,
    background: 2,
    opportunistic: 3,
};

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function finite(value: number | undefined, fallback: number, min: number): number {
    return typeof value === "number" && Number.isFinite(value) ? Math.max(min, value) : fallback;
}

export function deriveComputeBudget(input: {
    cpus: number;
    memoryMb: number;
    gpuAvailable?: boolean;
    batteryMode?: boolean;
    realtimeCpu?: number;
    backgroundCpu?: number;
    tierOverride?: ComputeTier;
}): ComputeBudget {
    const cpus = finite(input.cpus, 1, 0.25);
    const realtimeCpu = finite(input.realtimeCpu, cpus <= 1 ? 0.75 : Math.max(1, Math.floor(cpus * 0.35)), 0.25);
    const backgroundCpu = finite(input.backgroundCpu, Math.max(0.25, cpus - realtimeCpu), 0.25);
    return {
        realtimeCpu,
        backgroundCpu,
        gpuAvailable: input.gpuAvailable ?? false,
        memoryBudgetMb: Math.floor(finite(input.memoryMb, 512, 256)),
        batteryMode: input.batteryMode ?? false,
        ...(input.tierOverride !== undefined ? { tierOverride: input.tierOverride } : {}),
    };
}

export function defaultComputeBudget(): ComputeBudget {
    const detectedMemoryMb = Math.floor(memoryBudgetGb() * 1024 * 0.7);
    return deriveComputeBudget({
        cpus: resources.cpus,
        memoryMb: config.COMPUTE_MEMORY_BUDGET_MB || detectedMemoryMb,
        gpuAvailable: config.COMPUTE_GPU_AVAILABLE,
        batteryMode: config.COMPUTE_BATTERY_MODE,
        ...(config.COMPUTE_REALTIME_CPU > 0 ? { realtimeCpu: config.COMPUTE_REALTIME_CPU } : {}),
        ...(config.COMPUTE_BACKGROUND_CPU > 0 ? { backgroundCpu: config.COMPUTE_BACKGROUND_CPU } : {}),
        ...(config.COMPUTE_TIER_OVERRIDE >= 0 ? { tierOverride: config.COMPUTE_TIER_OVERRIDE as ComputeTier } : {}),
    });
}

export function deriveComputeTier(
    budget: ComputeBudget,
    runtime: Partial<ComputeSchedulerRuntimeState> = {},
): ComputeTier {
    if (budget.tierOverride !== undefined) return budget.tierOverride;
    const batteryMode = runtime.batteryMode ?? budget.batteryMode;
    const memoryPressure = clamp(runtime.memoryPressure ?? 0, 0, 1);
    const playbackFactor = runtime.playbackActive ? 0.8 : 1;
    const backgroundCpu = budget.backgroundCpu * playbackFactor;
    const memoryMb = budget.memoryBudgetMb * (1 - memoryPressure * 0.85);
    if (!batteryMode && budget.gpuAvailable && backgroundCpu >= 4 && memoryMb >= 8_192) return 3;
    if (!batteryMode && backgroundCpu >= 2 && memoryMb >= 4_096) return 2;
    if (backgroundCpu >= 0.75 && memoryMb >= 768) return 1;
    return 0;
}

function normalize(request: ComputeTaskRequest): NormalizedTask {
    return {
        ...request,
        lane: request.lane ?? (request.kind === "audio-realtime" ? "realtime" : "background"),
        priority: request.priority ?? "background",
        cpu: finite(request.cpu, 1, 0.05),
        memoryMb: finite(request.memoryMb, 64, 0),
        requiresGpu: request.requiresGpu ?? false,
        minimumTier: request.minimumTier ?? 0,
    };
}

/** Priority-aware runtime admission controller with a hard real-time CPU reserve. */
export class ComputeBudgetScheduler {
    readonly budget: ComputeBudget;
    #runtime: ComputeSchedulerRuntimeState;
    #queue: QueuedTask<unknown>[] = [];
    #running = new Map<number, RunningTask>();
    #sequence = 0;
    #activeRealtimeCpu = 0;
    #activeBackgroundCpu = 0;
    #activeMemoryMb = 0;
    #activeGpuJobs = 0;
    #completed = 0;
    #deferred = 0;
    #cancelled = 0;
    #now: () => number;

    constructor(budget: ComputeBudget = defaultComputeBudget(), options: { now?: () => number } = {}) {
        this.budget = { ...budget };
        this.#runtime = { playbackActive: false, batteryMode: budget.batteryMode, memoryPressure: 0 };
        this.#now = options.now ?? Date.now;
    }

    snapshot(): ComputeSchedulerSnapshot {
        const tier = deriveComputeTier(this.budget, this.#runtime);
        return {
            version: 1,
            tier,
            policy: COMPUTE_TIER_POLICIES[tier],
            budget: { ...this.budget },
            runtime: { ...this.#runtime },
            active: {
                realtimeCpu: this.#activeRealtimeCpu,
                backgroundCpu: this.#activeBackgroundCpu,
                memoryMb: this.#activeMemoryMb,
                gpuJobs: this.#activeGpuJobs,
            },
            queued: this.#queue.length,
            completed: this.#completed,
            deferred: this.#deferred,
            cancelled: this.#cancelled,
        };
    }

    updateRuntime(update: Partial<ComputeSchedulerRuntimeState>): ComputeSchedulerSnapshot {
        this.#runtime = {
            ...this.#runtime,
            ...update,
            memoryPressure: clamp(update.memoryPressure ?? this.#runtime.memoryPressure, 0, 1),
        };
        const tier = deriveComputeTier(this.budget, this.#runtime);
        for (const running of this.#running.values()) {
            if (
                running.request.minimumTier > tier &&
                (running.request.priority === "background" || running.request.priority === "opportunistic")
            ) {
                running.controller.abort("compute tier dropped while task was running");
            }
        }
        this.#pump();
        return this.snapshot();
    }

    schedule<T>(
        requestValue: ComputeTaskRequest,
        run: (context: ComputeTaskContext) => Promise<T>,
    ): Promise<ComputeTaskOutcome<T>> {
        const request = normalize(requestValue);
        const immediate = this.#cannotRun(request);
        if (immediate) {
            this.#deferred++;
            return Promise.resolve({ status: "deferred", reason: immediate, tier: this.snapshot().tier });
        }
        if (request.signal?.aborted) {
            this.#cancelled++;
            return Promise.resolve({
                status: "cancelled",
                reason: "task signal already aborted",
                tier: this.snapshot().tier,
            });
        }
        return new Promise<ComputeTaskOutcome<T>>((resolve, reject) => {
            const controller = new AbortController();
            const task: QueuedTask<T> = {
                sequence: ++this.#sequence,
                request,
                controller,
                run,
                resolve,
                reject,
            };
            if (request.signal) {
                const onAbort = () => {
                    controller.abort(request.signal?.reason);
                    this.#pump();
                };
                request.signal.addEventListener("abort", onAbort, { once: true });
                task.removeAbortListener = () => request.signal?.removeEventListener("abort", onAbort);
            }
            this.#queue.push(task as QueuedTask<unknown>);
            this.#sortQueue();
            this.#pump();
        });
    }

    #sortQueue(): void {
        this.#queue.sort((left, right) => {
            const priority = PRIORITY[left.request.priority] - PRIORITY[right.request.priority];
            if (priority) return priority;
            const leftDeadline = left.request.deadlineAtMs ?? Number.MAX_SAFE_INTEGER;
            const rightDeadline = right.request.deadlineAtMs ?? Number.MAX_SAFE_INTEGER;
            return leftDeadline - rightDeadline || left.sequence - right.sequence;
        });
    }

    #cannotRun(request: NormalizedTask): string | null {
        const snapshot = this.snapshot();
        if (request.minimumTier > snapshot.tier)
            return `requires compute tier ${request.minimumTier}; active tier is ${snapshot.tier}`;
        if (request.requiresGpu && !this.budget.gpuAvailable) return "requires an unavailable GPU";
        const cpuBudget = request.lane === "realtime" ? this.budget.realtimeCpu : this.#effectiveBackgroundCpu();
        if (request.cpu > cpuBudget)
            return `requires ${request.cpu} CPU; ${cpuBudget.toFixed(2)} available in ${request.lane}`;
        if (request.memoryMb > this.#effectiveMemoryBudget()) {
            return `requires ${request.memoryMb} MB; ${Math.floor(this.#effectiveMemoryBudget())} MB available`;
        }
        if (request.deadlineAtMs !== undefined && request.deadlineAtMs <= this.#now())
            return "task deadline already passed";
        return null;
    }

    #effectiveBackgroundCpu(): number {
        return this.budget.backgroundCpu * (this.#runtime.playbackActive ? 0.8 : 1);
    }

    #effectiveMemoryBudget(): number {
        return this.budget.memoryBudgetMb * (1 - this.#runtime.memoryPressure * 0.85);
    }

    #fits(request: NormalizedTask): boolean {
        const cpuActive = request.lane === "realtime" ? this.#activeRealtimeCpu : this.#activeBackgroundCpu;
        const cpuBudget = request.lane === "realtime" ? this.budget.realtimeCpu : this.#effectiveBackgroundCpu();
        return (
            cpuActive + request.cpu <= cpuBudget + Number.EPSILON &&
            this.#activeMemoryMb + request.memoryMb <= this.#effectiveMemoryBudget() + Number.EPSILON &&
            (!request.requiresGpu || this.#activeGpuJobs === 0)
        );
    }

    #pump(): void {
        const tier = deriveComputeTier(this.budget, this.#runtime);
        for (let index = this.#queue.length - 1; index >= 0; index--) {
            const task = this.#queue[index]!;
            const reason = task.controller.signal.aborted
                ? "task cancelled before execution"
                : task.request.deadlineAtMs !== undefined && task.request.deadlineAtMs <= this.#now()
                  ? "task deadline passed while queued"
                  : task.request.minimumTier > tier
                    ? `compute tier dropped below ${task.request.minimumTier}`
                    : null;
            if (!reason) continue;
            this.#queue.splice(index, 1);
            task.removeAbortListener?.();
            if (task.controller.signal.aborted) {
                this.#cancelled++;
                task.resolve({ status: "cancelled", reason, tier });
            } else {
                this.#deferred++;
                task.resolve({ status: "deferred", reason, tier });
            }
        }
        let started = true;
        while (started) {
            started = false;
            const index = this.#queue.findIndex((task) => this.#fits(task.request));
            if (index < 0) break;
            const [task] = this.#queue.splice(index, 1);
            if (!task) break;
            this.#start(task);
            started = true;
        }
    }

    #start(task: QueuedTask<unknown>): void {
        const { request, controller } = task;
        if (request.lane === "realtime") this.#activeRealtimeCpu += request.cpu;
        else this.#activeBackgroundCpu += request.cpu;
        this.#activeMemoryMb += request.memoryMb;
        if (request.requiresGpu) this.#activeGpuJobs++;
        this.#running.set(task.sequence, { request, controller });
        const tier = deriveComputeTier(this.budget, this.#runtime);
        void task
            .run({ signal: controller.signal, tier })
            .then((value) => {
                if (controller.signal.aborted) {
                    this.#cancelled++;
                    task.resolve({
                        status: "cancelled",
                        reason: String(controller.signal.reason ?? "task cancelled while running"),
                        tier,
                    });
                } else {
                    this.#completed++;
                    task.resolve({ status: "completed", value, tier });
                }
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) {
                    this.#cancelled++;
                    task.resolve({
                        status: "cancelled",
                        reason: String(controller.signal.reason ?? "task cancelled while running"),
                        tier,
                    });
                } else {
                    task.reject(error);
                }
            })
            .finally(() => {
                task.removeAbortListener?.();
                this.#running.delete(task.sequence);
                if (request.lane === "realtime") this.#activeRealtimeCpu -= request.cpu;
                else this.#activeBackgroundCpu -= request.cpu;
                this.#activeMemoryMb -= request.memoryMb;
                if (request.requiresGpu) this.#activeGpuJobs--;
                this.#pump();
            });
    }
}

export const computeScheduler = new ComputeBudgetScheduler();

export function logComputeBudgetPlan(scheduler: ComputeBudgetScheduler = computeScheduler): void {
    const snapshot = scheduler.snapshot();
    log.info(
        `tier ${snapshot.tier} (${snapshot.policy.name}): realtime ${snapshot.budget.realtimeCpu.toFixed(2)} CPU, ` +
            `background ${snapshot.budget.backgroundCpu.toFixed(2)} CPU, ${snapshot.budget.memoryBudgetMb} MB, ` +
            `GPU ${snapshot.budget.gpuAvailable ? "yes" : "no"}, battery ${snapshot.runtime.batteryMode ? "yes" : "no"}`,
    );
}

export interface ComputeTransitionGuard {
    plan: TransitionPlan;
    degraded: boolean;
    reason: string | null;
}

/** Enforce the creative ceiling of the current device tier after Director planning. */
export function guardTransitionForComputeTier(plan: TransitionPlan, tier: ComputeTier): ComputeTransitionGuard {
    const policy = COMPUTE_TIER_POLICIES[tier];
    if (policy.allowedTransitions.includes(plan.type)) return { plan, degraded: false, reason: null };
    const replacement: TransitionType = tier === 0 || plan.tempoRatio === 1 ? "fade" : "blend";
    const { stretch, ...basePlan } = plan;
    return {
        degraded: true,
        reason: `compute tier ${tier} (${policy.name}) does not allow ${plan.type}; using ${replacement}`,
        plan: {
            ...basePlan,
            type: replacement,
            fadeSec: tier === 0 ? Math.min(8, Math.max(4, plan.fadeSec)) : plan.fadeSec,
            eqSweep: tier >= 1 && replacement === "blend" ? plan.eqSweep : false,
            tempoRatio: tier >= 1 && replacement === "blend" ? plan.tempoRatio : 1,
            reason: `${plan.reason}; compute-tier fallback to ${replacement}`,
            ...(tier >= 1 && replacement === "blend" && stretch ? { stretch } : {}),
        },
    };
}
