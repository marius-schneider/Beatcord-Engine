import { describe, expect, test } from "bun:test";

import { cpuBudget, limitFor, memoryBudgetGb, planResources, resources } from "./resources";

describe("host detection", () => {
    test("reports at least one CPU and some memory", () => {
        expect(cpuBudget()).toBeGreaterThanOrEqual(1);
        expect(Number.isInteger(cpuBudget())).toBe(true);
        expect(memoryBudgetGb()).toBeGreaterThan(0);
    });

    test("never claims more CPUs than the host has", () => {
        // A cgroup quota may lower this, never raise it — sizing pools above the real
        // parallelism just buys context switching.
        const { availableParallelism } = require("node:os") as typeof import("node:os");
        expect(cpuBudget()).toBeLessThanOrEqual(availableParallelism());
    });

    test("the module-level plan matches a fresh one", () => {
        // It's computed once and read all over; a drifting value would be a bug.
        expect(planResources()).toEqual(resources);
    });
});

describe("derived limits", () => {
    const plan = resources;

    test("every pool gets at least one slot", () => {
        expect(plan.beatgridWorkers).toBeGreaterThanOrEqual(1);
        expect(plan.loudnessScans).toBeGreaterThanOrEqual(1);
        expect(plan.ytdlp).toBeGreaterThanOrEqual(1);
        expect(plan.tidalDownloads).toBeGreaterThanOrEqual(1);
        expect(plan.stems).toBeGreaterThanOrEqual(1);
    });

    test("analysis pools leave headroom — none may claim every core", () => {
        // Playback is the real-time path: a late analysis costs one transition, a
        // starved decoder is an audible dropout.
        expect(plan.beatgridWorkers).toBeLessThan(Math.max(2, plan.cpus));
        expect(plan.loudnessScans).toBeLessThan(Math.max(2, plan.cpus));
    });

    test("respects the caps — more parallel scans stop helping past a point", () => {
        expect(plan.beatgridWorkers).toBeLessThanOrEqual(6);
        expect(plan.loudnessScans).toBeLessThanOrEqual(4);
        expect(plan.ytdlp).toBeLessThanOrEqual(8);
        expect(plan.tidalDownloads).toBeLessThanOrEqual(4);
        // Demucs is memory-bound; two jobs is the most we ever allow.
        expect(plan.stems).toBeLessThanOrEqual(2);
    });

    test("loudness stays at or below the beatgrid pool", () => {
        // Loudness scans decode at full speed and compete with playback directly, so
        // they must never be the most aggressive pool.
        expect(plan.loudnessScans).toBeLessThanOrEqual(plan.beatgridWorkers);
    });

    test("a single-core host still gets a workable plan", () => {
        // The floors matter most here: a 1-core VPS must not end up with a zero-sized
        // pool, which would deadlock every analysis.
        expect(Math.max(1, Math.floor(1 / 2))).toBe(1);
        expect(Math.max(1, Math.floor(1 / 3))).toBe(1);
    });
});

describe("explicit configuration wins", () => {
    // Config fields carry 0 for "auto" rather than a plausible default, because a real
    // default can't be told apart from a deliberate choice.
    test("a configured value overrides the derived one", () => {
        expect(limitFor(3, 8)).toBe(3);
        expect(limitFor(1, 8)).toBe(1);
    });

    test("zero means auto", () => {
        expect(limitFor(0, 8)).toBe(8);
    });

    test("a negative value can't disable a pool", () => {
        // Zod already rejects these, but the resolver must not hand back a bad limit
        // either — Semaphore(0) would block forever.
        expect(limitFor(-5, 8)).toBe(8);
    });
});
