import { dirname, resolve } from "node:path";

import { config } from "./config";

export interface StemQualityFeatures {
    /** RMS of the isolated vocal stem over the analysed window. */
    vocalRms: number;
    /** RMS of the instrumental/no-vocals stem over the same window. */
    instrumentalRms: number;
    /** Fraction of short windows with meaningful vocal activity. */
    vocalDensity: number;
    /** p95 / median window RMS. Higher means the vocal stem has speech/singing-like dynamics. */
    vocalDynamicRange: number;
    /** Vocal stem level relative to the instrumental stem. */
    vocalToInstrumentalDb: number;
}

export interface StemQuality {
    score: number;
    usableForAcapella: boolean;
    vocalPresence: number;
    vocalDensity: number;
    vocalIsolation: number;
    leakageRisk: number;
    features: StemQualityFeatures;
    reasons: string[];
}

export interface StemQualityOptions {
    ffmpegPath?: string;
    startSec?: number;
    durationSec?: number;
    sampleRate?: number;
    minScore?: number;
}

export interface AnalyzeStemQualityOptions extends StemQualityOptions {
    vocalsPath: string;
    instrumentalPath: string;
}

const DEFAULT_SAMPLE_RATE = 22_050;
const DEFAULT_START_SEC = 20;
const DEFAULT_DURATION_SEC = 60;
const DEFAULT_MIN_SCORE = 58;
const EPS = 1e-9;

function clamp(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, n));
}

function round(n: number, digits = 3): number {
    const f = 10 ** digits;
    return Math.round(n * f) / f;
}

function db(ratio: number): number {
    return 20 * Math.log10(Math.max(EPS, ratio));
}

function percentile(sorted: number[], p: number): number {
    if (!sorted.length) return 0;
    const idx = clamp(Math.floor((sorted.length - 1) * p), 0, sorted.length - 1);
    return sorted[idx] ?? 0;
}

function rms(samples: Float32Array): number {
    if (!samples.length) return 0;
    let sum = 0;
    for (const s of samples) sum += s * s;
    return Math.sqrt(sum / samples.length);
}

function windowRms(samples: Float32Array, sampleRate: number, windowMs = 80): number[] {
    const win = Math.max(1, Math.floor((sampleRate * windowMs) / 1000));
    const out: number[] = [];
    for (let i = 0; i + win <= samples.length; i += win) {
        let sum = 0;
        for (let j = i; j < i + win; j++) sum += samples[j]! * samples[j]!;
        out.push(Math.sqrt(sum / win));
    }
    return out;
}

export function stemQualityFeatures(
    vocals: Float32Array,
    instrumental: Float32Array,
    sampleRate = DEFAULT_SAMPLE_RATE,
): StemQualityFeatures {
    const vocalRms = rms(vocals);
    const instrumentalRms = rms(instrumental);
    const windows = windowRms(vocals, sampleRate);
    const sorted = [...windows].sort((a, b) => a - b);
    const p10 = percentile(sorted, 0.1);
    const median = percentile(sorted, 0.5);
    const p95 = percentile(sorted, 0.95);
    const activityThreshold = Math.max(0.004, p10 * 2.5, median * 1.25);
    const vocalDensity = windows.length ? windows.filter((w) => w >= activityThreshold).length / windows.length : 0;
    const vocalDynamicRange = p95 / Math.max(EPS, median);

    return {
        vocalRms: round(vocalRms, 6),
        instrumentalRms: round(instrumentalRms, 6),
        vocalDensity: round(vocalDensity),
        vocalDynamicRange: round(vocalDynamicRange),
        vocalToInstrumentalDb: round(db(vocalRms / Math.max(EPS, instrumentalRms)), 1),
    };
}

export function scoreStemQuality(
    features: StemQualityFeatures,
    options: Pick<StemQualityOptions, "minScore"> = {},
): StemQuality {
    const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
    const vocalPresence = clamp((db(features.vocalRms) + 42) / 24, 0, 1);
    const densityLow = clamp(features.vocalDensity / 0.12, 0, 1);
    const densityHighPenalty = clamp((features.vocalDensity - 0.82) / 0.18, 0, 1);
    const vocalDensityScore = densityLow * (1 - densityHighPenalty * 0.6);
    const dynamicScore = clamp((features.vocalDynamicRange - 1.2) / 2.4, 0, 1);
    const buriedPenalty = clamp((-18 - features.vocalToInstrumentalDb) / 18, 0, 1);
    const leakageRisk = clamp(densityHighPenalty * 0.55 + (1 - dynamicScore) * 0.3 + buriedPenalty * 0.15, 0, 1);
    const vocalIsolation = 1 - leakageRisk;
    const score = round(
        (vocalPresence * 0.34 + vocalDensityScore * 0.25 + dynamicScore * 0.19 + vocalIsolation * 0.22) * 100,
        1,
    );

    const reasons: string[] = [];
    if (vocalPresence < 0.25) reasons.push("weak vocal stem");
    if (features.vocalDensity < 0.08) reasons.push("too little vocal activity");
    if (features.vocalDensity > 0.88) reasons.push("vocal stem is too dense, likely bleed");
    if (features.vocalDynamicRange < 1.35) reasons.push("low vocal dynamics");
    if (features.vocalToInstrumentalDb < -18) reasons.push("vocals buried below instrumental");
    if (!reasons.length) reasons.push("usable vocal isolation");

    return {
        score,
        usableForAcapella:
            score >= minScore &&
            vocalPresence >= 0.25 &&
            features.vocalDensity >= 0.08 &&
            features.vocalDensity <= 0.9 &&
            leakageRisk <= 0.68,
        vocalPresence: round(vocalPresence),
        vocalDensity: features.vocalDensity,
        vocalIsolation: round(vocalIsolation),
        leakageRisk: round(leakageRisk),
        features,
        reasons,
    };
}

export function isStemQualityUsable(quality: StemQuality | null | undefined, minScore = DEFAULT_MIN_SCORE): boolean {
    return !!quality && quality.usableForAcapella && quality.score >= minScore;
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
        throw new Error(`ffmpeg stem decode failed for ${stem}: ${stderr.trim() || `exit ${code}`}`);
    }
    return new Float32Array(stdout.slice(0, stdout.byteLength - (stdout.byteLength % 4)));
}

export async function analyzeStemQuality(options: AnalyzeStemQualityOptions): Promise<StemQuality> {
    const ffmpegPath = resolve(process.cwd(), options.ffmpegPath ?? config.FFMPEG_PATH);
    const startSec = options.startSec ?? DEFAULT_START_SEC;
    const durationSec = options.durationSec ?? DEFAULT_DURATION_SEC;
    const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
    const [vocals, instrumental] = await Promise.all([
        decodeMonoF32(options.vocalsPath, ffmpegPath, startSec, durationSec, sampleRate),
        decodeMonoF32(options.instrumentalPath, ffmpegPath, startSec, durationSec, sampleRate),
    ]);
    return scoreStemQuality(stemQualityFeatures(vocals, instrumental, sampleRate), options);
}
