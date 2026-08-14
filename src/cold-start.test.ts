import { beforeEach, describe, expect, test } from "bun:test";

import { coldStartStats, recordWarmGate, resetColdStartStats, timePlaybackGate } from "./cold-start";

const track = (id: string, source = "tidal") => ({ id, source });

beforeEach(() => resetColdStartStats());

describe("cold-start telemetry", () => {
    test("an empty history reports a zero ratio rather than NaN", () => {
        const s = coldStartStats();
        expect(s.total).toBe(0);
        expect(s.coldRatio).toBe(0);
        expect(s.p50WaitMs).toBe(0);
    });

    test("prefetched gates count as warm and keep the denominator honest", () => {
        recordWarmGate(track("a"), "start");
        recordWarmGate(track("b"), "advance");

        const s = coldStartStats();
        expect(s.total).toBe(2);
        expect(s.warm).toBe(2);
        expect(s.cold).toBe(0);
        expect(s.coldRatio).toBe(0);
    });

    test("a gate that had to wait is recorded as cold with its duration", async () => {
        await timePlaybackGate(track("slow"), "start", async () => {
            await Bun.sleep(80);
            return "/tmp/slow.flac";
        });

        const s = coldStartStats();
        expect(s.cold).toBe(1);
        expect(s.p50WaitMs).toBeGreaterThanOrEqual(70);
        expect(s.recent[0]?.prefetched).toBe(false);
    });

    test("a gate satisfied from the disk cache is not counted as cold", async () => {
        await timePlaybackGate(track("cached"), "advance", async () => "/tmp/cached.flac");

        const s = coldStartStats();
        expect(s.cold).toBe(0);
        expect(s.warm).toBe(1);
    });

    test("a failed download still counts — it blocked audio just the same", async () => {
        const attempt = timePlaybackGate(track("dead"), "start", async () => {
            await Bun.sleep(60);
            throw new Error("404");
        });
        await expect(attempt).rejects.toThrow("404");

        const s = coldStartStats();
        expect(s.total).toBe(1);
        expect(s.cold).toBe(1);
    });

    test("the ratio and per-gate split are what decide whether streaming is worth it", async () => {
        recordWarmGate(track("w1"), "advance");
        recordWarmGate(track("w2"), "advance");
        recordWarmGate(track("w3"), "advance");
        await timePlaybackGate(track("c1"), "start", () => Bun.sleep(60).then(() => "x"));

        const s = coldStartStats();
        expect(s.total).toBe(4);
        expect(s.coldRatio).toBeCloseTo(0.25, 5);
        expect(s.byGate.start).toEqual({ total: 1, cold: 1 });
        expect(s.byGate.advance).toEqual({ total: 3, cold: 0 });
    });

    test("history is bounded so a long session cannot grow it without limit", () => {
        for (let i = 0; i < 500; i++) recordWarmGate(track(`t${i}`), "advance");

        const s = coldStartStats();
        expect(s.total).toBe(200);
        // The ring keeps the NEWEST events — the oldest are the ones to drop.
        expect(s.recent.at(-1)?.trackId).toBe("t499");
    });
});
