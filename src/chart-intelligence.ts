export interface PopularityState {
    catalogPercentile: number;
    userPopularityPreference: number;
    recentSessionPopularity: number;
    popularityBiasPenalty: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

/** Penalize systematic overexposure, not popularity itself. */
export function assessPopularityBias(
    catalogPercentile: number,
    userPopularityPreference: number,
    recentSessionPopularity: number,
): PopularityState {
    const popularity = clamp01(catalogPercentile);
    const preference = clamp01(userPopularityPreference);
    const recent = clamp01(recentSessionPopularity);
    const preferenceExcess = Math.max(0, popularity - preference - 0.2);
    const sessionExcess = Math.max(0, recent - preference - 0.15);
    return {
        catalogPercentile: popularity,
        userPopularityPreference: preference,
        recentSessionPopularity: recent,
        popularityBiasPenalty: round(preferenceExcess * 0.55 + sessionExcess * 0.45),
    };
}

export type ChartProduct =
    | "global"
    | "country"
    | "region"
    | "genre"
    | "subgenre"
    | "friends"
    | "community"
    | "crowd"
    | "rising"
    | "viral"
    | "new"
    | "personal"
    | "hidden-gems"
    | "rediscovered"
    | "raw-popularity"
    | "trending"
    | "discovery"
    | "fresh";

export interface ChartSignal {
    rank: number;
    previousRank?: number;
    velocity: number;
    acceleration: number;
    uniqueListeners: number;
    totalListens: number;
    saveRate?: number;
    completionRate?: number;
    geographicSpread?: number;
    communitySpread?: number;
    ageDays: number;
}

export type TrendClass = "rising" | "breaking" | "viral" | "stable-hit" | "falling" | "evergreen";

export interface TrendAssessment {
    class: TrendClass;
    momentum: number;
    velocity: number;
    acceleration: number;
    reasons: string[];
}

export function assessTrend(signal: ChartSignal): TrendAssessment {
    const rankVelocity = signal.previousRank === undefined ? signal.velocity : signal.previousRank - signal.rank;
    const listenStrength = clamp01(Math.log10(Math.max(1, signal.totalListens)) / 7);
    const listenerQuality = clamp01((signal.uniqueListeners / Math.max(1, signal.totalListens)) * 8);
    const save = clamp01(signal.saveRate ?? 0.25);
    const completion = clamp01(signal.completionRate ?? 0.55);
    const spread = clamp01(((signal.geographicSpread ?? 0.3) + (signal.communitySpread ?? 0.3)) / 2);
    const velocity = Math.tanh(rankVelocity / 100);
    const acceleration = Math.tanh(signal.acceleration / 50);
    const momentum = clamp01(
        0.28 +
            velocity * 0.24 +
            acceleration * 0.12 +
            listenStrength * 0.1 +
            listenerQuality * 0.08 +
            save * 0.08 +
            completion * 0.05 +
            spread * 0.13,
    );
    let trendClass: TrendClass;
    if (rankVelocity < -10 || signal.velocity < -10) trendClass = "falling";
    else if (signal.ageDays > 365 && Math.abs(rankVelocity) < 5) trendClass = "evergreen";
    else if (momentum >= 0.82 && spread >= 0.65) trendClass = "viral";
    else if (momentum >= 0.7 && rankVelocity >= 100) trendClass = "breaking";
    else if (momentum >= 0.58 && rankVelocity > 5) trendClass = "rising";
    else trendClass = "stable-hit";
    const reasons = [
        `rank velocity ${rankVelocity >= 0 ? "+" : ""}${rankVelocity}`,
        `listener quality ${round(listenerQuality)}`,
        `spread ${round(spread)}`,
    ];
    return {
        class: trendClass,
        momentum: round(momentum),
        velocity: round(velocity),
        acceleration: round(acceleration),
        reasons,
    };
}

export interface ChartTrack {
    trackId: string;
    artistId: string;
    releasedAtMs: number;
    popularity: number;
    signal: ChartSignal;
    personalAffinity?: number;
    discoveryScore?: number;
    communityScore?: number;
}

export interface RankedChartTrack extends ChartTrack {
    chartScore: number;
    trend: TrendAssessment;
    methodology: string[];
}

function productScore(track: ChartTrack, product: ChartProduct, nowMs: number): number {
    const trend = assessTrend(track.signal);
    const freshness = clamp01(1 - (nowMs - track.releasedAtMs) / (365 * 86_400_000));
    if (product === "raw-popularity" || product === "global") return clamp01(track.popularity);
    if (product === "rising" || product === "trending") return trend.momentum;
    if (product === "viral") return clamp01(trend.momentum * 0.75 + (track.signal.communitySpread ?? 0) * 0.25);
    if (product === "new" || product === "fresh") return clamp01(freshness * 0.7 + trend.momentum * 0.3);
    if (product === "hidden-gems" || product === "discovery")
        return clamp01((track.discoveryScore ?? 0.5) * 0.55 + (1 - track.popularity) * 0.3 + trend.momentum * 0.15);
    if (product === "personal") return clamp01((track.personalAffinity ?? 0.5) * 0.75 + trend.momentum * 0.25);
    if (["friends", "community", "crowd"].includes(product))
        return clamp01((track.communityScore ?? 0.5) * 0.7 + trend.momentum * 0.3);
    if (product === "rediscovered")
        return clamp01(
            (track.personalAffinity ?? 0.5) * 0.5 + Number(track.signal.ageDays > 365) * 0.3 + trend.momentum * 0.2,
        );
    return clamp01(track.popularity * 0.4 + trend.momentum * 0.3 + (track.personalAffinity ?? 0.5) * 0.3);
}

/** Transparent product-specific charts with artist and catalog-age domination limits. */
export function buildChart(
    tracks: readonly ChartTrack[],
    product: ChartProduct,
    options: { limit?: number; maxPerArtist?: number; nowMs?: number } = {},
): RankedChartTrack[] {
    const nowMs = options.nowMs ?? Date.now();
    const maxPerArtist = Math.max(1, options.maxPerArtist ?? 3);
    const artistCounts = new Map<string, number>();
    const ranked = tracks
        .map((track) => ({
            ...track,
            chartScore: round(productScore(track, product, nowMs)),
            trend: assessTrend(track.signal),
            methodology: [
                `product=${product}`,
                "artist-cap",
                product === "fresh" || product === "new" ? "freshness-weighted" : "multi-signal",
            ],
        }))
        .sort((a, b) => b.chartScore - a.chartScore || a.trackId.localeCompare(b.trackId));
    const result: RankedChartTrack[] = [];
    for (const track of ranked) {
        const count = artistCounts.get(track.artistId) ?? 0;
        if (count >= maxPerArtist) continue;
        artistCounts.set(track.artistId, count + 1);
        result.push(track);
        if (result.length >= (options.limit ?? 100)) break;
    }
    return result;
}

export interface ChartDataSource {
    id: "listenbrainz" | "lastfm" | "ifpi";
    signals: string[];
    licenseReviewRequired: true;
    ingestion: "api" | "published-chart";
}

export const CHART_DATA_SOURCES: readonly ChartDataSource[] = [
    {
        id: "listenbrainz",
        signals: ["total-listens", "unique-listeners", "artist-recordings"],
        licenseReviewRequired: true,
        ingestion: "api",
    },
    { id: "lastfm", signals: ["top-tracks", "tag-charts"], licenseReviewRequired: true, ingestion: "api" },
    {
        id: "ifpi",
        signals: ["global-multi-market-consumption"],
        licenseReviewRequired: true,
        ingestion: "published-chart",
    },
] as const;

export interface PersonalChartInteraction {
    trackId: string;
    artistId: string;
    genre: string;
    context?: string;
    playedAtMs: number;
    completed: boolean;
    discovery: boolean;
}

export interface PersonalChartSummary {
    topTracks: string[];
    risingArtists: { artistId: string; recentShare: number; previousShare: number; growth: number }[];
    newDiscoveries: string[];
    forgottenFavorites: string[];
    topGenres: string[];
    contextTracks: Record<string, string[]>;
}

export function buildPersonalCharts(
    interactions: readonly PersonalChartInteraction[],
    nowMs: number,
): PersonalChartSummary {
    const count = (items: readonly PersonalChartInteraction[], key: "trackId" | "artistId" | "genre") => {
        const values = new Map<string, number>();
        for (const item of items) values.set(item[key], (values.get(item[key]) ?? 0) + (item.completed ? 1 : 0.5));
        return [...values].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    };
    const recent = interactions.filter((item) => nowMs - item.playedAtMs <= 30 * 86_400_000);
    const previous = interactions.filter(
        (item) => nowMs - item.playedAtMs > 30 * 86_400_000 && nowMs - item.playedAtMs <= 180 * 86_400_000,
    );
    const artistIds = [...new Set(interactions.map((item) => item.artistId))];
    const risingArtists = artistIds
        .map((artistId) => {
            const recentShare = recent.filter((item) => item.artistId === artistId).length / Math.max(1, recent.length);
            const previousShare =
                previous.filter((item) => item.artistId === artistId).length / Math.max(1, previous.length);
            return {
                artistId,
                recentShare: round(recentShare),
                previousShare: round(previousShare),
                growth: round(recentShare - previousShare),
            };
        })
        .sort((a, b) => b.growth - a.growth);
    const favoriteTracks = count(
        interactions.filter((item) => item.completed),
        "trackId",
    ).map(([id]) => id);
    const recentTracks = new Set(recent.map((item) => item.trackId));
    const contexts = [
        ...new Set(interactions.map((item) => item.context).filter((value): value is string => Boolean(value))),
    ];
    return {
        topTracks: count(interactions, "trackId")
            .slice(0, 50)
            .map(([id]) => id),
        risingArtists,
        newDiscoveries: recent
            .filter((item) => item.discovery)
            .sort((a, b) => b.playedAtMs - a.playedAtMs)
            .map((item) => item.trackId)
            .filter((id, index, array) => array.indexOf(id) === index),
        forgottenFavorites: favoriteTracks.filter((id) => !recentTracks.has(id)),
        topGenres: count(interactions, "genre").map(([id]) => id),
        contextTracks: Object.fromEntries(
            contexts.map((context) => [
                context,
                count(
                    interactions.filter((item) => item.context === context),
                    "trackId",
                ).map(([id]) => id),
            ]),
        ),
    };
}

export interface SocialChartInteraction {
    trackId: string;
    userId: string;
    shared: boolean;
    addedToParty: boolean;
    lovedDiscovery: boolean;
    observedAtMs: number;
}

export function buildSocialChart(
    interactions: readonly SocialChartInteraction[],
    limit = 50,
): { trackId: string; score: number; uniqueUsers: number; reasons: string[] }[] {
    const ids = [...new Set(interactions.map((item) => item.trackId))];
    return ids
        .map((trackId) => {
            const items = interactions.filter((item) => item.trackId === trackId);
            const uniqueUsers = new Set(items.map((item) => item.userId)).size;
            const shares = items.filter((item) => item.shared).length;
            const parties = items.filter((item) => item.addedToParty).length;
            const discoveries = items.filter((item) => item.lovedDiscovery).length;
            const score = uniqueUsers * 2 + shares * 1.5 + parties * 2 + discoveries * 2.5;
            return {
                trackId,
                score: round(score),
                uniqueUsers,
                reasons: [
                    `${uniqueUsers} unique users`,
                    `${shares} shares`,
                    `${parties} party adds`,
                    `${discoveries} loved discoveries`,
                ],
            };
        })
        .sort((a, b) => b.score - a.score || a.trackId.localeCompare(b.trackId))
        .slice(0, Math.max(1, limit));
}

export function chartTasteFit(
    chartMomentum: number,
    userTasteCompatibility: number,
    sessionCompatibility: number,
): number {
    return round(clamp01(chartMomentum) * clamp01(userTasteCompatibility) * clamp01(sessionCompatibility));
}

export interface GenreChartCandidate {
    trackId: string;
    baseScore: number;
    genres: { genre: string; confidence: number }[];
}

export function buildGenreChart(
    candidates: readonly GenreChartCandidate[],
    genre: string,
    limit = 100,
): { trackId: string; score: number; genreConfidence: number }[] {
    const normalized = genre.trim().toLowerCase();
    return candidates
        .map((candidate) => {
            const genreConfidence = clamp01(
                candidate.genres.find((entry) => entry.genre.trim().toLowerCase() === normalized)?.confidence ?? 0,
            );
            return {
                trackId: candidate.trackId,
                score: round(clamp01(candidate.baseScore) * genreConfidence),
                genreConfidence: round(genreConfidence),
            };
        })
        .filter((entry) => entry.genreConfidence > 0)
        .sort((a, b) => b.score - a.score || a.trackId.localeCompare(b.trackId))
        .slice(0, Math.max(1, limit));
}

export type ChartScope = "global" | "country" | "region" | "city" | "friend-circle" | "party" | "community";
export interface SocialChartPrivacy {
    publishable: boolean;
    scope: ChartScope;
    uniqueListeners: number;
    minimumThreshold: number;
    aggregationWindowHours: number;
    exactCountsVisible: boolean;
    reason: string;
}

export function assessSocialChartPrivacy(input: {
    scope: ChartScope;
    uniqueListeners: number;
    groupPrivate?: boolean;
    aggregationWindowHours?: number;
    minimumThreshold?: number;
}): SocialChartPrivacy {
    const social = ["friend-circle", "party", "community", "city"].includes(input.scope);
    const minimumThreshold = Math.max(input.minimumThreshold ?? (social ? 10 : 25), social ? 5 : 10);
    const aggregationWindowHours = Math.max(input.aggregationWindowHours ?? (social ? 24 : 6), social ? 12 : 1);
    const enoughListeners = input.uniqueListeners >= minimumThreshold;
    const publishable = enoughListeners && !input.groupPrivate;
    return {
        publishable,
        scope: input.scope,
        uniqueListeners: Math.max(0, input.uniqueListeners),
        minimumThreshold,
        aggregationWindowHours,
        exactCountsVisible: !social && input.uniqueListeners >= minimumThreshold * 5,
        reason: input.groupPrivate
            ? "private group charts remain private"
            : !enoughListeners
              ? `requires at least ${minimumThreshold} unique listeners`
              : "privacy threshold and aggregation window satisfied",
    };
}

export interface TrendAuthenticitySignals {
    uniqueListeners: number;
    totalListens: number;
    accountAgeDiversity: number;
    geographicDistribution: number;
    saveRate: number;
    completionRate: number;
    organicSpread: number;
}

export interface TrendAuthenticity {
    authenticity: number;
    confidenceMultiplier: number;
    suspicious: boolean;
    anomalies: string[];
}

export function assessTrendAuthenticity(signals: TrendAuthenticitySignals): TrendAuthenticity {
    const repeatRatio = signals.totalListens > 0 ? signals.totalListens / Math.max(1, signals.uniqueListeners) : 0;
    const anomalies: string[] = [];
    if (repeatRatio > 18) anomalies.push("extreme-repeat-ratio");
    if (signals.accountAgeDiversity < 0.2) anomalies.push("low-account-age-diversity");
    if (signals.geographicDistribution < 0.12) anomalies.push("geographic-concentration");
    if (signals.saveRate < 0.03 && signals.completionRate < 0.25) anomalies.push("weak-organic-engagement");
    if (signals.organicSpread < 0.15) anomalies.push("low-organic-spread");
    const positive =
        clamp01(signals.accountAgeDiversity) * 0.18 +
        clamp01(signals.geographicDistribution) * 0.17 +
        clamp01(signals.saveRate * 3) * 0.16 +
        clamp01(signals.completionRate) * 0.16 +
        clamp01(signals.organicSpread) * 0.2 +
        clamp01(signals.uniqueListeners / 1_000) * 0.13;
    const authenticity = clamp01(positive - anomalies.length * 0.1);
    return {
        authenticity: round(authenticity),
        confidenceMultiplier: round(0.2 + authenticity * 0.8),
        suspicious: anomalies.length >= 2 || authenticity < 0.35,
        anomalies,
    };
}

export interface ChartEntryConfidenceInput {
    uniqueListeners: number;
    sampleSize: number;
    sourceAgreement: number;
    geographicCoverage: number;
    authenticity: number;
    scope: ChartScope;
}

export function chartEntryConfidence(input: ChartEntryConfidenceInput): number {
    const sample = clamp01(Math.log10(Math.max(1, input.sampleSize)) / 6);
    const listeners = clamp01(Math.log10(Math.max(1, input.uniqueListeners)) / 5);
    const scopeMultiplier = {
        global: 1,
        country: 0.95,
        region: 0.85,
        city: 0.72,
        "friend-circle": 0.58,
        party: 0.48,
        community: 0.68,
    }[input.scope];
    return round(
        clamp01(
            (sample * 0.24 +
                listeners * 0.2 +
                clamp01(input.sourceAgreement) * 0.2 +
                clamp01(input.geographicCoverage) * 0.14 +
                clamp01(input.authenticity) * 0.22) *
                scopeMultiplier,
        ),
    );
}
