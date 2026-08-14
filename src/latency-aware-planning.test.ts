import { expect, test } from "bun:test";

import {
    guardTransitionForLatency,
    notRequiredPreparation,
    type PreparationReadiness,
    readyPreparation,
    type TransitionPreparationReadiness,
} from "./latency-aware-planning";
import type { TransitionPlan } from "./transition-planner";

const NOW = 1_000_000;

function running(
    resource: PreparationReadiness["resource"],
    progress: number,
    estimatedRemainingMs: number,
    confidence = 0.8,
): PreparationReadiness {
    return {
        resource,
        status: "running",
        progress,
        estimatedRemainingMs,
        confidence,
        updatedAtMs: NOW,
    };
}

function ready(): TransitionPreparationReadiness {
    return {
        buffer: readyPreparation("buffer", NOW),
        analysis: readyPreparation("analysis", NOW),
        stems: readyPreparation("stems", NOW),
        previewRender: notRequiredPreparation("preview-render", NOW),
    };
}

function plan(type: TransitionPlan["type"], tempoRatio = 1.02): TransitionPlan {
    return { type, fadeSec: 12, eqSweep: true, tempoRatio, reason: `planned ${type}` };
}

test("fully prepared transitions retain their musical plan", () => {
    const original = plan("acapella");
    const guarded = guardTransitionForLatency(original, {
        nowMs: NOW,
        requiredAtMs: NOW + 24_000,
        resources: ready(),
    });
    expect(guarded.plan).toBe(original);
    expect(guarded.assessment).toMatchObject({ outcome: "full", degraded: false, selectedType: "acapella" });
    expect(guarded.assessment.resources.stems.onTimeProbability).toBe(1);
});

test("a 72% stem job that cannot meet the cue becomes a beat blend", () => {
    const resources = ready();
    resources.stems = running("stems", 0.72, 35_000, 0.75);
    const guarded = guardTransitionForLatency(plan("acapella"), {
        nowMs: NOW,
        requiredAtMs: NOW + 24_000,
        resources,
    });
    expect(guarded.plan.type).toBe("blend");
    expect(guarded.assessment).toMatchObject({ outcome: "simplified", bottleneck: "stems" });
    expect(guarded.assessment.resources.stems.onTimeProbability).toBeLessThan(0.5);
    expect(guarded.plan.reason).toContain("stems may miss deadline");
});

test("late analysis removes beat and phrase dependent moves", () => {
    const resources = ready();
    resources.analysis = running("analysis", 0.35, 18_000, 0.6);
    const guarded = guardTransitionForLatency(plan("bassdrop"), {
        nowMs: NOW,
        requiredAtMs: NOW + 5_000,
        resources,
    });
    expect(guarded.plan).toMatchObject({ type: "fade", tempoRatio: 1, eqSweep: false });
    expect(guarded.assessment).toMatchObject({ outcome: "simplified", executionMode: "safe" });
});

test("late preview rendering falls back to live DSP without changing the plan", () => {
    const original = plan("filter");
    const resources = ready();
    resources.previewRender = running("preview-render", 0.41, 30_000, 0.7);
    const guarded = guardTransitionForLatency(original, {
        nowMs: NOW,
        requiredAtMs: NOW + 12_000,
        resources,
        previewRequiredForExecution: true,
    });
    expect(guarded.plan).toBe(original);
    expect(guarded.assessment).toMatchObject({ outcome: "live-fallback", executionMode: "live" });
});

test("unreliable incoming audio blocks arming and chooses a safe handoff", () => {
    const resources = ready();
    resources.buffer = {
        resource: "buffer",
        status: "not-started",
        progress: 0,
        estimatedRemainingMs: null,
        confidence: 0,
        updatedAtMs: NOW,
    };
    const guarded = guardTransitionForLatency(plan("blend"), {
        nowMs: NOW,
        requiredAtMs: NOW + 20_000,
        resources,
    });
    expect(guarded.assessment).toMatchObject({ outcome: "blocked", bottleneck: "buffer" });
    expect(guarded.plan.type).toBe("fade");
});

test("deadline estimates are deterministic, bounded and treat elapsed cues as due", () => {
    const resources = ready();
    resources.analysis = running("analysis", 0.8, 2_000, 0.2);
    const input = { nowMs: NOW, requiredAtMs: NOW, resources } as const;
    const first = guardTransitionForLatency(plan("filter"), input);
    const second = guardTransitionForLatency(plan("filter"), input);
    expect(first).toEqual(second);
    expect(first.assessment.timeToNeedMs).toBe(0);
    expect(first.assessment.resources.analysis.onTimeProbability).toBeGreaterThanOrEqual(0);
    expect(first.assessment.resources.analysis.onTimeProbability).toBeLessThanOrEqual(1);
});
