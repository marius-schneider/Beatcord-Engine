import { describe, expect, test } from "bun:test";

import { BeatmatchController, type BeatmatchOptions, type MixOutput } from "./beatmatch";
import type { TrackInfo } from "./ytdlp";

// Covers only what needs no ffmpeg/network: the end-of-mix semantics that decide
// whether the caller keeps treating a closed deck as playing. Skipping INTO a track
// spawns ffmpeg and downloads a file, so that path is out of scope here.

const nullOutput: MixOutput = { play: () => {} };

function opts(over: Partial<BeatmatchOptions> = {}): BeatmatchOptions {
    return {
        fadeSec: 6,
        eqSweep: true,
        tempoSync: true,
        harmonicMix: true,
        onEmpty: () => {},
        onTrackChange: () => {},
        ...over,
    };
}

function track(id: string): TrackInfo {
    return { id, title: id, url: `u/${id}`, durationMs: 180_000, uploader: null, thumbnail: null };
}

describe("a fresh controller", () => {
    test("is not stopped and exposes its deck", () => {
        const c = new BeatmatchController(nullOutput, opts());
        expect(c.stopped).toBe(false);
        expect(c.deck).toBeDefined();
        c.stop();
    });

    test("stop() marks it stopped", () => {
        const c = new BeatmatchController(nullOutput, opts());
        c.stop();
        expect(c.stopped).toBe(true);
    });
});

describe("skipping with nothing queued", () => {
    // The bug this guards: skip() used to return void, so the caller couldn't tell
    // "skipped to the next track" from "the mix just ended". It kept the finished
    // controller as the live one, leaving a closed deck showing as now-playing.
    test("reports that it did NOT advance", async () => {
        const c = new BeatmatchController(nullOutput, opts());
        expect(await c.skip()).toBe(false);
    });

    test("ends the mix and marks itself stopped", async () => {
        const c = new BeatmatchController(nullOutput, opts());
        await c.skip();
        expect(c.stopped).toBe(true);
    });

    test("notifies onEmpty exactly once", async () => {
        let empties = 0;
        const c = new BeatmatchController(nullOutput, opts({ onEmpty: () => empties++ }));
        await c.skip();
        expect(empties).toBe(1);
    });

    test("onEmpty sees the controller as already stopped", async () => {
        // Order matters: a listener that reacts by enqueueing (auto-radio) must be
        // able to tell that this controller is finished and start a fresh one.
        const seen: boolean[] = [];
        const c: BeatmatchController = new BeatmatchController(
            nullOutput,
            opts({ onEmpty: () => seen.push(c.stopped) }),
        );
        await c.skip();
        expect(seen).toEqual([true]);
    });

    test("leaves current untouched — there was nothing to move to", async () => {
        const c = new BeatmatchController(nullOutput, opts());
        expect(c.current).toBeNull();
        await c.skip();
        expect(c.current).toBeNull();
    });

    test("never reports a track change", async () => {
        let changes = 0;
        const c = new BeatmatchController(nullOutput, opts({ onTrackChange: () => changes++ }));
        await c.skip();
        expect(changes).toBe(0);
    });
});

describe("a stopped controller", () => {
    // The follow-on bug: auto-radio refilled the stopped controller's queue, whose
    // deck is closed, so the tracks sat there inaudibly and playback never resumed.
    // `stopped` is what lets the caller route the refill to a fresh controller —
    // add() itself stays permissive, so callers MUST check.
    test("still accepts add(), so callers have to check `stopped`", async () => {
        const c = new BeatmatchController(nullOutput, opts());
        await c.skip();
        expect(c.stopped).toBe(true);

        c.add({ track: track("x"), requesterId: "u" });
        expect(c.queue).toHaveLength(1); // queued, but this deck can never play it
    });
});
