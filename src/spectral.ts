/**
 * Spectral timbre features for audio-based genre/character detection — the signals
 * a DJ implicitly reads to decide how two tracks should mix. Computed from an STFT
 * (reusing the FFT in key.ts), so no extra decode is needed beyond the segment we
 * already decode for beat/key analysis.
 *
 * Features (all averaged across the segment):
 *  - centroid:  spectral "centre of mass" in Hz → perceived BRIGHTNESS. Bright,
 *               synth-heavy EDM sits high; warm hip-hop / acoustic sits low.
 *  - rolloff:   frequency below which 85% of the energy lies → high-frequency
 *               content / "air".
 *  - flatness:  geometric/arithmetic mean ratio [0,1] → NOISINESS vs TONALITY.
 *               Distorted/electronic = flatter; clean acoustic/vocal = peakier.
 *  - flux:      mean frame-to-frame spectral change → how busy/percussive the
 *               texture is.
 */

import { FFT_SIZE, fft, HANN, HOP_SIZE } from "./key";

export interface SpectralFeatures {
    /** Spectral centroid in Hz (brightness). */
    centroid: number;
    /** 85%-energy rolloff frequency in Hz. */
    rolloff: number;
    /** Spectral flatness in [0,1] (1 = noise-like, 0 = pure tone). */
    flatness: number;
    /** Mean spectral flux (rate of spectral change). */
    flux: number;
}

const ROLLOFF_FRACTION = 0.85;

/**
 * Compute averaged spectral features from a mono PCM segment. Shares the FFT_SIZE/
 * HOP_SIZE/Hann window with key detection so frames line up with the chromagram.
 */
export function spectralFeatures(samples: Float32Array, sampleRate: number): SpectralFeatures {
    const re = new Float64Array(FFT_SIZE);
    const im = new Float64Array(FFT_SIZE);
    const half = FFT_SIZE / 2;
    const binHz = sampleRate / FFT_SIZE;

    let centroidSum = 0;
    let rolloffSum = 0;
    let flatnessSum = 0;
    let fluxSum = 0;
    let frames = 0;

    // Previous frame's normalised magnitude spectrum, for spectral flux.
    let prevMag: Float64Array | null = null;
    const mag = new Float64Array(half);

    for (let start = 0; start + FFT_SIZE <= samples.length; start += HOP_SIZE) {
        for (let i = 0; i < FFT_SIZE; i++) {
            re[i] = samples[start + i]! * HANN[i]!;
            im[i] = 0;
        }
        fft(re, im);

        let magSum = 0;
        let weightedSum = 0;
        let logSum = 0;
        let nonZero = 0;
        for (let bin = 1; bin < half; bin++) {
            const m = Math.sqrt(re[bin]! * re[bin]! + im[bin]! * im[bin]!);
            mag[bin] = m;
            magSum += m;
            weightedSum += m * bin * binHz;
            if (m > 1e-9) {
                logSum += Math.log(m);
                nonZero++;
            }
        }
        if (magSum < 1e-9) continue; // silent frame

        // Centroid = energy-weighted mean frequency.
        centroidSum += weightedSum / magSum;

        // Rolloff = frequency below which ROLLOFF_FRACTION of the energy lies.
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

        // Flatness = geometric mean / arithmetic mean of the magnitude spectrum.
        if (nonZero > 0) {
            const geoMean = Math.exp(logSum / nonZero);
            const arithMean = magSum / (half - 1);
            flatnessSum += arithMean > 1e-9 ? geoMean / arithMean : 0;
        }

        // Flux = sum of positive magnitude changes vs the previous frame (L1, on
        // the energy-normalised spectrum so loudness doesn't dominate).
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

        frames++;
    }

    if (frames === 0) return { centroid: 0, rolloff: 0, flatness: 0, flux: 0 };
    return {
        centroid: centroidSum / frames,
        rolloff: rolloffSum / frames,
        flatness: flatnessSum / frames,
        flux: frames > 1 ? fluxSum / (frames - 1) : 0,
    };
}
