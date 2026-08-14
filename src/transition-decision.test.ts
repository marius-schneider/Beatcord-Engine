import { describe, expect, test } from "bun:test";

import type { BeatGrid } from "./beatgrid";
import { B_PRE_ROLL_SEC } from "./mixer";
import { clubBlendSec, decideTransition, type TransitionDecisionOptions } from "./transition-decision";
import type { TrackTraits } from "./transition-planner";

/** A complete, plausible grid — every field the planner actually reads. */
function grid(bpm: number, over: Partial<BeatGrid> = {}): BeatGrid {
    const beatInterval = 60 / bpm;
    return {
        bpm,
        beatInterval,
        beats: Array.from({ length: 400 }, (_, i) => i * beatInterval),
        analysisOffset: 0,
        musicalEndSec: 200,
        key: { camelot: "8A", confidence: 0.9, key: "C", scale: "major" },
        energy: { energy: 0.5, percussiveness: 0.5, danceability: 1.2 },
        spectral: { centroid: 2200, rolloff: 6500, flatness: 0.25, flux: 0.4 },
        downbeatPhase: 0,
        introSec: 0,
        ...over,
    } as BeatGrid;
}

function traits(over: Partial<TrackTraits> = {}): TrackTraits {
    return { title: "T", uploader: "A", grid: grid(128), durationMs: 210_000, ...over };
}

function opts(over: Partial<TransitionDecisionOptions> = {}): TransitionDecisionOptions {
    return {
        fadeSec: 6,
        tempoSync: true,
        eqSweep: true,
        harmonic: true,
        stemsReady: false,
        outgoingTempoRatio: 1,
        ...over,
    };
}

describe("decideTransition", () => {
    test("produces a plan, a cue and a pre-roll", () => {
        const d = decideTransition(traits(), traits(), opts());
        expect(d.plan.type).toBeTruthy();
        expect(d.plan.fadeSec).toBeGreaterThan(0);
        expect(d.cue.aStartSec).toBeGreaterThanOrEqual(0);
        expect(d.preRollSec).toBeGreaterThan(0);
    });

    test("eqSweep off forces the plan's sweep off", () => {
        expect(decideTransition(traits(), traits(), opts({ eqSweep: false })).plan.eqSweep).toBe(false);
    });

    test("tempoSync off never time-stretches", () => {
        const d = decideTransition(
            traits({ grid: grid(128) }),
            traits({ grid: grid(134) }),
            opts({ tempoSync: false }),
        );
        expect(d.plan.tempoRatio).toBe(1);
    });

    test("a harmonic-motivated move degrades to a blend when harmonic mixing is off", () => {
        // Force the planner down the harmonic path by making both sides key-compatible,
        // then check the override rather than asserting a specific planner choice.
        const on = decideTransition(traits(), traits(), opts({ harmonic: true }));
        const off = decideTransition(traits(), traits(), opts({ harmonic: false }));
        if (on.plan.reason.includes("harmonic")) expect(off.plan.type).toBe("blend");
        else expect(off.plan.type).toBe(on.plan.type);
    });
});

describe("pre-roll", () => {
    // Regression guard for the reconciled behaviour: the two controllers disagreed
    // here, and both halves of a transition must ask for the SAME lead or the
    // pre-warmed deck is thrown away and respawned.
    test("hard entries get a 20 ms hair, not a fade-sized lead", () => {
        // A big tempo gap with stretching disabled pushes the planner to a hard move.
        const d = decideTransition(
            traits({ grid: grid(128) }),
            traits({ grid: grid(174) }),
            opts({ tempoSync: false }),
        );
        if (["spinback", "roll", "cut", "bassdrop"].includes(d.plan.type)) {
            expect(d.preRollSec).toBe(0.02);
        }
    });

    test("a fade's pre-roll scales with the incoming stretch, keeping the heard lead constant", () => {
        const d = decideTransition(traits({ grid: grid(128) }), traits({ grid: grid(132) }), opts());
        if (!["spinback", "roll", "cut", "bassdrop"].includes(d.plan.type)) {
            expect(d.preRollSec).toBeCloseTo(B_PRE_ROLL_SEC * d.plan.tempoRatio, 10);
        }
    });

    test("the cue starts the incoming deck a pre-roll before its bar line", () => {
        const d = decideTransition(traits(), traits(), opts());
        expect(d.cue.bStartSec).toBeCloseTo(Math.max(0, d.cue.bDropSec - d.preRollSec), 6);
    });
});

describe("club blend", () => {
    test("off by default — a plain blend keeps the planner's length", () => {
        const plain = decideTransition(traits(), traits(), opts());
        const club = decideTransition(traits(), traits(), opts({ clubBlend: true, currentGenre: "edm" }));
        if (plain.plan.type === "blend") expect(club.plan.fadeSec).toBeGreaterThan(plain.plan.fadeSec);
    });

    test("only extends a blend, never a hard move", () => {
        const d = decideTransition(traits(), traits(), opts({ clubBlend: true, currentGenre: "edm" }));
        if (d.plan.type !== "blend") expect(d.plan.reason).not.toContain("club blend");
    });
});

describe("clubBlendSec", () => {
    const beat128 = 60 / 128; // 0.46875 s → bar = 1.875 s

    test("EDM plus strong musical evidence → 16 bars ≈ 30 s, snapped to whole bars", () => {
        const sec = clubBlendSec(beat128, "edm", "edm", 240, {
            beatConfidence: 0.9,
            tempoCompatible: true,
            phraseConfidence: 0.85,
            structureConfidence: 0.8,
            energy: 0.75,
        });
        expect(sec).toBeCloseTo(16 * beat128 * 4, 6);
        expect(sec).toBeCloseTo(30, 1);
    });

    test("House/EDM genre alone cannot force a 16-bar blend", () => {
        expect(clubBlendSec(beat128, "edm", "edm", 240)).toBeCloseTo(8 * beat128 * 4, 6);
    });

    test("pop → shorter (8 bars)", () => {
        expect(clubBlendSec(beat128, "pop", "pop", 240)).toBeCloseTo(8 * beat128 * 4, 6);
    });

    test("clamps to a fraction of a short track", () => {
        // 60 s track → ceiling is 45% = 27 s → 14 bars at 1.875 s.
        expect(clubBlendSec(beat128, "edm", "edm", 60)).toBeLessThanOrEqual(27);
    });

    test("never below a 4-bar floor", () => {
        expect(clubBlendSec(beat128, "edm", "edm", 10)).toBeCloseTo(4 * beat128 * 4, 6);
    });

    test("a nonsense grid yields no club blend at all", () => {
        expect(clubBlendSec(0, "edm", "edm", 240)).toBe(0);
    });
});
