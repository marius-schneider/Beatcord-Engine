export type TasteSandboxMode = "normal" | "party" | "guest" | "private";
export type TasteBucket = "personal" | "party" | "work" | "sleep" | "gaming" | "family" | "guest";
export type DontLearnScope = "track" | "playlist" | "session" | "device" | "context";

export interface TasteLearningPolicy {
    mode: TasteSandboxMode;
    bucket: TasteBucket;
    persistent: boolean;
    expiresWithSession: boolean;
    excludedScopes: DontLearnScope[];
}

export function tasteLearningPolicy(
    mode: TasteSandboxMode,
    excludedScopes: readonly DontLearnScope[] = [],
): TasteLearningPolicy {
    const persistent = mode === "normal" || mode === "party";
    return {
        mode,
        bucket: mode === "normal" || mode === "private" ? "personal" : mode,
        persistent,
        expiresWithSession: !persistent,
        excludedScopes: [...new Set(excludedScopes)],
    };
}

export function mayLearnFrom(policy: TasteLearningPolicy, scopes: readonly DontLearnScope[]): boolean {
    if (!policy.persistent) return false;
    return !scopes.some((scope) => policy.excludedScopes.includes(scope));
}

export type TasteBlend = Partial<Record<TasteBucket, number>>;

export function normalizedTasteBlend(blend: TasteBlend): Record<TasteBucket, number> {
    const buckets: TasteBucket[] = ["personal", "party", "work", "sleep", "gaming", "family", "guest"];
    const nonNegative = Object.fromEntries(
        buckets.map((bucket) => [bucket, Math.max(0, blend[bucket] ?? 0)]),
    ) as Record<TasteBucket, number>;
    const total = Object.values(nonNegative).reduce((sum, value) => sum + value, 0);
    if (total <= 0) return { personal: 1, party: 0, work: 0, sleep: 0, gaming: 0, family: 0, guest: 0 };
    return Object.fromEntries(buckets.map((bucket) => [bucket, nonNegative[bucket] / total])) as Record<
        TasteBucket,
        number
    >;
}

export const LOCAL_FIRST_DATA_BOUNDARY = {
    deviceOnly: ["raw-history", "private-context", "taste-profile", "mixing-profile", "sensitive-labels"],
    serverAllowed: ["catalog", "global-model", "charts", "public-metadata", "aggregated-representations"],
    transfer: "minimal-representations-only",
    federatedReady: true,
} as const;

export type Retention = "session" | "local" | "cloud";
export type Sharing = "none" | "aggregated" | "account";
export interface DataPolicy {
    retention: Retention;
    sharing: Sharing;
    rawHistoryLeavesDevice: false;
}

export function dataPolicy(retention: Retention, sharing: Sharing): DataPolicy {
    const safeSharing = retention === "session" ? "none" : sharing;
    return { retention, sharing: safeSharing, rawHistoryLeavesDevice: false };
}

export interface CrowdContribution {
    participantId: string;
    sessionVector: readonly number[];
    hardExclusions: readonly string[];
    familiarity: number;
}

export function sanitizeCrowdContribution(input: CrowdContribution): CrowdContribution {
    return {
        participantId: input.participantId,
        sessionVector: input.sessionVector.slice(0, 32).map((value) => Math.max(-1, Math.min(1, value))),
        hardExclusions: [...new Set(input.hardExclusions.map((value) => value.toLowerCase()))],
        familiarity: Math.max(0, Math.min(1, input.familiarity)),
    };
}

export interface DecisionProvenance {
    contributions: Array<{
        source: "personal" | "moment" | "crowd" | "mix" | "catalog";
        weight: number;
        reason: string;
    }>;
    dominantSource: DecisionProvenance["contributions"][number]["source"] | "none";
}

export function decisionProvenance(entries: DecisionProvenance["contributions"]): DecisionProvenance {
    const contributions = entries
        .filter((entry) => entry.weight > 0)
        .map((entry) => ({ ...entry, weight: Math.min(1, entry.weight) }));
    const dominantSource =
        contributions.reduce<DecisionProvenance["contributions"][number] | null>(
            (best, entry) => (!best || entry.weight > best.weight ? entry : best),
            null,
        )?.source ?? "none";
    return { contributions, dominantSource };
}

export interface UserMusicRelation {
    entityId: string;
    relation: "love" | "like" | "neutral" | "dislike" | "never-play";
    source: "explicit" | "behavioral" | "imported";
    context?: TasteBucket;
    correctable: true;
}

export function updateMusicRelation(
    prior: UserMusicRelation | undefined,
    correction: Omit<UserMusicRelation, "correctable">,
): { relation: UserMusicRelation; supersededBehavioralInference: boolean } {
    return {
        relation: { ...correction, correctable: true },
        supersededBehavioralInference: prior?.source === "behavioral" && correction.source === "explicit",
    };
}

export type NarrationMode = "chill" | "party" | "radio" | "pure-music";
const NARRATION_BUDGETS: Record<NarrationMode, number> = { chill: 0.08, party: 0.25, radio: 0.7, "pure-music": 0 };
export interface NarrationContext {
    instrumental: boolean;
    foreground: number;
    lyricDensity: number;
    musicalImportance: number;
    usedBudget: number;
}

export function narrationDecision(
    mode: NarrationMode,
    context: NarrationContext,
): { allowed: boolean; budget: number; reason: string } {
    const budget = NARRATION_BUDGETS[mode];
    if (budget === 0) return { allowed: false, budget, reason: "pure-music" };
    if (context.usedBudget >= budget) return { allowed: false, budget, reason: "budget-exhausted" };
    const quietWindow =
        context.instrumental &&
        context.foreground < 0.35 &&
        context.lyricDensity < 0.15 &&
        context.musicalImportance < 0.45;
    return {
        allowed: quietWindow,
        budget,
        reason: quietWindow ? "safe-instrumental-window" : "protect-musical-moment",
    };
}

export function reliabilityPriority(input: {
    playbackStable: boolean;
    fallbackReady: boolean;
    aiNoveltyGain: number;
}): "stabilize" | "prepare-fallback" | "allow-ai-novelty" {
    if (!input.playbackStable) return "stabilize";
    if (!input.fallbackReady) return "prepare-fallback";
    return input.aiNoveltyGain > 0 ? "allow-ai-novelty" : "prepare-fallback";
}
