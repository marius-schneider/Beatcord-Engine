/**
 * Musical key detection (Krumhansl-Schmuckler) + Camelot-wheel mapping for
 * harmonic mixing — picking the next track so its key sounds consonant with the
 * current one, the way DJs mix "in key".
 *
 * We build a 12-bin chromagram (energy per pitch class) from PCM via the Goertzel
 * algorithm across several octaves, then correlate it against the 24 major/minor
 * Krumhansl key profiles. No Web Audio API needed — works on raw samples.
 */

import type { SpectralFeatures } from "./spectral";

export type { SpectralFeatures } from "./spectral";

const PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

// Krumhansl-Kessler probe-tone profiles.
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/**
 * Camelot wheel codes. Index = pitch class (C=0…B=11). Major = "B" ring, minor =
 * "A" ring. Two tracks mix harmonically when their codes are equal or differ by
 * ±1 number (same letter), or share the number with a different letter.
 */
const CAMELOT_MAJOR = ["8B", "3B", "10B", "5B", "12B", "7B", "2B", "9B", "4B", "11B", "6B", "1B"];
const CAMELOT_MINOR = ["5A", "12A", "7A", "2A", "9A", "4A", "11A", "6A", "1A", "8A", "3A", "10A"];

export interface KeyInfo {
    /** e.g. "A minor". */
    name: string;
    /** Camelot code, e.g. "8A". */
    camelot: string;
    /** Correlation strength of the best match (confidence proxy). */
    confidence: number;
}

// STFT parameters (per MIR best practice for polyphonic key detection).
// Exported so spectral-feature extraction can share the same FFT + window.
export const FFT_SIZE = 4096;
export const HOP_SIZE = 2048; // 50% overlap
const MIN_HZ = 100; // ignore sub-bass rumble
const MAX_HZ = 5000; // ignore very high partials

/** In-place iterative radix-2 FFT (real input via separate re/im arrays). */
export function fft(re: Float64Array, im: Float64Array): void {
    const n = re.length;
    // Bit-reversal permutation.
    for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
            [re[i], re[j]] = [re[j]!, re[i]!];
            [im[i], im[j]] = [im[j]!, im[i]!];
        }
    }
    for (let len = 2; len <= n; len <<= 1) {
        const ang = (-2 * Math.PI) / len;
        const wr = Math.cos(ang);
        const wi = Math.sin(ang);
        for (let i = 0; i < n; i += len) {
            let cr = 1,
                ci = 0;
            for (let k = 0; k < len / 2; k++) {
                const a = i + k;
                const b = i + k + len / 2;
                const tr = cr * re[b]! - ci * im[b]!;
                const ti = cr * im[b]! + ci * re[b]!;
                re[b] = re[a]! - tr;
                im[b] = im[a]! - ti;
                re[a] = re[a]! + tr;
                im[a] = im[a]! + ti;
                const ncr = cr * wr - ci * wi;
                ci = cr * wi + ci * wr;
                cr = ncr;
            }
        }
    }
}

/** Map a frequency to its pitch class (0–11), or -1 if out of range. */
function freqToPitchClass(hz: number): number {
    if (hz < MIN_HZ || hz > MAX_HZ) return -1;
    const midi = 69 + 12 * Math.log2(hz / 440);
    return ((Math.round(midi) % 12) + 12) % 12;
}

/** Perceptual weight: emphasise the mid register (200–2000 Hz). */
function registerWeight(hz: number): number {
    if (hz >= 200 && hz <= 2000) return 1;
    if (hz < 200) return hz / 200;
    return Math.max(0.2, 2000 / hz);
}

export const HANN = (() => {
    const w = new Float64Array(FFT_SIZE);
    for (let i = 0; i < FFT_SIZE; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
    return w;
})();

/**
 * Build a normalised 12-bin chromagram by averaging STFT frames across the whole
 * segment — far more stable than a single transform. Each FFT bin's magnitude is
 * folded into its pitch class, weighted by perceptual register importance.
 */
function chromagram(samples: Float32Array, sampleRate: number): number[] {
    const chroma = new Array(12).fill(0);
    const re = new Float64Array(FFT_SIZE);
    const im = new Float64Array(FFT_SIZE);
    let frames = 0;

    for (let start = 0; start + FFT_SIZE <= samples.length; start += HOP_SIZE) {
        for (let i = 0; i < FFT_SIZE; i++) {
            re[i] = samples[start + i]! * HANN[i]!;
            im[i] = 0;
        }
        fft(re, im);
        // Only the lower half holds unique frequency content.
        for (let bin = 1; bin < FFT_SIZE / 2; bin++) {
            const hz = (bin * sampleRate) / FFT_SIZE;
            const pc = freqToPitchClass(hz);
            if (pc < 0) continue;
            const mag = Math.sqrt(re[bin]! * re[bin]! + im[bin]! * im[bin]!);
            chroma[pc] += mag * registerWeight(hz);
        }
        frames++;
    }
    if (frames === 0) return chroma;
    const max = Math.max(...chroma) || 1;
    return chroma.map((v) => v / max);
}

/** Pearson correlation between two equal-length arrays. */
function correlate(a: number[], b: number[]): number {
    const n = a.length;
    const ma = a.reduce((x, y) => x + y, 0) / n;
    const mb = b.reduce((x, y) => x + y, 0) / n;
    let num = 0,
        da = 0,
        db = 0;
    for (let i = 0; i < n; i++) {
        const x = a[i]! - ma;
        const y = b[i]! - mb;
        num += x * y;
        da += x * x;
        db += y * y;
    }
    const den = Math.sqrt(da * db) || 1;
    return num / den;
}

/** Correlate a chromagram against the 24 key profiles → best Camelot match. */
function chromaToKey(chroma: number[]): KeyInfo {
    let best: KeyInfo = { name: "C major", camelot: "8B", confidence: -1 };
    for (let tonic = 0; tonic < 12; tonic++) {
        // Rotate the profile so its tonic aligns with this pitch class.
        const maj = MAJOR_PROFILE.map((_, i) => MAJOR_PROFILE[(i - tonic + 12) % 12]!);
        const min = MINOR_PROFILE.map((_, i) => MINOR_PROFILE[(i - tonic + 12) % 12]!);
        const cMaj = correlate(chroma, maj);
        const cMin = correlate(chroma, min);
        if (cMaj > best.confidence) {
            best = { name: `${PITCH_CLASSES[tonic]} major`, camelot: CAMELOT_MAJOR[tonic]!, confidence: cMaj };
        }
        if (cMin > best.confidence) {
            best = { name: `${PITCH_CLASSES[tonic]} minor`, camelot: CAMELOT_MINOR[tonic]!, confidence: cMin };
        }
    }
    return best;
}

/**
 * Detect the musical key from mono PCM samples (44.1kHz mono recommended).
 * Returns the best major/minor match with its Camelot code.
 */
export function detectKey(samples: Float32Array, sampleRate = 44_100): KeyInfo {
    return chromaToKey(chromagram(samples, sampleRate));
}

const ROLLOFF_FRACTION = 0.85;

/**
 * Single-pass key + spectral analysis. Both the chromagram (for key) and the
 * spectral timbre features (for genre) need the SAME STFT — same FFT_SIZE, hop,
 * and Hann window — so running them separately did the (expensive) per-frame FFT
 * twice over identical samples. This computes each frame's spectrum ONCE and feeds
 * it into both accumulators, roughly halving the FFT cost.
 */
export function analyseSpectrum(
    samples: Float32Array,
    sampleRate = 44_100,
): { key: KeyInfo; spectral: SpectralFeatures } {
    const re = new Float64Array(FFT_SIZE);
    const im = new Float64Array(FFT_SIZE);
    const half = FFT_SIZE / 2;
    const binHz = sampleRate / FFT_SIZE;

    // Key accumulator.
    const chroma = new Array(12).fill(0);

    // Spectral accumulators.
    let centroidSum = 0;
    let rolloffSum = 0;
    let flatnessSum = 0;
    let fluxSum = 0;
    let specFrames = 0;
    let prevMag: Float64Array | null = null;
    const mag = new Float64Array(half);

    let frames = 0;
    for (let start = 0; start + FFT_SIZE <= samples.length; start += HOP_SIZE) {
        for (let i = 0; i < FFT_SIZE; i++) {
            re[i] = samples[start + i]! * HANN[i]!;
            im[i] = 0;
        }
        fft(re, im);
        frames++;

        let magSum = 0;
        let weightedSum = 0;
        let logSum = 0;
        let nonZero = 0;
        for (let bin = 1; bin < half; bin++) {
            const m = Math.sqrt(re[bin]! * re[bin]! + im[bin]! * im[bin]!);
            mag[bin] = m;
            magSum += m;

            // — Key: fold this bin into its pitch class (register-weighted).
            const hz = bin * binHz;
            const pc = freqToPitchClass(hz);
            if (pc >= 0) chroma[pc] += m * registerWeight(hz);

            // — Spectral: centroid numerator + flatness (geo/arith mean).
            weightedSum += m * hz;
            if (m > 1e-9) {
                logSum += Math.log(m);
                nonZero++;
            }
        }

        // Spectral features skip silent frames (chroma already absorbed the bins).
        if (magSum < 1e-9) continue;

        centroidSum += weightedSum / magSum;

        const target = magSum * ROLLOFF_FRACTION;
        let acc = 0;
        let rolloffBin = half - 1;
        for (let bin = 1; bin < half; bin++) {
            acc += mag[bin]!;
            if (acc >= target) {
                rolloffBin = bin;
                break;
            }
        }
        rolloffSum += rolloffBin * binHz;

        if (nonZero > 0) {
            const geoMean = Math.exp(logSum / nonZero);
            const arithMean = magSum / (half - 1);
            flatnessSum += arithMean > 1e-9 ? geoMean / arithMean : 0;
        }

        if (prevMag) {
            let f = 0;
            for (let bin = 1; bin < half; bin++) {
                const cur = mag[bin]! / magSum;
                const d = cur - prevMag[bin]!;
                if (d > 0) f += d;
            }
            fluxSum += f;
        }
        prevMag = prevMag ?? new Float64Array(half);
        for (let bin = 1; bin < half; bin++) prevMag[bin] = mag[bin]! / magSum;

        specFrames++;
    }

    // Key: normalise the chromagram exactly as chromagram() does.
    const max = Math.max(...chroma) || 1;
    const key =
        frames === 0 ? { name: "C major", camelot: "8B", confidence: -1 } : chromaToKey(chroma.map((v) => v / max));

    const spectral: SpectralFeatures =
        specFrames === 0
            ? { centroid: 0, rolloff: 0, flatness: 0, flux: 0 }
            : {
                  centroid: centroidSum / specFrames,
                  rolloff: rolloffSum / specFrames,
                  flatness: flatnessSum / specFrames,
                  flux: specFrames > 1 ? fluxSum / (specFrames - 1) : 0,
              };

    return { key, spectral };
}

/**
 * Harmonic compatibility score between two Camelot codes (0 = clash, 1 = same
 * key). Adjacent on the wheel (±1, or same number swapping major/minor) scores
 * high; everything else scores low. Used to rank/pick the next track.
 */
export function harmonicScore(a: string, b: string): number {
    if (a === b) return 1; // same key
    const na = Number(a.slice(0, -1));
    const nb = Number(b.slice(0, -1));
    const la = a.slice(-1);
    const lb = b.slice(-1);
    if (!na || !nb) return 0;

    if (la === lb) {
        // same ring: adjacent numbers (wrap 1↔12) are compatible.
        const diff = Math.min(Math.abs(na - nb), 12 - Math.abs(na - nb));
        if (diff === 1) return 0.8;
        if (diff === 2) return 0.4;
        return 0;
    }
    // different ring (relative major/minor): same number is compatible.
    if (na === nb) return 0.7;
    return 0;
}
