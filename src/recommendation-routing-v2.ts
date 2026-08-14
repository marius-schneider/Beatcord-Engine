const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

export interface TransitionCompatibilityInput {
    musical: number;
    mood: number;
    energy: number;
    semantic: number;
    contrastIntent: number;
}

export function transitionCompatibility(input: TransitionCompatibilityInput): number {
    return round(
        clamp01(
            input.musical * 0.32 +
                input.mood * 0.22 +
                input.energy * 0.2 +
                input.semantic * 0.12 +
                input.contrastIntent * 0.14,
        ),
    );
}

export interface DeferredRecommendation {
    trackId: string;
    currentFit: number;
    futureFit: number;
    defer: boolean;
    reason: string;
}

export function assessDeferredRecommendation(
    trackId: string,
    currentFit: number,
    projectedFits: readonly number[],
): DeferredRecommendation {
    const futureFit = Math.max(0, ...projectedFits);
    const defer = currentFit < 0.62 && futureFit >= Math.max(0.68, currentFit + 0.15);
    return {
        trackId,
        currentFit: round(clamp01(currentFit)),
        futureFit: round(clamp01(futureFit)),
        defer,
        reason: defer ? "better-future-context" : "playable-now",
    };
}

export interface RouteCandidate {
    trackId: string;
    durationMinutes: number;
    immediateFit: number;
    futureFit: number;
    transitionFromPrevious: number;
    targetProgress: number;
}

export interface RecommendationRoute {
    trackIds: string[];
    durationMinutes: number;
    score: number;
    deferredTrackIds: string[];
}

export function planRecommendationRoute(
    candidates: readonly RouteCandidate[],
    horizonMinutes = 30,
): RecommendationRoute {
    const ranked = [...candidates].sort(
        (a, b) =>
            b.immediateFit * 0.3 +
            b.futureFit * 0.25 +
            b.transitionFromPrevious * 0.25 +
            b.targetProgress * 0.2 -
            (a.immediateFit * 0.3 + a.futureFit * 0.25 + a.transitionFromPrevious * 0.25 + a.targetProgress * 0.2),
    );
    const selected: RouteCandidate[] = [];
    let durationMinutes = 0;
    for (const candidate of ranked) {
        if (durationMinutes + candidate.durationMinutes > horizonMinutes + 2) continue;
        selected.push(candidate);
        durationMinutes += candidate.durationMinutes;
        if (durationMinutes >= horizonMinutes) break;
    }
    const score = selected.length
        ? selected.reduce(
              (sum, item) =>
                  sum +
                  item.immediateFit * 0.3 +
                  item.futureFit * 0.25 +
                  item.transitionFromPrevious * 0.25 +
                  item.targetProgress * 0.2,
              0,
          ) / selected.length
        : 0;
    return {
        trackIds: selected.map((candidate) => candidate.trackId),
        durationMinutes: round(durationMinutes),
        score: round(clamp01(score)),
        deferredTrackIds: ranked
            .filter((candidate) => !selected.includes(candidate))
            .map((candidate) => candidate.trackId),
    };
}

export type CrowdReaction = "like" | "skip" | "dance" | "leave" | "request" | "neutral";
export interface CrowdReactionEvent {
    trackId: string;
    reaction: CrowdReaction;
    atMs: number;
    confidence: number;
}

const REACTION_VALUES: Record<CrowdReaction, number> = {
    like: 0.55,
    skip: -0.65,
    dance: 0.8,
    leave: -0.9,
    request: 1,
    neutral: 0,
};

export function reactionWeight(event: CrowdReactionEvent, nowMs: number, halfLifeMinutes = 45): number {
    const ageMinutes = Math.max(0, nowMs - event.atMs) / 60_000;
    return round(REACTION_VALUES[event.reaction] * clamp01(event.confidence) * 2 ** (-ageMinutes / halfLifeMinutes));
}

export class CrowdReactionLoop {
    readonly #events: CrowdReactionEvent[] = [];

    record(event: CrowdReactionEvent): void {
        this.#events.push({ ...event, confidence: clamp01(event.confidence) });
    }

    feedback(trackId: string, nowMs: number): { adjustment: number; evidenceCount: number } {
        const relevant = this.#events.filter((event) => event.trackId === trackId);
        const total = relevant.reduce((sum, event) => sum + reactionWeight(event, nowMs), 0);
        return { adjustment: round(Math.max(-1, Math.min(1, total))), evidenceCount: relevant.length };
    }
}

export type CrowdMoodControlMode = "adaptive" | "balanced" | "directed";
export interface CrowdMoodControl {
    mode: CrowdMoodControlMode;
    observedMood: number;
    requestedMood?: number;
    overrideMood?: number;
}

export function resolveCrowdMood(input: CrowdMoodControl): {
    targetMood: number;
    source: "observed" | "blended" | "requested" | "override";
} {
    if (input.overrideMood !== undefined) return { targetMood: clamp01(input.overrideMood), source: "override" };
    if (input.mode === "directed" && input.requestedMood !== undefined)
        return { targetMood: clamp01(input.requestedMood), source: "requested" };
    if (input.mode === "balanced" && input.requestedMood !== undefined)
        return {
            targetMood: round(clamp01(input.observedMood * 0.55 + input.requestedMood * 0.45)),
            source: "blended",
        };
    return { targetMood: clamp01(input.observedMood), source: "observed" };
}

export interface PrivateMemberSignal {
    memberId: string;
    consent: boolean;
    taste: Record<string, number>;
    negativeTags?: string[];
}

export interface AnonymousGroupProfile {
    memberCount: number;
    consentedMemberCount: number;
    aggregateTaste: Record<string, number>;
    blockedTags: string[];
    containsMemberIds: false;
}

export function aggregatePrivateGroup(signals: readonly PrivateMemberSignal[]): AnonymousGroupProfile {
    const consented = signals.filter((signal) => signal.consent);
    const keys = [...new Set(consented.flatMap((signal) => Object.keys(signal.taste)))];
    const aggregateTaste = Object.fromEntries(
        keys.map((key) => [
            key,
            round(consented.reduce((sum, signal) => sum + (signal.taste[key] ?? 0), 0) / Math.max(1, consented.length)),
        ]),
    );
    const negativeCounts = new Map<string, number>();
    for (const signal of consented)
        for (const tag of signal.negativeTags ?? []) negativeCounts.set(tag, (negativeCounts.get(tag) ?? 0) + 1);
    return {
        memberCount: signals.length,
        consentedMemberCount: consented.length,
        aggregateTaste,
        blockedTags: [...negativeCounts]
            .filter(([, count]) => count >= Math.max(2, consented.length / 2))
            .map(([tag]) => tag),
        containsMemberIds: false,
    };
}

export interface SavedGroupProfile extends AnonymousGroupProfile {
    groupId: string;
    version: number;
    updatedAt: number;
}

export class GroupProfileStore {
    readonly #session = new Map<string, AnonymousGroupProfile>();
    readonly #saved = new Map<string, SavedGroupProfile>();

    setSession(sessionId: string, profile: AnonymousGroupProfile): void {
        this.#session.set(sessionId, structuredClone(profile));
    }

    endSession(sessionId: string): void {
        this.#session.delete(sessionId);
    }

    session(sessionId: string): AnonymousGroupProfile | null {
        return structuredClone(this.#session.get(sessionId) ?? null);
    }

    save(groupId: string, profile: AnonymousGroupProfile, atMs: number): SavedGroupProfile {
        const previous = this.#saved.get(groupId);
        const saved = { ...structuredClone(profile), groupId, version: (previous?.version ?? 0) + 1, updatedAt: atMs };
        this.#saved.set(groupId, saved);
        return structuredClone(saved);
    }

    evolve(groupId: string, observed: AnonymousGroupProfile, atMs: number, learningRate = 0.2): SavedGroupProfile {
        const previous = this.#saved.get(groupId);
        if (!previous) return this.save(groupId, observed, atMs);
        const keys = [...new Set([...Object.keys(previous.aggregateTaste), ...Object.keys(observed.aggregateTaste)])];
        const aggregateTaste = Object.fromEntries(
            keys.map((key) => [
                key,
                round(
                    (previous.aggregateTaste[key] ?? 0) * (1 - learningRate) +
                        (observed.aggregateTaste[key] ?? 0) * learningRate,
                ),
            ]),
        );
        return this.save(groupId, { ...observed, aggregateTaste }, atMs);
    }
}

export function separateSocialInfluence(
    personalScore: number,
    socialScore: number,
    socialConsent: boolean,
): {
    personal: number;
    social: number;
    combined: number;
} {
    const personal = clamp01(personalScore);
    const social = socialConsent ? clamp01(socialScore) : 0;
    return { personal, social, combined: round(personal * 0.72 + social * 0.28) };
}

export const RECOMMENDATION_ARCHITECTURE_V2 = [
    "hard-gates",
    "identity-and-availability",
    "personal-taste",
    "negative-taste",
    "session-context",
    "group-context",
    "capability-fit",
    "transition-compatibility",
    "future-fit-and-routing",
    "explanation-and-memory",
] as const;

export interface RecommendationV2Signals {
    personalTaste: number;
    sessionContext: number;
    capabilityFit: number;
    groupFit: number;
    transitionFit: number;
    futureFit: number;
    memoryAdjustment: number;
    fatiguePenalty: number;
    overplayPenalty: number;
}

export function recommendationScoreV2(input: RecommendationV2Signals): number {
    const core = clamp01(input.personalTaste) * clamp01(input.sessionContext) * clamp01(input.capabilityFit);
    const supporting = input.groupFit * 0.12 + input.transitionFit * 0.18 + input.futureFit * 0.1;
    return round(
        Math.max(
            0,
            Math.min(
                1,
                core * 0.6 + supporting + input.memoryAdjustment - input.fatiguePenalty - input.overplayPenalty,
            ),
        ),
    );
}

export interface RecommendationHardGateInput {
    explicitDislike: boolean;
    neverPlay: boolean;
    contentAllowed: boolean;
    providerAvailable: boolean;
    sessionAllowed: boolean;
    duplicate: boolean;
    requestOrderValid: boolean;
    qualitySufficient: boolean;
}

export function evaluateRecommendationHardGates(input: RecommendationHardGateInput): {
    allowed: boolean;
    failures: string[];
} {
    const failures = [
        input.explicitDislike && "explicit-dislike",
        input.neverPlay && "never-play",
        !input.contentAllowed && "content-policy",
        !input.providerAvailable && "provider-unavailable",
        !input.sessionAllowed && "session-policy",
        input.duplicate && "duplicate",
        !input.requestOrderValid && "request-order",
        !input.qualitySufficient && "insufficient-quality",
    ].filter((failure): failure is string => Boolean(failure));
    return { allowed: failures.length === 0, failures };
}

export interface RecommendationV2Audit {
    architecture: typeof RECOMMENDATION_ARCHITECTURE_V2;
    score: number;
    hardGates: ReturnType<typeof evaluateRecommendationHardGates>;
    transitionFit: number;
    futureFit: number;
}

export const RECOMMENDATION_MILESTONES = [
    { id: 14, capability: "trend-intelligence" },
    { id: 15, capability: "taste-dynamics" },
    { id: 16, capability: "recommendation-memory" },
    { id: 17, capability: "route-planning" },
    { id: 18, capability: "reaction-loop" },
    { id: 19, capability: "private-group-learning" },
    { id: 20, capability: "recommendation-v2" },
] as const;

export const ADDITIONAL_RESEARCH_SOURCES = [
    "sequential-recommendation",
    "repeat-aware-recommendation",
    "playlist-continuation",
    "multimodal-music-representation",
    "music-emotion-recognition",
    "group-recommendation-privacy",
] as const;

export const STRATEGIC_BRAINS = ["taste-brain", "session-brain", "music-director"] as const;
