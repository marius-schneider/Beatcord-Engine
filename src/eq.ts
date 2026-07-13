/**
 * A 3-band EQ splitter for DJ-style transitions. Splits a signal into low / mid
 * / high bands so each can be cross-blended on its own curve — the professional
 * "bring the highs in first, then mids, then lows" technique that avoids the
 * muddy bass clash of a plain crossfade.
 *
 * Uses cascaded one-pole filters (cheap, stable, good enough for a DJ blend at
 * 48kHz). Crossovers at ~250 Hz (low/mid) and ~4 kHz (mid/high).
 */

const SAMPLE_RATE = 48_000;

/** One-pole low-pass coefficient for a given cutoff (Hz). */
function lpCoeff(cutoffHz: number): number {
    const x = Math.exp((-2 * Math.PI * cutoffHz) / SAMPLE_RATE);
    return 1 - x;
}

const LOW_CUT = lpCoeff(250); // below → "low" band
const MID_CUT = lpCoeff(4000); // below → "low+mid", above → "high"

/**
 * A sweepable high-pass for the "filter" transition: as the cutoff rises the bass
 * is progressively removed, so the outgoing track thins out and "filters away".
 * One-pole high-pass = input − low-pass(cutoff); we keep the running LP accumulator
 * per channel in a {@link HpState}.
 */
export interface HpState {
    lp: number;
}
export function createHpState(): HpState {
    return { lp: 0 };
}

/**
 * High-pass one sample at a given cutoff (Hz). `cutoffHz` can change every sample,
 * which is how we sweep it. At cutoff ≈ 20Hz this is ~transparent; sweeping toward
 * a few kHz strips the lows then the mids.
 */
export function highpass(sample: number, cutoffHz: number, st: HpState): number {
    const coeff = lpCoeff(cutoffHz);
    st.lp += coeff * (sample - st.lp);
    return sample - st.lp;
}

/**
 * Per-channel filter state for one audio source. Holds the running low-pass
 * accumulators used to derive the three bands.
 */
export interface BandState {
    /** low-pass @250Hz accumulator (the low band). */
    low: number;
    /** low-pass @4kHz accumulator (low+mid; high = input − this). */
    lowMid: number;
}

export function createBandState(): BandState {
    return { low: 0, lowMid: 0 };
}

/**
 * Split one sample into [low, mid, high] using the running state (mutated).
 *  - low  = LP(250)
 *  - high = input − LP(4000)
 *  - mid  = input − low − high
 */
export function splitBands(sample: number, st: BandState): [number, number, number] {
    st.low += LOW_CUT * (sample - st.low);
    st.lowMid += MID_CUT * (sample - st.lowMid);
    const low = st.low;
    const high = sample - st.lowMid;
    const mid = sample - low - high;
    return [low, mid, high];
}

/**
 * Per-band gains for a DJ 3-band transition at progress `t` (0→1), for the
 * OUTGOING (A) and INCOMING (B) track.
 *
 * Highs swap first (0–40%), mids next (30–70%), lows last (60–100%) — so the
 * incoming track layers in on top before its bass replaces the outgoing bass.
 */
export function bandGains(t: number): { a: [number, number, number]; b: [number, number, number] } {
    const ramp = (start: number, end: number) => {
        if (t <= start) return 0;
        if (t >= end) return 1;
        return (t - start) / (end - start);
    };
    const highB = ramp(0.0, 0.4);
    const midB = ramp(0.3, 0.7);
    const lowB = ramp(0.6, 1.0);
    // A fades each band out as B fades it in (complementary).
    return {
        a: [1 - lowB, 1 - midB, 1 - highB],
        b: [lowB, midB, highB],
    };
}
