const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
export type NonSelectionReason =
    | "session-mismatch"
    | "stronger-candidate"
    | "transition-incompatibility"
    | "familiarity-objective"
    | "explicit-preference"
    | "other";
export function aggregateNonSelection(reasons: readonly NonSelectionReason[]): {
    shares: Record<NonSelectionReason, number>;
    privacySafe: true;
    individualUsersExposed: false;
} {
    const all: NonSelectionReason[] = [
        "session-mismatch",
        "stronger-candidate",
        "transition-incompatibility",
        "familiarity-objective",
        "explicit-preference",
        "other",
    ];
    const total = Math.max(1, reasons.length);
    return {
        shares: Object.fromEntries(
            all.map((reason) => [reason, reasons.filter((value) => value === reason).length / total]),
        ) as Record<NonSelectionReason, number>,
        privacySafe: true,
        individualUsersExposed: false,
    };
}
export function contextFitAnalytics(values: Readonly<Record<string, number>>): {
    strongestExperiences: Array<{ experience: string; fit: number }>;
    artistQualityScoreForbidden: true;
} {
    return {
        strongestExperiences: Object.entries(values)
            .map(([experience, fit]) => ({ experience, fit: clamp01(fit) }))
            .sort((a, b) => b.fit - a.fit),
        artistQualityScoreForbidden: true,
    };
}
export type AnalyticsConfidence = "suppressed" | "low" | "medium" | "high";
export function analyticsConfidence(listeners: number, privacyThreshold = 20): AnalyticsConfidence {
    return listeners < privacyThreshold
        ? "suppressed"
        : listeners < 100
          ? "low"
          : listeners < 2_000
            ? "medium"
            : "high";
}
export type CausalityClass = "observed-association" | "experiment-result" | "causal-estimate";
export function analyticsClaim(
    text: string,
    causality: CausalityClass,
    confidence: number,
): { text: string; causality: CausalityClass; confidence: number; falseCausalityForbidden: true } {
    return { text, causality, confidence: clamp01(confidence), falseCausalityForbidden: true };
}
export const ARTIST_ALGORITHM_TRANSPARENCY = {
    secretThresholdMythology: false,
    thresholdsDocumentedWherePossible: true,
    principleLevelChangelog: true,
    reverseEngineerCompetitorFromAnecdotes: false,
} as const;

export interface HostedSession {
    artistId: string;
    curatedQueue: string[];
    narration?: string[];
    moments?: Array<{ at: number; label: string }>;
    crowdInteraction: boolean;
    rightsVerified: boolean;
}
export function releaseListeningParty(session: HostedSession): {
    enabled: boolean;
    features: string[];
    reason: string;
} {
    const enabled = session.rightsVerified;
    return {
        enabled,
        features: enabled ? ["synchronized-release-playback", "artist-commentary", "reactions", "fan-crowd"] : [],
        reason: enabled ? "rights-verified" : "rights-required",
    };
}
export function superfanRelationshipScore(input: {
    repeat: number;
    catalogDepth: number;
    activeChoice: number;
    saves: number;
    returnFrequency: number;
    eventParticipation: number;
}): number {
    return clamp01(
        input.repeat * 0.15 +
            input.catalogDepth * 0.2 +
            input.activeChoice * 0.2 +
            input.saves * 0.15 +
            input.returnFrequency * 0.15 +
            input.eventParticipation * 0.15,
    );
}
export const ARTIST_FAN_RELATIONS = [
    "knows",
    "likes",
    "follows",
    "explores",
    "attends-sessions",
    "returns-to",
] as const;
export interface ArtistGraphEdge {
    from: string;
    to: string;
    relation:
        | "collaborated-with"
        | "produced-by"
        | "written-by"
        | "remixed-by"
        | "sampled"
        | "covered"
        | "same-scene"
        | "tour-related"
        | "label-related";
    confidence: number;
}
export function artistPath(
    edges: readonly ArtistGraphEdge[],
    from: string,
    to: string,
): { path: string[]; explanation: string; grounded: boolean } {
    const direct = edges.find((edge) => edge.from === from && edge.to === to && edge.confidence >= 0.7);
    if (direct) return { path: [from, to], explanation: `Connected through ${direct.relation}.`, grounded: true };
    const first = edges.find((edge) => edge.from === from && edge.confidence >= 0.7);
    const second = first && edges.find((edge) => edge.from === first.to && edge.to === to && edge.confidence >= 0.7);
    return second
        ? {
              path: [from, first!.to, to],
              explanation: `Connected through ${first!.relation} and ${second.relation}.`,
              grounded: true,
          }
        : { path: [], explanation: "", grounded: false };
}

export type Capability = "allowed" | "forbidden" | "unknown";
export interface RightsProfileV2 {
    playback: Capability;
    recommendation: Capability;
    manipulation: { crossfade: Capability; beatmatch: Capability; stems: Capability; remix: Capability };
    ai: { analysis: Capability; training?: Capability; generation?: Capability };
}
export function rightsCapability(
    profile: RightsProfileV2,
    operation:
        | "playback"
        | "recommendation"
        | "crossfade"
        | "beatmatch"
        | "stems"
        | "remix"
        | "analysis"
        | "training"
        | "generation",
): Capability {
    if (operation === "playback" || operation === "recommendation") return profile[operation];
    if (operation === "analysis" || operation === "training" || operation === "generation")
        return profile.ai[operation] ?? "unknown";
    return profile.manipulation[operation];
}
export const STREAMING_ECONOMICS_CONTEXT = {
    recordedRevenueUsdBn: 29.6,
    streamingRevenueUsdBn: 20.4,
    streamingShare: 0.69,
    subscriptionsMillions: 752,
    intelligenceSeparateFromCatalogOwnership: true,
    economicsNotRankingFeature: true,
} as const;

export type CreditRole =
    | "recording-artist"
    | "featured-artist"
    | "composer"
    | "songwriter"
    | "producer"
    | "remixer"
    | "publisher"
    | "label";
export interface CreatorCredit {
    creatorId: string;
    role: CreditRole;
    verified: boolean;
    source: string;
}
export function creditDiscovery(credits: readonly CreatorCredit[], role: CreditRole): string[] {
    return [
        ...new Set(
            credits.filter((credit) => credit.role === role && credit.verified).map((credit) => credit.creatorId),
        ),
    ];
}
export function creatorAffinity(
    likedCredits: readonly CreatorCredit[],
    creatorId: string,
): { producerSongwriterAffinity: number; mainArtistOnly: false } {
    const verified = likedCredits.filter((credit) => credit.creatorId === creatorId && credit.verified);
    return { producerSongwriterAffinity: clamp01(verified.length / 5), mainArtistOnly: false };
}

export interface NewArtistOpportunity {
    coldStartBoost: number;
    semanticFit: number;
    userFit: number;
    sessionFit: number;
    exposureConfidence: number;
}
export function newArtistOpportunity(input: NewArtistOpportunity): {
    score: number;
    safeTest: boolean;
    collaborativeSignalsRequired: false;
} {
    const fit = input.semanticFit * 0.35 + input.userFit * 0.35 + input.sessionFit * 0.3;
    return {
        score: clamp01(fit + (fit >= 0.65 ? input.coldStartBoost * 0.1 : 0)),
        safeTest: input.exposureConfidence < 0.5 && fit >= 0.65,
        collaborativeSignalsRequired: false,
    };
}
export function artistExplorationBudget(
    trackDiscovery: number,
    newArtistRatio: number,
): { knownArtistNewTrack: number; newArtist: number } {
    const total = clamp01(trackDiscovery);
    const ratio = clamp01(newArtistRatio);
    return { knownArtistNewTrack: total * (1 - ratio), newArtist: total * ratio };
}

export type ArtistCorrectionType =
    | "wrong-genre"
    | "wrong-era"
    | "wrong-version"
    | "wrong-credit"
    | "wrong-semantic-tag";
export function artistMetadataCorrection(
    type: ArtistCorrectionType,
    value: string,
    verifiedArtist: boolean,
): {
    accepted: boolean;
    provenance: "artist";
    rankManipulationAllowed: false;
    analysisKeptSeparate: true;
    value: string;
} {
    return {
        accepted: verifiedArtist,
        provenance: "artist",
        rankManipulationAllowed: false,
        analysisKeptSeparate: true,
        value: `${type}:${value}`,
    };
}
export interface ArtistProvidedMetadata {
    genres?: string[];
    moods?: string[];
    contexts?: string[];
    story?: string;
    provenance: "artist";
}
export function multiSourceDescription(
    artist: ArtistProvidedMetadata,
    communityGenres: readonly string[],
    audioGenres: readonly string[],
): { sources: string[]; noSingleSourceOverrides: true } {
    return {
        sources: [...new Set([...(artist.genres ?? []), ...communityGenres, ...audioGenres])],
        noSingleSourceOverrides: true,
    };
}

export function privacySafeArtistMetric<T>(
    cohortSize: number,
    value: T,
    threshold = 20,
): { suppressed: boolean; value: T | null; aggregateOnly: true } {
    return { suppressed: cohortSize < threshold, value: cohortSize < threshold ? null : value, aggregateOnly: true };
}
export type RecommendationSource = "organic" | "editorial" | "artist-intent" | "sponsored";
export function recommendationSourcePolicy(
    source: RecommendationSource,
    input: { hardDislike: boolean; sessionFit: number; quality: number },
): { allowed: boolean; labelRequired: boolean; organicDirectorSeparated: true } {
    return {
        allowed: !input.hardDislike && input.sessionFit >= 0.4 && input.quality >= 0.7,
        labelRequired: source === "sponsored",
        organicDirectorSeparated: true,
    };
}
export const CREATIVE_AUTONOMY_PRINCIPLE = "analytics-explain-audience-response-not-prescribe-art" as const;
