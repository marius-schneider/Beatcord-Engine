import { expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { TransitionTelemetrySink } from "./transition-telemetry-sink";

test("TransitionTelemetrySink appends one scored JSONL record", async () => {
    const dir = await mkdtemp(join(tmpdir(), "beatcord-telemetry-"));
    const file = join(dir, "transitions.jsonl");
    const sink = new TransitionTelemetrySink({ enabled: true, path: file });

    const record = await sink.record({
        atMs: 1_781_986_400_000,
        guildId: "guild-1",
        current: {
            id: "a",
            title: "A",
            uploader: null,
            bpm: 128,
            key: "8A",
            keyConfidence: 0.9,
            energy: 0.7,
            percussiveness: 0.6,
            danceability: 2.1,
            introSec: 0,
            musicalEndSec: 180,
        },
        next: {
            id: "b",
            title: "B",
            uploader: null,
            bpm: 129,
            key: "9A",
            keyConfidence: 0.9,
            energy: 0.74,
            percussiveness: 0.62,
            danceability: 2.2,
            introSec: 0,
            musicalEndSec: 178,
        },
        transitionType: "blend",
        planReason: "test blend",
        fadeSec: 8,
        eqSweep: true,
        tempoRatio: 128 / 129,
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
    });

    expect(record?.quality.grade).toBe("A");
    const lines = (await readFile(file, "utf8")).trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!).quality.score).toBeGreaterThan(90);
});
