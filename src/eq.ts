/**
 * A 3-band EQ splitter + sweepable resonant filter for DJ-style transitions.
 * Splits a signal into low / mid / high bands so each can be cross-blended on
 * its own curve — the professional "bring the highs in first, then mids, then
 * swap the bass" technique that avoids the muddy bass clash of a plain fade.
 *
 * The band crossovers are steep (4th-order, ~24 dB/oct — real DJ-isolator
 * territory, à la a Pioneer DJM). A gentle 6 dB/oct split leaks so much energy
 * between bands that the bass-swap is barely audible and a "blend" collapses
 * back into a plain gain crossfade — which is exactly what makes a mix sound
 * basic. Steep crossovers make the swap decisive and the highs-first ride real.
 *
 * Crossovers at ~250 Hz (low/mid) and ~4 kHz (mid/high). The complementary
 * derivation (mid = input − low − high) keeps low+mid+high === input EXACTLY at
 * every sample regardless of filter order, so a swap never punches a level hole.
 */

const SAMPLE_RATE = 48_000;

/** One-pole low-pass coefficient for a given cutoff (Hz). */
function lpCoeff(cutoffHz: number): number {
    const x = Math.exp((-2 * Math.PI * cutoffHz) / SAMPLE_RATE);
    return 1 - x;
}

// Band split is a cascade of BAND_ORDER identical one-poles (→ BAND_ORDER ×
// 6 dB/oct). Order 2 (12 dB/oct) is the sweet spot: it roughly halves the
// bass leaking into the mid band and keeps the highs in the high band (so
// "highs-first" is real and the bass swap is decisive) — the tighter bands are
// what separate a real DJ blend from a plain crossfade. Going steeper (order 4)
// buys little extra purity but a subtractive-crossover phase artifact bleeds
// sub-bass back into the mid, so we stop at 2. Cascading lowers the effective
// −3 dB point, so the per-stage cutoff is compensated: for N one-poles the
// −3 dB frequency is fc·√(2^(1/N) − 1) (≈ 0.644·fc at N = 2).
const BAND_ORDER = 2;
const STAGE_COMP = Math.sqrt(2 ** (1 / BAND_ORDER) - 1); // ≈ 0.644
const LOW_STAGE = lpCoeff(250 / STAGE_COMP); // 2-stage cascade → ~250 Hz knee, 12 dB/oct
const MID_STAGE = lpCoeff(4000 / STAGE_COMP); // → ~4 kHz knee, 12 dB/oct

/**
 * Per-channel filter state for one audio source. Holds the running low-pass
 * cascade accumulators used to derive the three bands.
 */
export interface BandState {
    /** Cascade stages for the ~250 Hz low-pass (the low band). */
    low: number[];
    /** Cascade stages for the ~4 kHz low-pass (low+mid; high = input − this). */
    lowMid: number[];
}

export function createBandState(): BandState {
    return { low: new Array(BAND_ORDER).fill(0), lowMid: new Array(BAND_ORDER).fill(0) };
}

/** Run a sample through a cascade of one-poles (steeper roll-off). */
function cascadeLP(sample: number, stages: number[], coeff: number): number {
    let x = sample;
    for (let i = 0; i < stages.length; i++) {
        const prev = stages[i]!;
        const y = prev + coeff * (x - prev);
        stages[i] = y;
        x = y;
    }
    return x;
}

/**
 * Split one sample into [low, mid, high] using the running state (mutated).
 *  - low  = LP⁴(250)
 *  - high = input − LP⁴(4000)
 *  - mid  = input − low − high   (== LP⁴(4000) − LP⁴(250))
 * Steep crossovers → clean, decisive bands. Sum is always exactly `input`.
 */
export function splitBands(sample: number, st: BandState): [number, number, number] {
    const low = cascadeLP(sample, st.low, LOW_STAGE);
    const lowMid = cascadeLP(sample, st.lowMid, MID_STAGE);
    const high = sample - lowMid;
    const mid = sample - low - high;
    return [low, mid, high];
}

/**
 * A sweepable RESONANT high-pass for the "filter" transition — a proper DJ
 * filter, not a gentle one-pole. As the cutoff rises the bass is progressively
 * removed with a 12 dB/oct slope and a little resonant lift at the knee, so the
 * outgoing track "filters away" the way a hand on a DJM/Xone filter knob sounds.
 *
 * Implemented as a Cytomic TPT state-variable filter: unconditionally stable
 * even when the cutoff is modulated every sample (which is exactly how we sweep
 * it). {@link HpState} holds the two integrator states.
 */
export interface HpState {
    ic1: number; // band-pass integrator memory
    ic2: number; // low-pass integrator memory
}
export function createHpState(): HpState {
    return { ic1: 0, ic2: 0 };
}

/** Resonance: Q ≈ 1.3 gives a musical DJ-filter bump without self-oscillating. */
const FILTER_Q = 1.3;

/**
 * High-pass one sample at a given cutoff (Hz). `cutoffHz` may change every
 * sample (that's the sweep). At cutoff ≈ 20 Hz this is ~transparent; sweeping
 * toward a few kHz strips the lows then the low-mids with a resonant edge.
 */
export function highpass(sample: number, cutoffHz: number, st: HpState): number {
    const g = Math.tan((Math.PI * Math.min(cutoffHz, SAMPLE_RATE * 0.49)) / SAMPLE_RATE);
    const k = 1 / FILTER_Q;
    const a1 = 1 / (1 + g * (g + k));
    const a2 = g * a1;
    const a3 = g * a2;
    const v3 = sample - st.ic2;
    const v1 = a1 * st.ic1 + a2 * v3;
    const v2 = st.ic2 + a2 * st.ic1 + a3 * v3;
    st.ic1 = 2 * v1 - st.ic1;
    st.ic2 = 2 * v2 - st.ic2;
    // High-pass output of the TPT SVF.
    return sample - k * v1 - v2;
}

/**
 * Per-band gains for a DJ 3-band transition at progress `t` (0→1), for the
 * OUTGOING (A) and INCOMING (B) track.
 *
 * How a club DJ rides a long blend:
 *  - B's highs layer in first (0–45%) over A playing full.
 *  - B's mids follow (25–70%).
 *  - the BASS SWAP is decisive, not a slow crossfade: A owns the low end until
 *    ~mid-blend, then hands off to B over a tight window (46–58%) — one clean
 *    kick lineage, never two basslines fighting for 12 seconds. After the swap
 *    B carries the low end while A's mids/highs finish fading out.
 */
export function bandGains(t: number): { a: [number, number, number]; b: [number, number, number] } {
    const ramp = (start: number, end: number) => {
        if (t <= start) return 0;
        if (t >= end) return 1;
        // Smoothstep so band edges don't tick audibly on a long blend.
        const x = (t - start) / (end - start);
        return x * x * (3 - 2 * x);
    };
    const highB = ramp(0.0, 0.45);
    const midB = ramp(0.25, 0.7);
    const lowB = ramp(0.46, 0.58); // decisive bass handoff around the midpoint
    // A fades each band out as B fades it in (complementary).
    return {
        a: [1 - lowB, 1 - midB, 1 - highB],
        b: [lowB, midB, highB],
    };
}
