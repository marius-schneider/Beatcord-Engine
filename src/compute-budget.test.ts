import { expect, test } from "bun:test";

import {
    ComputeBudgetScheduler,
    deriveComputeBudget,
    deriveComputeTier,
    guardTransitionForComputeTier,
} from "./compute-budget";
import type { TransitionPlan } from "./transition-planner";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

test("compute tiers scale from safe playback through the GPU ultra path", () => {
    expect(deriveComputeTier(deriveComputeBudget({ cpus: 1, memoryMb: 512 }))).toBe(0);
    expect(deriveComputeTier(deriveComputeBudget({ cpus: 2, memoryMb: 1_024 }))).toBe(1);
    expect(deriveComputeTier(deriveComputeBudget({ cpus: 4, memoryMb: 4_096 }))).toBe(2);
    expect(deriveComputeTier(deriveComputeBudget({ cpus: 8, memoryMb: 8_192, gpuAvailable: true }))).toBe(3);
    expect(
        deriveComputeTier(deriveComputeBudget({ cpus: 8, memoryMb: 8_192, gpuAvailable: true, batteryMode: true })),
    ).toBe(1);
});

test("background saturation cannot consume the realtime CPU reserve", async () => {
    const scheduler = new ComputeBudgetScheduler({
        realtimeCpu: 1,
        backgroundCpu: 1,
        gpuAvailable: false,
        memoryBudgetMb: 2_048,
        batteryMode: false,
        tierOverride: 2,
    });
    let releaseBackground!: () => void;
    const backgroundGate = new Promise<void>((resolve) => {
        releaseBackground = resolve;
    });
    const background = scheduler.schedule(
        { id: "analysis", kind: "beat-grid", lane: "background", cpu: 1, memoryMb: 100 },
        async () => {
            await backgroundGate;
            return "analysis";
        },
    );
    await tick();
    const realtime = await scheduler.schedule(
        { id: "audio", kind: "audio-realtime", lane: "realtime", priority: "critical", cpu: 1, memoryMb: 100 },
        async () => "audio",
    );

    expect(realtime).toMatchObject({ status: "completed", value: "audio" });
    expect(scheduler.snapshot().active.backgroundCpu).toBe(1);
    releaseBackground();
    expect(await background).toMatchObject({ status: "completed", value: "analysis" });
});

test("queued work is priority ordered and FIFO within a priority", async () => {
    const scheduler = new ComputeBudgetScheduler({
        realtimeCpu: 1,
        backgroundCpu: 1,
        gpuAvailable: false,
        memoryBudgetMb: 4_096,
        batteryMode: false,
        tierOverride: 2,
    });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    const order: string[] = [];
    const blocker = scheduler.schedule({ id: "blocker", kind: "structure", cpu: 1, memoryMb: 10 }, async () => gate);
    const low = scheduler.schedule(
        { id: "low", kind: "simulation", priority: "opportunistic", cpu: 1, memoryMb: 10 },
        async () => order.push("low"),
    );
    const high = scheduler.schedule(
        { id: "high", kind: "beat-grid", priority: "critical", cpu: 1, memoryMb: 10 },
        async () => order.push("high"),
    );
    release();
    await Promise.all([blocker, low, high]);
    expect(order).toEqual(["high", "low"]);
});

test("tier loss aborts optional running work and deferred work is retryable", async () => {
    const scheduler = new ComputeBudgetScheduler({
        realtimeCpu: 1,
        backgroundCpu: 3,
        gpuAvailable: false,
        memoryBudgetMb: 8_192,
        batteryMode: false,
    });
    const running = scheduler.schedule(
        {
            id: "stems",
            kind: "stem-separation",
            priority: "opportunistic",
            cpu: 1,
            memoryMb: 1_000,
            minimumTier: 2,
        },
        ({ signal }) =>
            new Promise<string>((resolve) => {
                signal.addEventListener("abort", () => resolve("stopped"), { once: true });
            }),
    );
    await tick();
    expect(scheduler.snapshot().tier).toBe(2);
    scheduler.updateRuntime({ batteryMode: true });
    expect(await running).toMatchObject({ status: "cancelled" });
    expect(scheduler.snapshot()).toMatchObject({ tier: 1, cancelled: 1 });

    const deferred = await scheduler.schedule(
        { id: "simulation", kind: "simulation", minimumTier: 3 },
        async () => "never",
    );
    expect(deferred).toMatchObject({ status: "deferred", tier: 1 });
});

test("GPU, memory and deadlines fail closed before expensive work starts", async () => {
    let ran = false;
    const scheduler = new ComputeBudgetScheduler(
        {
            realtimeCpu: 1,
            backgroundCpu: 2,
            gpuAvailable: false,
            memoryBudgetMb: 1_024,
            batteryMode: false,
            tierOverride: 2,
        },
        { now: () => 100 },
    );
    const run = async () => {
        ran = true;
        return true;
    };
    expect(await scheduler.schedule({ id: "gpu", kind: "embedding", requiresGpu: true }, run)).toMatchObject({
        status: "deferred",
    });
    expect(await scheduler.schedule({ id: "memory", kind: "stem-separation", memoryMb: 2_000 }, run)).toMatchObject({
        status: "deferred",
    });
    expect(await scheduler.schedule({ id: "late", kind: "preview-render", deadlineAtMs: 100 }, run)).toMatchObject({
        status: "deferred",
    });
    expect(ran).toBe(false);
});

test("failed work releases every budget reservation", async () => {
    const scheduler = new ComputeBudgetScheduler({
        realtimeCpu: 1,
        backgroundCpu: 1,
        gpuAvailable: false,
        memoryBudgetMb: 1_024,
        batteryMode: false,
        tierOverride: 1,
    });
    await expect(
        scheduler.schedule({ id: "broken", kind: "beat-grid", cpu: 1, memoryMb: 512 }, async () => {
            throw new Error("broken analyzer");
        }),
    ).rejects.toThrow("broken analyzer");
    await tick();
    expect(scheduler.snapshot().active).toEqual({ realtimeCpu: 0, backgroundCpu: 0, memoryMb: 0, gpuJobs: 0 });
    expect(
        await scheduler.schedule({ id: "retry", kind: "beat-grid", cpu: 1, memoryMb: 512 }, async () => true),
    ).toMatchObject({ status: "completed", value: true });
});

test("device-tier guard reduces unsupported creative plans to executable fallbacks", () => {
    const plan: TransitionPlan = {
        type: "acapella",
        fadeSec: 12,
        eqSweep: true,
        tempoRatio: 1.03,
        reason: "clean stems",
    };
    const safe = guardTransitionForComputeTier(plan, 0);
    expect(safe).toMatchObject({ degraded: true, plan: { type: "fade", tempoRatio: 1, eqSweep: false } });
    expect(safe.plan.fadeSec).toBe(8);
    expect(guardTransitionForComputeTier(plan, 2)).toEqual({ plan, degraded: false, reason: null });
});
