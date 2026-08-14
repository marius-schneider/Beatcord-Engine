const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const round = (v: number) => Math.round(v * 1000) / 1000;

export function predictPhaseDrift(
    errorsMs: readonly number[],
    horizonSec: number,
): { predictedErrorMs: number; microNudgePercent: number; hardWarp: false } {
    const slope = errorsMs.length > 1 ? (errorsMs.at(-1)! - errorsMs[0]!) / (errorsMs.length - 1) : 0;
    const predictedErrorMs = (errorsMs.at(-1) ?? 0) + slope * horizonSec;
    return {
        predictedErrorMs: round(predictedErrorMs),
        microNudgePercent: round(Math.max(-0.25, Math.min(0.25, -predictedErrorMs / 400))),
        hardWarp: false,
    };
}

export type TempoMasterStrategy =
    | "incoming-follows"
    | "outgoing-follows"
    | "meet-in-middle"
    | "progressive-ramp"
    | "no-sync";
export interface TempoTransitionPlan {
    sourceBpm: number;
    targetBpm: number;
    strategy: TempoMasterStrategy;
    convergenceBpm: number;
}
export interface TempoBudget {
    maxInstantPercent: number;
    maxGradualPercent: number;
    maxCentsPitchError: number;
    preserveKey: boolean;
}

export function planTempoTransition(
    sourceBpm: number,
    targetBpm: number,
    input: {
        sourceStability: number;
        targetStability: number;
        budget: TempoBudget;
        beatmatchRisk: number;
        alternativeRisk: number;
    },
): TempoTransitionPlan {
    if (input.beatmatchRisk > input.alternativeRisk)
        return { sourceBpm, targetBpm, strategy: "no-sync", convergenceBpm: sourceBpm };
    const gap = Math.abs(targetBpm - sourceBpm) / Math.max(1, sourceBpm);
    const strategy: TempoMasterStrategy =
        gap > input.budget.maxGradualPercent / 100
            ? "progressive-ramp"
            : input.sourceStability > input.targetStability + 0.15
              ? "incoming-follows"
              : input.targetStability > input.sourceStability + 0.15
                ? "outgoing-follows"
                : "meet-in-middle";
    return {
        sourceBpm,
        targetBpm,
        strategy,
        convergenceBpm: round(
            strategy === "incoming-follows"
                ? sourceBpm
                : strategy === "outgoing-follows"
                  ? targetBpm
                  : (sourceBpm + targetBpm) / 2,
        ),
    };
}

export interface TempoCorridor {
    minBpm: number;
    maxBpm: number;
}
export function tempoCorridorDecision(
    bpm: number,
    corridor: TempoCorridor,
    reasons: { journey: boolean; request: boolean; genreChange: boolean; crowd: boolean },
): { inside: boolean; mayEscape: boolean; strategies: string[] } {
    const inside = bpm >= corridor.minBpm && bpm <= corridor.maxBpm;
    const mayEscape = inside || Object.values(reasons).some(Boolean);
    return {
        inside,
        mayEscape,
        strategies:
            mayEscape && !inside
                ? [
                      "half-double-time",
                      "breakdown",
                      "echo-out",
                      "phrase-cut",
                      "drumless-bridge",
                      "bridge-track",
                      "multi-track-ramp",
                  ]
                : [],
    };
}

export type ClubTransitionFamily =
    | "continuous"
    | "structural"
    | "transformative"
    | "semantic"
    | "tempo-escape"
    | "stem"
    | "energy";
export const CLUB_TRANSITION_TAXONOMY: Record<ClubTransitionFamily, readonly string[]> = {
    continuous: ["long-blend", "eq-blend", "bass-swap", "stem-blend"],
    structural: ["phrase-swap", "drop-swap", "breakdown-entry", "outro-intro"],
    transformative: ["filter", "echo", "reverb", "loop", "riser"],
    semantic: ["lyric-link", "theme-link", "sample-link"],
    "tempo-escape": ["hard-cut", "echo-out", "spin-brake", "drumless-bridge"],
    stem: ["vocal-handoff", "instrumental-handoff", "drum-swap", "bass-swap", "mashup"],
    energy: ["drop-to-drop", "build-to-drop", "breather", "impact-cut"],
};

export interface ClubTransitionCandidate {
    id: string;
    family: ClubTransitionFamily;
    hardConstraints: boolean;
    beatPhraseFeasibility: number;
    harmonicRisk: number;
    arrangementRisk: number;
    stretchRisk: number;
    experienceFit: number;
    simulationQuality: number;
}
export function solveTransitionConstraints(candidates: readonly ClubTransitionCandidate[]): {
    selected: ClubTransitionCandidate | null;
    rejected: string[];
} {
    const eligible = candidates
        .filter((c) => c.hardConstraints)
        .map((c) => ({
            c,
            score:
                c.beatPhraseFeasibility * 0.24 +
                (1 - c.harmonicRisk) * 0.14 +
                (1 - c.arrangementRisk) * 0.16 +
                (1 - c.stretchRisk) * 0.12 +
                c.experienceFit * 0.14 +
                c.simulationQuality * 0.2,
        }))
        .sort((a, b) => b.score - a.score);
    return {
        selected: eligible[0]?.c ?? null,
        rejected: candidates.filter((c) => !c.hardConstraints || c !== eligible[0]?.c).map((c) => c.id),
    };
}

export interface AutomationCurve {
    parameter: string;
    points: { progress: number; value: number }[];
}
export interface ClubTransitionPlan {
    outgoingStart: number;
    incomingStart: number;
    durationBars: number;
    tempoPlan: TempoTransitionPlan;
    gainCurves: AutomationCurve[];
    eqCurves: AutomationCurve[];
    stemCurves: AutomationCurve[];
    fxCurves: AutomationCurve[];
    expectedQuality: number;
    confidence: number;
    fallback: string;
    immutableIntent: true;
}

export function humanTransitionPrior(
    family: ClubTransitionFamily,
    similarity: number,
): { advisoryFamily: ClubTransitionFamily; prior: number; decidesMix: false; technicalValidationRequired: true } {
    return {
        advisoryFamily: family,
        prior: round(clamp01(similarity)),
        decidesMix: false,
        technicalValidationRequired: true,
    };
}

export function learnAutomationIntent(curves: readonly AutomationCurve[]): {
    curves: AutomationCurve[];
    learnsControlIntent: true;
    generatesWaveform: false;
} {
    return {
        curves: curves.map((curve) => ({
            ...curve,
            points: [...curve.points]
                .sort((a, b) => a.progress - b.progress)
                .map((p) => ({ progress: clamp01(p.progress), value: clamp01(p.value) })),
        })),
        learnsControlIntent: true,
        generatesWaveform: false,
    };
}

export interface BassState {
    outgoingBass: number;
    incomingBass: number;
    overlapRisk: number;
    swapPoint: number;
}
export function bassSwapState(
    outgoingBass: number,
    incomingBass: number,
    rhythmicCoincidence: number,
    phaseRisk: number,
): BassState {
    return {
        outgoingBass: clamp01(outgoingBass),
        incomingBass: clamp01(incomingBass),
        overlapRisk: round(clamp01(outgoingBass * incomingBass * 0.6 + rhythmicCoincidence * 0.25 + phaseRisk * 0.15)),
        swapPoint: 0.5,
    };
}

export interface RoleCollision {
    overlap: number;
    density: number;
    competition: number;
    intelligibilityRisk: number;
    mitigations: string[];
}
export function roleCollision(
    kind: "low-end" | "vocal" | "lead",
    outgoing: number,
    incoming: number,
    density: number,
): RoleCollision {
    const overlap = clamp01(outgoing) * clamp01(incoming);
    const competition = clamp01(overlap * 0.7 + density * 0.3);
    return {
        overlap: round(overlap),
        density: round(clamp01(density)),
        competition: round(competition),
        intelligibilityRisk: round(kind === "vocal" ? competition : competition * 0.55),
        mitigations:
            competition >= 0.55
                ? kind === "low-end"
                    ? ["eq-swap", "remove-bass-stem", "shorten-overlap"]
                    : ["stem-isolation", "different-phrase", "shorten-overlap"]
                : [],
    };
}

export type FrequencyBand = "sub" | "low" | "low-mid" | "mid" | "high-mid" | "high";
export type ClubMusicalRole = "kick" | "bass" | "vocal" | "lead" | "pad" | "percussion" | "fx";
export interface FrequencyRoleEntry {
    band: FrequencyBand;
    role: ClubMusicalRole;
    energy: number;
    confidence: number;
}

export function stemCapability(
    regionConfidence: number,
    available: boolean,
): { mode: "advanced-stem" | "classic-eq"; regionSafe: boolean } {
    return {
        mode: available && regionConfidence >= 0.72 ? "advanced-stem" : "classic-eq",
        regionSafe: available && regionConfidence >= 0.72,
    };
}
export const STEM_HANDOFFS = ["vocal-handoff", "drum-handoff", "bass-swap"] as const;

export interface ClubLoopability {
    rhythmic: number;
    harmonic: number;
    semantic: number;
    transientBoundary: number;
    repetitionNoticeability: number;
}
export function loopabilityScore(loop: ClubLoopability): number {
    return round(
        clamp01(
            loop.rhythmic * 0.28 +
                loop.harmonic * 0.2 +
                loop.semantic * 0.17 +
                loop.transientBoundary * 0.2 +
                (1 - loop.repetitionNoticeability) * 0.15,
        ),
    );
}
export function smartLoopExtension(
    availableBars: number,
    neededBars: number,
    loop: ClubLoopability,
): { enabled: boolean; repeats: number; preservesStructure: boolean } {
    const score = loopabilityScore(loop);
    return {
        enabled: neededBars > availableBars && score >= 0.65,
        repeats: score >= 0.65 ? Math.ceil((neededBars - availableBars) / Math.max(1, availableBars)) : 0,
        preservesStructure: score >= 0.65,
    };
}

export function adaptiveTransitionBars(input: {
    harmonic: number;
    arrangementCollision: number;
    beatStability: number;
    tempoGap: number;
    gridConfidence: number;
    popStructure: number;
}): number {
    const longFit =
        input.harmonic * 0.25 +
        (1 - input.arrangementCollision) * 0.25 +
        input.beatStability * 0.2 +
        (1 - input.tempoGap) * 0.15 +
        input.gridConfidence * 0.15;
    return longFit >= 0.8 && input.popStructure < 0.6 ? 32 : longFit >= 0.62 ? 16 : longFit >= 0.42 ? 8 : 4;
}

export interface PhraseBoundary {
    time: number;
    probability: number;
    type: string;
}
export interface TransitionWindow {
    earliest: number;
    ideal: number;
    latest: number;
    entryRoles: string[];
    exitRoles: string[];
    confidence: number;
}
export function buildTransitionWindow(
    boundaries: readonly PhraseBoundary[],
    role: "entry" | "exit",
): TransitionWindow | null {
    const best = [...boundaries].sort((a, b) => b.probability - a.probability)[0];
    return best
        ? {
              earliest: Math.max(0, best.time - 2),
              ideal: best.time,
              latest: best.time + 2,
              entryRoles: role === "entry" ? [best.type] : [],
              exitRoles: role === "exit" ? [best.type] : [],
              confidence: clamp01(best.probability),
          }
        : null;
}
export type CueSemantic =
    | "intro-safe"
    | "intro-phrase"
    | "vocal-start"
    | "build-start"
    | "drop"
    | "breakdown"
    | "chorus"
    | "outro-safe"
    | "emergency-exit"
    | "loop-safe";

export type CommitState = "planned" | "armed" | "committed";
export function transitionCommitPolicy(
    state: CommitState,
    emergency: boolean,
): { replaceable: boolean; changes: "free" | "limited" | "emergency-only" } {
    return state === "planned"
        ? { replaceable: true, changes: "free" }
        : state === "armed"
          ? { replaceable: emergency, changes: "limited" }
          : { replaceable: emergency, changes: "emergency-only" };
}
export const PRE_ROLL_TASKS = ["load", "seek", "tempo", "key-lock", "stems", "fx", "buffer", "phase-lock"] as const;

export type BeatSyncState =
    | "unsynced"
    | "tempo-acquired"
    | "phase-acquired"
    | "bar-aligned"
    | "phrase-armed"
    | "locked"
    | "transitioning"
    | "release";
export function nextBeatSyncState(state: BeatSyncState, confidence: number): BeatSyncState {
    const order: BeatSyncState[] = [
        "unsynced",
        "tempo-acquired",
        "phase-acquired",
        "bar-aligned",
        "phrase-armed",
        "locked",
        "transitioning",
        "release",
    ];
    return confidence < 0.45 ? "release" : order[Math.min(order.length - 1, order.indexOf(state) + 1)]!;
}
export function rescueBeatmatching(
    failure: "phase-drift" | "wrong-downbeat" | "half-time" | "grid-jump" | "stretch-artifact",
    confidence: number,
): string[] {
    if (confidence < 0.3) return ["echo-out", "hard-phrase-cut"];
    return failure === "phase-drift"
        ? ["micro-nudge", "shorten-overlap"]
        : failure === "wrong-downbeat"
          ? ["re-anchor-strong-onset", "shorten-overlap"]
          : failure === "stretch-artifact"
            ? ["release-sync", "echo-out"]
            : ["re-anchor-strong-onset", "drop-drums", "shorten-overlap"];
}
export function manipulationGate(
    required: number,
    budget: number,
): { allowed: boolean; action: "use-plan" | "choose-different-transition-or-track" } {
    return required <= budget
        ? { allowed: true, action: "use-plan" }
        : { allowed: false, action: "choose-different-transition-or-track" };
}
