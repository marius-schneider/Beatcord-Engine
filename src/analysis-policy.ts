import type { ComputeTier } from "./compute-budget";
import type { TimeRegion } from "./track-profile.types";

export type RealtimeOperation =
    | "sample-processing"
    | "parameter-read"
    | "network"
    | "file-io"
    | "ml-inference"
    | "lock"
    | "allocation"
    | "logging";

export interface RealtimeAudit {
    safe: boolean;
    allowed: RealtimeOperation[];
    violations: RealtimeOperation[];
}

const REALTIME_FORBIDDEN = new Set<RealtimeOperation>([
    "network",
    "file-io",
    "ml-inference",
    "lock",
    "allocation",
    "logging",
]);

export function auditRealtimeOperations(operations: readonly RealtimeOperation[]): RealtimeAudit {
    const violations = [...new Set(operations.filter((operation) => REALTIME_FORBIDDEN.has(operation)))];
    return {
        safe: violations.length === 0,
        allowed: operations.filter((operation) => !REALTIME_FORBIDDEN.has(operation)),
        violations,
    };
}

export type AnalysisPriority = "critical" | "high" | "medium" | "low";
export type AnalysisFidelity = 1 | 2 | 3 | 4;

export interface AnalysisRequestContext {
    position: "now-playing" | "next" | "next-plus-one" | "library-candidate" | "background";
    selectionProbability: number;
    deadlineMs?: number;
}

export interface AnalysisPolicyDecision {
    priority: AnalysisPriority;
    fidelity: AnalysisFidelity;
    generateStems: boolean;
    features: string[];
}

const FEATURES: Record<AnalysisFidelity, string[]> = {
    1: ["metadata", "quick-bpm", "loudness"],
    2: ["beatgrid", "key", "vocals", "energy"],
    3: ["structure", "embedding", "moments"],
    4: ["stems", "transition-simulation"],
};

/** Prioritize queue proximity first, then cap fidelity by the active compute tier. */
export function planAnalysis(context: AnalysisRequestContext, tier: ComputeTier): AnalysisPolicyDecision {
    const priority: AnalysisPriority =
        context.position === "next"
            ? "critical"
            : context.position === "next-plus-one"
              ? "high"
              : context.position === "library-candidate"
                ? "medium"
                : context.position === "now-playing"
                  ? "high"
                  : "low";
    const desired: AnalysisFidelity =
        context.position === "next" && context.selectionProbability >= 0.7
            ? 4
            : context.position === "next-plus-one" || context.selectionProbability >= 0.45
              ? 3
              : context.position === "library-candidate"
                ? 2
                : 1;
    const tierMaximum: AnalysisFidelity = ([1, 2, 3, 4, 4] as const)[tier];
    const fidelity = Math.min(desired, tierMaximum) as AnalysisFidelity;
    return {
        priority,
        fidelity,
        generateStems: fidelity === 4 && context.selectionProbability >= 0.7,
        features: Array.from({ length: fidelity }, (_, index) => FEATURES[(index + 1) as AnalysisFidelity]).flat(),
    };
}

export interface SharedSpectralFrame {
    timeSec: number;
    magnitudes: Float32Array;
    spectralCentroid: number;
    spectralFlux: number;
    rms: number;
}

/** Immutable frontend output lets every analyzer consume one decoded STFT pass. */
export class SharedAnalysisFrontend {
    readonly #frames = new Map<number, SharedSpectralFrame>();

    store(frame: SharedSpectralFrame): void {
        this.#frames.set(frame.timeSec, { ...frame, magnitudes: frame.magnitudes.slice() });
    }

    frame(timeSec: number): SharedSpectralFrame | null {
        const frame = this.#frames.get(timeSec);
        return frame ? { ...frame, magnitudes: frame.magnitudes.slice() } : null;
    }

    get size(): number {
        return this.#frames.size;
    }
}

export interface BeatgridFailureInput {
    expectedBeatsSec: readonly number[];
    actualOnsetsSec: readonly number[];
    downbeatOffsetsSec?: readonly number[];
    localBpms?: readonly number[];
    sectionResetErrorsSec?: readonly number[];
}

export interface BeatgridFailureReport {
    failed: boolean;
    driftMs: number;
    periodicDrift: number;
    downbeatConsistency: number;
    tempoDiscontinuity: number;
    sectionResetRisk: number;
    issues: string[];
    action: "constant-grid" | "dynamic-grid" | "safe-transition";
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const mean = (values: readonly number[]) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const variance = (values: readonly number[]) => {
    const average = mean(values);
    return mean(values.map((value) => (value - average) ** 2));
};

export function detectBeatgridFailure(input: BeatgridFailureInput): BeatgridFailureReport {
    const count = Math.min(input.expectedBeatsSec.length, input.actualOnsetsSec.length);
    const offsets = Array.from(
        { length: count },
        (_, index) => input.actualOnsetsSec[index]! - input.expectedBeatsSec[index]!,
    );
    const driftMs = mean(offsets) * 1_000;
    const first = offsets.slice(0, Math.max(1, Math.floor(count / 3)));
    const last = offsets.slice(-Math.max(1, Math.floor(count / 3)));
    const periodicDrift = Math.abs(mean(last) - mean(first)) * 1_000;
    const downbeatConsistency = 1 - clamp01(Math.sqrt(variance(input.downbeatOffsetsSec ?? [])) / 0.08);
    const bpms = input.localBpms ?? [];
    const tempoDiscontinuity = bpms.length > 1 ? clamp01(Math.max(...bpms) / Math.max(1, Math.min(...bpms)) - 1) : 0;
    const sectionResetRisk = clamp01(Math.max(0, ...(input.sectionResetErrorsSec ?? []).map(Math.abs)) / 0.25);
    const issues: string[] = [];
    if (Math.abs(driftMs) >= 35) issues.push("onset-offset");
    if (periodicDrift >= 25) issues.push("periodic-drift");
    if (downbeatConsistency < 0.65) issues.push("downbeat-inconsistent");
    if (tempoDiscontinuity > 0.08) issues.push("tempo-discontinuity");
    if (sectionResetRisk > 0.5) issues.push("section-reset");
    const severe = periodicDrift >= 80 || downbeatConsistency < 0.35 || tempoDiscontinuity > 0.2;
    return {
        failed: issues.length > 0,
        driftMs,
        periodicDrift,
        downbeatConsistency,
        tempoDiscontinuity,
        sectionResetRisk,
        issues,
        action: severe ? "safe-transition" : issues.length ? "dynamic-grid" : "constant-grid",
    };
}

export type GenreWorld = "edm" | "hip-hop" | "disco-funk" | "rock" | "ambient" | "jazz" | "triple-meter" | "general";

export interface GenreAdapter {
    world: GenreWorld;
    phraseWeight: number;
    beatWeight: number;
    tempoTolerance: number;
    halfDoubleTimeAware: boolean;
    variableTempo: boolean;
    beatlessAllowed: boolean;
    meter: 3 | 4;
}

export function genreAdapter(genres: readonly string[], meter = 4): GenreAdapter {
    const text = genres.join(" ").toLowerCase();
    const world: GenreWorld =
        meter === 3
            ? "triple-meter"
            : /ambient|drone|classical/.test(text)
              ? "ambient"
              : /hip.?hop|trap/.test(text)
                ? "hip-hop"
                : /disco|funk/.test(text)
                  ? "disco-funk"
                  : /rock|metal/.test(text)
                    ? "rock"
                    : /jazz/.test(text)
                      ? "jazz"
                      : /edm|house|techno|trance/.test(text)
                        ? "edm"
                        : "general";
    return {
        world,
        phraseWeight: world === "edm" ? 1 : world === "ambient" ? 0.2 : 0.65,
        beatWeight: world === "ambient" ? 0.1 : world === "jazz" ? 0.35 : 0.8,
        tempoTolerance: world === "disco-funk" || world === "rock" ? 0.14 : 0.08,
        halfDoubleTimeAware: world === "hip-hop",
        variableTempo: world === "disco-funk" || world === "rock" || world === "jazz",
        beatlessAllowed: world === "ambient" || world === "jazz",
        meter: meter === 3 ? 3 : 4,
    };
}

export interface BeatlessTransitionPolicy {
    enabled: boolean;
    strategy: "spectral-harmonic-fade" | "beat-synchronous";
    signals: string[];
}

export function beatlessTransitionPolicy(beatConfidence: number, adapter: GenreAdapter): BeatlessTransitionPolicy {
    const enabled = beatConfidence < 0.35 || (adapter.beatlessAllowed && beatConfidence < 0.55);
    return enabled
        ? {
              enabled,
              strategy: "spectral-harmonic-fade",
              signals: [
                  "spectral-centroid",
                  "loudness-envelope",
                  "tonality",
                  "ambience",
                  "texture",
                  "section-boundary",
              ],
          }
        : { enabled, strategy: "beat-synchronous", signals: ["beat", "bar", "phrase"] };
}

export type ContentType = "music" | "podcast" | "audiobook" | "speech" | "live-recording" | "interlude" | "jingle";

export interface ContentProfile {
    type: ContentType;
    confidence: number;
    playbackPolicy: "music-director" | "speech-safe" | "gapless" | "short-form";
}

export function detectContentType(input: {
    speechRatio: number;
    musicProbability: number;
    durationSec: number;
    liveProbability?: number;
    chapterCount?: number;
}): ContentProfile {
    if ((input.liveProbability ?? 0) >= 0.72)
        return { type: "live-recording", confidence: input.liveProbability!, playbackPolicy: "gapless" };
    if (input.durationSec <= 20) return { type: "jingle", confidence: 0.8, playbackPolicy: "short-form" };
    if (input.speechRatio >= 0.78) {
        const audiobook = input.durationSec >= 1_800 || (input.chapterCount ?? 0) > 1;
        return {
            type: audiobook ? "audiobook" : "podcast",
            confidence: clamp01(input.speechRatio),
            playbackPolicy: "speech-safe",
        };
    }
    if (input.musicProbability >= 0.62)
        return {
            type: input.durationSec <= 75 ? "interlude" : "music",
            confidence: input.musicProbability,
            playbackPolicy: "music-director",
        };
    return { type: "speech", confidence: clamp01(1 - input.musicProbability), playbackPolicy: "speech-safe" };
}

export interface NarrationPlan {
    allowed: boolean;
    region: TimeRegion | null;
    duckDb: number;
    restoreAtSec: number | null;
    reason: string;
}

export function planNarration(
    vocalRegions: readonly TimeRegion[],
    durationSec: number,
    narrationSec: number,
): NarrationPlan {
    const sorted = [...vocalRegions].sort((a, b) => a.start - b.start);
    const gaps: TimeRegion[] = [];
    let cursor = 0;
    for (const region of sorted) {
        if (region.start > cursor) gaps.push({ start: cursor, end: region.start });
        cursor = Math.max(cursor, region.end);
    }
    if (cursor < durationSec) gaps.push({ start: cursor, end: durationSec });
    const region = gaps.find((gap) => gap.end - gap.start >= narrationSec + 0.5) ?? null;
    return region
        ? {
              allowed: true,
              region: { start: region.start, end: region.start + narrationSec },
              duckDb: -8,
              restoreAtSec: region.end,
              reason: "instrumental/low-vocal window",
          }
        : {
              allowed: false,
              region: null,
              duckDb: 0,
              restoreAtSec: null,
              reason: "no safe vocal-free narration window",
          };
}

export interface GroupMemberTaste {
    userId: string;
    satisfaction: number;
    candidateAffinity: number;
    fairnessDebt: number;
    requested: boolean;
    host: boolean;
}

export interface GroupTasteDecision {
    score: number;
    minimumSatisfaction: number;
    fairnessBoost: number;
    debts: Record<string, number>;
}

/** Optimize average and minimum satisfaction while repaying underserved listeners. */
export function scoreGroupTaste(members: readonly GroupMemberTaste[]): GroupTasteDecision {
    if (!members.length) return { score: 0, minimumSatisfaction: 0, fairnessBoost: 0, debts: {} };
    const projected = members.map((member) => clamp01(member.satisfaction * 0.45 + member.candidateAffinity * 0.55));
    const average = mean(projected);
    const minimumSatisfaction = Math.min(...projected);
    const fairnessBoost = mean(members.map((member) => member.fairnessDebt * member.candidateAffinity)) * 0.2;
    const requestBoost = mean(members.map((member) => (member.requested ? 0.08 : 0)));
    const hostPenalty = mean(members.map((member) => (member.host && member.candidateAffinity < 0.25 ? 0.2 : 0)));
    const debts = Object.fromEntries(
        members.map((member, index) => [
            member.userId,
            clamp01(member.fairnessDebt + (0.55 - projected[index]!) * 0.15),
        ]),
    );
    return {
        score: clamp01(average * 0.55 + minimumSatisfaction * 0.35 + fairnessBoost + requestBoost - hostPenalty),
        minimumSatisfaction,
        fairnessBoost,
        debts,
    };
}
