/** Shared PCM/Opus audio format constants for the voice pipeline. */
import { config } from "./config";

/** Discord voice sample rate. */
export const SAMPLE_RATE = 48_000;
/** Stereo. */
export const CHANNELS = 2;
export const BYTES_PER_SAMPLE = 2; // s16
export const FLOAT_BYTES_PER_SAMPLE = 4; // f32
/** Bytes for one stereo sample-frame (L+R). */
export const SAMPLE_FRAME_BYTES = CHANNELS * BYTES_PER_SAMPLE; // 4
/** Bytes for one stereo float sample-frame (L+R). */
export const FLOAT_SAMPLE_FRAME_BYTES = CHANNELS * FLOAT_BYTES_PER_SAMPLE; // 8

/** Discord audio frame length. */
export const FRAME_MS = 20;
/** Samples per channel in one 20ms frame. */
export const SAMPLES_PER_FRAME = (SAMPLE_RATE * FRAME_MS) / 1000; // 960
/** Bytes for one 20ms Discord frame (stereo s16). */
export const DISCORD_FRAME_BYTES = SAMPLES_PER_FRAME * SAMPLE_FRAME_BYTES; // 3840
/** Bytes for one 20ms internal float frame (stereo f32). */
export const FLOAT_FRAME_BYTES = SAMPLES_PER_FRAME * FLOAT_SAMPLE_FRAME_BYTES; // 7680

export const PCM_MAX = 32767;
export const PCM_MIN = -32768;

/**
 * Shared ffmpeg resample filter for the 48kHz/stereo/s16le PCM the voice pipeline
 * consumes. Four deliberate anti-crackle / quality choices:
 *
 *  - high-quality resampling for any source that is not already 48kHz, instead
 *    of ffmpeg's coarse default. `swr` stays the portable default; `soxr` is the
 *    Ultra profile used by the local custom FFmpeg build.
 *  - `dither_method=triangular_hp` so the float→s16 quantization noise is shaped
 *    instead of correlating with the signal (audible as faint fizz on quiet
 *    passages / fades).
 *  - `async=1:first_pts=0` keeps the timeline gapless so no samples are dropped
 *    or duplicated mid-stream — a classic source of periodic clicks.
 *
 * Exported so every decode path (file resource + mix decks) produces identical,
 * well-conditioned PCM.
 */
export type ResamplerProfile = "swr" | "soxr";
export const RESAMPLER_PROFILE: ResamplerProfile = config.FFMPEG_RESAMPLER;
export type TempoStretcherProfile = "atempo" | "rubberband";
export const TEMPO_STRETCHER_PROFILE: TempoStretcherProfile = config.FFMPEG_TEMPO_STRETCHER;

export interface RubberbandTuning {
    transients: "crisp" | "mixed" | "smooth";
    detector: "compound" | "percussive" | "soft";
    phase: "laminar" | "independent";
    window: "standard" | "short" | "long";
    smoothing: "off" | "on";
    formant: "shifted" | "preserved";
    pitchQuality: "quality" | "speed";
    channels: "apart" | "together";
}

export const DEFAULT_RUBBERBAND_TUNING: RubberbandTuning = {
    transients: "crisp",
    detector: "compound",
    phase: "laminar",
    window: "standard",
    smoothing: "off",
    formant: "preserved",
    pitchQuality: "quality",
    channels: "together",
};

export const SWR_RESAMPLE = `aresample=${SAMPLE_RATE}:resampler=swr:filter_size=256:async=1:first_pts=0:dither_method=triangular_hp`;
export const SOXR_RESAMPLE = `aresample=${SAMPLE_RATE}:resampler=soxr:precision=33:cheby=1:async=1:first_pts=0:dither_method=triangular_hp`;
export const HQ_RESAMPLE = RESAMPLER_PROFILE === "soxr" ? SOXR_RESAMPLE : SWR_RESAMPLE;

export function tempoStretchFilter(
    tempoRatio: number,
    profile: TempoStretcherProfile = TEMPO_STRETCHER_PROFILE,
    tuning: RubberbandTuning = DEFAULT_RUBBERBAND_TUNING,
): string | null {
    if (!Number.isFinite(tempoRatio) || Math.abs(tempoRatio - 1) < 0.0001) return null;
    const tempo = tempoRatio.toFixed(4);
    if (profile === "rubberband") {
        const parts = [
            `rubberband=tempo=${tempo}`,
            "pitch=1",
            `transients=${tuning.transients}`,
            `detector=${tuning.detector}`,
            `phase=${tuning.phase}`,
            `window=${tuning.window}`,
            `smoothing=${tuning.smoothing}`,
            `formant=${tuning.formant}`,
            `pitchq=${tuning.pitchQuality}`,
            `channels=${tuning.channels}`,
        ];
        // R3 ("finer") only when explicitly enabled — the option exists only on
        // patched ffmpeg builds; sending it to a stock build errors the filter.
        if (config.FFMPEG_RUBBERBAND_ENGINE === "finer") parts.push("engine=finer");
        return parts.join(":");
    }
    return `atempo=${tempo}`;
}

/**
 * A gentle lookahead limiter applied to the final mix. It catches the inter-track
 * summation peaks (and loud masters) just below full-scale so they never hit the
 * hard s16 clamp — hard clipping is itself an audible crackle/buzz. `level=false`
 * means it only limits peaks, it does not make everything louder.
 */
export const SAFETY_LIMITER = "alimiter=limit=0.97:level=false:attack=5:release=50";
