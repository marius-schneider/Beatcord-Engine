import { expect, test } from "bun:test";
import {
    type AudioQualityReport,
    formatAudioQualityReport,
    parseFfmpegBuildFlags,
    parseFfmpegFilters,
} from "./audio-quality-report";
import { tempoStretchFilter } from "./constants";

test("parseFfmpegBuildFlags extracts enabled libraries", () => {
    const flags = parseFfmpegBuildFlags(`
ffmpeg version 8.1
configuration: --prefix=/opt --enable-libopus --enable-libsoxr --enable-librubberband --disable-debug
`);
    expect(flags).toContain("--enable-libopus");
    expect(flags).toContain("--enable-libsoxr");
    expect(flags).toContain("--enable-librubberband");
});

test("parseFfmpegFilters extracts filter names from ffmpeg -filters output", () => {
    const filters = parseFfmpegFilters(`
 .. loudnorm          A->A       EBU R128 loudness normalization
 T. alimiter          A->A       Audio lookahead limiter.
 TS rubberband        A->A       Apply time-stretching and pitch-shifting.
`);
    expect(filters).toEqual(["alimiter", "loudnorm", "rubberband"]);
});

test("formatAudioQualityReport calls out missing ultra features", () => {
    const report: AudioQualityReport = {
        generatedAt: "2026-06-20T00:00:00.000Z",
        ffmpeg: {
            path: "./bin/ffmpeg",
            runnable: true,
            version: "ffmpeg version 8.1",
            buildFlags: [],
            filters: ["loudnorm", "alimiter"],
            hasLibOpus: true,
            hasLibSoxr: false,
            hasRubberband: false,
            hasLv2: false,
            hasLadspa: false,
            hasLoudnorm: true,
            hasSafetyLimiter: true,
            hasCrossfeed: false,
            hasVirtualBass: false,
            hasSpeechNorm: false,
            hasArnndn: false,
        },
        playback: {
            sampleRate: 48_000,
            channels: 2,
            sampleFormat: "s16le",
            internalMixFormat: "f32-deck-float-accumulator",
            resamplerProfile: "swr",
            resampleFilter: "aresample=48000",
            tempoStretcherProfile: "atempo",
            tempoStretchFilterExample: "atempo=1.0500",
            safetyLimiter: "alimiter=limit=0.97",
            masteringEnabled: true,
            masteringCrossfeed: 0.3,
            masteringBassDb: 0,
            masteringTrebleDb: 0,
        },
        ultraReady: false,
        gaps: ["SoXR resampler unavailable", "Rubberband time-stretch/pitch-shift unavailable"],
        recommendations: ["Build/install FFmpeg with --enable-libsoxr before switching HQ_RESAMPLE to soxr."],
    };
    const text = formatAudioQualityReport(report);
    expect(text).toContain("Ultra ready: no");
    expect(text).toContain("internal mix: f32-deck-float-accumulator");
    expect(text).toContain("SoXR resampler unavailable");
});

test("tempoStretchFilter builds rubberband quality profile", () => {
    const filter = tempoStretchFilter(1.05, "rubberband");
    expect(filter).toContain("rubberband=tempo=1.0500");
    expect(filter).toContain("pitchq=quality");
    expect(filter).toContain("channels=together");
});
