import type { TasteVector } from "./recommendation-intelligence";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1000) / 1000;
const mean = (values: readonly number[]) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export type ConsumptionTrend = "popular" | "trending" | "viral" | "rising" | "evergreen" | "rediscovered";

export interface TrendClassificationInput {
    absoluteConsumption: number;
    sustainedGrowth: number;
    sharingVelocity: number;
    crossCommunitySpread: number;
    baselineConsumption: number;
    ageDays: number;
    renewedGrowth: number;
}

export function classifyConsumptionTrend(input: TrendClassificationInput): {
    trend: ConsumptionTrend;
    confidence: number;
    reasons: string[];
} {
    const scores: Record<ConsumptionTrend, number> = {
        popular: clamp01(input.absoluteConsumption),
        trending: clamp01(input.sustainedGrowth * 0.7 + input.baselineConsumption * 0.3),
        viral: clamp01(input.sharingVelocity * 0.55 + input.crossCommunitySpread * 0.45),
        rising: clamp01(input.sustainedGrowth * 0.7 + (1 - input.baselineConsumption) * 0.3),
        evergreen: clamp01(
            Number(input.ageDays >= 365) * 0.45 + input.absoluteConsumption * 0.35 + (1 - input.sustainedGrowth) * 0.2,
        ),
        rediscovered: clamp01(Number(input.ageDays >= 365) * 0.35 + input.renewedGrowth * 0.65),
    };
    const ranked = (Object.entries(scores) as [ConsumptionTrend, number][]).sort((a, b) => b[1] - a[1]);
    const trend = ranked[0]?.[0] ?? "popular";
    const confidence = clamp01((ranked[0]?.[1] ?? 0) - (ranked[1]?.[1] ?? 0) + 0.45);
    return {
        trend,
        confidence: round(confidence),
        reasons: [
            `${trend} score ${round(scores[trend])}`,
            `runner-up ${ranked[1]?.[0] ?? "none"} ${round(ranked[1]?.[1] ?? 0)}`,
        ],
    };
}

export interface PersonalTrendPoint {
    period: string;
    value: number;
    atMs: number;
}
export interface PersonalTrend {
    direction: "rising" | "stable" | "falling";
    velocity: number;
    acceleration: number;
    confidence: number;
}

export function detectPersonalTrend(points: readonly PersonalTrendPoint[]): PersonalTrend {
    const sorted = [...points].sort((a, b) => a.atMs - b.atMs);
    if (sorted.length < 2) return { direction: "stable", velocity: 0, acceleration: 0, confidence: 0.15 };
    const velocities = sorted.slice(1).map((point, index) => point.value - sorted[index]!.value);
    const velocity = mean(velocities);
    const acceleration =
        velocities.length > 1 ? mean(velocities.slice(1).map((value, index) => value - velocities[index]!)) : 0;
    return {
        direction: velocity > 0.15 ? "rising" : velocity < -0.15 ? "falling" : "stable",
        velocity: round(velocity),
        acceleration: round(acceleration),
        confidence: round(clamp01(0.25 + sorted.length * 0.12)),
    };
}

export interface TasteDriftResult {
    drift: TasteVector;
    magnitude: number;
    possibleShift: boolean;
    suggestedRecentBlend: number;
    preserveLongTerm: true;
}

export function detectTasteDrift(longTerm: TasteVector, recent: TasteVector, threshold = 0.22): TasteDriftResult {
    const keys = [...new Set([...Object.keys(longTerm), ...Object.keys(recent)])];
    const drift = Object.fromEntries(keys.map((key) => [key, round((recent[key] ?? 0) - (longTerm[key] ?? 0))]));
    const magnitude = mean(keys.map((key) => Math.abs(drift[key] ?? 0)));
    return {
        drift,
        magnitude: round(magnitude),
        possibleShift: magnitude >= threshold,
        suggestedRecentBlend: round(clamp01(0.25 + magnitude * 0.75)),
        preserveLongTerm: true,
    };
}

export interface TastePhase {
    id: string;
    name: string;
    startedAt: number;
    endedAt?: number;
    genres: TasteVector;
    confidence: number;
}

export class TastePhaseHistory {
    readonly #phases: TastePhase[] = [];
    start(phase: Omit<TastePhase, "endedAt">): TastePhase {
        const current = this.#phases.at(-1);
        if (current && current.endedAt === undefined) current.endedAt = phase.startedAt;
        const created = { ...phase, genres: { ...phase.genres }, confidence: clamp01(phase.confidence) };
        this.#phases.push(created);
        return { ...created, genres: { ...created.genres } };
    }
    end(atMs: number): void {
        const current = this.#phases.at(-1);
        if (current && current.endedAt === undefined) current.endedAt = atMs;
    }
    current(): TastePhase | null {
        const phase = this.#phases.at(-1);
        return phase && phase.endedAt === undefined ? { ...phase, genres: { ...phase.genres } } : null;
    }
    all(): TastePhase[] {
        return this.#phases.map((phase) => ({ ...phase, genres: { ...phase.genres } }));
    }
}

export interface NegativeTasteRule {
    id: string;
    targetType: "track" | "artist" | "album" | "version" | "genre";
    targetId: string;
    context?: string;
    weight: number;
    explicit: boolean;
}

export class NegativeTasteGraph {
    readonly #rules: NegativeTasteRule[] = [];
    add(rule: NegativeTasteRule): void {
        this.#rules.push({ ...rule, weight: clamp01(rule.weight) });
    }
    penalty(input: {
        trackId: string;
        artistId?: string;
        albumId?: string;
        version?: string;
        genres?: string[];
        context?: string;
    }): { penalty: number; matched: string[]; hardBlocked: boolean } {
        const matched = this.#rules.filter((rule) => {
            if (rule.context && rule.context !== input.context) return false;
            if (rule.targetType === "track") return rule.targetId === input.trackId;
            if (rule.targetType === "artist") return rule.targetId === input.artistId;
            if (rule.targetType === "album") return rule.targetId === input.albumId;
            if (rule.targetType === "version") return rule.targetId === input.version;
            return input.genres?.includes(rule.targetId) ?? false;
        });
        const penalty = clamp01(1 - matched.reduce((product, rule) => product * (1 - rule.weight), 1));
        return {
            penalty: round(penalty),
            matched: matched.map((rule) => rule.id),
            hardBlocked: matched.some((rule) => rule.explicit && rule.weight >= 0.95),
        };
    }
}

export type FamiliarityLevel =
    | "never-heard"
    | "seen-before"
    | "heard-once"
    | "recognizable"
    | "familiar"
    | "favorite"
    | "overplayed";
export interface FamiliarityEvidence {
    plays: number;
    completions: number;
    saves: number;
    favorite: boolean;
    lastPlayedAt?: number;
    recentPlays: number;
}

export function classifyFamiliarity(evidence: FamiliarityEvidence): {
    level: FamiliarityLevel;
    score: number;
    confidence: number;
} {
    const score = clamp01(
        evidence.plays * 0.08 + evidence.completions * 0.04 + evidence.saves * 0.12 + Number(evidence.favorite) * 0.35,
    );
    const level: FamiliarityLevel =
        evidence.recentPlays >= 12
            ? "overplayed"
            : evidence.favorite
              ? "favorite"
              : evidence.plays >= 8
                ? "familiar"
                : evidence.plays >= 3
                  ? "recognizable"
                  : evidence.plays === 1
                    ? "heard-once"
                    : evidence.plays === 0 && evidence.saves > 0
                      ? "seen-before"
                      : "never-heard";
    return { level, score: round(score), confidence: round(clamp01(0.2 + (evidence.plays + evidence.saves) * 0.08)) };
}

export interface OverplayAssessment {
    overplayed: boolean;
    temporaryPenalty: number;
    permanentTastePenalty: 0;
    recoveryDays: number;
}
export function assessOverplay(
    playTimestamps: readonly number[],
    nowMs: number,
    favorite: boolean,
): OverplayAssessment {
    const recent = playTimestamps.filter((time) => nowMs - time <= 7 * 86_400_000).length;
    const threshold = favorite ? 14 : 9;
    const excess = Math.max(0, recent - threshold);
    return {
        overplayed: excess > 0,
        temporaryPenalty: round(clamp01(excess / threshold)),
        permanentTastePenalty: 0,
        recoveryDays: excess > 0 ? Math.min(30, 3 + excess * 2) : 0,
    };
}

export interface RediscoveryInput {
    affinity: number;
    lastPlayedAt: number;
    lastLovedAt: number;
    playCount: number;
    currentContextFit: number;
}
export function rediscoveryPotential(input: RediscoveryInput, nowMs: number): number {
    const absentMonths = Math.max(0, nowMs - input.lastPlayedAt) / (30 * 86_400_000);
    const lovedAge = Math.max(0, nowMs - input.lastLovedAt) / (365 * 86_400_000);
    return round(
        clamp01(
            input.affinity * 0.32 +
                clamp01(absentMonths / 14) * 0.3 +
                clamp01(lovedAge / 2) * 0.12 +
                input.currentContextFit * 0.2 +
                clamp01(input.playCount / 20) * 0.06,
        ),
    );
}

export type RecommendationMemoryOutcome = "recommended" | "accepted" | "skipped" | "ignored" | "searched-later";
export interface RecommendationMemoryEvent {
    trackId: string;
    outcome: RecommendationMemoryOutcome;
    atMs: number;
    context?: string;
}

export class RecommendationMemory {
    readonly #events: RecommendationMemoryEvent[] = [];
    record(event: RecommendationMemoryEvent): void {
        this.#events.push({ ...event });
    }
    history(trackId: string): RecommendationMemoryEvent[] {
        return this.#events.filter((event) => event.trackId === trackId).map((event) => ({ ...event }));
    }
    relevanceAdjustment(trackId: string): number {
        const events = this.history(trackId);
        let adjustment = 0;
        for (const event of events)
            adjustment += { recommended: 0, accepted: 0.2, skipped: -0.18, ignored: -0.04, "searched-later": 0.28 }[
                event.outcome
            ];
        return round(Math.max(-0.5, Math.min(0.5, adjustment)));
    }
}

export type ExplorationStrategy = "safe" | "adjacent" | "moderate" | "wild";
export interface ExplorationPolicy {
    strategy: ExplorationStrategy;
    noveltyRange: [number, number];
    genreDistanceMax: number;
    bridgeRequired: boolean;
    riskWeight: number;
}
export const EXPLORATION_POLICIES: Record<ExplorationStrategy, ExplorationPolicy> = {
    safe: {
        strategy: "safe",
        noveltyRange: [0.1, 0.35],
        genreDistanceMax: 0.2,
        bridgeRequired: false,
        riskWeight: 0.9,
    },
    adjacent: {
        strategy: "adjacent",
        noveltyRange: [0.25, 0.55],
        genreDistanceMax: 0.4,
        bridgeRequired: false,
        riskWeight: 0.65,
    },
    moderate: {
        strategy: "moderate",
        noveltyRange: [0.45, 0.75],
        genreDistanceMax: 0.65,
        bridgeRequired: true,
        riskWeight: 0.45,
    },
    wild: { strategy: "wild", noveltyRange: [0.65, 1], genreDistanceMax: 1, bridgeRequired: true, riskWeight: 0.25 },
};

export interface ExplorationRouteCandidate {
    trackId: string;
    familiarity: number;
    compatibilityToPrevious: number;
    compatibilityToDiscovery: number;
}
export function planExplorationBridge(
    knownTrackId: string,
    discoveryTrackId: string,
    candidates: readonly ExplorationRouteCandidate[],
): { route: string[]; score: number; bridgeUsed: boolean } {
    const bridge = [...candidates]
        .filter((candidate) => candidate.trackId !== knownTrackId && candidate.trackId !== discoveryTrackId)
        .map((candidate) => ({
            candidate,
            score:
                candidate.compatibilityToPrevious * 0.45 +
                candidate.compatibilityToDiscovery * 0.45 +
                candidate.familiarity * 0.1,
        }))
        .sort((a, b) => b.score - a.score)[0];
    return bridge && bridge.score >= 0.55
        ? {
              route: [knownTrackId, bridge.candidate.trackId, discoveryTrackId],
              score: round(bridge.score),
              bridgeUsed: true,
          }
        : { route: [knownTrackId, discoveryTrackId], score: round(bridge?.score ?? 0), bridgeUsed: false };
}
