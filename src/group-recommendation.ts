import type { SessionPhase } from "./music-director";
import type { TasteVector } from "./recommendation-intelligence";

export const GROUP_RECOMMENDATION_RESEARCH = [
    { id: "group-fairness-acm", url: "https://dl.acm.org/doi/10.1145/3397481.3450642", topic: "perceived-fairness" },
    { id: "group-recommender-arxiv", url: "https://arxiv.org/abs/1707.09790", topic: "aggregation-strategies" },
    { id: "group-music-mdpi", url: "https://www.mdpi.com/2078-2489/12/12/506", topic: "diverse-real-groups" },
    { id: "deezer-flow-moods", url: "https://arxiv.org/abs/2207.11229", topic: "mood-aware-recommendation" },
    {
        id: "spotify-social-motivation",
        url: "https://research.atspotify.com/2024/06/socially-motivated-music-recommendation",
        topic: "social-relevance",
    },
] as const;

export type GroupAggregationStrategy =
    | "average-satisfaction"
    | "least-misery"
    | "most-pleasure"
    | "average-without-misery"
    | "approval-voting"
    | "fairness-aware";

export interface MemberCandidateSatisfaction {
    userId: string;
    satisfaction: number;
    fairnessDebt: number;
    approved?: boolean;
    active?: boolean;
}

export interface GroupAggregationResult {
    score: number;
    mean: number;
    minimum: number;
    maximum: number;
    polarization: number;
    strategyWeights: Record<GroupAggregationStrategy, number>;
    leastMiseryPenalty: number;
    fairnessBonus: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1000) / 1000;
const mean = (values: readonly number[]) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export function polarizationScore(values: readonly number[]): number {
    if (values.length < 2) return 0;
    const average = mean(values);
    const variance = mean(values.map((value) => (clamp01(value) - average) ** 2));
    return round(clamp01(Math.sqrt(variance) * 2));
}

export function groupAggregationWeights(
    phase: SessionPhase | "breather",
    groupSize: number,
    polarization: number,
): Record<GroupAggregationStrategy, number> {
    const peak = phase === "peak";
    const breather = phase === "breather" || phase === "reset" || phase === "cooldown";
    return {
        "average-satisfaction": peak ? 0.3 : 0.25,
        "least-misery": polarization > 0.55 ? 0.25 : 0.12,
        "most-pleasure": peak ? 0.2 : 0.08,
        "average-without-misery": groupSize <= 6 ? 0.18 : 0.1,
        "approval-voting": groupSize >= 4 ? 0.12 : 0.05,
        "fairness-aware": breather ? 0.4 : peak ? 0.1 : 0.25,
    };
}

/** Dynamic blend of classic group strategies; least misery is a soft guard, never a veto. */
export function aggregateGroupSatisfaction(
    members: readonly MemberCandidateSatisfaction[],
    phase: SessionPhase | "breather" = "build",
    minimumThreshold = 0.18,
): GroupAggregationResult {
    const active = members.filter((member) => member.active !== false);
    const values = active.map((member) => clamp01(member.satisfaction));
    const average = mean(values);
    const minimum = values.length ? Math.min(...values) : 0;
    const maximum = values.length ? Math.max(...values) : 0;
    const polarization = polarizationScore(values);
    const weights = groupAggregationWeights(phase, active.length, polarization);
    const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;
    const leastMiseryPenalty =
        minimum < minimumThreshold ? ((minimumThreshold - minimum) / minimumThreshold) * 0.35 : 0;
    const approved = active.filter((member) => member.approved).length / Math.max(1, active.length);
    const withoutMisery = mean(values.filter((value) => value >= minimumThreshold));
    const fairnessBonus =
        mean(active.map((member) => clamp01(member.fairnessDebt) * clamp01(member.satisfaction))) * 0.35;
    const components: Record<GroupAggregationStrategy, number> = {
        "average-satisfaction": average,
        "least-misery": minimum,
        "most-pleasure": maximum,
        "average-without-misery": withoutMisery,
        "approval-voting": approved,
        "fairness-aware": clamp01(average + fairnessBonus),
    };
    const weighted =
        (Object.keys(weights) as GroupAggregationStrategy[]).reduce(
            (sum, strategy) => sum + components[strategy] * weights[strategy],
            0,
        ) / totalWeight;
    return {
        score: round(clamp01(weighted - leastMiseryPenalty)),
        mean: round(average),
        minimum: round(minimum),
        maximum: round(maximum),
        polarization,
        strategyWeights: weights,
        leastMiseryPenalty: round(leastMiseryPenalty),
        fairnessBonus: round(fairnessBonus),
    };
}

export interface FairnessObservation {
    atMs: number;
    trackId: string;
    userId: string;
    expectedSatisfaction: number;
    observedSatisfaction: number;
    represented: boolean;
}

export interface FairnessWindowResult {
    sinceMs: number;
    trackCount: number;
    representation: Record<string, number>;
    debt: Record<string, number>;
}

/** Fairness is evaluated over both a rolling time and track window. */
export function evaluateFairnessWindow(
    observations: readonly FairnessObservation[],
    nowMs: number,
    options: { minutes?: number; tracks?: number } = {},
): FairnessWindowResult {
    const sinceMs = nowMs - (options.minutes ?? 30) * 60_000;
    const recentTracks = [
        ...new Set(observations.filter((item) => item.atMs >= sinceMs).map((item) => item.trackId)),
    ].slice(-(options.tracks ?? 10));
    const relevant = observations.filter((item) => item.atMs >= sinceMs && recentTracks.includes(item.trackId));
    const userIds = [...new Set(relevant.map((item) => item.userId))];
    const representation: Record<string, number> = {};
    const debt: Record<string, number> = {};
    for (const userId of userIds) {
        const entries = relevant.filter((item) => item.userId === userId);
        const represented = entries.filter((item) => item.represented).length / Math.max(1, entries.length);
        const satisfactionGap = mean(
            entries.map((item) => clamp01(item.expectedSatisfaction) - clamp01(item.observedSatisfaction)),
        );
        representation[userId] = round(represented);
        debt[userId] = round(clamp01((1 - represented) * 0.7 + Math.max(0, satisfactionGap) * 0.3));
    }
    return { sinceMs, trackCount: recentTracks.length, representation, debt };
}

export interface CrowdMoodState {
    chill: number;
    love: number;
    energy: number;
    party: number;
    engagement: number;
    fatigue: number;
    familiarityDemand: number;
    noveltyDemand: number;
    confidence: number;
}

export interface CrowdMoodInputs {
    explicit: {
        moodVotes?: Partial<Record<"chill" | "love" | "energy" | "party", number>>;
        experienceSelection?: "chill" | "love" | "energy" | "party";
        hostSetting?: "chill" | "love" | "energy" | "party";
        crowdSlider?: number;
    };
    implicit: {
        likes: number;
        reactions: number;
        skipVotes: number;
        requests: number;
        queueAdds: number;
        saveRate: number;
        participation: number;
        chatReactions: number;
    };
    optionalSensing?: {
        consent: boolean;
        motion?: number;
        wearableEngagement?: number;
        cameraEmotion?: number;
        microphoneEmotion?: number;
    };
}

export type MoodPrivacyTier = 0 | 1 | 2 | 3;
export function permittedMoodPrivacyTier(input: CrowdMoodInputs): MoodPrivacyTier {
    if (!input.optionalSensing?.consent) return Object.keys(input.implicit).length ? 1 : 0;
    if (input.optionalSensing.motion !== undefined || input.optionalSensing.wearableEngagement !== undefined) return 2;
    return 1;
}

export function inferCrowdMood(input: CrowdMoodInputs, previous?: CrowdMoodState, smoothing = 0.28): CrowdMoodState {
    const implicit = input.implicit;
    const positive = clamp01(
        (implicit.likes + implicit.reactions + implicit.queueAdds + implicit.requests + implicit.chatReactions) / 25,
    );
    const negative = clamp01(implicit.skipVotes / 8);
    const engagement = clamp01(
        positive * 0.7 + implicit.participation * 0.2 + implicit.saveRate * 0.1 - negative * 0.25,
    );
    const fatigue = clamp01(negative * 0.55 + (1 - engagement) * 0.35 + Number(implicit.requests === 0) * 0.1);
    const votes = input.explicit.moodVotes ?? {};
    const selected = input.explicit.experienceSelection ?? input.explicit.hostSetting;
    const slider = clamp01(input.explicit.crowdSlider ?? 0.5);
    const raw = {
        chill: clamp01((votes.chill ?? 0) * 0.6 + (1 - slider) * 0.25 + fatigue * 0.15),
        love: clamp01((votes.love ?? 0) * 0.7 + (1 - slider) * 0.15),
        energy: clamp01((votes.energy ?? 0) * 0.55 + slider * 0.25 + engagement * 0.2),
        party: clamp01((votes.party ?? 0) * 0.5 + slider * 0.2 + positive * 0.3),
    };
    if (selected) raw[selected] = clamp01(raw[selected] + 0.25);
    const explicitSignals =
        Object.keys(votes).length + Number(Boolean(selected)) + Number(input.explicit.crowdSlider !== undefined);
    const implicitSignals = Object.values(implicit).filter((value) => value > 0).length;
    const confidence = clamp01(0.18 + Math.min(0.45, explicitSignals * 0.14) + Math.min(0.32, implicitSignals * 0.04));
    const t = clamp01(smoothing);
    const blend = (key: keyof Pick<CrowdMoodState, "chill" | "love" | "energy" | "party">) =>
        previous ? previous[key] * (1 - t) + raw[key] * t : raw[key];
    return {
        chill: round(blend("chill")),
        love: round(blend("love")),
        energy: round(blend("energy")),
        party: round(blend("party")),
        engagement: round(previous ? previous.engagement * (1 - t) + engagement * t : engagement),
        fatigue: round(previous ? previous.fatigue * (1 - t) + fatigue * t : fatigue),
        familiarityDemand: round(clamp01(fatigue * 0.65 + negative * 0.35)),
        noveltyDemand: round(clamp01(engagement * (1 - fatigue))),
        confidence: round(confidence),
    };
}

export interface CrowdMoodTransition {
    state: CrowdMoodState;
    switched: boolean;
    dominant: "chill" | "love" | "energy" | "party";
    reason: string;
}

export function applyCrowdMoodHysteresis(
    previous: CrowdMoodState,
    inferred: CrowdMoodState,
    currentDominant: "chill" | "love" | "energy" | "party",
    threshold = 0.14,
): CrowdMoodTransition {
    const keys = ["chill", "love", "energy", "party"] as const;
    const smoothed = Object.fromEntries(
        keys.map((key) => [key, round(previous[key] * 0.72 + inferred[key] * 0.28)]),
    ) as Record<(typeof keys)[number], number>;
    const candidate = keys.reduce((best, key) => (smoothed[key] > smoothed[best] ? key : best), currentDominant);
    const margin = smoothed[candidate] - smoothed[currentDominant];
    const switched = candidate !== currentDominant && inferred.confidence >= 0.58 && margin >= threshold;
    const state: CrowdMoodState = {
        ...inferred,
        ...smoothed,
        confidence: round(previous.confidence * 0.5 + inferred.confidence * 0.5),
    };
    return {
        state,
        switched,
        dominant: switched ? candidate : currentDominant,
        reason: switched
            ? `${currentDominant} → ${candidate}, margin ${margin.toFixed(2)}`
            : `held ${currentDominant}; confidence ${inferred.confidence.toFixed(2)}, margin ${margin.toFixed(2)}`,
    };
}

export interface CrowdFatigue {
    energyFatigue: number;
    genreFatigue: number;
    vocalFatigue: number;
    noveltyFatigue: number;
    transitionFatigue: number;
}

export function assessCrowdFatigue(
    history: readonly {
        energy: number;
        genre: string;
        vocalness: number;
        novelty: number;
        transitionComplexity: number;
        reaction: number;
    }[],
): CrowdFatigue {
    const recent = history.slice(-8);
    const average = (key: "energy" | "vocalness" | "novelty" | "transitionComplexity") =>
        mean(recent.map((item) => item[key]));
    const reactionDrop = recent.length > 1 ? clamp01(recent[0]!.reaction - recent.at(-1)!.reaction + 0.5) : 0;
    const dominantGenre = recent
        .map((item) => item.genre)
        .sort(
            (a, b) =>
                recent.filter((item) => item.genre === b).length - recent.filter((item) => item.genre === a).length,
        )[0];
    const repetition = dominantGenre ? recent.filter((item) => item.genre === dominantGenre).length / recent.length : 0;
    return {
        energyFatigue: round(clamp01(average("energy") * reactionDrop)),
        genreFatigue: round(clamp01(repetition * reactionDrop)),
        vocalFatigue: round(clamp01(average("vocalness") * reactionDrop)),
        noveltyFatigue: round(clamp01(average("novelty") * reactionDrop)),
        transitionFatigue: round(clamp01(average("transitionComplexity") * reactionDrop)),
    };
}

export interface EnergyResponseSample {
    energy: number;
    engagement: number;
    confidence: number;
}
export function learnCrowdEnergyZone(samples: readonly EnergyResponseSample[]): {
    optimalMin: number;
    optimalMax: number;
    peak: number;
    confidence: number;
} {
    const valid = samples.filter((item) => item.confidence >= 0.3);
    if (!valid.length) return { optimalMin: 0.55, optimalMax: 0.78, peak: 0.68, confidence: 0.15 };
    const weighted = [...valid].sort((a, b) => b.engagement * b.confidence - a.engagement * a.confidence);
    const peak = clamp01(weighted[0]!.energy);
    return {
        optimalMin: round(clamp01(peak - 0.12)),
        optimalMax: round(clamp01(peak + 0.12)),
        peak: round(peak),
        confidence: round(clamp01((valid.length / 12) * mean(valid.map((item) => item.confidence)))),
    };
}

export type CommunityRelation =
    | "close-friend"
    | "listening-friend"
    | "party-group"
    | "shared-playlist"
    | "community"
    | "local"
    | "country"
    | "global";
export interface CommunityEdge {
    from: string;
    to: string;
    relation: CommunityRelation;
    strength: number;
}

export class CommunityGraph {
    readonly #edges: CommunityEdge[] = [];
    add(edge: CommunityEdge): void {
        this.#edges.push({ ...edge, strength: clamp01(edge.strength) });
    }
    affinity(userId: string, communityId: string): number {
        const relationWeight: Record<CommunityRelation, number> = {
            "close-friend": 1,
            "listening-friend": 0.82,
            "party-group": 0.78,
            "shared-playlist": 0.7,
            community: 0.58,
            local: 0.48,
            country: 0.38,
            global: 0.25,
        };
        return round(
            this.#edges
                .filter((edge) => edge.from === userId && edge.to === communityId)
                .reduce((best, edge) => Math.max(best, edge.strength * relationWeight[edge.relation]), 0),
        );
    }
    neighbors(userId: string): CommunityEdge[] {
        return this.#edges
            .filter((edge) => edge.from === userId || edge.to === userId)
            .sort((a, b) => b.strength - a.strength);
    }
}

export function socialRelevance(communityPopularity: number, communityAffinity: number, personalFit: number): number {
    return round(clamp01(communityPopularity) * clamp01(communityAffinity) * (0.35 + clamp01(personalFit) * 0.65));
}

export function tasteCompatibility(
    left: TasteVector,
    right: TasteVector,
    genreNeighbors: Record<string, string[]> = {},
): { score: number; sharedGenres: string[]; bridgeGenres: string[] } {
    const genres = [...new Set([...Object.keys(left), ...Object.keys(right)])];
    const sharedGenres = genres.filter((genre) => (left[genre] ?? 0) >= 0.55 && (right[genre] ?? 0) >= 0.55);
    const bridgeGenres = genres.filter((genre) => {
        const neighbors = genreNeighbors[genre] ?? [];
        return (
            ((left[genre] ?? 0) >= 0.45 && neighbors.some((neighbor) => (right[neighbor] ?? 0) >= 0.55)) ||
            ((right[genre] ?? 0) >= 0.45 && neighbors.some((neighbor) => (left[neighbor] ?? 0) >= 0.55))
        );
    });
    const score = mean(genres.map((genre) => 1 - Math.abs((left[genre] ?? 0) - (right[genre] ?? 0))));
    return { score: round(score), sharedGenres, bridgeGenres: [...new Set(bridgeGenres)] };
}

export function scoreGroupBridgeTrack(
    satisfactions: readonly MemberCandidateSatisfaction[],
    bridgeGenreFit: number,
    transitionCompatibility: number,
): { score: number; consensus: number; bridgeBonus: number } {
    const aggregate = aggregateGroupSatisfaction(satisfactions, "build");
    const bridgeBonus = clamp01(bridgeGenreFit) * clamp01(transitionCompatibility) * 0.25;
    return {
        score: round(clamp01(aggregate.score * 0.75 + bridgeBonus)),
        consensus: aggregate.score,
        bridgeBonus: round(bridgeBonus),
    };
}

export interface CrowdRequest {
    id: string;
    trackId: string;
    requestedBy: string;
    priority: number;
    playNext: boolean;
    deadline?: number;
    votes: number;
    compatibility: number;
    createdAtMs: number;
    hostOverride?: boolean;
}

export interface RankedCrowdRequest extends CrowdRequest {
    score: number;
    fairness: number;
    recency: number;
    reasons: string[];
}

export function rankCrowdRequests(
    requests: readonly CrowdRequest[],
    nowMs: number,
    fairnessDebt: Record<string, number>,
    recentRequesterCounts: Record<string, number>,
): RankedCrowdRequest[] {
    return requests
        .map((request) => {
            const fairness = clamp01(
                0.55 +
                    (fairnessDebt[request.requestedBy] ?? 0) * 0.55 -
                    (recentRequesterCounts[request.requestedBy] ?? 0) * 0.12,
            );
            const recency = clamp01(1 - (nowMs - request.createdAtMs) / (45 * 60_000));
            const deadlineUrgency =
                request.deadline === undefined ? 0 : clamp01(1 - (request.deadline - nowMs) / (30 * 60_000));
            const score = request.hostOverride
                ? 1
                : clamp01(
                      clamp01(request.priority) * 0.22 +
                          fairness * 0.24 +
                          recency * 0.1 +
                          clamp01(request.compatibility) * 0.22 +
                          clamp01(request.votes / 8) * 0.12 +
                          deadlineUrgency * 0.1,
                  );
            return {
                ...request,
                score: round(score),
                fairness: round(fairness),
                recency: round(recency),
                reasons: [
                    request.hostOverride ? "host override" : `fairness ${round(fairness)}`,
                    `compatibility ${round(request.compatibility)}`,
                    `${request.votes} votes`,
                    ...(deadlineUrgency > 0.5 ? ["deadline approaching"] : []),
                ],
            };
        })
        .sort((a, b) => b.score - a.score || a.createdAtMs - b.createdAtMs);
}

export function crowdConsensusScore(satisfactions: readonly number[]): {
    consensus: number;
    mean: number;
    disagreementPenalty: number;
} {
    const average = mean(satisfactions.map(clamp01));
    const disagreementPenalty = polarizationScore(satisfactions) * 0.45;
    return {
        consensus: round(clamp01(average - disagreementPenalty)),
        mean: round(average),
        disagreementPenalty: round(disagreementPenalty),
    };
}

export interface PhaseGroupRules {
    exploration: number;
    consensus: number;
    crowdResponse: number;
    familiarity: number;
    minorityOpportunity: number;
}

export function groupRulesForPhase(phase: SessionPhase | "breather"): PhaseGroupRules {
    if (phase === "warmup")
        return {
            exploration: 0.75,
            consensus: 0.45,
            crowdResponse: 0.35,
            familiarity: 0.45,
            minorityOpportunity: 0.45,
        };
    if (phase === "build" || phase === "momentum" || phase === "rebuild")
        return { exploration: 0.4, consensus: 0.8, crowdResponse: 0.65, familiarity: 0.55, minorityOpportunity: 0.35 };
    if (phase === "peak")
        return { exploration: 0.2, consensus: 0.65, crowdResponse: 1, familiarity: 0.85, minorityOpportunity: 0.15 };
    if (phase === "breather" || phase === "reset" || phase === "cooldown")
        return { exploration: 0.55, consensus: 0.55, crowdResponse: 0.4, familiarity: 0.5, minorityOpportunity: 0.9 };
    return { exploration: 0.15, consensus: 0.85, crowdResponse: 0.75, familiarity: 1, minorityOpportunity: 0.3 };
}

export interface CrowdMemberSatisfactionHistory {
    userId: string;
    recentExpectedSatisfaction: number;
    recentObservedSatisfaction: number;
    representation: number;
    requestDebt: number;
    active: boolean;
}

export function updateGroupSatisfactionHistory(
    previous: CrowdMemberSatisfactionHistory,
    observation: { expected: number; observed: number; represented: boolean; requestServed: boolean },
    smoothing = 0.25,
): CrowdMemberSatisfactionHistory {
    const t = clamp01(smoothing);
    return {
        ...previous,
        recentExpectedSatisfaction: round(
            previous.recentExpectedSatisfaction * (1 - t) + clamp01(observation.expected) * t,
        ),
        recentObservedSatisfaction: round(
            previous.recentObservedSatisfaction * (1 - t) + clamp01(observation.observed) * t,
        ),
        representation: round(previous.representation * (1 - t) + Number(observation.represented) * t),
        requestDebt: round(clamp01(previous.requestDebt + (observation.requestServed ? -0.35 : 0.08))),
    };
}

export type PresenceEvent = "joined" | "active" | "inactive" | "left";
export interface PresenceState {
    userId: string;
    weight: number;
    joinedAtMs: number;
    lastActiveAtMs: number;
    present: boolean;
}

export function updatePresence(
    previous: PresenceState | null,
    userId: string,
    event: PresenceEvent,
    nowMs: number,
): PresenceState {
    if (!previous || event === "joined")
        return {
            userId,
            weight: event === "joined" ? 0.15 : 1,
            joinedAtMs: nowMs,
            lastActiveAtMs: nowMs,
            present: event !== "left",
        };
    if (event === "left") return { ...previous, weight: 0, lastActiveAtMs: nowMs, present: false };
    if (event === "inactive")
        return {
            ...previous,
            weight: round(Math.max(0.1, previous.weight * 0.65)),
            lastActiveAtMs: previous.lastActiveAtMs,
        };
    const ramp = clamp01((nowMs - previous.joinedAtMs) / (5 * 60_000));
    return {
        ...previous,
        weight: round(Math.max(previous.weight, 0.15 + ramp * 0.85)),
        lastActiveAtMs: nowMs,
        present: true,
    };
}
