import { describe, expect, test } from "bun:test";

import { PlayHistory } from "./play-history";

describe("PlayHistory", () => {
    test("starts empty and has nothing to go back to", () => {
        const h = new PlayHistory<string>();
        expect(h.size).toBe(0);
        expect(h.canGoBack).toBe(false);
        expect(h.last).toBeUndefined();
    });

    test("back() on an empty stack reports false and never calls play", async () => {
        const h = new PlayHistory<string>();
        let called = false;
        expect(
            await h.back(() => {
                called = true;
            }),
        ).toBe(false);
        expect(called).toBe(false);
    });

    test("keeps only the newest `max` entries", () => {
        const h = new PlayHistory<number>(3);
        for (const n of [1, 2, 3, 4, 5]) h.push(n);
        expect(h.items).toEqual([3, 4, 5]);
    });

    test("a captured items reference keeps tracking the history across clear()", () => {
        // Consumers (the autoplay dedup) hold on to `items`. Replacing the array on
        // clear would leave them reading a detached snapshot forever.
        const h = new PlayHistory<string>();
        const captured = h.items;
        h.push("A");
        expect(captured).toEqual(["A"]);
        h.clear();
        expect(captured).toEqual([]);
        h.push("B");
        expect(captured).toEqual(["B"]);
    });
});

describe("walking back", () => {
    // The bug this class exists to prevent: a track change caused by going back
    // used to re-push the track being left, so Previous ping-ponged between two
    // tracks instead of walking the stack.
    test("repeated back() walks the whole stack instead of ping-ponging", async () => {
        const h = new PlayHistory<string>();
        for (const t of ["A", "B", "C"]) h.push(t);
        let current = "D";

        // Exactly what the player does: the track change fires push(current).
        const goBack = () =>
            h.back((prev) => {
                h.push(current); // suppressed — this is backward motion
                current = prev;
            });

        expect(await goBack()).toBe(true);
        expect(current).toBe("C");
        expect(await goBack()).toBe(true);
        expect(current).toBe("B");
        expect(await goBack()).toBe(true);
        expect(current).toBe("A");
        expect(await goBack()).toBe(false); // stack exhausted
        expect(current).toBe("A");
    });

    test("pushes resume normally after back() settles", async () => {
        const h = new PlayHistory<string>();
        h.push("A");
        await h.back(() => {});
        expect(h.size).toBe(0);
        h.push("B"); // forward motion again
        expect(h.items).toEqual(["B"]);
    });

    test("suppression also covers an async playback change", async () => {
        const h = new PlayHistory<string>();
        h.push("A");
        await h.back(async () => {
            await Promise.resolve();
            h.push("ignored");
        });
        expect(h.size).toBe(0);
    });

    test("a failed rewind keeps the entry reachable", async () => {
        const h = new PlayHistory<string>();
        h.push("A");
        await expect(
            h.back(() => {
                throw new Error("could not play");
            }),
        ).rejects.toThrow("could not play");
        // The track is still there to retry, and pushes work again.
        expect(h.items).toEqual(["A"]);
        h.push("B");
        expect(h.items).toEqual(["A", "B"]);
    });
});
