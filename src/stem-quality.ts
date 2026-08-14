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

export type StemName = "vocals" | "drums" | "bass" | "other";
export type StemQualityTier = "high" | "medium" | "low";
export type StemMixUse = "acapella" | "rhythm" | "bass-swap" | "instrumental";

export interface StemComponentFeatures {
    rms: number;
    activityDensity: number;
    dynamicRange: number;
    artifactRisk: number;
}

export interface StemSetQualityFeatures {
    components: Record<StemName, StemComponentFeatures>;
    /** Maximum normalized zero-lag correlation between any two stems. */
    bleed: number;
    artifacts: number;
    legacyVocal: StemQualityFeatures;
}

export interface StemComponentQuality {
    score: number;
    presence: number;
    isolation: number;
    artifactRisk: number;
}

export interface StemMixPolicy {
    mode: "mashup" | "eq-assisted" | "full-mix";
    allowedUses: StemMixUse[];
    eqAssist: boolean;
    reason: string;
}

export interface StemQuality {
    score: number;
    tier: StemQualityTier;
    analysisMode: "two-stem" | "four-stem";
    vocals: number;
    drums: number;
    bass: number;
    other: number;
    bleed: number;
    artifacts: number;
    usableForMixing: boolean;
    usableForAcapella: boolean;
    vocalPresence: number;
    vocalDensity: number;
    vocalIsolation: number;
    leakageRisk: number;
    features: StemQualityFeatures;
    components: Record<StemName, StemComponentQuality>;
    policy: StemMixPolicy;
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
    drumsPath?: string;
    bassPath?: string;
    otherPath?: string;
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

function normalizedCorrelation(a: Float32Array, b: Float32Array): number {
    const length = Math.min(a.length, b.length);
    if (!length) return 0;
    let dot = 0;
    let powerA = 0;
    let powerB = 0;
    for (let index = 0; index < length; index++) {
        const left = Number.isFinite(a[index]) ? a[index]! : 0;
        const right = Number.isFinite(b[index]) ? b[index]! : 0;
        dot += left * right;
        powerA += left * left;
        powerB += right * right;
    }
    return clamp(Math.abs(dot) / Math.sqrt(Math.max(EPS, powerA * powerB)), 0, 1);
}

function componentFeatures(samples: Float32Array, sampleRate: number): StemComponentFeatures {
    const level = rms(samples);
    const windows = windowRms(samples, sampleRate);
    const sorted = [...windows].sort((a, b) => a - b);
    const median = percentile(sorted, 0.5);
    const p95 = percentile(sorted, 0.95);
    const threshold = Math.max(0.003, median * 1.3);
    const activityDensity = windows.length ? windows.filter((value) => value >= threshold).length / windows.length : 0;
    let clipped = 0;
    let discontinuities = 0;
    let finite = 0;
    const clickThreshold = Math.max(0.12, level * 8);
    for (let index = 0; index < samples.length; index++) {
        const sample = samples[index]!;
        if (!Number.isFinite(sample)) continue;
        finite++;
        if (Math.abs(sample) >= 0.995) clipped++;
        if (
            index > 0 &&
            Number.isFinite(samples[index - 1]) &&
            Math.abs(sample - samples[index - 1]!) > clickThreshold
        ) {
            discontinuities++;
        }
    }
    const invalidRate = samples.length ? 1 - finite / samples.length : 1;
    const artifactRisk = clamp(
        invalidRate * 4 + (finite ? clipped / finite : 1) * 12 + (finite ? discontinuities / finite : 1) * 18,
        0,
        1,
    );
    return {
        rms: round(level, 6),
        activityDensity: round(activityDensity),
        dynamicRange: round(p95 / Math.max(EPS, median)),
        artifactRisk: round(artifactRisk),
    };
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

export function stemSetQualityFeatures(
    stems: Record<StemName, Float32Array>,
    instrumental: Float32Array,
    sampleRate = DEFAULT_SAMPLE_RATE,
): StemSetQualityFeatures {
    const names: StemName[] = ["vocals", "drums", "bass", "other"];
    const components = Object.fromEntries(
        names.map((name) => [name, componentFeatures(stems[name], sampleRate)]),
    ) as Record<StemName, StemComponentFeatures>;
    let bleed = 0;
    for (let left = 0; left < names.length; left++) {
        for (let right = left + 1; right < names.length; right++) {
            bleed = Math.max(bleed, normalizedCorrelation(stems[names[left]!]!, stems[names[right]!]!));
        }
    }
    const artifacts = names.reduce((sum, name) => sum + components[name].artifactRisk, 0) / Math.max(1, names.length);
    return {
        components,
        bleed: round(bleed),
        artifacts: round(artifacts),
        legacyVocal: stemQualityFeatures(stems.vocals, instrumental, sampleRate),
    };
}

function qualityTier(score: number, bleed: number, artifacts: number): StemQualityTier {
    if (score >= 72 && bleed <= 0.32 && artifacts <= 0.28) return "high";
    if (score >= 50 && bleed <= 0.62 && artifacts <= 0.55) return "medium";
    return "low";
}

function policyFor(tier: StemQualityTier, analysisMode: StemQuality["analysisMode"]): StemMixPolicy {
    if (tier === "high") {
        return {
            mode: "mashup",
            allowedUses:
                analysisMode === "four-stem"
                    ? ["acapella", "rhythm", "bass-swap", "instrumental"]
                    : ["acapella", "instrumental"],
            eqAssist: false,
            reason: `high-quality ${analysisMode} isolation`,
        };
    }
    if (tier === "medium") {
        return {
            mode: "eq-assisted",
            allowedUses: analysisMode === "four-stem" ? ["rhythm", "bass-swap", "instrumental"] : ["instrumental"],
            eqAssist: true,
            reason: "medium stem quality; mask residual bleed with EQ",
        };
    }
    return {
        mode: "full-mix",
        allowedUses: [],
        eqAssist: false,
        reason: "low stem quality; ignore separated sources",
    };
}

function componentQuality(features: StemComponentFeatures, isolation: number): StemComponentQuality {
    const presence = clamp((db(features.rms) + 48) / 36, 0, 1);
    const dynamics = clamp((features.dynamicRange - 1.05) / 2.5, 0, 1);
    const activity = clamp(features.activityDensity / 0.18, 0, 1);
    const score =
        (presence * 0.25 + dynamics * 0.18 + activity * 0.12 + isolation * 0.28 + (1 - features.artifactRisk) * 0.17) *
        100;
    return {
        score: round(score, 1),
        presence: round(presence),
        isolation: round(isolation),
        artifactRisk: features.artifactRisk,
    };
}

export function scoreStemSetQuality(
    features: StemSetQualityFeatures,
    options: Pick<StemQualityOptions, "minScore"> = {},
): StemQuality {
    const isolation = 1 - features.bleed;
    const components = Object.fromEntries(
        (Object.keys(features.components) as StemName[]).map((name) => [
            name,
            componentQuality(features.components[name], isolation),
        ]),
    ) as Record<StemName, StemComponentQuality>;
    const componentMean =
        components.vocals.score * 0.32 +
        components.drums.score * 0.24 +
        components.bass.score * 0.22 +
        components.other.score * 0.22;
    const score = round(componentMean * 0.7 + isolation * 100 * 0.2 + (1 - features.artifacts) * 100 * 0.1, 1);
    let tier = qualityTier(score, features.bleed, features.artifacts);
    if (components.vocals.score < 58 && tier === "high") tier = "medium";
    const policy = policyFor(tier, "four-stem");
    const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
    const usableForAcapella =
        tier === "high" &&
        score >= minScore &&
        components.vocals.score >= 58 &&
        features.legacyVocal.vocalDensity >= 0.08 &&
        features.legacyVocal.vocalDensity <= 0.9;
    const reasons: string[] = [];
    if (features.bleed > 0.32) reasons.push(`cross-stem bleed ${features.bleed.toFixed(2)}`);
    if (features.artifacts > 0.28) reasons.push(`separation artifacts ${features.artifacts.toFixed(2)}`);
    for (const name of Object.keys(components) as StemName[]) {
        if (components[name].score < 50) reasons.push(`weak ${name} stem ${components[name].score.toFixed(0)}`);
    }
    if (!reasons.length) reasons.push("clean four-stem separation");
    return {
        score,
        tier,
        analysisMode: "four-stem",
        vocals: components.vocals.score,
        drums: components.drums.score,
        bass: components.bass.score,
        other: components.other.score,
        bleed: features.bleed,
        artifacts: features.artifacts,
        usableForMixing: tier !== "low",
        usableForAcapella,
        vocalPresence: components.vocals.presence,
        vocalDensity: features.legacyVocal.vocalDensity,
        vocalIsolation: components.vocals.isolation,
        leakageRisk: features.bleed,
        features: features.legacyVocal,
        components,
        policy,
        reasons,
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
    const artifacts = clamp((1 - dynamicScore) * 0.55 + buriedPenalty * 0.25 + densityHighPenalty * 0.2, 0, 1);
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

    const tier = qualityTier(score, leakageRisk, artifacts);
    const instrumentalPresence = clamp((db(features.instrumentalRms) + 48) / 36, 0, 1);
    const instrumentalScore = round(
        (instrumentalPresence * 0.38 + vocalIsolation * 0.35 + (1 - artifacts) * 0.27) * 100,
        1,
    );
    const components: Record<StemName, StemComponentQuality> = {
        vocals: {
            score,
            presence: round(vocalPresence),
            isolation: round(vocalIsolation),
            artifactRisk: round(artifacts),
        },
        drums: {
            score: instrumentalScore,
            presence: round(instrumentalPresence),
            isolation: round(vocalIsolation),
            artifactRisk: round(artifacts),
        },
        bass: {
            score: instrumentalScore,
            presence: round(instrumentalPresence),
            isolation: round(vocalIsolation),
            artifactRisk: round(artifacts),
        },
        other: {
            score: instrumentalScore,
            presence: round(instrumentalPresence),
            isolation: round(vocalIsolation),
            artifactRisk: round(artifacts),
        },
    };
    const usableForAcapella =
        tier === "high" &&
        score >= minScore &&
        vocalPresence >= 0.25 &&
        features.vocalDensity >= 0.08 &&
        features.vocalDensity <= 0.9 &&
        leakageRisk <= 0.68;

    return {
        score,
        tier,
        analysisMode: "two-stem",
        vocals: components.vocals.score,
        drums: components.drums.score,
        bass: components.bass.score,
        other: components.other.score,
        bleed: round(leakageRisk),
        artifacts: round(artifacts),
        usableForMixing: tier !== "low",
        usableForAcapella,
        vocalPresence: round(vocalPresence),
        vocalDensity: features.vocalDensity,
        vocalIsolation: round(vocalIsolation),
        leakageRisk: round(leakageRisk),
        features,
        components,
        policy: policyFor(tier, "two-stem"),
        reasons,
    };
}

export function isStemQualityUsable(quality: StemQuality | null | undefined, minScore = DEFAULT_MIN_SCORE): boolean {
    return !!quality && quality.tier === "high" && quality.usableForAcapella && quality.score >= minScore;
}

export function stemPolicyAllows(quality: StemQuality | null | undefined, use: StemMixUse): boolean {
    return !!quality && quality.usableForMixing && quality.policy.allowedUses.includes(use);
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
    if (options.drumsPath && options.bassPath && options.otherPath) {
        const [drums, bass, other] = await Promise.all([
            decodeMonoF32(options.drumsPath, ffmpegPath, startSec, durationSec, sampleRate),
            decodeMonoF32(options.bassPath, ffmpegPath, startSec, durationSec, sampleRate),
            decodeMonoF32(options.otherPath, ffmpegPath, startSec, durationSec, sampleRate),
        ]);
        return scoreStemSetQuality(
            stemSetQualityFeatures({ vocals, drums, bass, other }, instrumental, sampleRate),
            options,
        );
    }
    return scoreStemQuality(stemQualityFeatures(vocals, instrumental, sampleRate), options);
}
