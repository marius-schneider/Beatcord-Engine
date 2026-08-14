import { describe, expect, test } from "bun:test";

import { analyzeHealth, estimateGroove, rmsCurve, segmentSections } from "./deep-analysis";

// Build onset times for a given per-beat "and" phase at 120 BPM (beat = 0.5s).
function onsetsAt(phase: number, beats = 32): number[] {
    const beat = 0.5;
    const out: number[] = [];
    for (let b = 0; b < beats; b++) {
        out.push(b * beat); // the downbeat
        out.push(b * beat + phase * beat); // the "and"
    }
    return out;
}

describe("estimateGroove", () => {
    test("straight feel → 'straight' (~0.5)", () => {
        const g = estimateGroove(onsetsAt(0.5), 120);
        expect(g.kind).toBe("straight");
        expect(g.swing).toBeLessThan(0.55);
    });

    test("delayed off-beat → swing/shuffle", () => {
        const g = estimateGroove(onsetsAt(0.63), 120);
        expect(["swing", "shuffle"]).toContain(g.kind);
        expect(g.swing).toBeGreaterThan(0.58);
    });

    test("too few onsets → safe default", () => {
        expect(estimateGroove([0, 0.5], 120).kind).toBe("straight");
    });
});

describe("segmentSections", () => {
    test("intro-low → build-mid → drop-high → outro-low", () => {
        // ~4s per region at hop 0.046 → ~87 frames each.
        const region = (v: number) => Array(90).fill(v);
        const curve = [...region(0.2), ...region(0.55), ...region(0.9), ...region(0.15)];
        const secs = segmentSections(curve);
        const kinds = secs.map((s) => s.kind);
        expect(kinds[0]).toBe("intro");
        expect(kinds).toContain("drop");
        expect(kinds.at(-1)).toBe("outro");
    });

    test("too short → no sections", () => {
        expect(segmentSections([0.2, 0.9, 0.2])).toEqual([]);
    });
});

describe("analyzeHealth", () => {
    test("clean sine → no clip, tiny DC, peak near source", () => {
        const n = 4096;
        const pcm = new Float32Array(n);
        for (let i = 0; i < n; i++) pcm[i] = 0.5 * Math.sin((2 * Math.PI * 100 * i) / 22050);
        const h = analyzeHealth(pcm);
        expect(h.clipPct).toBe(0);
        expect(h.truePeakDb).toBeLessThan(0);
        expect(h.truePeakDb).toBeGreaterThan(-12);
    });

    test("detects clipping and DC offset", () => {
        const n = 2048;
        const pcm = new Float32Array(n);
        for (let i = 0; i < n; i++) pcm[i] = 1.0 + 0 * i; // full-scale + DC
        const h = analyzeHealth(pcm);
        expect(h.clipPct).toBeGreaterThan(50);
        expect(h.dcOffsetDb).toBeGreaterThan(-1); // strong DC
    });

    test("empty input → safe", () => {
        const h = analyzeHealth(new Float32Array(0));
        expect(h.clipPct).toBe(0);
    });
});

describe("rmsCurve", () => {
    test("normalizes to its own max (peak → 1)", () => {
        const pcm = new Float32Array(22050);
        for (let i = 0; i < pcm.length; i++) pcm[i] = i < 11000 ? 0.1 : 0.8;
        const curve = rmsCurve(pcm);
        expect(Math.max(...curve)).toBeCloseTo(1, 5);
        expect(Math.min(...curve)).toBeLessThan(0.3);
    });
});
