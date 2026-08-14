import { RealtimeQualityGuardian, type RealtimeQualitySnapshot } from "./quality-guardian";

export const OFFLINE_AUDIO_VALIDATION_VERSION = 1 as const;

export interface OfflineAudioValidationOptions {
    ffmpegPath: string;
    filePath: string;
    expectedDurationSec?: number;
    sampleRate?: number;
}

export interface OfflineAudioValidationResult {
    version: typeof OFFLINE_AUDIO_VALIDATION_VERSION;
    usable: boolean;
    recommendation: "accept" | "accept-with-warning" | "fallback";
    durationSec: number;
    expectedDurationSec: number | null;
    durationErrorMs: number | null;
    quality: RealtimeQualitySnapshot;
    issues: string[];
}

export class OfflineAudioValidationError extends Error {
    readonly validation: OfflineAudioValidationResult;

    constructor(validation: OfflineAudioValidationResult) {
        super(`Rendered transition failed audio validation: ${validation.issues.join(", ")}`);
        this.name = "OfflineAudioValidationError";
        this.validation = validation;
    }
}

export function assessOfflineAudioValidation(
    quality: RealtimeQualitySnapshot,
    durationSec: number,
    expectedDurationSec?: number,
): OfflineAudioValidationResult {
    const issues = new Set(quality.issues);
    let fatal = quality.status === "unsafe";
    const durationErrorMs =
        expectedDurationSec === undefined ? null : Math.abs(durationSec - expectedDurationSec) * 1000;

    if (!Number.isFinite(durationSec) || durationSec <= 0) {
        issues.add("empty-or-invalid-audio");
        fatal = true;
    }
    if (quality.rmsDbfs <= -70) {
        issues.add("unexpected-silence");
        fatal = true;
    }
    if (quality.estimatedTruePeakDbtp > 0.5) {
        issues.add("true-peak-unsafe");
        fatal = true;
    } else if (quality.estimatedTruePeakDbtp > -0.1) {
        issues.add("true-peak-headroom-low");
    }
    if (expectedDurationSec !== undefined) {
        const toleranceMs = Math.max(150, expectedDurationSec * 20);
        if ((durationErrorMs ?? 0) > toleranceMs) {
            issues.add("duration-mismatch");
            fatal = true;
        }
    }

    const issueList = [...issues];
    return {
        version: OFFLINE_AUDIO_VALIDATION_VERSION,
        usable: !fatal,
        recommendation: fatal ? "fallback" : issueList.length ? "accept-with-warning" : "accept",
        durationSec: Number(durationSec.toFixed(4)),
        expectedDurationSec: expectedDurationSec ?? null,
        durationErrorMs: durationErrorMs === null ? null : Number(durationErrorMs.toFixed(2)),
        quality,
        issues: issueList,
    };
}

/** Decode a rendered file to float PCM and validate the exact delivery artifact. */
export async function validateOfflineAudioFile(
    options: OfflineAudioValidationOptions,
): Promise<OfflineAudioValidationResult> {
    const sampleRate = options.sampleRate ?? 48_000;
    const proc = Bun.spawn(
        [
            options.ffmpegPath,
            "-hide_banner",
            "-nostdin",
            "-loglevel",
            "error",
            "-i",
            options.filePath,
            "-map",
            "0:a:0",
            "-f",
            "f32le",
            "-c:a",
            "pcm_f32le",
            "-ar",
            String(sampleRate),
            "-ac",
            "2",
            "pipe:1",
        ],
        { stdout: "pipe", stderr: "pipe" },
    );
    const [pcm, stderr, code] = await Promise.all([
        new Response(proc.stdout).arrayBuffer(),
        new Response(proc.stderr).text(),
        proc.exited,
    ]);
    if (code !== 0) throw new Error(stderr.trim() || `FFmpeg validation decode exited ${code}`);
    if (pcm.byteLength % 8 !== 0) throw new Error("Validation decode returned a partial stereo float sample");

    const samples = new Float32Array(pcm);
    const guardian = new RealtimeQualityGuardian(Number.MAX_SAFE_INTEGER);
    const samplesPerTwentyMs = Math.round(sampleRate * 0.02) * 2;
    for (let offset = 0; offset < samples.length; offset += samplesPerTwentyMs) {
        guardian.observeFloatFrame(
            samples.subarray(offset, Math.min(samples.length, offset + samplesPerTwentyMs)),
            1,
            1,
        );
    }
    const durationSec = samples.length / 2 / sampleRate;
    return assessOfflineAudioValidation(guardian.snapshot(), durationSec, options.expectedDurationSec);
}
