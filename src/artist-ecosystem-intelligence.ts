const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
export type ArtistRelationshipStage = "discovered" | "curious" | "returning" | "fan" | "core-fan";
export interface ArtistRelationship {
    stage: ArtistRelationshipStage;
    affinity: number;
    familiarity: number;
    intentionalListening: number;
    repeatBehavior: number;
    catalogDepth: number;
    confidence: number;
}
export type ArtistSignal =
    | "passive-stream"
    | "completion"
    | "repeat"
    | "save"
    | "playlist-add"
    | "artist-page"
    | "manual-second-track"
    | "album-exploration"
    | "concert-merch"
    | "intentional-session";
const SIGNAL_WEIGHT: Record<ArtistSignal, number> = {
    "passive-stream": 0.02,
    completion: 0.08,
    repeat: 0.13,
    save: 0.18,
    "playlist-add": 0.25,
    "artist-page": 0.22,
    "manual-second-track": 0.28,
    "album-exploration": 0.3,
    "concert-merch": 0.35,
    "intentional-session": 0.4,
};
export function developArtistRelationship(
    current: ArtistRelationship,
    signals: readonly ArtistSignal[],
): ArtistRelationship & { relationshipValue: number } {
    const relationshipValue = clamp01(signals.reduce((sum, signal) => sum + SIGNAL_WEIGHT[signal], 0));
    const stages: ArtistRelationshipStage[] = ["discovered", "curious", "returning", "fan", "core-fan"];
    const advance = relationshipValue >= 0.6 ? 2 : relationshipValue >= 0.2 ? 1 : 0;
    return {
        ...current,
        stage: stages[Math.min(stages.length - 1, stages.indexOf(current.stage) + advance)]!,
        affinity: clamp01(current.affinity + relationshipValue * 0.2),
        intentionalListening: clamp01(current.intentionalListening + relationshipValue * 0.25),
        repeatBehavior: clamp01(
            current.repeatBehavior +
                signals.filter((signal) => signal === "repeat" || signal === "intentional-session").length * 0.1,
        ),
        confidence: clamp01(current.confidence + signals.length * 0.03),
        relationshipValue,
    };
}
export function artistOpportunity(
    relationship: ArtistRelationship,
    sessionFit: number,
    saturation: number,
): { opportunity: number; saturationPenalty: number; floodGuard: boolean } {
    const opportunity = clamp01(
        relationship.affinity * 0.3 +
            relationship.intentionalListening * 0.25 +
            (1 - relationship.catalogDepth) * 0.15 +
            sessionFit * 0.3,
    );
    const saturationPenalty = clamp01(saturation ** 2);
    return { opportunity: clamp01(opportunity - saturationPenalty), saturationPenalty, floodGuard: saturation > 0.6 };
}

export interface ArtistMarketAffinity {
    market: string;
    listeners: number;
    fanIntensity: number;
    trend: number;
    confidence: number;
}
export function marketSignal(
    market: ArtistMarketAffinity,
    globalPopularity: number,
): { localFandom: number; globalPopularity: number; independent: true } {
    return {
        localFandom: clamp01(market.fanIntensity * 0.7 + market.trend * 0.3),
        globalPopularity: clamp01(globalPopularity),
        independent: true,
    };
}
export interface ReleaseContext {
    releaseAgeDays: number;
    isNewRelease: boolean;
    isFocusTrack: boolean;
    artistRelationshipStage: number;
}
export function releaseOpportunity(
    release: ReleaseContext,
    userAffinity: number,
    sessionFit: number,
    disliked: boolean,
): { boost: number; hardBoost: false; candidateSource: true } {
    const boost = disliked
        ? 0
        : clamp01(
              (release.isNewRelease ? 0.15 : 0) +
                  (release.isFocusTrack ? 0.08 : 0) +
                  userAffinity * 0.35 +
                  sessionFit * 0.42,
          );
    return { boost, hardBoost: false, candidateSource: true };
}
export interface ArtistIntent {
    focusTrack?: string;
    entryTracks?: string[];
    fanFavorites?: string[];
    deepCuts?: string[];
    liveHighlights?: string[];
    releasePriority?: number;
}
export function artistIntentScore(
    intent: ArtistIntent,
    trackId: string,
    gates: { userHardPreferences: boolean; rights: boolean; sessionFit: number; quality: number },
): { eligible: boolean; score: number; softSignal: true } {
    const eligible = gates.userHardPreferences && gates.rights && gates.sessionFit >= 0.5 && gates.quality >= 0.7;
    const marked =
        intent.focusTrack === trackId ||
        [intent.entryTracks, intent.fanFavorites, intent.deepCuts, intent.liveHighlights].some((list) =>
            list?.includes(trackId),
        );
    return {
        eligible,
        score: eligible && marked ? clamp01((intent.releasePriority ?? 0.5) * 0.15) : 0,
        softSignal: true,
    };
}
export function artistCuratedJourney(intent: ArtistIntent): string[] {
    return [intent.entryTracks?.[0], intent.fanFavorites?.[0], intent.deepCuts?.[0], intent.focusTrack].filter(
        (value): value is string => Boolean(value),
    );
}

export const ARTIST_WORLD_GRAPH = [
    "tracks",
    "albums",
    "eras",
    "collaborations",
    "remixes",
    "influences",
    "visual-identity",
    "themes",
    "stories",
    "fan-communities",
] as const;
export interface ArtistEraAffinity {
    artistId: string;
    eraId: string;
    affinity: number;
}
export function eraAwareArtistAffinity(
    eras: readonly ArtistEraAffinity[],
    artistId: string,
    eraId: string,
): { affinity: number; wholeArtistAssumption: false } {
    return {
        affinity: clamp01(eras.find((era) => era.artistId === artistId && era.eraId === eraId)?.affinity ?? 0.5),
        wholeArtistAssumption: false,
    };
}

export interface ArtistExposureState {
    impressions: number;
    plays: number;
    qualifiedImpressions: number;
    exposureShare: number;
    catalogShare: number;
    opportunityShare: number;
}
export function opportunityNormalizedFairness(state: ArtistExposureState): {
    fairness: number;
    catalogShareNotDefinition: true;
    qualifiedOnly: true;
} {
    return {
        fairness: state.opportunityShare > 0 ? clamp01(state.exposureShare / state.opportunityShare) : 1,
        catalogShareNotDefinition: true,
        qualifiedOnly: true,
    };
}
export function exposureBuckets(
    states: readonly { tier: "top-1" | "top-10" | "middle" | "long-tail" | "new"; exposure: number }[],
): Record<string, number> {
    return Object.fromEntries(states.map((state) => [state.tier, state.exposure]));
}
export function diversityAudit(
    items: readonly { trackId: string; genre: string; artistId: string; labelId: string }[],
): { track: number; genre: number; artist: number; label: number; labelExposureConcentration: number } {
    const ratio = (values: readonly string[]) => new Set(values).size / Math.max(1, values.length);
    const counts: Record<string, number> = {};
    for (const item of items) counts[item.labelId] = (counts[item.labelId] ?? 0) + 1;
    const concentration = Object.values(counts).reduce(
        (sum, count) => sum + (count / Math.max(1, items.length)) ** 2,
        0,
    );
    return {
        track: ratio(items.map((item) => item.trackId)),
        genre: ratio(items.map((item) => item.genre)),
        artist: ratio(items.map((item) => item.artistId)),
        label: ratio(items.map((item) => item.labelId)),
        labelExposureConcentration: concentration,
    };
}
export function counterfactualSupplierEvaluation(input: {
    relevanceBefore: number;
    relevanceAfter: number;
    fairnessBefore: number;
    fairnessAfter: number;
}): { relevanceChange: number; fairnessChange: number; satisfactionRisk: number; shadowOnly: true } {
    const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
    return {
        relevanceChange: round(input.relevanceAfter - input.relevanceBefore),
        fairnessChange: round(input.fairnessAfter - input.fairnessBefore),
        satisfactionRisk: round(clamp01(input.relevanceBefore - input.relevanceAfter)),
        shadowOnly: true,
    };
}
export function artistDiscoveryQuality(input: {
    userFit: number;
    sessionFit: number;
    bridgePotential: number;
    obscureOnly: boolean;
}): { quality: number; artificialInsertion: boolean } {
    return {
        quality: clamp01(input.userFit * 0.4 + input.sessionFit * 0.35 + input.bridgePotential * 0.25),
        artificialInsertion: input.obscureOnly && input.userFit < 0.5,
    };
}

export interface EngagementQuality {
    activeChoice: number;
    completion: number;
    repeat: number;
    save: number;
    sessionIntentionality: number;
}
export function engagementQuality(input: EngagementQuality): {
    score: number;
    royaltyValue: false;
    activeRelationship: boolean;
} {
    const score = clamp01(
        input.activeChoice * 0.25 +
            input.completion * 0.15 +
            input.repeat * 0.2 +
            input.save * 0.2 +
            input.sessionIntentionality * 0.2,
    );
    return { score, royaltyValue: false, activeRelationship: input.activeChoice + input.sessionIntentionality >= 1 };
}
export interface RecommendationAttribution {
    userIntent: number;
    artistAffinity: number;
    crowd: number;
    discovery: number;
    social: number;
    chart: number;
    transitionUtility: number;
}
export function dominantAttribution(attribution: RecommendationAttribution): {
    source: keyof RecommendationAttribution;
    shares: RecommendationAttribution;
} {
    const source =
        (Object.entries(attribution) as [keyof RecommendationAttribution, number][]).sort(
            (a, b) => b[1] - a[1],
        )[0]?.[0] ?? "userIntent";
    return { source, shares: { ...attribution } };
}
export interface QualifiedDiscoveryFunnel {
    candidates: number;
    eligible: number;
    recommended: number;
    completed: number;
    saved: number;
    artistRevisits: number;
}
export function qualifiedDiscoveryRates(funnel: QualifiedDiscoveryFunnel): {
    eligibility: number;
    recommendation: number;
    completion: number;
    save: number;
    revisit: number;
} {
    const ratio = (a: number, b: number) => a / Math.max(1, b);
    return {
        eligibility: ratio(funnel.eligible, funnel.candidates),
        recommendation: ratio(funnel.recommended, funnel.eligible),
        completion: ratio(funnel.completed, funnel.recommended),
        save: ratio(funnel.saved, funnel.completed),
        revisit: ratio(funnel.artistRevisits, funnel.saved),
    };
}
export const FAN_STUDY = {
    superListenerShare: 0.02,
    superListenerStreamShareAbove: 0.18,
    playlistAddStreamLift: 0.41,
    playlistAddProfileVisitLift: 0.12,
} as const;
