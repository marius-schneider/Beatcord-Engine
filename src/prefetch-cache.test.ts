import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AnalysisCache } from "./analysis-cache";
import type { BeatGrid } from "./beatgrid";
import { ComputeBudgetScheduler } from "./compute-budget";
import { TrackPrep, type TrackPrepAnalyzers } from "./prefetch";
import type { TrackInfo } from "./ytdlp";

const grid: BeatGrid = {
    bpm: 120,
    beats: [0, 0.5, 1, 1.5],
    beatInterval: 0.5,
    analysisOffset: 0,
    musicalEndSec: 59,
    key: { name: "A minor", camelot: "8A", confidence: 0.9 },
    energy: { energy: 0.7, percussiveness: 0.65, danceability: 2.1 },
    spectral: { centroid: 3_000, rolloff: 6_500, flatness: 0.1, flux: 0.3 },
    downbeatPhase: 0,
    introSec: 8,
};

const track: TrackInfo = {
    id: "cache-track",
    title: "Cache Track",
    url: "https://example.test/cache-track",
    durationMs: 60_000,
    uploader: "Tester",
    thumbnail: null,
};

function analyzers(
    filePath: string,
    calls: { loudness: number; beatGrid: number; structure: number },
): Partial<TrackPrepAnalyzers> {
    return {
        download: async () => filePath,
        loudness: async () => {
            calls.loudness++;
            return {
                input_i: "-12",
                input_tp: "-1",
                input_lra: "8",
                input_thresh: "-22",
                target_offset: "0",
            };
        },
        beatGrid: async () => {
            calls.beatGrid++;
            return grid;
        },
        structure: async () => {
            calls.structure++;
            return {
                groove: { kind: "straight", swing: 0.5 },
                sections: [
                    { startSec: 0, endSec: 8, kind: "intro", level: 0.3 },
                    { startSec: 8, endSec: 59, kind: "body", level: 0.7 },
                    { startSec: 59, endSec: 60, kind: "outro", level: 0.2 },
                ],
                health: { truePeakDb: -1, dcOffsetDb: -80, clipPct: 0 },
            };
        },
    };
}

test("TrackPrep reuses all current components and selectively invalidates beat-dependent analysis", async () => {
    const directory = await mkdtemp(join(tmpdir(), "beatcord-prep-cache-"));
    try {
        const audio = join(directory, "track.opus");
        await writeFile(audio, "deterministic fake audio payload");
        const cache = new AnalysisCache({ directory: join(directory, "analysis") });

        const firstCalls = { loudness: 0, beatGrid: 0, structure: 0 };
        const first = new TrackPrep({ analysisCache: cache, analyzers: analyzers(audio, firstCalls) });
        const firstRecord = await first.ensureAnalyzed(track);
        expect(firstCalls).toEqual({ loudness: 1, beatGrid: 1, structure: 1 });
        expect(firstRecord.cache?.hits).toEqual([]);
        expect(firstRecord.cache?.misses).toEqual(["loudness", "beatGrid", "genre", "structure", "trackProfile"]);

        const secondCalls = { loudness: 0, beatGrid: 0, structure: 0 };
        const second = new TrackPrep({ analysisCache: cache, analyzers: analyzers(audio, secondCalls) });
        const secondRecord = await second.ensureAnalyzed(track);
        expect(secondCalls).toEqual({ loudness: 0, beatGrid: 0, structure: 0 });
        expect(secondRecord.cache?.hits).toEqual(["loudness", "beatGrid", "genre", "structure", "trackProfile"]);

        const upgradedCalls = { loudness: 0, beatGrid: 0, structure: 0 };
        const upgraded = new TrackPrep({
            analysisCache: cache,
            analyzers: analyzers(audio, upgradedCalls),
            analyzerVersions: { beatGrid: "beat-grid-v3" },
        });
        const upgradedRecord = await upgraded.ensureAnalyzed(track);
        expect(upgradedCalls).toEqual({ loudness: 0, beatGrid: 1, structure: 1 });
        expect(upgradedRecord.cache?.hits).toEqual(["loudness"]);
        expect(upgradedRecord.cache?.misses).toEqual(["beatGrid", "genre", "structure", "trackProfile"]);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test("tier 0 background prefetch keeps loudness but defers beat and phrase analysis", async () => {
    const directory = await mkdtemp(join(tmpdir(), "beatcord-prep-tier0-"));
    try {
        const audio = join(directory, "track.opus");
        await writeFile(audio, "tier zero fake audio payload");
        const calls = { loudness: 0, beatGrid: 0, structure: 0 };
        const scheduler = new ComputeBudgetScheduler({
            realtimeCpu: 0.5,
            backgroundCpu: 0.5,
            gpuAvailable: false,
            memoryBudgetMb: 1_024,
            batteryMode: true,
            tierOverride: 0,
        });
        const prep = new TrackPrep({
            analysisCache: new AnalysisCache({ directory: join(directory, "analysis") }),
            analyzers: analyzers(audio, calls),
            computeScheduler: scheduler,
        });
        const record = await prep.ensureAnalyzed(track, "background");

        expect(calls).toEqual({ loudness: 1, beatGrid: 0, structure: 0 });
        expect(record.grid).toBeNull();
        expect(record.compute).toMatchObject({ tier: 0, priority: "background" });
        expect(record.compute?.deferred).toEqual(["beat-grid: compute tier 0", "structure: compute tier 0"]);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test("TrackPrep exposes deadline-ready progress while streaming preparation runs", async () => {
    const directory = await mkdtemp(join(tmpdir(), "beatcord-prep-readiness-"));
    try {
        const audio = join(directory, "track.opus");
        await writeFile(audio, "readiness fake audio payload");
        let now = 10_000;
        let releaseDownload!: () => void;
        const downloadGate = new Promise<void>((resolve) => {
            releaseDownload = resolve;
        });
        const calls = { loudness: 0, beatGrid: 0, structure: 0 };
        const prep = new TrackPrep({
            analysisCache: new AnalysisCache({ directory: join(directory, "analysis") }),
            analyzers: {
                ...analyzers(audio, calls),
                download: async () => {
                    await downloadGate;
                    return audio;
                },
            },
            computeScheduler: new ComputeBudgetScheduler({
                realtimeCpu: 1,
                backgroundCpu: 2,
                gpuAvailable: false,
                memoryBudgetMb: 4_096,
                batteryMode: false,
                tierOverride: 2,
            }),
            now: () => now,
        });
        const pending = prep.ensureAnalyzed(track);
        now += 7_500;
        const running = prep.preparationReadiness(track.id, now);
        expect(running.buffer).toMatchObject({ status: "running", progress: 0.5, estimatedRemainingMs: 7_500 });
        expect(running.analysis.status).toBe("running");

        releaseDownload();
        now += 500;
        await pending;
        const complete = prep.preparationReadiness(track.id, now);
        expect(complete.buffer.status).toBe("ready");
        expect(complete.analysis.status).toBe("ready");
        expect(complete.stems.status).toBe("not-started");
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});
