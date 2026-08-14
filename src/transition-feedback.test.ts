import { expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TransitionFeedbackStore } from "./transition-feedback";
import { buildTransitionTelemetryRecord, type TransitionTelemetryInput } from "./transition-telemetry";

function input(atMs: number): TransitionTelemetryInput {
    return {
        atMs,
        guildId: "guild-1",
        current: {
            id: "a",
            title: "A",
            uploader: null,
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
            uploader: null,
            bpm: 128,
            key: "8A",
            keyConfidence: 0.9,
            energy: 0.8,
            percussiveness: 0.7,
            danceability: 2.4,
            introSec: 0,
            musicalEndSec: 180,
        },
        transitionType: "blend",
        planReason: "blend",
        fadeSec: 8,
        eqSweep: true,
        tempoRatio: 1,
        outgoingTempoRatio: 1,
        scheduledTrackSec: 172,
        scheduledPlaySec: 172,
        actualFirePlaySec: 172.01,
        preRollSec: 0.05,
        execution: {
            mode: "offline-cache",
            fallbackReason: null,
            cacheHit: true,
            renderMs: null,
            renderDeadlineMs: null,
            segmentSec: 12,
        },
    };
}

test("TransitionFeedbackStore builds a cached feedback profile from telemetry JSONL", async () => {
    const dir = await mkdtemp(join(tmpdir(), "beatcord-feedback-"));
    const path = join(dir, "transitions.jsonl");
    await writeFile(
        path,
        `${JSON.stringify(buildTransitionTelemetryRecord(input(1)))}\n${JSON.stringify(buildTransitionTelemetryRecord(input(2)))}\n`,
    );
    const store = new TransitionFeedbackStore({ enabled: true, path, minRecords: 2, refreshMs: 60_000 });
    const profile = await store.profile();
    expect(profile?.totalRecords).toBe(2);
    expect(profile?.byType["type:blend"]?.bias).toBeGreaterThan(0);
    expect(await store.profile()).toBe(profile);
});
