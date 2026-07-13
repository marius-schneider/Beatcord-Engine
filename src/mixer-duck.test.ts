import { expect, test } from "bun:test";
import { PCM_MAX, PCM_MIN } from "./constants";
import { clamp, duckStep, finalizeFloatSample } from "./mixer";

test("clamp never exceeds the s16 range, even for huge sums", () => {
    for (const v of [0, 100, PCM_MAX, PCM_MAX * 2, 99999, -99999, PCM_MIN * 2, PCM_MIN]) {
        const out = clamp(v);
        expect(out).toBeLessThanOrEqual(PCM_MAX);
        expect(out).toBeGreaterThanOrEqual(PCM_MIN);
    }
});

test("clamp leaves moderate levels bit-exact (below the soft knee)", () => {
    // Well below 0.85 * full-scale → must pass through (only rounded).
    for (const v of [0, 1000, -1000, 20000, -20000]) {
        expect(clamp(v)).toBe(Math.round(v));
    }
});

test("finalizeFloatSample preserves direct integer PCM before the output limiter", () => {
    for (const v of [0, 1000, -1000, 20000, -20000]) {
        expect(finalizeFloatSample(v)).toBe(v);
    }
});

test("finalizeFloatSample soft-limits a float bus sum only at the final boundary", () => {
    expect(finalizeFloatSample(PCM_MAX * 1.5)).toBeLessThanOrEqual(PCM_MAX);
    expect(finalizeFloatSample(PCM_MIN * 1.5)).toBeGreaterThanOrEqual(PCM_MIN);
    expect(finalizeFloatSample(PCM_MAX * 1.5)).toBeGreaterThan(PCM_MAX * 0.85);
});

test("duck eases DOWN monotonically toward the speaking gain and stays above it", () => {
    let g = 1;
    let prev = g;
    for (let i = 0; i < 10; i++) {
        g = duckStep(g, 0.32);
        expect(g).toBeLessThanOrEqual(prev); // never goes back up while ducking
        expect(g).toBeGreaterThanOrEqual(0.32); // approaches but never overshoots
        prev = g;
    }
    expect(g).toBeCloseTo(0.32, 2); // converged after ~10 frames (200ms)
});

test("duck eases UP monotonically and snaps to exactly 1 (bit-exact idle)", () => {
    let g = 0.32;
    let prev = g;
    let snapped = false;
    for (let i = 0; i < 20; i++) {
        g = duckStep(g, 1);
        expect(g).toBeGreaterThanOrEqual(prev);
        prev = g;
        if (g === 1) {
            snapped = true;
            break;
        }
    }
    expect(snapped).toBe(true); // reaches an exact 1 so idle frames are untouched
});

test("duck-down then voice mix never clips a full-scale music + voice sum", () => {
    // Worst case: music at full scale, voice at full scale, summed during a duck.
    let g = 1;
    for (let frame = 0; frame < 6; frame++) {
        g = duckStep(g, 0.32);
        const mixed = clamp(PCM_MAX * g + PCM_MAX);
        expect(mixed).toBeLessThanOrEqual(PCM_MAX);
        const mixedNeg = clamp(PCM_MIN * g + PCM_MIN);
        expect(mixedNeg).toBeGreaterThanOrEqual(PCM_MIN);
    }
});
