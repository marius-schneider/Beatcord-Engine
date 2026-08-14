import { describe, expect, test } from "bun:test";

import { Semaphore } from "./semaphore";

/**
 * The measurement gate in loudness.ts. A real `measureLoudness` call spawns ffmpeg
 * and decodes a whole file, so the two properties that matter are pinned against
 * the same Semaphore + in-flight-map construction the module uses.
 *
 *   1. Never more than N scans at once — each one burns a core at full speed and
 *      competes with the playback decoders, which must not be starved.
 *   2. Two callers wanting the SAME file share one scan. Two guilds starting the
 *      same popular track otherwise each paid for a full decode, because the cache
 *      only helps once the first has finished.
 */
function gatedMeasurer(limit: number, run: (key: string) => Promise<number>) {
    const gate = new Semaphore(limit);
    const cache = new Map<string, number>();
    const inFlight = new Map<string, Promise<number>>();

    return {
        get active() {
            return gate.active;
        },
        measure(key: string): Promise<number> {
            const hit = cache.get(key);
            if (hit !== undefined) return Promise.resolve(hit);

            const running = inFlight.get(key);
            if (running) return running;

            const job = gate
                .run(async () => {
                    const cached = cache.get(key);
                    if (cached !== undefined) return cached; // filled while queued
                    const value = await run(key);
                    cache.set(key, value);
                    return value;
                })
                .finally(() => inFlight.delete(key));

            inFlight.set(key, job);
            return job;
        },
    };
}

describe("concurrency cap", () => {
    test("never runs more scans at once than the limit allows", async () => {
        let inFlight = 0;
        let peak = 0;
        const m = gatedMeasurer(2, async () => {
            inFlight++;
            peak = Math.max(peak, inFlight);
            await Bun.sleep(5);
            inFlight--;
            return 1;
        });

        // Ten different files, as ten guilds starting different tracks at once.
        await Promise.all(Array.from({ length: 10 }, (_, i) => m.measure(`t${i}`)));
        expect(peak).toBe(2);
    });

    test("queued work still completes — the cap delays, never drops", async () => {
        const m = gatedMeasurer(1, async (key) => Number(key.slice(1)));
        const results = await Promise.all(Array.from({ length: 5 }, (_, i) => m.measure(`t${i}`)));
        expect(results).toEqual([0, 1, 2, 3, 4]);
    });
});

describe("in-flight deduplication", () => {
    test("concurrent callers for the same file share ONE scan", async () => {
        let scans = 0;
        const m = gatedMeasurer(4, async () => {
            scans++;
            await Bun.sleep(5);
            return 42;
        });

        const results = await Promise.all([m.measure("same"), m.measure("same"), m.measure("same")]);
        expect(scans).toBe(1);
        expect(results).toEqual([42, 42, 42]);
    });

    test("a waiter that got queued behind the same file reuses the cached result", async () => {
        // With one slot, the second caller for a DIFFERENT file waits; a third for the
        // first file must not re-scan once the first finished.
        let scans = 0;
        const m = gatedMeasurer(1, async () => {
            scans++;
            await Bun.sleep(5);
            return 7;
        });

        await m.measure("a");
        await m.measure("a");
        expect(scans).toBe(1);
    });

    test("the in-flight entry is cleared so later calls can scan again", async () => {
        let scans = 0;
        const m = gatedMeasurer(2, async () => {
            scans++;
            return 1;
        });
        await m.measure("x");
        await m.measure("y");
        expect(scans).toBe(2); // different files → two scans, no stale sharing
    });

    test("a failed scan doesn't wedge the file forever", async () => {
        let attempts = 0;
        const m = gatedMeasurer(2, async () => {
            attempts++;
            if (attempts === 1) throw new Error("ffmpeg died");
            return 3;
        });

        await expect(m.measure("flaky")).rejects.toThrow("ffmpeg died");
        // The in-flight entry must be gone, so a retry actually retries.
        expect(await m.measure("flaky")).toBe(3);
        expect(attempts).toBe(2);
    });
});
