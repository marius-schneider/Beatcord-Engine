import { expect, test } from "bun:test";

import {
    analyzeTransitionTelemetry,
    formatTransitionTelemetryAnalysis,
    parseTransitionTelemetryJsonl,
} from "./transition-analyzer";
import { buildTransitionTelemetryRecord, type TransitionTelemetryInput } from "./transition-telemetry";

function input(extra: Partial<TransitionTelemetryInput> = {}): TransitionTelemetryInput {
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
            segmentSec: 12,
        },
        ...extra,
    };
}

test("parseTransitionTelemetryJsonl keeps valid v1 records and reports bad lines", () => {
    const good = buildTransitionTelemetryRecord(input());
    const parsed = parseTransitionTelemetryJsonl(`${JSON.stringify(good)}\nnot-json\n{"schemaVersion":1}\n`);
    expect(parsed.records).toHaveLength(1);
    expect(parsed.skipped).toBe(2);
    expect(parsed.errors[0]).toContain("line 2");
});

test("analyzeTransitionTelemetry aggregates quality, modes and fallback reasons", () => {
    const records = [
        buildTransitionTelemetryRecord(input()),
        buildTransitionTelemetryRecord(input({ atMs: 1_781_986_401_000, transitionType: "bassdrop" })),
        buildTransitionTelemetryRecord(
            input({
                atMs: 1_781_986_402_000,
                transitionType: "blend",
                tempoRatio: 1,
                next: { ...input().next, bpm: 95, key: "2B" },
                actualFirePlaySec: 172.24,
                execution: {
                    mode: "live",
                    fallbackReason: null,
                    cacheHit: null,
                    renderMs: null,
                    renderDeadlineMs: null,
                    segmentSec: null,
                },
            }),
        ),
        buildTransitionTelemetryRecord(
            input({
                atMs: 1_781_986_403_000,
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
        ),
    ];
    const analysis = analyzeTransitionTelemetry(
        records,
        { skipped: 1, errors: ["line 5: bad"] },
        { minPatternRecords: 1 },
    );
    expect(analysis.totalRecords).toBe(4);
    expect(analysis.skippedRecords).toBe(1);
    expect(analysis.byType.find((b) => b.key === "type:blend")?.count).toBe(3);
    expect(analysis.byMode.find((b) => b.key === "mode:fallback")?.count).toBe(1);
    expect(analysis.fallbackReasons[0]?.label).toBe("render-timeout");
    expect(analysis.worstPatterns.length).toBeGreaterThan(0);
});

test("analyzeTransitionTelemetry reports early-skip feedback rate", () => {
    const analysis = analyzeTransitionTelemetry([
        buildTransitionTelemetryRecord(input()),
        buildTransitionTelemetryRecord({
            ...input({ atMs: 1_781_986_401_000 }),
            userFeedback: {
                kind: "early-skip",
                atMs: 1_781_986_411_000,
                afterTransitionMs: 10_000,
                skippedTrackId: "b",
                skippedPositionMs: 9_000,
                skippedPositionRatio: 0.05,
                weight: 1,
                source: "skip",
            },
        }),
    ]);
    expect(analysis.overall.negativeFeedbackRate).toBe(0.5);
    expect(formatTransitionTelemetryAnalysis(analysis)).toContain("early skip: 50%");
});

test("formatTransitionTelemetryAnalysis renders a compact operator report", () => {
    const record = buildTransitionTelemetryRecord(input());
    const text = formatTransitionTelemetryAnalysis(analyzeTransitionTelemetry([record]));
    expect(text).toContain("Beatcord Transition Telemetry Report");
    expect(text).toContain("By Transition Type");
    expect(text).toContain("Recommendations");
});
