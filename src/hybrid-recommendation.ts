import { buildCrowdTaste, type CrowdMemberState, type CrowdTaste } from "./crowd-taste";
import type { ConcreteExperienceId } from "./experience-engine";
import {
    type RecommendationObjectives,
    type RecommendationWeights,
    recommendationWeights,
    type UserTasteProfile,
} from "./recommendation-intelligence";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

export interface UserColdStartInput {
    artistIds: string[];
    genres: string[];
    trackIds: string[];
    experiences: ConcreteExperienceId[];
    familiarityVsDiscovery: number;
}

export interface UserColdStartResult {
    profile: UserTasteProfile;
    experienceWeights: Partial<Record<ConcreteExperienceId, number>>;
    confidence: number;
    missing: string[];
}

export function buildUserColdStart(input: UserColdStartInput, nowMs: number): UserColdStartResult {
    const genreTaste = Object.fromEntries(input.genres.map((genre) => [genre.toLowerCase(), 0.78]));
    const artistAffinity = Object.fromEntries(
        input.artistIds.map((id) => [id, { value: 0.82, confidence: 0.6, observations: 1, lastObservedAt: nowMs }]),
    );
    const trackAffinity = Object.fromEntries(
        input.trackIds.map((id) => [id, { value: 0.88, confidence: 0.65, observations: 1, lastObservedAt: nowMs }]),
    );
    const experienceWeights = Object.fromEntries(
        input.experiences.map((id) => [id, round(1 / Math.max(1, input.experiences.length))]),
    );
    const evidence = input.artistIds.length + input.genres.length + input.trackIds.length + input.experiences.length;
    const missing = [
        !input.artistIds.length ? "artists" : "",
        !input.genres.length ? "genres" : "",
        input.trackIds.length < 5 ? "five-tracks" : "",
        !input.experiences.length ? "experiences" : "",
    ].filter(Boolean);
    const discovery = clamp01(input.familiarityVsDiscovery);
    return {
        profile: {
            longTerm: genreTaste,
            recent: {},
            contextual: {},
            positivePreferences: [],
            negativePreferences: [],
            artistAffinity,
            genreAffinity: Object.fromEntries(
                input.genres.map((genre) => [
                    genre.toLowerCase(),
                    { value: 0.78, confidence: 0.55, observations: 1, lastObservedAt: nowMs },
                ]),
            ),
            trackAffinity,
            noveltyPreference: discovery,
            familiarityPreference: 1 - discovery,
            explorationTolerance: round(0.25 + discovery * 0.65),
        },
        experienceWeights,
        confidence: round(clamp01(0.18 + evidence * 0.045)),
        missing,
    };
}

export interface CrowdColdStartResult {
    crowd: CrowdTaste;
    bridgeGenres: string[];
    confidence: number;
}

export function buildCrowdColdStart(members: readonly CrowdMemberState[]): CrowdColdStartResult {
    const crowd = buildCrowdTaste(members);
    const genres = [...new Set(members.flatMap((member) => Object.keys(member.taste)))];
    const bridgeGenres = genres.filter((genre) => {
        const values = members.map((member) => member.taste[genre] ?? 0);
        return Math.min(...values) >= 0.35 && Math.max(...values) >= 0.65;
    });
    return { crowd, bridgeGenres, confidence: round(clamp01(0.2 + members.length * 0.12 - crowd.diversity * 0.18)) };
}

export interface TrackColdStartInput {
    trackId: string;
    audioFeatures: number;
    genreConfidence: number;
    artistGraphConfidence: number;
    lyricsConfidence: number;
    moodConfidence: number;
    embeddingConfidence: number;
    metadataConfidence: number;
}

export interface TrackColdStartRepresentation extends TrackColdStartInput {
    contentConfidence: number;
    collaborativeWeight: 0;
    coldStart: true;
}

export function buildTrackColdStart(input: TrackColdStartInput): TrackColdStartRepresentation {
    const contentConfidence =
        input.audioFeatures * 0.18 +
        input.genreConfidence * 0.16 +
        input.artistGraphConfidence * 0.13 +
        input.lyricsConfidence * 0.08 +
        input.moodConfidence * 0.13 +
        input.embeddingConfidence * 0.2 +
        input.metadataConfidence * 0.12;
    return { ...input, contentConfidence: round(clamp01(contentConfidence)), collaborativeWeight: 0, coldStart: true };
}

export type CandidateSource =
    | "personal-cf"
    | "content-similarity"
    | "social"
    | "charts"
    | "new-releases"
    | "long-tail-discovery"
    | "director-bridge"
    | "requests";

export const DEFAULT_SOURCE_QUOTAS: Record<CandidateSource, number> = {
    "personal-cf": 30,
    "content-similarity": 20,
    social: 15,
    charts: 10,
    "new-releases": 10,
    "long-tail-discovery": 10,
    "director-bridge": 10,
    requests: 5,
};

export interface SourceCandidate<T = unknown> {
    id: string;
    value: T;
    retrievalScore: number;
}

export interface AttributedCandidate<T = unknown> {
    id: string;
    value: T;
    sources: CandidateSource[];
    sourceScores: Partial<Record<CandidateSource, number>>;
    retrievalScore: number;
}

/** Apply per-source quotas before deduplication and retain every source attribution. */
export function mergeCandidateSources<T>(
    sources: Partial<Record<CandidateSource, readonly SourceCandidate<T>[]>>,
    quotas: Record<CandidateSource, number> = DEFAULT_SOURCE_QUOTAS,
): AttributedCandidate<T>[] {
    const merged = new Map<string, AttributedCandidate<T>>();
    for (const [source, candidates] of Object.entries(sources) as [CandidateSource, readonly SourceCandidate<T>[]][]) {
        for (const candidate of [...candidates]
            .sort((a, b) => b.retrievalScore - a.retrievalScore)
            .slice(0, quotas[source])) {
            const existing = merged.get(candidate.id);
            if (existing) {
                if (!existing.sources.includes(source)) existing.sources.push(source);
                existing.sourceScores[source] = clamp01(candidate.retrievalScore);
                existing.retrievalScore = round(
                    Math.max(existing.retrievalScore, candidate.retrievalScore) +
                        Math.min(0.15, existing.sources.length * 0.025),
                );
            } else {
                merged.set(candidate.id, {
                    id: candidate.id,
                    value: candidate.value,
                    sources: [source],
                    sourceScores: { [source]: clamp01(candidate.retrievalScore) },
                    retrievalScore: round(clamp01(candidate.retrievalScore)),
                });
            }
        }
    }
    return [...merged.values()].sort((a, b) => b.retrievalScore - a.retrievalScore || a.id.localeCompare(b.id));
}

export interface HybridSignals {
    collaborative: number;
    content: number;
    knowledgeGraph: number;
    sessionContext: number;
    socialGraph: number;
    chartsTrends: number;
    directorFeatures: number;
}

export function hybridRecommendationScore(
    signals: HybridSignals,
    availability: Partial<Record<keyof HybridSignals, boolean>> = {},
): { score: number; contributions: Partial<Record<keyof HybridSignals, number>> } {
    const weights: Record<keyof HybridSignals, number> = {
        collaborative: 0.2,
        content: 0.17,
        knowledgeGraph: 0.13,
        sessionContext: 0.17,
        socialGraph: 0.1,
        chartsTrends: 0.08,
        directorFeatures: 0.15,
    };
    const keys = Object.keys(weights) as (keyof HybridSignals)[];
    const active = keys.filter((key) => availability[key] !== false);
    const totalWeight = active.reduce((sum, key) => sum + weights[key], 0) || 1;
    const contributions = Object.fromEntries(
        active.map((key) => [key, round((clamp01(signals[key]) * weights[key]) / totalWeight)]),
    );
    return { score: round(Object.values(contributions).reduce((sum, value) => sum + (value ?? 0), 0)), contributions };
}

export type RecommendationReasonCategory =
    | "for-you"
    | "because-you-like"
    | "friends-listening"
    | "rising-near-you"
    | "perfect-for-session"
    | "great-next-mix"
    | "rediscovered"
    | "hidden-gem";

export interface RecommendationExplanation {
    categories: RecommendationReasonCategory[];
    reasons: string[];
    sources: CandidateSource[];
}

export function explainRecommendation(
    candidate: Pick<AttributedCandidate, "sources">,
    objectives: RecommendationObjectives,
    context: { artistAffinity?: number; rediscovery?: number; hiddenGem?: number } = {},
): RecommendationExplanation {
    const categories: RecommendationReasonCategory[] = [];
    const reasons: string[] = [];
    if ((context.artistAffinity ?? 0) >= 0.65) {
        categories.push("because-you-like");
        reasons.push("You often listen to this artist");
    } else if (objectives.userSatisfaction >= 0.7) {
        categories.push("for-you");
        reasons.push("Strong personal taste match");
    }
    if (candidate.sources.includes("social")) {
        categories.push("friends-listening");
        reasons.push("Trending among your relevant communities");
    }
    if (objectives.localRelevance >= 0.7) {
        categories.push("rising-near-you");
        reasons.push("Rising in your local context");
    }
    if (objectives.sessionFit >= 0.72) {
        categories.push("perfect-for-session");
        reasons.push("Fits the current experience and session phase");
    }
    if (objectives.transitionQuality >= 0.72) {
        categories.push("great-next-mix");
        reasons.push("Compatible next transition and route");
    }
    if ((context.rediscovery ?? 0) >= 0.7) {
        categories.push("rediscovered");
        reasons.push("A past favorite ready for rediscovery");
    }
    if ((context.hiddenGem ?? 0) >= 0.7) {
        categories.push("hidden-gem");
        reasons.push("Relevant long-tail discovery");
    }
    return { categories: [...new Set(categories)], reasons, sources: [...candidate.sources] };
}

export interface RecommendationObjectiveControls {
    familiarDiscover: number;
    popularHiddenGems: number;
    smoothSurprise: number;
    personalCrowd: number;
}

export function weightsFromControls(
    experience: ConcreteExperienceId,
    controls: RecommendationObjectiveControls,
): RecommendationWeights {
    const weights = recommendationWeights(experience, {
        crowdActive: controls.personalCrowd > 0.5,
        discoveryBudget: controls.familiarDiscover,
    });
    weights.discovery = round(clamp01(controls.familiarDiscover));
    weights.novelty = round(clamp01(controls.smoothSurprise));
    weights.crowdSatisfaction = round(clamp01(controls.personalCrowd));
    weights.userSatisfaction = round(clamp01(1.2 - controls.personalCrowd * 0.45));
    weights.trendRelevance = round(clamp01(1 - controls.popularHiddenGems) * 0.65);
    weights.diversity = round(clamp01(0.35 + controls.popularHiddenGems * 0.65));
    return weights;
}

export interface PersonalizedDiversityPreferences {
    diversityPreference: number;
    fairnessPreference: number;
    artistDiversityPreference: number;
    genreDiversityPreference: number;
}

export function personalizeDiversityWeights(
    weights: RecommendationWeights,
    preferences: PersonalizedDiversityPreferences,
): RecommendationWeights {
    return {
        ...weights,
        diversity: round(
            clamp01(
                (preferences.diversityPreference +
                    preferences.artistDiversityPreference +
                    preferences.genreDiversityPreference) /
                    3,
            ),
        ),
        fairness: round(clamp01(preferences.fairnessPreference)),
    };
}

export function artistExposureContribution(
    relevance: number,
    emergingArtistScore: number,
    exposureWeight: number,
    relevanceFloor = 0.55,
): { allowed: boolean; contribution: number; reason: string } {
    if (relevance < relevanceFloor)
        return {
            allowed: false,
            contribution: 0,
            reason: `relevance ${relevance.toFixed(2)} below exposure floor ${relevanceFloor.toFixed(2)}`,
        };
    return {
        allowed: true,
        contribution: round(clamp01(emergingArtistScore) * clamp01(exposureWeight) * Math.min(1, relevance)),
        reason: "artist exposure applied within acceptable relevance",
    };
}

export interface RecommendationSafetyMetrics {
    satisfaction: number;
    diversity: number;
    novelty: number;
    discovery: number;
    artistDiversity: number;
    genreDiversity: number;
    longTailExposure: number;
    sessionCoherence: number;
}

export function assessHomogenizationSafety(metrics: RecommendationSafetyMetrics): {
    safe: boolean;
    score: number;
    issues: string[];
} {
    const issues: string[] = [];
    if (metrics.artistDiversity < 0.25) issues.push("artist-homogenization");
    if (metrics.genreDiversity < 0.22) issues.push("genre-homogenization");
    if (metrics.novelty < 0.12 && metrics.discovery < 0.12) issues.push("no-exploration");
    if (metrics.sessionCoherence < 0.35) issues.push("incoherent-exploration");
    const score = Object.values(metrics).reduce((sum, value) => sum + clamp01(value), 0) / 8;
    return { safe: issues.length === 0, score: round(score), issues };
}

export interface CuratorProfile {
    id: string;
    name: string;
    seedTrackIds: string[];
    allowedGenres: string[];
    minimumQuality: number;
    journeyStyle: "rising" | "steady" | "wave" | "falling";
}

export interface CuratedCandidate {
    trackId: string;
    genres: string[];
    quality: number;
    personalFit: number;
}
export function applyCuratorProfile(
    candidates: readonly CuratedCandidate[],
    curator: CuratorProfile,
): CuratedCandidate[] {
    return candidates
        .filter(
            (candidate) =>
                candidate.quality >= curator.minimumQuality &&
                (!curator.allowedGenres.length ||
                    candidate.genres.some((genre) => curator.allowedGenres.includes(genre))),
        )
        .sort(
            (a, b) =>
                Number(curator.seedTrackIds.includes(b.trackId)) - Number(curator.seedTrackIds.includes(a.trackId)) ||
                b.personalFit - a.personalFit,
        );
}

export type RecommendationUserIntent =
    | "discover"
    | "background"
    | "party"
    | "specific-track"
    | "explore-artist"
    | "chill"
    | "favorites";
export type RecommendationMetricEvent = "skip" | "save" | "completion" | "session-exit" | "request";

export function intentAwareMetric(
    intent: RecommendationUserIntent,
    event: RecommendationMetricEvent,
): { value: number; interpretation: string } {
    const table: Record<RecommendationUserIntent, Record<RecommendationMetricEvent, number>> = {
        discover: { skip: -0.15, save: 1, completion: 0.6, "session-exit": -0.35, request: 0.5 },
        background: { skip: -0.35, save: 0.45, completion: 0.8, "session-exit": -0.1, request: 0.3 },
        party: { skip: -0.65, save: 0.35, completion: 0.55, "session-exit": -0.75, request: 0.9 },
        "specific-track": { skip: -0.8, save: 0.4, completion: 0.75, "session-exit": -0.4, request: 1 },
        "explore-artist": { skip: -0.3, save: 0.8, completion: 0.65, "session-exit": -0.35, request: 0.5 },
        chill: { skip: -0.45, save: 0.55, completion: 0.75, "session-exit": -0.3, request: 0.45 },
        favorites: { skip: -0.75, save: 0.2, completion: 0.9, "session-exit": -0.55, request: 0.6 },
    };
    const value = table[intent][event];
    return { value, interpretation: `${event} under ${intent} intent has weight ${value}` };
}
