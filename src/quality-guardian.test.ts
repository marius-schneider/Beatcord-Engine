import { expect, test } from "bun:test";

import { guardTransitionPlan, RealtimeQualityGuardian } from "./quality-guardian";
import type { TransitionPlan } from "./transition-planner";

function observeSine(guardian: RealtimeQualityGuardian, frames = 30): void {
    for (let frame = 0; frame < frames; frame++) {
        const samples = new Float32Array(960 * 2);
        for (let i = 0; i < 960; i++) {
            const value = Math.sin(((frame * 960 + i) * Math.PI * 2 * 440) / 48_000) * 0.5;
            samples[i * 2] = value;
            samples[i * 2 + 1] = value;
        }
        guardian.observeFloatFrame(samples, 1, 1);
    }
}

const riskyPlan: TransitionPlan = {
    type: "bassdrop",
    fadeSec: 6,
    eqSweep: true,
    tempoRatio: 1.04,
    reason: "party bass swap",
};

test("RealtimeQualityGuardian measures a clean stereo float stream without false alarms", () => {
    const guardian = new RealtimeQualityGuardian();
    observeSine(guardian);
    const snapshot = guardian.snapshot();
    expect(snapshot.status).toBe("healthy");
    expect(snapshot.samplePeakDbfs).toBeCloseTo(-6.02, 1);
    expect(snapshot.rmsDbfs).toBeCloseTo(-9.03, 1);
    expect(snapshot.stereoCorrelation).toBe(1);
    expect(snapshot.issues).toEqual([]);
});

test("RealtimeQualityGuardian detects invalid samples and sustained limiter demand", () => {
    const guardian = new RealtimeQualityGuardian();
    for (let frame = 0; frame < 30; frame++) {
        const samples = new Float32Array(960 * 2).fill(1.2);
        if (frame === 0) samples[10] = Number.NaN;
        guardian.observeFloatFrame(samples, 1, 1);
    }
    const snapshot = guardian.snapshot();
    expect(snapshot.status).toBe("unsafe");
    expect(snapshot.nonFiniteSamples).toBe(1);
    expect(snapshot.overFullScaleSamples).toBeGreaterThan(50_000);
    expect(snapshot.issues).toContain("non-finite-samples");
    expect(snapshot.issues).toContain("sustained-pre-limiter-overload");
});

test("RealtimeQualityGuardian records underruns and missed realtime deadlines", () => {
    const guardian = new RealtimeQualityGuardian();
    observeSine(guardian, 50);
    guardian.noteInsertedSilence(true);
    guardian.noteInsertedSilence(true);
    guardian.noteInsertedSilence(true);
    guardian.noteDeadlineMiss(125);
    const snapshot = guardian.snapshot();
    expect(snapshot.status).toBe("unsafe");
    expect(snapshot.underruns).toBe(3);
    expect(snapshot.lateFrames).toBe(1);
    expect(snapshot.maxDeadlineMissMs).toBe(125);
});

test("RealtimeQualityGuardian lets transient faults expire from its bounded window", () => {
    const guardian = new RealtimeQualityGuardian(25);
    guardian.noteInsertedSilence(true);
    observeSine(guardian, 24);
    expect(guardian.snapshot().status).toBe("warning");
    observeSine(guardian, 25);
    const recovered = guardian.snapshot();
    expect(recovered.status).toBe("healthy");
    expect(recovered.underruns).toBe(0);
    expect(recovered.windowCapacityFrames).toBe(25);
});

test("Quality Guardian rescue ladder preserves clean plans and degrades risky ones", () => {
    const clean = new RealtimeQualityGuardian();
    observeSine(clean);
    expect(guardTransitionPlan(riskyPlan, clean.snapshot())).toEqual({
        plan: riskyPlan,
        rescued: false,
        fallbackReason: null,
    });

    const warning = new RealtimeQualityGuardian();
    observeSine(warning);
    warning.noteInsertedSilence(true);
    const reduced = guardTransitionPlan(riskyPlan, warning.snapshot());
    expect(reduced.rescued).toBe(true);
    expect(reduced.plan.type).toBe("blend");
    expect(reduced.plan.tempoRatio).toBe(1);

    warning.noteInsertedSilence(true);
    warning.noteInsertedSilence(true);
    const safe = guardTransitionPlan(riskyPlan, warning.snapshot());
    expect(safe.plan.type).toBe("fade");
    expect(safe.plan.eqSweep).toBe(false);
});
