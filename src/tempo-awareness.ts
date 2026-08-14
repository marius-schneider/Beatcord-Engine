import type { BeatGrid } from "./beatgrid";

export type TempoRelation =
    | "same-pulse"
    | "half-time"
    | "double-time"
    | "three-over-two"
    | "two-over-three"
    | "unrelated";

export interface TempoEvidenceContext {
    confidence?: number;
    agreement?: number;
    percussiveness?: number;
}

export interface TempoRelationshipOptions {
    tolerance?: number;
    current?: TempoEvidenceContext;
    next?: TempoEvidenceContext;
}

/** Auditable metrical hypothesis between the outgoing and incoming pulse. */
export interface TempoRelationshipAssessment {
    relation: TempoRelation;
    label: string;
    currentBpm: number | null;
    nextBpm: number | null;
    /** Multiplier applied to the incoming BPM to compare equivalent pulse levels. */
    nextMultiplier: number;
    alignedNextBpm: number | null;
    /** Small physical stretch after metrical folding; never contains the 2×/1.5× fold itself. */
    stretchRatio: number;
    effectiveGap: number;
    plausibility: number;
    compatible: boolean;
    reasons: string[];
}

interface Hypothesis {
    relation: Exclude<TempoRelation, "unrelated">;
    label: string;
    multiplier: number;
    prior: number;
}

const HYPOTHESES: readonly Hypothesis[] = [
    { relation: "same-pulse", label: "same pulse", multiplier: 1, prior: 1 },
    { relation: "half-time", label: "incoming half-time (×2 pulse)", multiplier: 2, prior: 0.94 },
    { relation: "double-time", label: "incoming double-time (÷2 pulse)", multiplier: 0.5, prior: 0.94 },
    { relation: "three-over-two", label: "incoming 3:2 pulse (÷1.5)", multiplier: 2 / 3, prior: 0.8 },
    { relation: "two-over-three", label: "incoming 2:3 pulse (×1.5)", multiplier: 1.5, prior: 0.8 },
];

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

function round(value: number, digits = 4): number {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function evidenceQuality(options: TempoRelationshipOptions): number {
    const current = options.current ?? {};
    const next = options.next ?? {};
    const confidence = ((current.confidence ?? 0.7) + (next.confidence ?? 0.7)) / 2;
    const agreement = ((current.agreement ?? 0.7) + (next.agreement ?? 0.7)) / 2;
    const pulse = ((current.percussiveness ?? 0.5) + (next.percussiveness ?? 0.5)) / 2;
    return clamp01(confidence * 0.55 + agreement * 0.3 + pulse * 0.15);
}

/**
 * Test same, octave and 3:2 pulse interpretations and select the strongest
 * rhythmically plausible one. A fold changes metrical interpretation only; the
 * returned stretch ratio remains close to one and is safe for the audio renderer.
 */
export function assessTempoRelationship(
    currentBpm: number | null | undefined,
    nextBpm: number | null | undefined,
    options: TempoRelationshipOptions = {},
): TempoRelationshipAssessment {
    if (!(currentBpm && currentBpm > 0) || !(nextBpm && nextBpm > 0)) {
        return {
            relation: "unrelated",
            label: "tempo unavailable",
            currentBpm: currentBpm && currentBpm > 0 ? currentBpm : null,
            nextBpm: nextBpm && nextBpm > 0 ? nextBpm : null,
            nextMultiplier: 1,
            alignedNextBpm: null,
            stretchRatio: 1,
            effectiveGap: Number.POSITIVE_INFINITY,
            plausibility: 0,
            compatible: false,
            reasons: ["tempo evidence unavailable"],
        };
    }

    const tolerance = Math.max(0.01, Math.min(0.2, options.tolerance ?? 0.08));
    const evidence = evidenceQuality(options);
    const evaluated = HYPOTHESES.map((hypothesis) => {
        const alignedNextBpm = nextBpm * hypothesis.multiplier;
        const stretchRatio = currentBpm / alignedNextBpm;
        const gap = Math.abs(stretchRatio - 1);
        const match = Math.exp(-((gap / tolerance) ** 2));
        const plausibility = match * (hypothesis.prior * 0.55 + evidence * 0.45);
        return { hypothesis, alignedNextBpm, stretchRatio, gap, plausibility };
    }).sort((left, right) => right.plausibility - left.plausibility || left.gap - right.gap);
    const winner = evaluated[0]!;
    const complex = winner.hypothesis.relation === "three-over-two" || winner.hypothesis.relation === "two-over-three";
    const minimumPlausibility = complex ? 0.62 : 0.55;
    const compatible = winner.gap <= tolerance && winner.plausibility >= minimumPlausibility;
    if (!compatible) {
        const rawGap = Math.abs(currentBpm / nextBpm - 1);
        return {
            relation: "unrelated",
            label: "unrelated pulse",
            currentBpm,
            nextBpm,
            nextMultiplier: 1,
            alignedNextBpm: nextBpm,
            stretchRatio: 1,
            effectiveGap: round(rawGap),
            plausibility: round(winner.plausibility),
            compatible: false,
            reasons: [
                `best hypothesis ${winner.hypothesis.label} leaves ${(winner.gap * 100).toFixed(1)}% gap`,
                `rhythmic plausibility ${winner.plausibility.toFixed(2)} below safe match`,
            ],
        };
    }

    return {
        relation: winner.hypothesis.relation,
        label: winner.hypothesis.label,
        currentBpm,
        nextBpm,
        nextMultiplier: round(winner.hypothesis.multiplier),
        alignedNextBpm: round(winner.alignedNextBpm, 2),
        stretchRatio: round(winner.stretchRatio),
        effectiveGap: round(winner.gap),
        plausibility: round(winner.plausibility),
        compatible: true,
        reasons: [
            `${currentBpm.toFixed(1)} ↔ ${nextBpm.toFixed(1)} BPM as ${winner.hypothesis.label}`,
            `${(winner.gap * 100).toFixed(1)}% residual gap after pulse folding`,
            `rhythmic plausibility ${winner.plausibility.toFixed(2)}`,
        ],
    };
}

export function assessGridTempoRelationship(
    current: BeatGrid | null | undefined,
    next: BeatGrid | null | undefined,
    tolerance = 0.08,
): TempoRelationshipAssessment {
    const context = (grid: BeatGrid | null | undefined): TempoEvidenceContext => ({
        confidence: grid?.analysisConfidence?.tempo.confidence ?? (grid ? 0.7 : 0),
        agreement: grid?.analysisConfidence?.tempo.agreement ?? (grid ? 0.7 : 0),
        percussiveness: grid?.energy.percussiveness ?? 0,
    });
    return assessTempoRelationship(current?.bpm, next?.bpm, {
        tolerance,
        current: context(current),
        next: context(next),
    });
}
