const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
export interface StakeholderUtility {
    listener: number;
    session: number;
    crowd: number;
    journey: number;
    artistRelationship: number;
    discovery: number;
    supplierFairness: number;
    repetition: number;
    artistSaturation: number;
    popularityBias: number;
    risk: number;
}
export function multiStakeholderUtility(
    input: StakeholderUtility,
    hardConstraintsMet: boolean,
    maxRelationshipWeight = 0.12,
): { eligible: boolean; utility: number; artistRelationshipContribution: number; hardConstraintsFirst: true } {
    const relationship = Math.min(maxRelationshipWeight, clamp01(input.artistRelationship) * maxRelationshipWeight);
    const positive =
        input.listener * 0.28 +
        input.session * 0.2 +
        input.crowd * 0.1 +
        input.journey * 0.12 +
        relationship +
        input.discovery * 0.08 +
        input.supplierFairness * 0.1;
    const negative =
        input.repetition * 0.08 + input.artistSaturation * 0.08 + input.popularityBias * 0.04 + input.risk * 0.12;
    return {
        eligible: hardConstraintsMet,
        utility: hardConstraintsMet ? clamp01(positive - negative) : 0,
        artistRelationshipContribution: relationship,
        hardConstraintsFirst: true,
    };
}
export type ArtistExperiment = "relationship-continuity" | "qualified-fairness" | "artist-intent" | "release-journey";
export const ARTIST_EXPERIMENT_METRICS: Record<ArtistExperiment, readonly string[]> = {
    "relationship-continuity": [
        "artist-revisits",
        "catalog-depth",
        "saves",
        "fan-retention",
        "user-satisfaction",
        "diversity",
    ],
    "qualified-fairness": [
        "listener-satisfaction",
        "artist-concentration",
        "long-tail-qualified-exposure",
        "discovery-acceptance",
    ],
    "artist-intent": ["relationship-growth", "satisfaction", "save-rate"],
    "release-journey": ["fan-conversion", "saturation"],
};
export function artistExperimentPlan(
    experiment: ArtistExperiment,
    relevanceFloorPassed: boolean,
): { enabled: boolean; startsInShadow: true; metrics: readonly string[] } {
    return { enabled: relevanceFloorPassed, startsInShadow: true, metrics: ARTIST_EXPERIMENT_METRICS[experiment] };
}
export const AVOID_ARTIST_METRICS = ["algorithm-score", "artist-quality-score", "recommendation-worthiness"] as const;
export const BETTER_ARTIST_METRICS = [
    "qualified-reach",
    "new-listener-conversion",
    "returning-listener-rate",
    "catalog-exploration",
    "context-fit",
    "fan-relationship-growth",
    "recommendation-sources",
] as const;

export function localArtistSignal(input: {
    coarseRegionMatch: number;
    userAffinity: number;
    sessionFit: number;
    privacySafeLocation: boolean;
}): { score: number; nationalistPrioritization: false; locationStoredPrecisely: false } {
    return {
        score: input.privacySafeLocation
            ? clamp01(input.coarseRegionMatch * 0.15 + input.userAffinity * 0.45 + input.sessionFit * 0.4)
            : clamp01(input.userAffinity * 0.55 + input.sessionFit * 0.45),
        nationalistPrioritization: false,
        locationStoredPrecisely: false,
    };
}
export type ArtistCommunitySource = "saved-fan-group" | "official-artist-session";
export function artistCommunityCrowd(
    source: ArtistCommunitySource,
    members: number,
): { source: ArtistCommunitySource; distinctFromGenericCrowd: true; aggregateMembers: number } {
    return { source, distinctFromGenericCrowd: true, aggregateMembers: members };
}
export interface CuratorBoundaries {
    mustPlay: string[];
    optional: string[];
    forbiddenTransitions: string[];
    storyBeats: string[];
}
export function humanCuratedDirector(
    boundaries: CuratorBoundaries,
    technicalPlan: { timing: boolean; mixing: boolean; crowdAdaptation: boolean },
): {
    curatorOwnsNarrative: true;
    directorOwnsTechnicalExecution: true;
    boundaries: CuratorBoundaries;
    technicalPlan: typeof technicalPlan;
} {
    return { curatorOwnsNarrative: true, directorOwnsTechnicalExecution: true, boundaries, technicalPlan };
}

export interface ArtistPlaybackIntent {
    preserveIntro?: boolean;
    preserveOutro?: boolean;
    preserveDrop?: boolean;
    allowStemMixing?: boolean;
    official: boolean;
}
export type CreativeTier = "standard-playback" | "smart-transition" | "dj-mix" | "stem-remix" | "creative-remix";
const TIER_ORDER: CreativeTier[] = ["standard-playback", "smart-transition", "dj-mix", "stem-remix", "creative-remix"];
export function artistConsentTier(
    rightsMax: CreativeTier,
    intent: ArtistPlaybackIntent,
): { maximumTier: CreativeTier; preservation: string[]; stricterPolicyWins: true } {
    const artistMax: CreativeTier = intent.allowStemMixing === false ? "smart-transition" : rightsMax;
    const maximumTier = TIER_ORDER[Math.min(TIER_ORDER.indexOf(rightsMax), TIER_ORDER.indexOf(artistMax))]!;
    return {
        maximumTier,
        preservation: [
            intent.preserveIntro && "intro",
            intent.preserveOutro && "outro",
            intent.preserveDrop && "drop",
        ].filter((value): value is string => Boolean(value)),
        stricterPolicyWins: true,
    };
}

export const ARTIST_ECOSYSTEM_BRAIN = [
    "artist-knowledge",
    "fan-relationship",
    "artist-intent",
    "fairness",
    "provenance",
    "analytics",
] as const;
export const ORGANIC_ACCOUNTING_BOUNDARY = {
    organicInputs: ["music", "user", "session"],
    royaltyPayoutAsRankFeature: false,
    attributionAuditable: true,
    rightsMetadataAuditable: true,
    streamAccountingAuditable: true,
} as const;
export type ArtistResearchConfidence = "high" | "medium-high" | "experimental";
export const ARTIST_RESEARCH_CONFIDENCE: Record<ArtistResearchConfidence, readonly string[]> = {
    high: [
        "fan-segmentation",
        "relationship-signals",
        "supplier-fairness",
        "exposure-concentration",
        "rights-metadata",
    ],
    "medium-high": ["artist-intent-soft-signal", "relationship-recommendation", "era-affinity", "qualified-exposure"],
    experimental: [
        "artist-world-recommendation",
        "relationship-value-optimization",
        "moment-fan-conversion",
        "preservation-at-scale",
    ],
};
export const ARTIST_ECOSYSTEM_PRINCIPLE =
    "great-listener-experiences-help-genuine-artist-relationships-emerge-naturally" as const;
