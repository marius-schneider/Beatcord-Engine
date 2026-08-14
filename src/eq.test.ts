import { describe, expect, test } from "bun:test";

import { bandGains, createBandState, createHpState, highpass, splitBands } from "./eq";

const SR = 48_000;

/** Run a sine of `freq` Hz through the band splitter; return per-band RMS. */
function bandRms(freq: number): { low: number; mid: number; high: number } {
    const st = createBandState();
    let lo = 0;
    let mi = 0;
    let hi = 0;
    const n = SR; // 1 second, long enough for the cascade to settle
    for (let i = 0; i < n; i++) {
        const s = Math.sin((2 * Math.PI * freq * i) / SR);
        const [l, m, h] = splitBands(s, st);
        // Skip the first 20ms of settling.
        if (i > SR / 50) {
            lo += l * l;
            mi += m * m;
            hi += h * h;
        }
    }
    const d = n - SR / 50;
    return { low: Math.sqrt(lo / d), mid: Math.sqrt(mi / d), high: Math.sqrt(hi / d) };
}

describe("bandGains — DJ 3-band transition curve", () => {
    test("endpoints hand the whole spectrum from A to B", () => {
        const start = bandGains(0);
        expect(start.a).toEqual([1, 1, 1]);
        expect(start.b).toEqual([0, 0, 0]);
        const end = bandGains(1);
        expect(end.a[0]).toBeCloseTo(0, 5);
        expect(end.b[0]).toBeCloseTo(1, 5);
    });

    test("A and B bands are always complementary (constant per-band sum)", () => {
        for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
            const { a, b } = bandGains(t);
            for (let band = 0; band < 3; band++) {
                expect(a[band]! + b[band]!).toBeCloseTo(1, 6);
            }
        }
    });

    test("decisive bass swap: A owns the low end before ~0.46, B after ~0.58", () => {
        // Low band is index 0. Before the swap window A keeps its bass.
        expect(bandGains(0.4).a[0]).toBeGreaterThan(0.95);
        expect(bandGains(0.4).b[0]).toBeLessThan(0.05);
        // Mid-swap it is genuinely crossing.
        const mid = bandGains(0.52).b[0]!;
        expect(mid).toBeGreaterThan(0.1);
        expect(mid).toBeLessThan(0.9);
        // After the window B owns the bass — no long muddy dual-bass overlap.
        expect(bandGains(0.6).b[0]).toBeGreaterThan(0.95);
        expect(bandGains(0.6).a[0]).toBeLessThan(0.05);
    });

    test("highs lead the swap (B highs in well before B bass)", () => {
        // At 40% B should already have most of its highs but little bass.
        const g = bandGains(0.4);
        expect(g.b[2]).toBeGreaterThan(g.b[0]!); // highs ahead of lows
    });

    test("monotonic bass handoff", () => {
        let prev = -1;
        for (let t = 0; t <= 1.0001; t += 0.05) {
            const lowB = bandGains(t).b[0]!;
            expect(lowB).toBeGreaterThanOrEqual(prev - 1e-9);
            prev = lowB;
        }
    });
});

describe("splitBands — steep 3-band crossover", () => {
    test("bands always sum back to the input (no level hole on a swap)", () => {
        const st = createBandState();
        for (let i = 0; i < 500; i++) {
            const s = Math.sin(i * 0.3) * 0.7 + Math.sin(i * 1.9) * 0.3;
            const [l, m, h] = splitBands(s, st);
            expect(l + m + h).toBeCloseTo(s, 6);
        }
    });

    test("a 60 Hz tone lands in the low band, out of the highs entirely", () => {
        const { low, mid, high } = bandRms(60);
        expect(low).toBeGreaterThan(mid * 3); // low clearly dominates the sub
        expect(low).toBeGreaterThan(high * 20); // B's highs carry no sub-bass
    });

    test("a 1 kHz tone lands in the mid band (little bass leakage)", () => {
        const { low, mid, high } = bandRms(1000);
        expect(mid).toBeGreaterThan(low * 5);
        expect(mid).toBeGreaterThan(high * 4);
    });

    test("a 12 kHz tone lands overwhelmingly in the high band", () => {
        const { low, mid, high } = bandRms(12_000);
        expect(high).toBeGreaterThan(mid * 3);
        expect(high).toBeGreaterThan(low * 50);
    });
});

describe("highpass — sweepable resonant DJ filter", () => {
    test("near-open (20 Hz) is ~transparent; swept up it strips the lows", () => {
        const rmsAt = (cutoff: number, freq: number) => {
            const st = createHpState();
            let acc = 0;
            const n = SR;
            for (let i = 0; i < n; i++) {
                const y = highpass(Math.sin((2 * Math.PI * freq * i) / SR), cutoff, st);
                if (i > SR / 50) acc += y * y;
            }
            return Math.sqrt(acc / (n - SR / 50));
        };
        // A 100 Hz tone: nearly untouched wide open, strongly attenuated when the
        // cutoff sweeps up to 2 kHz.
        expect(rmsAt(20, 100)).toBeGreaterThan(0.6);
        expect(rmsAt(2000, 100)).toBeLessThan(0.15);
    });
});
