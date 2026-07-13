import { expect, test } from "bun:test";

import type { BeatGrid } from "./beatgrid";
import { scoreStemQuality } from "./stem-quality";
import {
    buildTransitionCandidates,
    buildTransitionFeedbackProfile,
    planTransitionWithFeedback,
} from "./transition-candidates";
import { planTransition, type TrackTraits, type TransitionType } from "./transition-planner";
import { buildTransitionTelemetryRecord, type TransitionTelemetryInput } from "./transition-telemetry";
import { buildVocalActivityProfile } from "./vocal-activity";

function grid(bpm: number, camelot: string, percussiveness = 0.7): BeatGrid {
    return {
        bpm,
        beats: [0, 60 / bpm],
        beatInterval: 60 / bpm,
        analysisOffset: 0,
        musicalEndSec: 180,
        key: { name: camelot, camelot, confidence: 0.9 },
        energy: { energy: 0.8, percussiveness, danceability: 2.4 },
        spectral: { centroid: 3600, rolloff: 7600, flatness: 0.12, flux: 0.4 },
        downbeatPhase: 0,
        introSec: 0,
    };
}

function track(title: string, g: BeatGrid): TrackTraits {
    return { title, uploader: "Artist", grid: g, durationMs: 200_000 };
}

function vocalActivity(activeFromSec: number, activeToSec: number) {
    const sr = 1000;
    const samples = new Float32Array(sr * 20);
    for (let i = 0; i < samples.length; i++) {
        const sec = i / sr;
        samples[i] = sec >= activeFromSec && sec < activeToSec ? 0.07 : 0.001;
    }
    return buildVocalActivityProfile(samples, sr, { segmentSec: 4, windowMs: 80 });
}

function telemetry(type: TransitionType, score: "good" | "bad", atMs: number): TransitionTelemetryInput {
    const bad = score === "bad";
    return {
        atMs,
        guildId: "guild-1",
        current: {
            id: "a",
            title: "A",
            uploader: "Artist",
            bpm: 128,
            key: "8A",
            keyConfidence: 0.9,
            energy: 0.8,
            percussiveness: 0.7,
            danceability: 2.4,
            introSec: 0,
            musicalEndSec: 180,
        },
        next: {
            id: "b",
            title: "B",
            uploader: "Artist",
            bpm: 128,
            key: bad ? "2B" : "8A",
            keyConfidence: 0.9,
            energy: 0.8,
            percussiveness: 0.7,
            danceability: 2.4,
            introSec: 0,
            musicalEndSec: 180,
        },
        transitionType: type,
        planReason: type,
        fadeSec: 8,
        eqSweep: type === "blend" || type === "bassdrop",
        tempoRatio: 1,
        outgoingTempoRatio: 1,
        scheduledTrackSec: 172,
        scheduledPlaySec: 172,
        actualFirePlaySec: bad ? 172.45 : 172.01,
        preRollSec: 0.05,
        execution: bad
            ? {
                  mode: "fallback",
                  fallbackReason: "render-timeout",
                  cacheHit: false,
                  renderMs: null,
                  renderDeadlineMs: 300,
                  segmentSec: null,
              }
            : {
                  mode: "offline-cache",
                  fallbackReason: null,
                  cacheHit: true,
                  renderMs: null,
                  renderDeadlineMs: null,
                  segmentSec: 12,
              },
    };
}

test("planTransitionWithFeedback is neutral without telemetry", () => {
    const cur = track("House A", grid(128, "8A"));
    const next = track("House B", grid(128, "8A"));
    expect(planTransitionWithFeedback(cur, next, 6)).toEqual(planTransition(cur, next, 6));
});

test("buildTransitionFeedbackProfile converts scored telemetry into type bias", () => {
    const records = [
        buildTransitionTelemetryRecord(telemetry("blend", "good", 1)),
        buildTransitionTelemetryRecord(telemetry("blend", "good", 2)),
        buildTransitionTelemetryRecord(telemetry("bassdrop", "bad", 3)),
        buildTransitionTelemetryRecord(telemetry("bassdrop", "bad", 4)),
    ];
    const profile = buildTransitionFeedbackProfile(records, { minRecords: 2 });
    expect(profile.byType["type:blend"]?.bias).toBeGreaterThan(0);
    expect(profile.byType["type:bassdrop"]?.bias).toBeLessThan(0);
});

test("buildTransitionFeedbackProfile treats early skips as negative listener feedback", () => {
    const records = [
        buildTransitionTelemetryRecord(telemetry("blend", "good", 1)),
        buildTransitionTelemetryRecord({
            ...telemetry("blend", "good", 2),
            userFeedback: {
                kind: "early-skip",
                atMs: 20_000,
                afterTransitionMs: 8_000,
                skippedTrackId: "b",
                skippedPositionMs: 10_000,
                skippedPositionRatio: 0.05,
                weight: 1,
                source: "skip",
            },
        }),
    ];
    const profile = buildTransitionFeedbackProfile(records, { minRecords: 2 });
    const bucket = profile.byType["type:blend"];
    expect(bucket?.negativeFeedbackRate).toBe(0.5);
    expect(bucket?.bias).toBeLessThan(0);
});

test("clear feedback can choose a safer candidate over the deterministic spice move", () => {
    // 128 + 128 => spice 1 in the legacy planner, so high-energy in-key tracks pick bassdrop.
    const cur = track("House A", grid(128, "8A"));
    const next = track("House B", grid(128, "8A"));
    expect(planTransition(cur, next, 6).type).toBe("bassdrop");

    const records = [
        buildTransitionTelemetryRecord(telemetry("blend", "good", 1)),
        buildTransitionTelemetryRecord(telemetry("blend", "good", 2)),
        buildTransitionTelemetryRecord(telemetry("blend", "good", 3)),
        buildTransitionTelemetryRecord(telemetry("bassdrop", "bad", 4)),
        buildTransitionTelemetryRecord(telemetry("bassdrop", "bad", 5)),
        buildTransitionTelemetryRecord(telemetry("bassdrop", "bad", 6)),
    ];
    const feedback = buildTransitionFeedbackProfile(records, { minRecords: 2 });
    const plan = planTransitionWithFeedback(cur, next, 6, {
        maxFadeSec: 12,
        tempoTolerance: 0.08,
        feedback,
        switchMargin: 1,
    });
    expect(plan.type).toBe("blend");
    expect(plan.reason).toContain("telemetry preferred");
});

test("buildTransitionCandidates exposes scored alternatives for debugging", () => {
    const cur = track("House A", grid(128, "8A"));
    const next = track("House B", grid(128, "8A"));
    const candidates = buildTransitionCandidates(cur, next, 6);
    expect(candidates.map((c) => c.plan.type)).toContain("blend");
    expect(candidates.map((c) => c.plan.type)).toContain("bassdrop");
});

test("buildTransitionCandidates only exposes acapella when stem quality is usable", () => {
    const cur = track("House A", grid(128, "8A"));
    const next = track("House B", grid(128, "8A"));
    cur.stemQuality = scoreStemQuality({
        vocalRms: 0.001,
        instrumentalRms: 0.04,
        vocalDensity: 0.03,
        vocalDynamicRange: 1.2,
        vocalToInstrumentalDb: -32,
    });
    expect(
        buildTransitionCandidates(cur, next, 6, {
            maxFadeSec: 12,
            tempoTolerance: 0.08,
            stemsReady: true,
        }).map((c) => c.plan.type),
    ).not.toContain("acapella");

    cur.stemQuality = scoreStemQuality({
        vocalRms: 0.035,
        instrumentalRms: 0.07,
        vocalDensity: 0.35,
        vocalDynamicRange: 3,
        vocalToInstrumentalDb: -6,
    });
    const acapella = buildTransitionCandidates(cur, next, 6, {
        maxFadeSec: 12,
        tempoTolerance: 0.08,
        stemsReady: true,
    }).find((c) => c.plan.type === "acapella");
    expect(acapella).toBeTruthy();
    expect(acapella?.reasons.join(" ")).toContain("stem");
    expect(acapella?.reasons.join(" ")).toContain("vocal lane");
});

test("buildTransitionCandidates removes acapella when the incoming vocal lane is crowded", () => {
    const cur = track("House A", grid(128, "8A"));
    const next = track("House B", grid(128, "8A"));
    cur.stemQuality = scoreStemQuality({
        vocalRms: 0.035,
        instrumentalRms: 0.07,
        vocalDensity: 0.35,
        vocalDynamicRange: 3,
        vocalToInstrumentalDb: -6,
    });
    next.stemQuality = scoreStemQuality({
        vocalRms: 0.09,
        instrumentalRms: 0.08,
        vocalDensity: 0.8,
        vocalDynamicRange: 3,
        vocalToInstrumentalDb: 1,
    });

    expect(
        buildTransitionCandidates(cur, next, 6, {
            maxFadeSec: 12,
            tempoTolerance: 0.08,
            stemsReady: true,
        }).map((c) => c.plan.type),
    ).not.toContain("acapella");
});

test("buildTransitionCandidates allows acapella when the incoming entry window is clear", () => {
    const cur = track("House A", grid(128, "8A"));
    const next = track("House B", grid(128, "8A"));
    cur.stemQuality = scoreStemQuality({
        vocalRms: 0.035,
        instrumentalRms: 0.07,
        vocalDensity: 0.35,
        vocalDynamicRange: 3,
        vocalToInstrumentalDb: -6,
    });
    next.stemQuality = scoreStemQuality({
        vocalRms: 0.09,
        instrumentalRms: 0.08,
        vocalDensity: 0.8,
        vocalDynamicRange: 3,
        vocalToInstrumentalDb: 1,
    });
    next.vocalActivity = vocalActivity(12, 20);

    const acapella = buildTransitionCandidates(cur, next, 6, {
        maxFadeSec: 12,
        tempoTolerance: 0.08,
        stemsReady: true,
    }).find((c) => c.plan.type === "acapella");
    expect(acapella).toBeTruthy();
    expect(acapella?.reasons.join(" ")).toContain("vocal lane");
});
