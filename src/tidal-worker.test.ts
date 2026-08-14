// Exercises the persistent-helper transport (TS MetaWorker ↔ python `serve` loop)
// end-to-end using the auth-free `ping` command, so it runs without a TIDAL login
// or the `tiddl` package. Covers the wire framing, error propagation, worker
// survival after a bad command, id-correlated concurrency, and respawn-after-close.

import { afterEach, describe, expect, test } from "bun:test";

import { MetaWorker, tidalHelperPath, tidalPython } from "./tidal";

const workers: MetaWorker[] = [];
function make(): MetaWorker {
    const w = new MetaWorker(tidalPython, tidalHelperPath);
    workers.push(w);
    return w;
}

afterEach(() => {
    for (const w of workers.splice(0)) w.close();
});

describe("MetaWorker", () => {
    test("ping round-trips over the warm worker", async () => {
        const res = await make().send(["ping"]);
        expect(res.pong).toBe(true);
    });

    test("a bad command rejects but the worker keeps serving", async () => {
        const w = make();
        await expect(w.send(["bogus"])).rejects.toThrow(/unknown command/);
        // The same (still-alive) worker answers the next request.
        expect((await w.send(["ping"])).pong).toBe(true);
    });

    test("concurrent requests are correlated by id", async () => {
        const w = make();
        const results = await Promise.all([w.send(["ping"]), w.send(["ping"]), w.send(["ping"])]);
        expect(results.map((r) => r.pong)).toEqual([true, true, true]);
    });

    test("slow commands do not block the ones queued behind them", async () => {
        const w = make();
        await w.send(["ping"]); // pay the python cold start before timing anything
        const t0 = performance.now();
        // Four 300ms commands: serialized that is ~1.2s, overlapped it is ~300ms.
        await Promise.all(Array.from({ length: 4 }, () => w.send(["ping", "0.3"])));
        const elapsed = performance.now() - t0;
        expect(elapsed).toBeLessThan(900);
    });

    test("respawns after close", async () => {
        const w = make();
        expect((await w.send(["ping"])).pong).toBe(true);
        w.close();
        // send() after close transparently spawns a fresh worker.
        expect((await w.send(["ping"])).pong).toBe(true);
    });
});
