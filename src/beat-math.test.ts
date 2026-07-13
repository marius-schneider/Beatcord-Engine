import { expect, test } from "bun:test";
import { beatAlignedIntro, transitionStart } from "./beat-math";
import type { BeatGrid } from "./beatgrid";

/** 120 BPM grid (interval 0.5s) with configurable anchor/downbeat/intro. */
function grid(b0 = 10, downbeatPhase = 0, introSec = 0): BeatGrid {
    return {
        bpm: 120,
        beats: [b0, b0 + 0.5, b0 + 1, b0 + 1.5],
        beatInterval: 0.5,
        analysisOffset: 0,
        musicalEndSec: 180,
        key: { name: "A minor", camelot: "8A", confidence: 0.8 },
        energy: { energy: 1, percussiveness: 0.5 },
        spectral: { centroid: 3000, rolloff: 6000, flatness: 0.1, flux: 0.3 },
        downbeatPhase,
        introSec,
    };
}

// Grid above: bar lines at 10, 12, 14, …; 16-beat phrase lines at 10, 18, 26, …

test("transitionStart snaps to the 16-beat phrase line when the cost is small", () => {
    // target 19 → phrase line 18 sacrifices 2 beats → take it.
    expect(transitionStart(grid(), 19, 100, true)).toBe(18);
});

test("phrase snap falls back to the bar grid when it would cut >8 beats", () => {
    // target 23 → phrase line 18 would sacrifice 10 beats → bar line 22 instead.
    expect(transitionStart(grid(), 23, 100, true)).toBe(22);
});

test("preferPhrase=false (cuts/fades) uses the bar grid directly", () => {
    expect(transitionStart(grid(), 23, 100, false)).toBe(22);
    expect(transitionStart(grid(), 19, 100, false)).toBe(18); // 18 is also a bar line
});

test("the max clamp walks back to an earlier boundary", () => {
    // target 23 but max 21 → bar line 20.
    expect(transitionStart(grid(), 23, 21, false)).toBe(20);
});

test("bar grid honours the downbeat phase (bar 1 = the kick beat, not beat[0])", () => {
    // downbeatPhase 2 → bar lines at 11, 13, 15, … (origin 10 + 2·0.5).
    expect(transitionStart(grid(10, 2), 14, 100, false)).toBe(13);
});

test("beatAlignedIntro starts on the track's first DOWNBEAT (bar line)", () => {
    // b0=0.3, downbeatPhase=2 → first bar line at 1.3 → start 1.28 (20ms pre-roll).
    expect(beatAlignedIntro(grid(0.3, 2))).toBeCloseTo(1.28, 5);
});

test("beatAlignedIntro skips the intro to the next bar line after it", () => {
    // intro 10s, bar lines 1.3, 3.3, …, 11.3 → first ≥10 is 11.3 → 11.28.
    expect(beatAlignedIntro(grid(0.3, 2, 10))).toBeCloseTo(11.28, 5);
});

test("beatAlignedIntro is safe without a grid", () => {
    expect(beatAlignedIntro(null)).toBe(0);
    expect(beatAlignedIntro(undefined)).toBe(0);
});

test("beatAlignedIntro honours a custom pre-roll (crossfade lead for bar-align trim)", () => {
    // Same bar line (1.3) with a 50ms lead instead of the default 20ms.
    expect(beatAlignedIntro(grid(0.3, 2), 0.05)).toBeCloseTo(1.25, 5);
});
