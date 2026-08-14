import { describe, expect, test } from "bun:test";

import { scoreCandidate, targetEnergy } from "./radio";

describe("energy arc (targetEnergy)", () => {
    test("fixed vibes are constant", () => {
        expect(targetEnergy("warmup", 0)).toBeCloseTo(0.45, 3);
        expect(targetEnergy("warmup", 90)).toBeCloseTo(0.45, 3);
        expect(targetEnergy("peak", 5)).toBeCloseTo(0.9, 3);
        expect(targetEnergy("chill", 40)).toBeCloseTo(0.3, 3);
    });

    test("auto arc builds from warm-up toward peak over ~22 min", () => {
        const start = targetEnergy("auto", 0);
        const mid = targetEnergy("auto", 11);
        const peak = targetEnergy("auto", 22);
        expect(start).toBeCloseTo(0.5, 2);
        expect(mid).toBeGreaterThan(start);
        expect(peak).toBeGreaterThan(mid);
        expect(peak).toBeGreaterThan(0.85);
    });

    test("auto arc stays in a sane band and never pins the floor cold", () => {
        for (let m = 0; m <= 120; m += 3) {
            const e = targetEnergy("auto", m);
            expect(e).toBeGreaterThanOrEqual(0.3);
            expect(e).toBeLessThanOrEqual(0.92);
        }
    });
});

describe("scoreCandidate", () => {
    test("prefers the candidate closest to the target energy", () => {
        const near = scoreCandidate(0.85, 0.84, 2.4, "8A", "8A", "auto");
        const far = scoreCandidate(0.85, 0.4, 2.4, "8A", "8A", "auto");
        expect(near).toBeGreaterThan(far);
    });

    test("rewards harmonic (Camelot-compatible) keys", () => {
        // Same energy/dance; 8A→9A (adjacent, compatible) should beat 8A→2B (clash).
        const compatible = scoreCandidate(0.8, 0.8, 2, "8A", "9A", "auto");
        const clash = scoreCandidate(0.8, 0.8, 2, "8A", "2B", "auto");
        expect(compatible).toBeGreaterThan(clash);
    });

    test("chill vibe inverts the danceability preference", () => {
        const calm = scoreCandidate(0.3, 0.3, 0.6, "1A", "1A", "chill");
        const dancey = scoreCandidate(0.3, 0.3, 2.9, "1A", "1A", "chill");
        expect(calm).toBeGreaterThan(dancey);
    });
});
