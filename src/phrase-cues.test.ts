import { expect, test } from "bun:test";

import type { BeatGrid } from "./beatgrid";
import { chooseTransitionCue } from "./phrase-cues";

function grid(b0 = 0, downbeatPhase = 0, introSec = 0, bpm = 120): BeatGrid {
    const beat = 60 / bpm;
    return {
        bpm,
        beats: [b0, b0 + beat, b0 + beat * 2, b0 + beat * 3],
        beatInterval: beat,
        analysisOffset: 0,
        musicalEndSec: 180,
        key: { name: "A minor", camelot: "8A", confidence: 0.8 },
        energy: { energy: 1, percussiveness: 0.6 },
        spectral: { centroid: 3200, rolloff: 7000, flatness: 0.1, flux: 0.4 },
        downbeatPhase,
        introSec,
    };
}

test("chooses a phrase start on A when the sacrifice is musical", () => {
    const cur = grid(10);
    const next = grid(0, 0, 0);
    cur.musicalEndSec = 27; // target = 19, phrase lines are 10, 18, 26
    const cue = chooseTransitionCue({
        currentGrid: cur,
        nextGrid: next,
        currentDurationSec: 30,
        transitionType: "blend",
        fadeSec: 8,
        preRollSec: 0.05,
    });
    expect(cue.aStartSec).toBe(18);
    expect(cue.aGrid).toBe("phrase");
});

test("uses a nearby phrase drop on B when it aligns with the intro", () => {
    const cur = grid(10);
    const next = grid(0, 0, 7);
    cur.musicalEndSec = 27;
    const cue = chooseTransitionCue({
        currentGrid: cur,
        nextGrid: next,
        currentDurationSec: 30,
        transitionType: "bassdrop",
        fadeSec: 8,
        preRollSec: 0.05,
    });
    expect(cue.bDropSec).toBe(8);
    expect(cue.bStartSec).toBeCloseTo(7.95, 5);
    expect(cue.bGrid).toBe("phrase");
});

test("does not wait too long for a phrase on the incoming track", () => {
    const cur = grid(10);
    const next = grid(0, 0, 9);
    cur.musicalEndSec = 27;
    const cue = chooseTransitionCue({
        currentGrid: cur,
        nextGrid: next,
        currentDurationSec: 30,
        transitionType: "blend",
        fadeSec: 8,
        preRollSec: 0.05,
    });
    expect(cue.bDropSec).toBe(10);
    expect(cue.bGrid).toBe("bar");
});

test("falls back safely without grids", () => {
    const cue = chooseTransitionCue({
        currentGrid: null,
        nextGrid: null,
        currentDurationSec: 100,
        transitionType: "fade",
        fadeSec: 6,
        outgoingTempoRatio: 1,
    });
    expect(cue.aStartSec).toBe(94);
    expect(cue.aStartPlaySec).toBe(94);
    expect(cue.bStartSec).toBe(0);
});

test("uses duration when the detected musical end is unusable", () => {
    const cur = grid(0);
    cur.musicalEndSec = 0;
    const cue = chooseTransitionCue({
        currentGrid: cur,
        nextGrid: null,
        currentDurationSec: 100,
        transitionType: "fade",
        fadeSec: 6,
    });
    expect(cue.aStartSec).toBe(94);
});

test("converts the outgoing cue to heard playback time under tempo stretch", () => {
    const cur = grid(10);
    cur.musicalEndSec = 27;
    const cue = chooseTransitionCue({
        currentGrid: cur,
        nextGrid: grid(),
        currentDurationSec: 30,
        transitionType: "blend",
        fadeSec: 8,
        outgoingTempoRatio: 1.05,
    });
    expect(cue.aStartSec).toBe(18);
    expect(cue.aStartPlaySec).toBeCloseTo(18 / 1.05, 3);
});
