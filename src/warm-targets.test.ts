import { describe, expect, test } from "bun:test";

import { type WarmCandidate, warmTargets } from "./prefetch";
import type { TrackInfo } from "./ytdlp";

const track = (id: string, extra: Partial<TrackInfo> = {}): TrackInfo => ({
    id,
    title: `Track ${id}`,
    url: `https://tidal.com/track/${id}`,
    durationMs: 200_000,
    uploader: "Someone",
    thumbnail: null,
    ...extra,
});

const entry = (id: string, extra: Partial<WarmCandidate> = {}): WarmCandidate => ({
    track: track(id),
    ...extra,
});

describe("warmTargets", () => {
    test("takes only the head, so a big playlist add is not a big download burst", () => {
        const queue = Array.from({ length: 50 }, (_, i) => entry(`t${i}`));

        expect(warmTargets(queue, 3).map((t) => t.id)).toEqual(["t0", "t1", "t2"]);
    });

    test("skips entries that already have a file", () => {
        const queue = [entry("a", { filePath: "/cache/a.flac" }), entry("b"), entry("c")];

        expect(warmTargets(queue, 3).map((t) => t.id)).toEqual(["b", "c"]);
    });

    test("skips live streams — they have no finite file to fetch", () => {
        const queue = [entry("a"), { track: track("live", { isLive: true }) }, entry("c")];

        expect(warmTargets(queue, 3).map((t) => t.id)).toEqual(["a", "c"]);
    });

    test("filtering happens inside the window, not after it", () => {
        // 'a' is already cached; that must NOT pull 'd' into a depth-3 warm — the
        // bound is on how far down the queue we look, not on how many we return.
        const queue = [entry("a", { filePath: "/cache/a.flac" }), entry("b"), entry("c"), entry("d")];

        expect(warmTargets(queue, 3).map((t) => t.id)).toEqual(["b", "c"]);
    });

    test("an empty or fully-warm queue asks for nothing", () => {
        expect(warmTargets([], 3)).toEqual([]);
        expect(warmTargets([entry("a", { filePath: "/cache/a.flac" })], 3)).toEqual([]);
    });

    test("a non-positive depth disables warming entirely", () => {
        const queue = [entry("a"), entry("b")];

        expect(warmTargets(queue, 0)).toEqual([]);
        expect(warmTargets(queue, -1)).toEqual([]);
    });
});
