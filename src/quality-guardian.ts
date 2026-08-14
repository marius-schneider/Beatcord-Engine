import { PCM_MAX } from "./constants";
import type { TransitionPlan, TransitionType } from "./transition-planner";

export const REALTIME_QUALITY_GUARDIAN_VERSION = 1 as const;

export type RealtimeQualityStatus = "warming" | "healthy" | "warning" | "unsafe";

export interface RealtimeQualitySnapshot {
    version: typeof REALTIME_QUALITY_GUARDIAN_VERSION;
    status: RealtimeQualityStatus;
    windowCapacityFrames: number;
    observedFrames: number;
    observedSampleFrames: number;
    insertedSilenceFrames: number;
    underruns: number;
    lateFrames: number;
    maxDeadlineMissMs: number;
    samplePeakDbfs: number;
    estimatedTruePeakDbtp: number;
    rmsDbfs: number;
    dcOffset: { left: number; right: number };
    stereoCorrelation: number;
    overFullScaleSamples: number;
    nonFiniteSamples: number;
    discontinuities: number;
    issues: string[];
}

export interface GuardedTransitionPlan {
    plan: TransitionPlan;
    rescued: boolean;
    fallbackReason: string | null;
}

const COMPLEX_TRANSITIONS = new Set<TransitionType>([
    "filter",
    "echo",
    "bassdrop",
    "spinback",
    "gate",
    "roll",
    "riser",
    "acapella",
]);

function toDb(value: number): number {
    return value > 0 ? Math.max(-120, 20 * Math.log10(value)) : -120;
}

function finite(value: number): number {
    return Number.isFinite(value) ? value : 0;
}

/**
 * Estimate inter-sample peaks with a three-point quadratic evaluated at 4×.
 * This is intentionally a cheap realtime warning signal, not an ITU-R BS.1770
 * certification meter; offline validation can replace it with a full FIR meter.
 */
function quadraticPeak(previous2: number, previous: number, current: number): number {
    let peak = Math.max(Math.abs(previous), Math.abs(current));
    for (const t of [0.25, 0.5, 0.75]) {
        const a = (previous2 * t * (t - 1)) / 2;
        const b = -previous * (t + 1) * (t - 1);
        const c = (current * (t + 1) * t) / 2;
        peak = Math.max(peak, Math.abs(a + b + c));
    }
    return peak;
}

/**
 * Allocation-free accumulator for the live stereo mix. Samples are inspected
 * before the final limiter/quantizer, so limiter demand and invalid DSP output
 * remain visible instead of being hidden by the s16 boundary.
 */
export class RealtimeQualityGuardian {
    readonly #windowCapacityFrames: number;
    #observedFrames = 0;
    #observedSampleFrames = 0;
    #insertedSilenceFrames = 0;
    #underruns = 0;
    #lateFrames = 0;
    #maxDeadlineMissMs = 0;
    #samplePeak = 0;
    #truePeak = 0;
    #sumSquares = 0;
    #sumLeft = 0;
    #sumRight = 0;
    #sumLeftSquares = 0;
    #sumRightSquares = 0;
    #sumCross = 0;
    #overFullScaleSamples = 0;
    #nonFiniteSamples = 0;
    #discontinuities = 0;
    #historyCount = 0;
    #left2 = 0;
    #left1 = 0;
    #right2 = 0;
    #right1 = 0;

    constructor(windowCapacityFrames = 3_000) {
        this.#windowCapacityFrames = Math.max(25, Math.floor(windowCapacityFrames));
    }

    #rollWindowIfFull(): void {
        if (this.#observedFrames >= this.#windowCapacityFrames) this.reset();
    }

    reset(): void {
        this.#observedFrames = 0;
        this.#observedSampleFrames = 0;
        this.#insertedSilenceFrames = 0;
        this.#underruns = 0;
        this.#lateFrames = 0;
        this.#maxDeadlineMissMs = 0;
        this.#samplePeak = 0;
        this.#truePeak = 0;
        this.#sumSquares = 0;
        this.#sumLeft = 0;
        this.#sumRight = 0;
        this.#sumLeftSquares = 0;
        this.#sumRightSquares = 0;
        this.#sumCross = 0;
        this.#overFullScaleSamples = 0;
        this.#nonFiniteSamples = 0;
        this.#discontinuities = 0;
        this.#historyCount = 0;
        this.#left2 = 0;
        this.#left1 = 0;
        this.#right2 = 0;
        this.#right1 = 0;
    }

    observeFloatFrame(samples: Float32Array, gain = 1, fullScale = PCM_MAX): void {
        if (samples.length % 2 !== 0) throw new Error("QualityGuardian expects interleaved stereo samples");
        this.#rollWindowIfFull();
        const scale = Number.isFinite(fullScale) && fullScale > 0 ? fullScale : PCM_MAX;
        const safeGain = Number.isFinite(gain) ? gain : 1;
        this.#observedFrames++;

        for (let i = 0; i < samples.length; i += 2) {
            const rawLeft = samples[i]! * safeGain;
            const rawRight = samples[i + 1]! * safeGain;
            if (!Number.isFinite(rawLeft)) this.#nonFiniteSamples++;
            if (!Number.isFinite(rawRight)) this.#nonFiniteSamples++;
            const left = finite(rawLeft) / scale;
            const right = finite(rawRight) / scale;
            const absLeft = Math.abs(left);
            const absRight = Math.abs(right);
            this.#samplePeak = Math.max(this.#samplePeak, absLeft, absRight);
            if (absLeft > 1) this.#overFullScaleSamples++;
            if (absRight > 1) this.#overFullScaleSamples++;
            this.#sumSquares += left * left + right * right;
            this.#sumLeft += left;
            this.#sumRight += right;
            this.#sumLeftSquares += left * left;
            this.#sumRightSquares += right * right;
            this.#sumCross += left * right;

            if (
                this.#historyCount > 0 &&
                (Math.abs(left - this.#left1) > 1.9 || Math.abs(right - this.#right1) > 1.9)
            ) {
                this.#discontinuities++;
            }
            if (this.#historyCount > 1) {
                this.#truePeak = Math.max(
                    this.#truePeak,
                    quadraticPeak(this.#left2, this.#left1, left),
                    quadraticPeak(this.#right2, this.#right1, right),
                );
            } else {
                this.#truePeak = Math.max(this.#truePeak, absLeft, absRight);
            }
            this.#left2 = this.#left1;
            this.#left1 = left;
            this.#right2 = this.#right1;
            this.#right1 = right;
            this.#historyCount++;
            this.#observedSampleFrames++;
        }
    }

    noteInsertedSilence(underrun = false): void {
        this.#rollWindowIfFull();
        this.#observedFrames++;
        this.#insertedSilenceFrames++;
        if (underrun) this.#underruns++;
    }

    noteDeadlineMiss(lateByMs: number): void {
        if (!Number.isFinite(lateByMs) || lateByMs <= 0) return;
        this.#rollWindowIfFull();
        this.#maxDeadlineMissMs = Math.max(this.#maxDeadlineMissMs, lateByMs);
        if (lateByMs >= 20) this.#lateFrames++;
    }

    snapshot(): RealtimeQualitySnapshot {
        const sampleCount = this.#observedSampleFrames * 2;
        const dcLeft = this.#observedSampleFrames ? this.#sumLeft / this.#observedSampleFrames : 0;
        const dcRight = this.#observedSampleFrames ? this.#sumRight / this.#observedSampleFrames : 0;
        const denominator = Math.sqrt(this.#sumLeftSquares * this.#sumRightSquares);
        const correlation = denominator > 0 ? Math.max(-1, Math.min(1, this.#sumCross / denominator)) : 0;
        const overRatio = sampleCount ? this.#overFullScaleSamples / sampleCount : 0;
        const discontinuityRatio = this.#observedSampleFrames ? this.#discontinuities / this.#observedSampleFrames : 0;
        const silenceRatio = this.#observedFrames ? this.#insertedSilenceFrames / this.#observedFrames : 0;
        const issues: string[] = [];
        let status: RealtimeQualityStatus = this.#observedFrames < 25 ? "warming" : "healthy";
        const warn = (issue: string) => {
            issues.push(issue);
            if (status === "healthy" || status === "warming") status = "warning";
        };
        const unsafe = (issue: string) => {
            issues.push(issue);
            status = "unsafe";
        };

        if (this.#nonFiniteSamples > 0) unsafe("non-finite-samples");
        if (overRatio > 0.02) unsafe("sustained-pre-limiter-overload");
        else if (overRatio > 0.001) warn("pre-limiter-overload");
        const maxDc = Math.max(Math.abs(dcLeft), Math.abs(dcRight));
        if (maxDc > 0.1) unsafe("dc-offset-critical");
        else if (maxDc > 0.025) warn("dc-offset");
        if (this.#underruns >= 3) unsafe("repeated-buffer-underrun");
        else if (this.#underruns > 0) warn("buffer-underrun");
        if (this.#maxDeadlineMissMs >= 100) unsafe("realtime-deadline-critical");
        else if (this.#lateFrames > 0) warn("realtime-deadline-miss");
        if (this.#observedFrames >= 50 && silenceRatio > 0.5) unsafe("unexpected-silence-critical");
        else if (this.#observedFrames >= 50 && silenceRatio > 0.2) warn("unexpected-silence");
        if (discontinuityRatio > 0.001) warn("signal-discontinuity");

        return {
            version: REALTIME_QUALITY_GUARDIAN_VERSION,
            status,
            windowCapacityFrames: this.#windowCapacityFrames,
            observedFrames: this.#observedFrames,
            observedSampleFrames: this.#observedSampleFrames,
            insertedSilenceFrames: this.#insertedSilenceFrames,
            underruns: this.#underruns,
            lateFrames: this.#lateFrames,
            maxDeadlineMissMs: Number(this.#maxDeadlineMissMs.toFixed(3)),
            samplePeakDbfs: Number(toDb(this.#samplePeak).toFixed(2)),
            estimatedTruePeakDbtp: Number(toDb(this.#truePeak).toFixed(2)),
            rmsDbfs: Number(toDb(sampleCount ? Math.sqrt(this.#sumSquares / sampleCount) : 0).toFixed(2)),
            dcOffset: { left: Number(dcLeft.toFixed(6)), right: Number(dcRight.toFixed(6)) },
            stereoCorrelation: Number(correlation.toFixed(4)),
            overFullScaleSamples: this.#overFullScaleSamples,
            nonFiniteSamples: this.#nonFiniteSamples,
            discontinuities: this.#discontinuities,
            issues,
        };
    }
}

/** Quality Guardian rescue ladder: complex → classic blend → conservative fade. */
export function guardTransitionPlan(
    requested: TransitionPlan,
    quality: RealtimeQualitySnapshot | null | undefined,
): GuardedTransitionPlan {
    if (!quality || quality.status === "warming" || quality.status === "healthy") {
        return { plan: requested, rescued: false, fallbackReason: null };
    }
    if (quality.status === "warning" && !COMPLEX_TRANSITIONS.has(requested.type)) {
        return { plan: requested, rescued: false, fallbackReason: null };
    }
    const unsafe = quality.status === "unsafe";
    const fallbackReason = `Quality Guardian ${quality.status}: ${quality.issues.join(", ") || "runtime risk"}`;
    const plan: TransitionPlan = unsafe
        ? {
              type: "fade",
              fadeSec: Math.min(8, Math.max(4, requested.fadeSec)),
              eqSweep: false,
              tempoRatio: 1,
              reason: `${requested.reason}; rescued to safe fade`,
              ...(requested.regions ? { regions: requested.regions } : {}),
          }
        : {
              type: "blend",
              fadeSec: Math.min(10, Math.max(4, requested.fadeSec)),
              eqSweep: false,
              tempoRatio: 1,
              reason: `${requested.reason}; reduced to classic blend`,
              ...(requested.regions ? { regions: requested.regions } : {}),
          };
    return { plan, rescued: true, fallbackReason };
}
