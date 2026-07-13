import { resolve } from "node:path";
import { config } from "./config";
import {
    HQ_RESAMPLE,
    RESAMPLER_PROFILE,
    SAFETY_LIMITER,
    TEMPO_STRETCHER_PROFILE,
    tempoStretchFilter,
} from "./constants";

export interface FfmpegCapabilities {
    path: string;
    runnable: boolean;
    version: string | null;
    buildFlags: string[];
    filters: string[];
    hasLibOpus: boolean;
    hasLibSoxr: boolean;
    hasRubberband: boolean;
    hasLv2: boolean;
    hasLadspa: boolean;
    hasLoudnorm: boolean;
    hasSafetyLimiter: boolean;
    hasCrossfeed: boolean;
    hasVirtualBass: boolean;
    hasSpeechNorm: boolean;
    hasArnndn: boolean;
}

export interface AudioQualityReport {
    generatedAt: string;
    ffmpeg: FfmpegCapabilities;
    playback: {
        sampleRate: number;
        channels: number;
        sampleFormat: "s16le";
        internalMixFormat: "f32-deck-float-accumulator";
        resamplerProfile: "swr" | "soxr";
        resampleFilter: string;
        tempoStretcherProfile: "atempo" | "rubberband";
        tempoStretchFilterExample: string;
        safetyLimiter: string;
        masteringEnabled: boolean;
        masteringCrossfeed: number;
        masteringBassDb: number;
        masteringTrebleDb: number;
    };
    ultraReady: boolean;
    gaps: string[];
    recommendations: string[];
}

interface CommandResult {
    ok: boolean;
    stdout: string;
    stderr: string;
}

const ffmpegPath = resolve(process.cwd(), config.FFMPEG_PATH);

async function run(args: string[]): Promise<CommandResult> {
    try {
        const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
        const [stdout, stderr, code] = await Promise.all([
            new Response(proc.stdout).text(),
            new Response(proc.stderr).text(),
            proc.exited,
        ]);
        return { ok: code === 0, stdout, stderr };
    } catch (err) {
        return { ok: false, stdout: "", stderr: (err as Error).message };
    }
}

export function parseFfmpegBuildFlags(text: string): string[] {
    const flags = new Set<string>();
    for (const match of text.matchAll(/--[a-z0-9][a-z0-9-]*(?:=(?:"[^"]+"|'[^']+'|\S+))?/gi)) {
        flags.add(match[0]!);
    }
    return [...flags].sort();
}

export function parseFfmpegFilters(text: string): string[] {
    const filters = new Set<string>();
    for (const line of text.split("\n")) {
        const match = line.match(/^\s*[A-Z.]{2,3}\s+([A-Za-z0-9_]+)\s+/);
        if (match?.[1]) filters.add(match[1]);
    }
    return [...filters].sort();
}

function hasFlag(flags: string[], name: string): boolean {
    return flags.some((flag) => flag === `--enable-${name}` || flag.startsWith(`--enable-${name}=`));
}

function hasFilter(filters: string[], name: string): boolean {
    return filters.includes(name);
}

export async function detectFfmpegCapabilities(path = ffmpegPath): Promise<FfmpegCapabilities> {
    const version = await run([path, "-hide_banner", "-version"]);
    if (!version.ok) {
        return {
            path,
            runnable: false,
            version: null,
            buildFlags: [],
            filters: [],
            hasLibOpus: false,
            hasLibSoxr: false,
            hasRubberband: false,
            hasLv2: false,
            hasLadspa: false,
            hasLoudnorm: false,
            hasSafetyLimiter: false,
            hasCrossfeed: false,
            hasVirtualBass: false,
            hasSpeechNorm: false,
            hasArnndn: false,
        };
    }

    const filterList = await run([path, "-hide_banner", "-filters"]);
    const versionText = `${version.stdout}\n${version.stderr}`;
    const filtersText = `${filterList.stdout}\n${filterList.stderr}`;
    const buildFlags = parseFfmpegBuildFlags(versionText);
    const filters = parseFfmpegFilters(filtersText);
    const firstLine =
        versionText
            .split("\n")
            .find((line) => line.trim().startsWith("ffmpeg version"))
            ?.trim() ?? null;

    return {
        path,
        runnable: true,
        version: firstLine,
        buildFlags,
        filters,
        hasLibOpus: hasFlag(buildFlags, "libopus"),
        hasLibSoxr: hasFlag(buildFlags, "libsoxr"),
        hasRubberband: hasFilter(filters, "rubberband") || hasFlag(buildFlags, "librubberband"),
        hasLv2: hasFilter(filters, "lv2") || hasFlag(buildFlags, "lv2"),
        hasLadspa: hasFilter(filters, "ladspa") || hasFlag(buildFlags, "ladspa"),
        hasLoudnorm: hasFilter(filters, "loudnorm"),
        hasSafetyLimiter: hasFilter(filters, "alimiter"),
        hasCrossfeed: hasFilter(filters, "crossfeed"),
        hasVirtualBass: hasFilter(filters, "virtualbass"),
        hasSpeechNorm: hasFilter(filters, "speechnorm"),
        hasArnndn: hasFilter(filters, "arnndn"),
    };
}

export async function buildAudioQualityReport(path = ffmpegPath): Promise<AudioQualityReport> {
    const ffmpeg = await detectFfmpegCapabilities(path);
    const gaps: string[] = [];
    const recommendations: string[] = [];

    if (!ffmpeg.runnable) {
        gaps.push("ffmpeg is not runnable");
        recommendations.push("Set FFMPEG_PATH to a working ffmpeg binary.");
    } else {
        if (!ffmpeg.hasLibOpus) {
            gaps.push("FFmpeg was not built with libopus");
            recommendations.push("Use an ffmpeg build with --enable-libopus for best Opus tooling compatibility.");
        }
        if (!ffmpeg.hasLibSoxr) {
            gaps.push("SoXR resampler unavailable");
            recommendations.push("Build/install FFmpeg with --enable-libsoxr before switching HQ_RESAMPLE to soxr.");
            if (RESAMPLER_PROFILE === "soxr") {
                gaps.push("Configured FFMPEG_RESAMPLER=soxr cannot run on this FFmpeg build");
                recommendations.push("Set FFMPEG_RESAMPLER=swr or run `bun run setup:ffmpeg-ultra`.");
            }
        }
        if (!ffmpeg.hasRubberband) {
            gaps.push("Rubberband time-stretch/pitch-shift unavailable");
            recommendations.push(
                "Build/install FFmpeg with --enable-librubberband for high-quality tempo/key changes.",
            );
            if (TEMPO_STRETCHER_PROFILE === "rubberband") {
                gaps.push("Configured FFMPEG_TEMPO_STRETCHER=rubberband cannot run on this FFmpeg build");
                recommendations.push("Set FFMPEG_TEMPO_STRETCHER=atempo or run `bun run setup:ffmpeg-ultra`.");
            }
        }
        if (!ffmpeg.hasLv2 || !ffmpeg.hasLadspa) {
            gaps.push(
                !ffmpeg.hasLv2 && !ffmpeg.hasLadspa
                    ? "No LV2/LADSPA plugin host support"
                    : `${!ffmpeg.hasLv2 ? "LV2" : "LADSPA"} plugin host support unavailable`,
            );
            recommendations.push(
                "Build/install FFmpeg with --enable-lv2 and --enable-ladspa for offline mastering/plugin experiments.",
            );
        }
        if (!ffmpeg.hasLoudnorm) gaps.push("loudnorm filter unavailable");
        if (!ffmpeg.hasSafetyLimiter) gaps.push("alimiter safety limiter unavailable");
        if (!ffmpeg.hasCrossfeed) gaps.push("crossfeed filter unavailable");
    }

    const ultraReady = ffmpeg.runnable && ffmpeg.hasLibOpus && ffmpeg.hasLibSoxr && ffmpeg.hasRubberband;
    if (ultraReady) {
        if (RESAMPLER_PROFILE === "soxr" && TEMPO_STRETCHER_PROFILE === "rubberband") {
            recommendations.push(
                ffmpeg.hasLv2 && ffmpeg.hasLadspa
                    ? config.AUTOMIX_OFFLINE_RENDER
                        ? config.AUTOMIX_TELEMETRY_ENABLED
                            ? config.AUTOMIX_FEEDBACK_ENABLED
                                ? "Ultra playback filters, plugin hosts, Automix offline-render prefetch, telemetry, feedback-biased candidate scoring, phrase/cue selection, stem-quality gating, early-skip listener feedback, vocal-conflict detection, segment-level vocal density, f32 deck decode and float live mix accumulation are active; next step is drum/bass/other stem lanes."
                                : "Ultra playback filters, plugin hosts, Automix offline-render prefetch and transition telemetry are active; set AUTOMIX_FEEDBACK_ENABLED=true for telemetry-biased candidate scoring."
                            : "Ultra playback filters, plugin hosts and Automix offline-render prefetch are active; set AUTOMIX_TELEMETRY_ENABLED=true for transition scoring."
                        : "Ultra playback filters, plugin hosts and offline render primitives are active; set AUTOMIX_OFFLINE_RENDER=true for Automix prefetch integration."
                    : "Ultra playback filters are active; next step is the A/B transition render harness.",
            );
        } else {
            recommendations.push(
                "FFmpeg Ultra prerequisites are present; next step is enabling/A-B testing soxr vs swr and rubberband vs atempo.",
            );
        }
    }

    return {
        generatedAt: new Date().toISOString(),
        ffmpeg,
        playback: {
            sampleRate: 48_000,
            channels: 2,
            sampleFormat: "s16le",
            internalMixFormat: "f32-deck-float-accumulator",
            resamplerProfile: RESAMPLER_PROFILE,
            resampleFilter: HQ_RESAMPLE,
            tempoStretcherProfile: TEMPO_STRETCHER_PROFILE,
            tempoStretchFilterExample: tempoStretchFilter(1.05) ?? "none",
            safetyLimiter: SAFETY_LIMITER,
            masteringEnabled: config.MASTERING_ENABLED,
            masteringCrossfeed: config.MASTERING_CROSSFEED,
            masteringBassDb: config.MASTERING_BASS,
            masteringTrebleDb: config.MASTERING_TREBLE,
        },
        ultraReady,
        gaps,
        recommendations,
    };
}

export function formatAudioQualityReport(report: AudioQualityReport): string {
    const yes = "yes";
    const no = "no";
    const ff = report.ffmpeg;
    const lines = [
        "Beatcord Audio Quality Report",
        "",
        `FFmpeg: ${ff.runnable ? (ff.version ?? ff.path) : "not runnable"}`,
        `Path: ${ff.path}`,
        "",
        "Capabilities:",
        `- libopus: ${ff.hasLibOpus ? yes : no}`,
        `- libsoxr: ${ff.hasLibSoxr ? yes : no}`,
        `- rubberband: ${ff.hasRubberband ? yes : no}`,
        `- LV2: ${ff.hasLv2 ? yes : no}`,
        `- LADSPA: ${ff.hasLadspa ? yes : no}`,
        `- loudnorm: ${ff.hasLoudnorm ? yes : no}`,
        `- alimiter: ${ff.hasSafetyLimiter ? yes : no}`,
        `- crossfeed: ${ff.hasCrossfeed ? yes : no}`,
        `- virtualbass: ${ff.hasVirtualBass ? yes : no}`,
        `- speechnorm: ${ff.hasSpeechNorm ? yes : no}`,
        "",
        "Playback:",
        `- ${report.playback.sampleRate} Hz, ${report.playback.channels} channels, ${report.playback.sampleFormat}`,
        `- internal mix: ${report.playback.internalMixFormat}`,
        `- resampler profile: ${report.playback.resamplerProfile}`,
        `- resample: ${report.playback.resampleFilter}`,
        `- tempo stretcher: ${report.playback.tempoStretcherProfile}`,
        `- tempo example: ${report.playback.tempoStretchFilterExample}`,
        `- limiter: ${report.playback.safetyLimiter}`,
        `- mastering: ${report.playback.masteringEnabled ? "enabled" : "disabled"}`,
        "",
        `Ultra ready: ${report.ultraReady ? yes : no}`,
    ];

    if (report.gaps.length) {
        lines.push("", "Gaps:", ...report.gaps.map((gap) => `- ${gap}`));
    }
    if (report.recommendations.length) {
        lines.push("", "Recommendations:", ...report.recommendations.map((rec) => `- ${rec}`));
    }
    return lines.join("\n");
}
