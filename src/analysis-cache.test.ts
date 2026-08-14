import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AnalysisCache, analyzerFingerprint, fingerprintAnalyzerParameters, hashTrackFile } from "./analysis-cache";

test("parameter fingerprints are canonical and include analyzer/model versions", () => {
    expect(fingerprintAnalyzerParameters({ bpm: 120, nested: { a: 1, b: 2 } })).toBe(
        fingerprintAnalyzerParameters({ nested: { b: 2, a: 1 }, bpm: 120 }),
    );
    expect(analyzerFingerprint({ analyzerVersion: "beat-v1", parameters: { bpm: 120 } })).not.toBe(
        analyzerFingerprint({ analyzerVersion: "beat-v2", parameters: { bpm: 120 } }),
    );
    expect(analyzerFingerprint({ analyzerVersion: "stem-v1", modelVersion: "demucs-a" })).not.toBe(
        analyzerFingerprint({ analyzerVersion: "stem-v1", modelVersion: "demucs-b" }),
    );
});

test("track hashes are content-addressed rather than path-addressed", async () => {
    const directory = await mkdtemp(join(tmpdir(), "beatcord-track-hash-"));
    try {
        const left = join(directory, "left.audio");
        const right = join(directory, "right.audio");
        await writeFile(left, "same audio bytes");
        await writeFile(right, "same audio bytes");
        expect(await hashTrackFile(left)).toBe(await hashTrackFile(right));
        await writeFile(right, "changed audio bytes");
        expect(await hashTrackFile(left)).not.toBe(await hashTrackFile(right));
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test("component versions invalidate independently and atomic entries survive reload", async () => {
    const directory = await mkdtemp(join(tmpdir(), "beatcord-analysis-cache-"));
    try {
        const cache = new AnalysisCache({ directory, now: () => 123 });
        const hash = `sha256-${"a".repeat(64)}`;
        const beatV1 = { analyzerVersion: "beat-v1", modelVersion: "model-a", parameters: { durationMs: 100 } };
        const loudnessV1 = { analyzerVersion: "loudness-v1", parameters: { target: -14 } };
        await cache.set(hash, "track-a", "beatGrid", beatV1, { bpm: 120 });
        await cache.set(hash, "track-a", "loudness", loudnessV1, { input_i: "-12" });

        const reloaded = new AnalysisCache({ directory });
        const entry = await reloaded.load(hash);
        expect(reloaded.get<{ bpm: number }>(entry, "beatGrid", beatV1)?.bpm).toBe(120);
        expect(reloaded.get(entry, "beatGrid", { ...beatV1, analyzerVersion: "beat-v2" })).toBeUndefined();
        expect(reloaded.get(entry, "beatGrid", { ...beatV1, modelVersion: "model-b" })).toBeUndefined();
        expect(reloaded.get(entry, "beatGrid", { ...beatV1, parameters: { durationMs: 200 } })).toBeUndefined();
        expect(reloaded.get<{ input_i: string }>(entry, "loudness", loudnessV1)?.input_i).toBe("-12");
        expect(entry?.createdAt).toBe(123);
        expect(entry?.updatedAt).toBe(123);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test("malformed or incompatible cache files are ignored safely", async () => {
    const directory = await mkdtemp(join(tmpdir(), "beatcord-analysis-corrupt-"));
    try {
        const hash = `sha256-${"b".repeat(64)}`;
        await writeFile(join(directory, `${"b".repeat(64)}.json`), "{truncated");
        expect(await new AnalysisCache({ directory }).load(hash)).toBeNull();
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});
