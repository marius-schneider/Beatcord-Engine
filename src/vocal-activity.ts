import { dirname, resolve } from "node:path";

import { config } from "./config";

export interface VocalActivitySegment {
    startSec: number;
    endSec: number;
    rms: number;
    peakRms: number;
    density: number;
    active: boolean;
}

export interface VocalActivityProfile {
    startSec: number;
    durationSec: number;
    sampleRate: number;
    windowMs: number;
    segmentSec: number;
    activityThreshold: number;
    averageDensity: number;
    peakDensity: number;
    firstActiveSec: number | null;
    lastActiveSec: number | null;
    segments: VocalActivitySegment[];
}

export interface VocalActivityWindow {
    startSec: number;
    endSec: number;
    density: number;
    peakDensity: number;
    rms: number;
    coverage: number;
    hasData: boolean;
}

export interface VocalActivityProfileOptions {
    startSec?: number | undefined;
    segmentSec?: number | undefined;
    windowMs?: number | undefined;
    activeDensity?: number | undefined;
}

export interface AnalyzeVocalActivityProfileOptions extends VocalActivityProfileOptions {
    vocalsPath: string;
    ffmpegPath?: string | undefined;
    durationSec?: number | undefined;
    sampleRate?: number | undefined;
}

const DEFAULT_SAMPLE_RATE = 22_050;
const DEFAULT_DURATION_SEC = 180;
const DEFAULT_SEGMENT_SEC = 4;
const DEFAULT_WINDOW_MS = 80;
const DEFAULT_ACTIVE_DENSITY = 0.14;
const EPS = 1e-9;

interface RmsWindow {
    startSec: number;
    endSec: number;
    rms: number;
}

function clamp(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, n));
}

function round(n: number, digits = 3): number {
    const f = 10 ** digits;
    return Math.round(n * f) / f;
}

function percentile(sorted: number[], p: number): number {
    if (!sorted.length) return 0;
    const idx = clamp(Math.floor((sorted.length - 1) * p), 0, sorted.length - 1);
    return sorted[idx] ?? 0;
}

function rmsWindows(samples: Float32Array, sampleRate: number, startSec: number, windowMs: number): RmsWindow[] {
    const win = Math.max(1, Math.floor((sampleRate * windowMs) / 1000));
    const out: RmsWindow[] = [];
    for (let i = 0; i + win <= samples.length; i += win) {
        let sum = 0;
        for (let j = i; j < i + win; j++) sum += samples[j]! * samples[j]!;
        const localStart = i / sampleRate;
        out.push({
            startSec: startSec + localStart,
            endSec: startSec + (i + win) / sampleRate,
            rms: Math.sqrt(sum / win),
        });
    }
    return out;
}

function segmentRms(windows: RmsWindow[]): number {
    if (!windows.length) return 0;
    let sum = 0;
    for (const w of windows) sum += w.rms * w.rms;
    return Math.sqrt(sum / windows.length);
}

export function buildVocalActivityProfile(
    vocals: Float32Array,
    sampleRate = DEFAULT_SAMPLE_RATE,
    options: VocalActivityProfileOptions = {},
): VocalActivityProfile {
    const startSec = options.startSec ?? 0;
    const segmentSec = Math.max(1, options.segmentSec ?? DEFAULT_SEGMENT_SEC);
    const windowMs = Math.max(20, options.windowMs ?? DEFAULT_WINDOW_MS);
    const activeDensity = clamp(options.activeDensity ?? DEFAULT_ACTIVE_DENSITY, 0, 1);
    const durationSec = vocals.length / sampleRate;
    const windows = rmsWindows(vocals, sampleRate, startSec, windowMs);
    const sortedRms = windows.map((w) => w.rms).sort((a, b) => a - b);
    const p10 = percentile(sortedRms, 0.1);
    const median = percentile(sortedRms, 0.5);
    const activityThreshold = Math.max(0.004, p10 * 2.5, median * 1.3);
    const segments: VocalActivitySegment[] = [];
    const segmentCount = Math.max(1, Math.ceil(durationSec / segmentSec));

    for (let i = 0; i < segmentCount; i++) {
        const segStart = startSec + i * segmentSec;
        const segEnd = Math.min(startSec + durationSec, segStart + segmentSec);
        const bucket = windows.filter((w) => w.startSec < segEnd && w.endSec > segStart);
        const activeCount = bucket.filter((w) => w.rms >= activityThreshold).length;
        const density = bucket.length ? activeCount / bucket.length : 0;
        const peakRms = bucket.reduce((peak, w) => Math.max(peak, w.rms), 0);
        segments.push({
            startSec: round(segStart),
            endSec: round(segEnd),
            rms: round(segmentRms(bucket), 6),
            peakRms: round(peakRms, 6),
            density: round(density),
            active: density >= activeDensity,
        });
    }

    const weighted = segments.reduce((sum, s) => sum + s.density * Math.max(0, s.endSec - s.startSec), 0);
    const total = segments.reduce((sum, s) => sum + Math.max(0, s.endSec - s.startSec), 0);
    const active = segments.filter((s) => s.active);

    return {
        startSec: round(startSec),
        durationSec: round(durationSec),
        sampleRate,
        windowMs,
        segmentSec,
        activityThreshold: round(activityThreshold, 6),
        averageDensity: round(total ? weighted / total : 0),
        peakDensity: round(segments.reduce((peak, s) => Math.max(peak, s.density), 0)),
        firstActiveSec: active[0]?.startSec ?? null,
        lastActiveSec: active.at(-1)?.endSec ?? null,
        segments,
    };
}

export function vocalActivityInWindow(
    profile: VocalActivityProfile | null | undefined,
    startSec: number,
    durationSec: number,
): VocalActivityWindow {
    const start = Math.max(0, startSec);
    const end = Math.max(start, start + Math.max(0.001, durationSec));
    if (!profile?.segments.length) {
        return {
            startSec: round(start),
            endSec: round(end),
            density: 0,
            peakDensity: 0,
            rms: 0,
            coverage: 0,
            hasData: false,
        };
    }

    let covered = 0;
    let density = 0;
    let rmsEnergy = 0;
    let peakDensity = 0;
    for (const segment of profile.segments) {
        const overlap = Math.min(end, segment.endSec) - Math.max(start, segment.startSec);
        if (overlap <= 0) continue;
        covered += overlap;
        density += segment.density * overlap;
        rmsEnergy += segment.rms * segment.rms * overlap;
        peakDensity = Math.max(peakDensity, segment.density);
    }

    const requested = end - start;
    return {
        startSec: round(start),
        endSec: round(end),
        density: round(covered ? density / covered : 0),
        peakDensity: round(peakDensity),
        rms: round(covered ? Math.sqrt(rmsEnergy / Math.max(EPS, covered)) : 0, 6),
        coverage: round(clamp(covered / requested, 0, 1)),
        hasData: covered > 0,
    };
}

async function decodeMonoF32(
    inputPath: string,
    ffmpegPath: string,
    startSec: number,
    durationSec: number,
    sampleRate: number,
): Promise<Float32Array> {
    const proc = Bun.spawn(
        [
            ffmpegPath,
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            String(startSec),
            "-t",
            String(durationSec),
            "-i",
            inputPath,
            "-ac",
            "1",
            "-ar",
            String(sampleRate),
            "-f",
            "f32le",
            "pipe:1",
        ],
        { stdout: "pipe", stderr: "pipe" },
    );
    const [stdout, stderr, code] = await Promise.all([
        new Response(proc.stdout).arrayBuffer(),
        new Response(proc.stderr).text(),
        proc.exited,
    ]);
    if (code !== 0) {
        const stem = inputPath.replace(`${dirname(inputPath)}/`, "");
        throw new Error(`ffmpeg vocal activity decode failed for ${stem}: ${stderr.trim() || `exit ${code}`}`);
    }
    return new Float32Array(stdout.slice(0, stdout.byteLength - (stdout.byteLength % 4)));
}

export async function analyzeVocalActivityProfile(
    options: AnalyzeVocalActivityProfileOptions,
): Promise<VocalActivityProfile> {
    const ffmpegPath = resolve(process.cwd(), options.ffmpegPath ?? config.FFMPEG_PATH);
    const startSec = options.startSec ?? 0;
    const durationSec = options.durationSec ?? DEFAULT_DURATION_SEC;
    const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
    const vocals = await decodeMonoF32(options.vocalsPath, ffmpegPath, startSec, durationSec, sampleRate);
    return buildVocalActivityProfile(vocals, sampleRate, options);
}
