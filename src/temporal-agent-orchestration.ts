export type TemporalCondition = { kind: "now" | "time" | "elapsed" | "event"; value?: string | number };
export interface SessionContractPatch {
    energy?: number;
    familiarity?: number;
    discovery?: number;
    mixIntensity?: number;
    genre?: string;
}
export interface SessionTemporalIntent {
    startCondition: TemporalCondition;
    endCondition?: TemporalCondition;
    changes: SessionContractPatch;
    sourceText: string;
}

export function temporalIntentGraph(intents: readonly SessionTemporalIntent[]): {
    nodes: SessionTemporalIntent[];
    overlaps: number;
    temporalPoliciesNotQueries: true;
} {
    const nodes = [...intents];
    const timed = nodes
        .filter((node) => node.startCondition.kind === "time")
        .map((node) => String(node.startCondition.value));
    return { nodes, overlaps: timed.length - new Set(timed).size, temporalPoliciesNotQueries: true };
}

export interface RelaxableConstraint {
    id: string;
    value: string | number;
    importance: number;
    relaxability: number;
    kind:
        | "explicit"
        | "rights"
        | "clean-only"
        | "blocked-artist"
        | "year"
        | "bpm"
        | "discovery"
        | "genre"
        | "familiarity"
        | "bridge";
}
const HARD_KINDS = new Set<RelaxableConstraint["kind"]>(["explicit", "rights", "clean-only", "blocked-artist"]);
export function reflectiveRetry(
    constraints: readonly RelaxableConstraint[],
    failureReasons: readonly string[],
): { preserve: string[]; relax: string[]; retry: boolean; genericFallbackForbidden: true } {
    const ordered = [...constraints].sort((a, b) => b.relaxability - a.relaxability || a.importance - b.importance);
    const relax = ordered
        .filter((constraint) => !HARD_KINDS.has(constraint.kind) && constraint.relaxability >= 0.5)
        .slice(0, Math.max(1, failureReasons.length))
        .map((constraint) => constraint.id);
    return {
        preserve: constraints.filter((constraint) => !relax.includes(constraint.id)).map((constraint) => constraint.id),
        relax,
        retry: relax.length > 0,
        genericFallbackForbidden: true,
    };
}

export function relaxYearRange(year: number, radius = 3): { from: number; to: number } {
    return { from: year - radius, to: year + radius };
}

export type PrecisionClass = "sample" | "beat" | "section" | "semantic";
export interface MusicEvidence<T> {
    value: T;
    source: string;
    confidence: number;
    precisionClass: PrecisionClass;
}
const PRECISION = { sample: 4, beat: 3, section: 2, semantic: 1 } as const;
export function fuseMusicEvidence<T>(evidence: readonly MusicEvidence<T>[]): {
    selected: MusicEvidence<T> | null;
    sources: string[];
    specialistPrecisionProtected: true;
} {
    const selected =
        [...evidence].sort(
            (a, b) => PRECISION[b.precisionClass] - PRECISION[a.precisionClass] || b.confidence - a.confidence,
        )[0] ?? null;
    return { selected, sources: evidence.map((item) => item.source), specialistPrecisionProtected: true };
}

export const SPECIALIST_ENSEMBLE = {
    specialists: ["beat-tracker", "structure-model", "key-detector", "stem-analyzer"],
    audioLanguageModelRole: ["semantic-interpretation", "high-level-reasoning"],
    metadataGraphIncluded: true,
    monolithicAudioAiTrusted: false,
} as const;

export const BASS_BENCHMARK_2026 = {
    questions: 2_658,
    songs: 1_993,
    audioHours: 138,
    tasks: 12,
    lyricTranscriptionRelativelyStronger: true,
    higherLevelReasoningReliable: false,
} as const;
export const MELO_PRODUCTION_EVIDENCE = {
    catalogGroundingEntityReductionPoints: 7.8,
    reflectiveRetrySessionRate: 0.058,
    processRecoveryRate: 0.59,
    deterministicStateGraph: true,
} as const;

export function agentRetryDecision(input: {
    entityGrounded: boolean;
    toolChainSucceeded: boolean;
    candidateQuality: number;
}): { action: "continue" | "reflective-retry" | "hard-failure"; validationRequired: true } {
    if (!input.entityGrounded) return { action: "hard-failure", validationRequired: true };
    if (!input.toolChainSucceeded || input.candidateQuality < 0.65)
        return { action: "reflective-retry", validationRequired: true };
    return { action: "continue", validationRequired: true };
}

export function applyTemporalPolicy(
    intent: SessionTemporalIntent,
    currentTime: number,
    sessionStart: number,
): { active: boolean; patch: SessionContractPatch } {
    const conditionTime = (condition: TemporalCondition): number =>
        condition.kind === "now"
            ? -Infinity
            : condition.kind === "elapsed"
              ? sessionStart + Number(condition.value ?? 0)
              : condition.kind === "time"
                ? Number(condition.value ?? Infinity)
                : -Infinity;
    const active =
        currentTime >= conditionTime(intent.startCondition) &&
        (!intent.endCondition || currentTime < conditionTime(intent.endCondition));
    return { active, patch: active ? { ...intent.changes } : {} };
}

export const AGENT_PRODUCTION_PRINCIPLE = {
    catalogGrounding: true,
    deterministicStateGraph: true,
    reflectiveRetry: true,
    freeAutonomousAgent: false,
    reliabilityBeforeEngagementLift: true,
} as const;
