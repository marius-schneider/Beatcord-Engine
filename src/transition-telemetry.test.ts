import { expect, test } from "bun:test";

import {
    buildTransitionTelemetryRecord,
    scoreTransitionTelemetry,
    type TransitionTelemetryInput,
} from "./transition-telemetry";

function base(overrides: Partial<TransitionTelemetryInput> = {}): TransitionTelemetryInput {
    return {
        atMs: 1_781_986_400_000,
        guildId: "guild-1",
        current: {
            id: "a",
            title: "Track A",
            uploader: "Artist A",
            bpm: 128,
            key: "8A",
            keyConfidence: 0.9,
            energy: 0.7,
            percussiveness: 0.6,
            danceability: 2.2,
            introSec: 0,
            musicalEndSec: 180,
        },
        next: {
            id: "b",
            title: "Track B",
            uploader: "Artist B",
            bpm: 129,
            key: "9A",
            keyConfidence: 0.9,
            energy: 0.76,
            percussiveness: 0.64,
            danceability: 2.4,
            introSec: 0,
            musicalEndSec: 182,
        },
        transitionType: "blend",
        planReason: "beatmatched blend",
        fadeSec: 8,
        eqSweep: true,
        tempoRatio: 128 / 129,
        outgoingTempoRatio: 1,
        scheduledTrackSec: 172,
        scheduledPlaySec: 172,
        actualFirePlaySec: 172.018,
        preRollSec: 0.05,
        execution: {
            mode: "offline-cache",
            fallbackReason: null,
            cacheHit: true,
            renderMs: null,
            renderDeadlineMs: null,
            segmentSec: 12.35,
        },
        ...overrides,
    };
}

test("offline cache hit with tight timing scores as a strong transition", () => {
    const score = scoreTransitionTelemetry(base());
    expect(score.score).toBeGreaterThanOrEqual(90);
    expect(score.grade).toBe("A");
    expect(score.notes).toHaveLength(0);
});

test("buildTransitionTelemetryRecord derives timing, key, tempo and energy metrics", () => {
    const record = buildTransitionTelemetryRecord(base());
    expect(record.schemaVersion).toBe(1);
    expect(record.timingErrorMs).toBeCloseTo(18, 1);
    expect(record.tempoGapPct).toBeLessThan(1);
    expect(record.keyScore).toBeGreaterThanOrEqual(0.5);
    expect(record.energyDelta).toBeGreaterThan(0);
    expect(record.quality.dimensions.execution).toBe(100);
});

test("hard cuts tolerate wide tempo gaps better than long blends", () => {
    const hard = scoreTransitionTelemetry(
        base({
            transitionType: "cut",
            tempoRatio: 1,
            next: { ...base().next, bpm: 95, key: "2B" },
            execution: {
                mode: "live",
                fallbackReason: null,
                cacheHit: null,
                renderMs: null,
                renderDeadlineMs: null,
                segmentSec: null,
            },
        }),
    );
    const blend = scoreTransitionTelemetry(
        base({
            transitionType: "blend",
            tempoRatio: 1,
            next: { ...base().next, bpm: 95, key: "2B" },
            execution: {
                mode: "live",
                fallbackReason: null,
                cacheHit: null,
                renderMs: null,
                renderDeadlineMs: null,
                segmentSec: null,
            },
        }),
    );
    expect(hard.score).toBeGreaterThan(blend.score);
});

test("late fallback is penalised and explains why", () => {
    const record = buildTransitionTelemetryRecord(
        base({
            actualFirePlaySec: 172.42,
            execution: {
                mode: "fallback",
                fallbackReason: "render-timeout",
                cacheHit: false,
                renderMs: null,
                renderDeadlineMs: 300,
                segmentSec: null,
            },
        }),
    );
    expect(record.quality.score).toBeLessThan(80);
    expect(record.quality.notes.join(" ")).toContain("render-timeout");
    expect(record.quality.notes.join(" ")).toContain("late/early");
});

test("early skip feedback lowers the transition score and is explained", () => {
    const clean = buildTransitionTelemetryRecord(base());
    const skipped = buildTransitionTelemetryRecord(
        base({
            atMs: 1_781_986_430_000,
            userFeedback: {
                kind: "early-skip",
                atMs: 1_781_986_440_000,
                afterTransitionMs: 10_000,
                skippedTrackId: "b",
                skippedPositionMs: 12_000,
                skippedPositionRatio: 0.06,
                weight: 0.9,
                source: "skip",
                attribution: {
                    trackPreference: 0.1,
                    transitionPreference: 0.7,
                    sessionMismatch: 0.15,
                    repetitionFatigue: 0.05,
                    confidence: 0.82,
                    dominant: "transition",
                    learnTrack: false,
                    learnTransition: true,
                },
            },
        }),
    );
    expect(skipped.quality.score).toBeLessThan(clean.quality.score);
    expect(skipped.quality.dimensions.feedback).toBeLessThan(20);
    expect(skipped.quality.notes.join(" ")).toContain("early skip");
    expect(skipped.quality.notes.join(" ")).toContain("attributed to transition");
});
