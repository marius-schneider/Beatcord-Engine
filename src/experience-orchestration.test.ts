import { describe, expect, test } from "bun:test";
import {
    applyExperienceHysteresis,
    ExperienceEventBus,
    evaluatePairwiseMixes,
    lightingCueForSection,
    planStinger,
    resolveFeature,
    SessionClock,
    scheduleExternalEvent,
} from "./experience-orchestration";

describe("experience orchestration", () => {
    test("keeps analyzer provenance and applies only trusted matching overrides", () => {
        const original = { value: 128, confidence: 0.9, source: "model" as const, version: "beat-v1" };
        const resolved = resolveFeature(
            original,
            [
                {
                    value: 127.98,
                    confidence: 0.95,
                    source: "community",
                    fingerprint: "right",
                    contributorCount: 8,
                    trust: 0.9,
                },
                {
                    value: 90,
                    confidence: 1,
                    source: "community",
                    fingerprint: "wrong",
                    contributorCount: 100,
                    trust: 1,
                },
            ],
            "right",
        );
        expect(resolved.effective.value).toBe(127.98);
        expect(resolved.original).toBe(original);
        expect(resolved.rejected).toHaveLength(1);
    });

    test("separates pairwise preference from quality dimensions", () => {
        const report = evaluatePairwiseMixes([
            { audioArtifacts: 5, musicalTiming: 4, energyFlow: 4, naturalness: 5, overallPreference: "A" },
            { audioArtifacts: 4, musicalTiming: 4, energyFlow: 3, naturalness: 4, overallPreference: "A" },
            { audioArtifacts: 5, musicalTiming: 5, energyFlow: 5, naturalness: 5, overallPreference: "B" },
        ]);
        expect(report.winner).toBe("A");
        expect(report.mean.audioArtifacts).toBeCloseTo(4.667, 2);
    });

    test("holds an experience until dwell and switch margin are satisfied", () => {
        const state = {
            current: "chill" as const,
            enteredAtMs: 0,
            smoothedScores: { chill: 0.72, love: 0.1, energy: 0.16, party: 0.02 },
        };
        const detected = { chill: 0.1, love: 0.05, energy: 0.84, party: 0.01 };
        expect(applyExperienceHysteresis(state, detected, 60_000, { smoothing: 1 }).switched).toBe(false);
        expect(applyExperienceHysteresis(state, detected, 700_000, { smoothing: 1 }).state.current).toBe("energy");
    });

    test("shares a quantized timeline with lighting and external systems", () => {
        const clock = new SessionClock(1_000);
        const snapshot = clock.snapshot(11_000, 120, 2, 0.08);
        expect(snapshot).toMatchObject({ sessionTimeSec: 10, musicalBeat: 20, trackTimeSec: 8, outputTimeSec: 10.08 });
        const stinger = planStinger("peak", snapshot);
        expect(stinger.event.beat).toBe(32);
        expect(scheduleExternalEvent(stinger.event, snapshot, 1).dispatchAtSessionTime).toBe(15);
        expect(lightingCueForSection("drop", 0.92)).toEqual({ scene: "impact", intensity: 0.92, transitionBeats: 0 });
        const events: string[] = [];
        const bus = new ExperienceEventBus();
        bus.subscribe("*", (event) => events.push(event.id));
        bus.publish(stinger.event);
        expect(events).toEqual([stinger.event.id]);
    });
});
