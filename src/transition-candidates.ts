import { classifyGenre, inferGenre } from "./genre";
import { harmonicScore } from "./key";
import { isStemQualityUsable } from "./stem-quality";
import {
    type PlannerConfig,
    planTransition,
    type TrackTraits,
    type TransitionPlan,
    type TransitionType,
    tempoMatchRatio,
} from "./transition-planner";
import type { TransitionTelemetryRecord } from "./transition-telemetry";
import { assessVocalConflict, type VocalConflictScore } from "./vocal-conflict";

export interface TransitionFeedbackBucket {
    count: number;
    avgScore: number;
    fallbackRate: number;
    negativeFeedbackRate: number;
    confidence: number;
    bias: number;
}

export interface TransitionFeedbackProfile {
    generatedAt: string;
    totalRecords: number;
    minRecords: number;
    byType: Record<string, TransitionFeedbackBucket>;
    byPattern: Record<string, TransitionFeedbackBucket>;
}

export interface CandidatePlannerConfig extends PlannerConfig {
    feedback?: TransitionFeedbackProfile | null;
    /** Required score margin before telemetry is allowed to overrule the old planner. */
    switchMargin?: number;
}

export interface TransitionCandidate {
    plan: TransitionPlan;
    score: number;
    musicalScore: number;
    feedbackBias: number;
    reasons: string[];
}

export interface TransitionFeedbackProfileOptions {
    minRecords?: number;
}

interface CandidateContext {
    curGenre: string;
    nextGenre: string;
    gap: number;
    tempoRatio: number;
    tempoClose: boolean;
    keyScore: number;
    keyOk: boolean;
    highEnergy: boolean;
    hasOutro: boolean;
    eitherChill: boolean;
    eitherHiphop: boolean;
    acapellaStemReady: boolean;
    stemQualityScore: number | null;
    vocalDensity: number | null;
    vocalConflict: VocalConflictScore;
}

const DEFAULT_CONFIG: PlannerConfig = { maxFadeSec: 12, tempoTolerance: 0.08 };
const HARD_TYPES = new Set<TransitionType>(["cut", "spinback", "roll"]);
const KEY_MASK_TYPES = new Set<TransitionType>(["filter", "gate", "echo", "riser"]);
const CLOSE_TEMPO_TYPES = new Set<TransitionType>(["blend", "bassdrop", "filter", "gate", "riser", "acapella"]);

function clamp(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, n));
}

function round(n: number, digits = 1): number {
    const f = 10 ** digits;
    return Math.round(n * f) / f;
}

function clampFade(seconds: number, config: PlannerConfig): number {
    return Math.min(config.maxFadeSec, Math.max(1, seconds));
}

function foldedTempoGap(curBpm?: number, nextBpm?: number): number {
    if (!curBpm || !nextBpm) return Infinity;
    let ratio = curBpm / nextBpm;
    if (ratio > 1.4) ratio /= 2;
    else if (ratio < 0.7) ratio *= 2;
    return Math.abs(ratio - 1);
}

function tempoBucket(gapPct: number | null): string {
    if (gapPct === null) return "tempo:unknown";
    if (gapPct <= 2) return "tempo:0-2";
    if (gapPct <= 6) return "tempo:2-6";
    if (gapPct <= 8) return "tempo:6-8";
    if (gapPct <= 12) return "tempo:8-12";
    if (gapPct <= 18) return "tempo:12-18";
    return "tempo:18+";
}

function keyBucket(score: number | null): string {
    if (score === null) return "key:unknown";
    if (score >= 0.7) return "key:compatible";
    if (score >= 0.4) return "key:borderline";
    return "key:clash";
}

function stretchBucket(tempoRatio: number, outgoingTempoRatio = 1): string {
    const pct = Math.max(Math.abs(tempoRatio - 1), Math.abs(outgoingTempoRatio - 1)) * 100;
    if (pct <= 2) return "stretch:0-2";
    if (pct <= 5) return "stretch:2-5";
    if (pct <= 8) return "stretch:5-8";
    if (pct <= 12) return "stretch:8-12";
    return "stretch:12+";
}

function candidateContext(current: TrackTraits, next: TrackTraits, config: PlannerConfig): CandidateContext {
    const cg = current.grid;
    const ng = next.grid;
    const curGenre = cg
        ? classifyGenre(
              { spectral: cg.spectral, percussiveness: cg.energy.percussiveness, bpm: cg.bpm },
              current.title,
              current.uploader,
          )
        : inferGenre(current.title, current.uploader);
    const nextGenre = ng
        ? classifyGenre(
              { spectral: ng.spectral, percussiveness: ng.energy.percussiveness, bpm: ng.bpm },
              next.title,
              next.uploader,
          )
        : inferGenre(next.title, next.uploader);
    const gap = foldedTempoGap(cg?.bpm, ng?.bpm);
    const tempoRatio = tempoMatchRatio(cg?.bpm, ng?.bpm, config.tempoTolerance);
    const keyScore = cg && ng ? harmonicScore(cg.key.camelot, ng.key.camelot) : 0;
    const curPunch = cg?.energy.percussiveness ?? 0.3;
    const nextPunch = ng?.energy.percussiveness ?? 0.3;
    const knownStemQuality = current.stemQuality !== undefined;
    const stemQuality = current.stemQuality ?? null;
    const acapellaStemReady =
        !!config.stemsReady && (!knownStemQuality || isStemQualityUsable(stemQuality, config.minStemQuality));
    const vocalConflict = assessVocalConflict({
        outgoingStemQuality: stemQuality,
        incomingStemQuality: next.stemQuality,
        incomingVocalActivity: next.vocalActivity,
        incomingStartSec: ng?.introSec ?? null,
        incomingIntroSec: ng?.introSec ?? null,
        overlapSec: 8,
        keyScore,
        maxRisk: config.vocalConflictMaxRisk,
    });
    return {
        curGenre,
        nextGenre,
        gap,
        tempoRatio,
        tempoClose: gap <= config.tempoTolerance || tempoRatio !== 1,
        keyScore,
        keyOk: keyScore >= 0.5,
        highEnergy: curPunch >= 0.34 && nextPunch >= 0.34,
        hasOutro: cg ? cg.musicalEndSec < current.durationMs / 1000 - 1 : false,
        eitherChill: curGenre === "chill" || nextGenre === "chill",
        eitherHiphop: curGenre === "hiphop" || nextGenre === "hiphop",
        acapellaStemReady,
        stemQualityScore: stemQuality?.score ?? null,
        vocalDensity: stemQuality?.vocalDensity ?? null,
        vocalConflict,
    };
}

function planFor(
    type: TransitionType,
    baseFadeSec: number,
    config: PlannerConfig,
    c: CandidateContext,
): TransitionPlan {
    const ratio = CLOSE_TEMPO_TYPES.has(type) ? c.tempoRatio : 1;
    const highEnergyFade = clampFade(baseFadeSec + 2, config);
    switch (type) {
        case "blend":
            return {
                type,
                fadeSec: clampFade(baseFadeSec + (c.tempoClose && c.keyOk ? 2 : 0), config),
                eqSweep: true,
                tempoRatio: ratio,
                reason: `candidate blend (key ${c.keyScore.toFixed(1)})`,
            };
        case "bassdrop":
            return {
                type,
                fadeSec: highEnergyFade,
                eqSweep: true,
                tempoRatio: ratio,
                reason: `candidate bass-drop (key ${c.keyScore.toFixed(1)}, high energy)`,
            };
        case "riser":
            return {
                type,
                fadeSec: highEnergyFade,
                eqSweep: false,
                tempoRatio: ratio,
                reason: `candidate riser drop (key ${c.keyScore.toFixed(1)}, high energy)`,
            };
        case "filter":
            return {
                type,
                fadeSec: clampFade(baseFadeSec, config),
                eqSweep: true,
                tempoRatio: ratio,
                reason: "candidate filter sweep",
            };
        case "gate":
            return {
                type,
                fadeSec: clampFade(baseFadeSec, config),
                eqSweep: false,
                tempoRatio: ratio,
                reason: "candidate gate stutter",
            };
        case "echo":
            return {
                type,
                fadeSec: clampFade(baseFadeSec, config),
                eqSweep: false,
                tempoRatio: 1,
                reason: c.hasOutro ? "candidate echo ring-out (clean outro)" : "candidate echo ring-out",
            };
        case "fade":
            return {
                type,
                fadeSec: clampFade(baseFadeSec + (c.eitherChill ? 2 : 0), config),
                eqSweep: false,
                tempoRatio: 1,
                reason: c.eitherChill ? "candidate smooth fade (chill)" : "candidate smooth fade",
            };
        case "spinback":
            return {
                type,
                fadeSec: clampFade(2, config),
                eqSweep: false,
                tempoRatio: 1,
                reason: "candidate spinback",
            };
        case "roll":
            return {
                type,
                fadeSec: clampFade(2, config),
                eqSweep: false,
                tempoRatio: 1,
                reason: "candidate beat-repeat roll",
            };
        case "cut":
            return {
                type,
                fadeSec: clampFade(2, config),
                eqSweep: false,
                tempoRatio: 1,
                reason: "candidate beat-aligned cut",
            };
        case "acapella":
            return {
                type,
                fadeSec: highEnergyFade,
                eqSweep: false,
                tempoRatio: ratio,
                reason: `candidate acapella (key ${c.keyScore.toFixed(1)})`,
            };
    }
}

function candidateTypes(
    base: TransitionPlan,
    current: TrackTraits,
    next: TrackTraits,
    config: PlannerConfig,
): TransitionType[] {
    const c = candidateContext(current, next, config);
    const types = new Set<TransitionType>([base.type]);
    if (!next.grid) {
        types.add("blend");
        types.add("fade");
        return [...types];
    }
    if (c.eitherChill) {
        types.add("fade");
        types.add("echo");
        types.add("blend");
        return [...types];
    }
    if (c.gap > 0.18) {
        types.add("cut");
        if (c.highEnergy) types.add("spinback");
        types.add("echo");
        types.add("fade");
        return [...types];
    }
    if (c.eitherHiphop) {
        types.add("cut");
        if (c.highEnergy) {
            types.add("spinback");
            types.add("roll");
        }
        types.add("filter");
        return [...types];
    }
    if (c.tempoClose && c.keyOk) {
        types.add("blend");
        if (c.highEnergy) {
            types.add("bassdrop");
            types.add("riser");
        }
        if (c.acapellaStemReady && c.keyScore >= 0.7 && c.vocalConflict.safeForAcapella) types.add("acapella");
        types.add("filter");
        return [...types];
    }
    if (c.tempoClose && !c.keyOk) {
        types.add("filter");
        types.add("gate");
        types.add("echo");
        types.add("cut");
        return [...types];
    }
    types.add("blend");
    types.add("cut");
    types.add("fade");
    return [...types];
}

function scoreType(type: TransitionType, c: CandidateContext): { score: number; reasons: string[] } {
    if (type === "acapella" && (!c.acapellaStemReady || c.keyScore < 0.7 || !c.vocalConflict.safeForAcapella)) {
        return { score: -Infinity, reasons: ["acapella not feasible"] };
    }

    let tempo = 72;
    if (HARD_TYPES.has(type)) tempo = c.gap > 0.18 || c.eitherHiphop ? 92 : 70;
    else if (type === "fade" || type === "echo") tempo = 78;
    else tempo = c.tempoClose ? 94 : c.gap <= 0.12 ? 72 : 40;

    let key = 72;
    if (HARD_TYPES.has(type)) key = Math.max(70, c.keyScore * 100);
    else if (KEY_MASK_TYPES.has(type)) key = c.keyOk ? 88 : 84;
    else key = c.keyScore * 100;

    let genre = 72;
    if (c.eitherChill) genre = type === "fade" || type === "echo" ? 96 : HARD_TYPES.has(type) ? 38 : 68;
    else if (c.eitherHiphop) genre = HARD_TYPES.has(type) ? 94 : type === "filter" ? 76 : 62;
    else if (["blend", "bassdrop", "riser", "filter", "gate", "acapella"].includes(type)) genre = 86;

    let energy = 74;
    if (c.highEnergy)
        energy = ["bassdrop", "riser", "gate", "spinback", "roll"].includes(type) ? 94 : type === "fade" ? 50 : 78;
    else energy = type === "fade" || type === "echo" ? 86 : ["bassdrop", "riser", "spinback"].includes(type) ? 58 : 74;

    const stem = type === "acapella" ? (c.stemQualityScore ?? 78) : 72;
    const vocalLane = type === "acapella" ? c.vocalConflict.score : 72;
    const score =
        type === "acapella"
            ? tempo * 0.18 + key * 0.2 + genre * 0.13 + energy * 0.11 + stem * 0.2 + vocalLane * 0.18
            : tempo * 0.28 + key * 0.24 + genre * 0.25 + energy * 0.23;
    const reasons = [`tempo ${round(tempo)}`, `key ${round(key)}`, `genre ${round(genre)}`, `energy ${round(energy)}`];
    if (type === "acapella") reasons.push(`stem ${round(stem)}`);
    if (type === "acapella") reasons.push(`vocal lane ${round(vocalLane)}`);
    return { score: round(score), reasons };
}

function bucketStats(records: TransitionTelemetryRecord[], minRecords: number): TransitionFeedbackBucket {
    const count = records.length;
    const avgScore = count ? records.reduce((sum, r) => sum + r.quality.score, 0) / count : 0;
    const fallbackRate = count ? records.filter((r) => r.execution.mode === "fallback").length / count : 0;
    const negativeFeedbackRate = count
        ? records.filter((r) => r.userFeedback?.kind === "early-skip").length / count
        : 0;
    const confidence = clamp(count / Math.max(1, minRecords), 0, 1);
    const rawBias = (avgScore - 82) * 0.45 - fallbackRate * 18 - negativeFeedbackRate * 28;
    return {
        count,
        avgScore: round(avgScore),
        fallbackRate: round(fallbackRate, 3),
        negativeFeedbackRate: round(negativeFeedbackRate, 3),
        confidence: round(confidence, 3),
        bias: round(clamp(rawBias, -24, 12) * confidence),
    };
}

function addRecord(
    map: Map<string, TransitionTelemetryRecord[]>,
    key: string,
    record: TransitionTelemetryRecord,
): void {
    const bucket = map.get(key) ?? [];
    bucket.push(record);
    map.set(key, bucket);
}

export function buildTransitionFeedbackProfile(
    records: TransitionTelemetryRecord[],
    options: TransitionFeedbackProfileOptions = {},
): TransitionFeedbackProfile {
    const minRecords = options.minRecords ?? 6;
    const byTypeRaw = new Map<string, TransitionTelemetryRecord[]>();
    const byPatternRaw = new Map<string, TransitionTelemetryRecord[]>();

    for (const record of records) {
        const type = record.transitionType;
        addRecord(byTypeRaw, `type:${type}`, record);
        addRecord(byPatternRaw, `type-tempo:${type}:${tempoBucket(record.tempoGapPct)}`, record);
        addRecord(byPatternRaw, `type-key:${type}:${keyBucket(record.keyScore)}`, record);
        addRecord(
            byPatternRaw,
            `type-stretch:${type}:${stretchBucket(record.tempoRatio, record.outgoingTempoRatio)}`,
            record,
        );
    }

    const byType: Record<string, TransitionFeedbackBucket> = {};
    for (const [key, bucket] of byTypeRaw) byType[key] = bucketStats(bucket, minRecords);
    const byPattern: Record<string, TransitionFeedbackBucket> = {};
    for (const [key, bucket] of byPatternRaw) byPattern[key] = bucketStats(bucket, minRecords);

    return {
        generatedAt: new Date().toISOString(),
        totalRecords: records.length,
        minRecords,
        byType,
        byPattern,
    };
}

function feedbackBias(
    type: TransitionType,
    c: CandidateContext,
    plan: TransitionPlan,
    feedback?: TransitionFeedbackProfile | null,
): number {
    if (!feedback?.totalRecords) return 0;
    const buckets = [
        feedback.byType[`type:${type}`],
        feedback.byPattern[`type-tempo:${type}:${tempoBucket(Number.isFinite(c.gap) ? c.gap * 100 : null)}`],
        feedback.byPattern[`type-key:${type}:${keyBucket(c.keyScore)}`],
        feedback.byPattern[`type-stretch:${type}:${stretchBucket(plan.tempoRatio)}`],
    ].filter((b): b is TransitionFeedbackBucket => !!b);
    if (!buckets.length) return 0;
    const weighted = buckets.reduce((sum, b, i) => sum + b.bias * (i === 0 ? 0.4 : 0.2), 0);
    return round(weighted);
}

export function buildTransitionCandidates(
    current: TrackTraits,
    next: TrackTraits,
    baseFadeSec: number,
    config: CandidatePlannerConfig = DEFAULT_CONFIG,
): TransitionCandidate[] {
    const base = planTransition(current, next, baseFadeSec, config);
    const c = candidateContext(current, next, config);
    return candidateTypes(base, current, next, config)
        .map((type) => {
            const plan = type === base.type ? base : planFor(type, baseFadeSec, config, c);
            const musical = scoreType(type, c);
            const feedback = feedbackBias(type, c, plan, config.feedback);
            const baseBonus = type === base.type ? 8 : 0;
            return {
                plan,
                score: round(musical.score + feedback + baseBonus),
                musicalScore: musical.score,
                feedbackBias: feedback,
                reasons: musical.reasons,
            };
        })
        .filter((candidate) => Number.isFinite(candidate.score))
        .sort((a, b) => b.score - a.score || a.plan.type.localeCompare(b.plan.type));
}

export function planTransitionWithFeedback(
    current: TrackTraits,
    next: TrackTraits,
    baseFadeSec: number,
    config: CandidatePlannerConfig = DEFAULT_CONFIG,
): TransitionPlan {
    const base = planTransition(current, next, baseFadeSec, config);
    const feedback = config.feedback;
    if (!feedback?.totalRecords) return base;

    const candidates = buildTransitionCandidates(current, next, baseFadeSec, config);
    const best = candidates[0];
    const baseCandidate = candidates.find((c) => c.plan.type === base.type);
    if (!best || !baseCandidate) return base;
    const switchMargin = config.switchMargin ?? 4;
    if (best.plan.type !== base.type && best.score < baseCandidate.score + switchMargin) return base;
    if (best.plan.type === base.type) return base;

    return {
        ...best.plan,
        reason: `${best.plan.reason}; telemetry preferred over ${base.type} (${best.score.toFixed(1)} vs ${baseCandidate.score.toFixed(1)})`,
    };
}
