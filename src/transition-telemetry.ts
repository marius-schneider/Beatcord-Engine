import type { FeedbackAttribution } from "./feedback-attribution";
import { harmonicScore } from "./key";
import { assessTempoRelationship } from "./tempo-awareness";
import type { TransitionType } from "./transition-planner";

export type TransitionExecutionMode = "live" | "offline-render" | "offline-cache" | "fallback";

export type TransitionFallbackReason =
    | "disabled"
    | "unsupported"
    | "missing-file"
    | "segment-before-start"
    | "render-timeout"
    | "render-error"
    | "stale-plan"
    | "late-handoff"
    | "quality-warning"
    | "quality-unsafe"
    | "compute-budget"
    | "latency-budget"
    | "audio-validation";

export interface TransitionTrackSnapshot {
    id: string;
    title: string;
    uploader: string | null;
    bpm: number | null;
    key: string | null;
    keyConfidence: number | null;
    energy: number | null;
    percussiveness: number | null;
    danceability: number | null;
    introSec: number | null;
    musicalEndSec: number | null;
}

export interface TransitionExecutionSnapshot {
    mode: TransitionExecutionMode;
    fallbackReason: TransitionFallbackReason | null;
    cacheHit: boolean | null;
    renderMs: number | null;
    renderDeadlineMs: number | null;
    segmentSec: number | null;
}

export type TransitionUserFeedbackKind = "early-skip";

export interface TransitionUserFeedback {
    kind: TransitionUserFeedbackKind;
    atMs: number;
    afterTransitionMs: number;
    skippedTrackId: string;
    skippedPositionMs: number;
    skippedPositionRatio: number | null;
    weight: number;
    source: "skip";
    attribution?: FeedbackAttribution;
}

export interface TransitionTelemetryInput {
    atMs: number;
    guildId: string | null;
    current: TransitionTrackSnapshot;
    next: TransitionTrackSnapshot;
    transitionType: TransitionType;
    planReason: string;
    fadeSec: number;
    eqSweep: boolean;
    tempoRatio: number;
    outgoingTempoRatio: number;
    scheduledTrackSec: number;
    scheduledPlaySec: number;
    actualFirePlaySec: number;
    preRollSec: number;
    execution: TransitionExecutionSnapshot;
    userFeedback?: TransitionUserFeedback | null;
}

export interface TransitionQualityScore {
    score: number;
    grade: "A" | "B" | "C" | "D" | "F";
    dimensions: {
        timing: number;
        harmonic: number;
        tempo: number;
        energy: number;
        execution: number;
        stretch: number;
        feedback: number;
    };
    notes: string[];
}

export interface TransitionTelemetryRecord extends TransitionTelemetryInput {
    schemaVersion: 1;
    timingErrorMs: number;
    tempoGapPct: number | null;
    keyScore: number | null;
    energyDelta: number | null;
    quality: TransitionQualityScore;
}

const HARD_TRANSITIONS = new Set<TransitionType>(["cut", "spinback", "roll"]);
const KEY_MASKING_TRANSITIONS = new Set<TransitionType>(["filter", "gate", "echo", "riser"]);

function clamp(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, n));
}

function round(n: number, digits = 3): number {
    const f = 10 ** digits;
    return Math.round(n * f) / f;
}

function grade(score: number): TransitionQualityScore["grade"] {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 55) return "D";
    return "F";
}

function foldedTempoGapPct(a: number | null, b: number | null): number | null {
    if (!a || !b) return null;
    return assessTempoRelationship(a, b).effectiveGap * 100;
}

function timingScore(errorMs: number): number {
    const e = Math.abs(errorMs);
    if (e <= 30) return 100;
    if (e <= 80) return 92;
    if (e <= 150) return 75;
    if (e <= 300) return 55;
    return clamp(35 - (e - 300) / 20, 0, 35);
}

function tempoScore(type: TransitionType, gapPct: number | null): number {
    if (gapPct === null) return 72;
    if (HARD_TRANSITIONS.has(type)) {
        return gapPct <= 8 ? 95 : gapPct <= 18 ? 88 : gapPct <= 35 ? 78 : 62;
    }
    if (gapPct <= 2) return 100;
    if (gapPct <= 6) return 92;
    if (gapPct <= 8) return 84;
    if (gapPct <= 12) return 68;
    if (gapPct <= 18) return 48;
    return 25;
}

function keyCompatibilityScore(type: TransitionType, keyScore: number | null): number {
    if (keyScore === null) return 72;
    if (HARD_TRANSITIONS.has(type)) return Math.max(72, keyScore * 100);
    if (KEY_MASKING_TRANSITIONS.has(type)) return Math.max(68, keyScore * 100);
    return keyScore * 100;
}

function energyScore(delta: number | null): number {
    if (delta === null) return 72;
    // Ideal DJ flow is usually a small lift; both cliffs and sudden drops sound worse.
    return clamp(100 - Math.abs(delta - 0.08) * 220, 0, 100);
}

function executionScore(execution: TransitionExecutionSnapshot): number {
    if (execution.mode === "offline-cache") return 100;
    if (execution.mode === "offline-render") {
        const slack = (execution.renderDeadlineMs ?? 0) - (execution.renderMs ?? 0);
        if (slack >= 500) return 98;
        if (slack >= 100) return 92;
        if (slack >= 0) return 84;
        return 70;
    }
    if (execution.mode === "live") return 86;
    return execution.fallbackReason === "disabled" || execution.fallbackReason === "unsupported" ? 76 : 58;
}

function stretchScore(tempoRatio: number, outgoingTempoRatio: number): number {
    const incoming = Math.abs(tempoRatio - 1);
    const outgoing = Math.abs(outgoingTempoRatio - 1);
    const worst = Math.max(incoming, outgoing);
    if (worst <= 0.02) return 100;
    if (worst <= 0.05) return 92;
    if (worst <= 0.08) return 82;
    if (worst <= 0.12) return 62;
    return 40;
}

function feedbackScore(feedback: TransitionUserFeedback | null | undefined): number {
    if (!feedback) return 100;
    if (feedback.kind === "early-skip") return clamp(100 - feedback.weight * 100, 0, 100);
    return 72;
}

function trackEnergy(t: TransitionTrackSnapshot): number | null {
    const energy = t.energy;
    const perc = t.percussiveness;
    if (energy === null && perc === null && t.danceability === null) return null;
    const loudness = ((energy ?? perc ?? 0.5) + (perc ?? energy ?? 0.5)) / 2;
    const dance = t.danceability === null ? loudness : clamp(t.danceability / 3, 0, 1);
    return loudness * 0.55 + dance * 0.45;
}

function computeKeyScore(current: TransitionTrackSnapshot, next: TransitionTrackSnapshot): number | null {
    if (!current.key || !next.key) return null;
    const confidence = Math.min(current.keyConfidence ?? 0, next.keyConfidence ?? 0);
    if (confidence < 0.35) return null;
    return harmonicScore(current.key, next.key);
}

function notesFor(record: Omit<TransitionTelemetryRecord, "quality" | "schemaVersion">): string[] {
    const notes: string[] = [];
    const absTiming = Math.abs(record.timingErrorMs);
    if (absTiming > 150) notes.push(`late/early fire ${Math.round(record.timingErrorMs)}ms`);
    if (record.execution.mode === "fallback" && record.execution.fallbackReason) {
        notes.push(`offline fallback: ${record.execution.fallbackReason}`);
    }
    if (record.execution.mode === "offline-render" && record.execution.renderMs !== null) {
        const slack = (record.execution.renderDeadlineMs ?? 0) - record.execution.renderMs;
        if (slack < 100) notes.push(`offline render tight (${Math.round(slack)}ms slack)`);
    }
    if (record.tempoGapPct !== null && record.tempoGapPct > 12 && !HARD_TRANSITIONS.has(record.transitionType)) {
        notes.push(`wide tempo gap ${record.tempoGapPct.toFixed(1)}% on ${record.transitionType}`);
    }
    if (record.keyScore !== null && record.keyScore < 0.4 && !KEY_MASKING_TRANSITIONS.has(record.transitionType)) {
        notes.push(`harmonic clash ${record.keyScore.toFixed(2)}`);
    }
    const stretch = Math.max(Math.abs(record.tempoRatio - 1), Math.abs(record.outgoingTempoRatio - 1));
    if (stretch > 0.08) notes.push(`heavy stretch ${(stretch * 100).toFixed(1)}%`);
    if (record.userFeedback?.kind === "early-skip") {
        notes.push(`early skip ${(record.userFeedback.afterTransitionMs / 1000).toFixed(1)}s after transition`);
        if (record.userFeedback.attribution) {
            notes.push(
                `feedback attributed to ${record.userFeedback.attribution.dominant} (${record.userFeedback.attribution.confidence.toFixed(2)})`,
            );
        }
    }
    return notes;
}

export function scoreTransitionTelemetry(input: TransitionTelemetryInput): TransitionQualityScore {
    const timingErrorMs = (input.actualFirePlaySec - input.scheduledPlaySec) * 1000;
    const tempoGapPct = foldedTempoGapPct(input.current.bpm, input.next.bpm);
    const keyScore = computeKeyScore(input.current, input.next);
    const curEnergy = trackEnergy(input.current);
    const nextEnergy = trackEnergy(input.next);
    const energyDelta = curEnergy === null || nextEnergy === null ? null : nextEnergy - curEnergy;

    const dimensions = {
        timing: timingScore(timingErrorMs),
        harmonic: keyCompatibilityScore(input.transitionType, keyScore),
        tempo: tempoScore(input.transitionType, tempoGapPct),
        energy: energyScore(energyDelta),
        execution: executionScore(input.execution),
        stretch: stretchScore(input.tempoRatio, input.outgoingTempoRatio),
        feedback: feedbackScore(input.userFeedback),
    };
    const score =
        dimensions.timing * 0.24 +
        dimensions.harmonic * 0.15 +
        dimensions.tempo * 0.17 +
        dimensions.energy * 0.1 +
        dimensions.execution * 0.18 +
        dimensions.stretch * 0.06 +
        dimensions.feedback * 0.1;
    const recordBase = {
        ...input,
        timingErrorMs: round(timingErrorMs, 1),
        tempoGapPct: tempoGapPct === null ? null : round(tempoGapPct, 3),
        keyScore: keyScore === null ? null : round(keyScore, 3),
        energyDelta: energyDelta === null ? null : round(energyDelta, 3),
    };
    const finalScore = round(clamp(score, 0, 100), 1);
    return {
        score: finalScore,
        grade: grade(finalScore),
        dimensions: {
            timing: round(dimensions.timing, 1),
            harmonic: round(dimensions.harmonic, 1),
            tempo: round(dimensions.tempo, 1),
            energy: round(dimensions.energy, 1),
            execution: round(dimensions.execution, 1),
            stretch: round(dimensions.stretch, 1),
            feedback: round(dimensions.feedback, 1),
        },
        notes: notesFor(recordBase),
    };
}

export function buildTransitionTelemetryRecord(input: TransitionTelemetryInput): TransitionTelemetryRecord {
    const timingErrorMs = (input.actualFirePlaySec - input.scheduledPlaySec) * 1000;
    const tempoGapPct = foldedTempoGapPct(input.current.bpm, input.next.bpm);
    const keyScore = computeKeyScore(input.current, input.next);
    const curEnergy = trackEnergy(input.current);
    const nextEnergy = trackEnergy(input.next);
    const energyDelta = curEnergy === null || nextEnergy === null ? null : nextEnergy - curEnergy;
    const base = {
        ...input,
        timingErrorMs: round(timingErrorMs, 1),
        tempoGapPct: tempoGapPct === null ? null : round(tempoGapPct, 3),
        keyScore: keyScore === null ? null : round(keyScore, 3),
        energyDelta: energyDelta === null ? null : round(energyDelta, 3),
    };
    return {
        schemaVersion: 1,
        ...base,
        quality: scoreTransitionTelemetry(input),
    };
}
