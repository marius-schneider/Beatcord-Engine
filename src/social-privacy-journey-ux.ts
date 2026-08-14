const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export type PresenceAudience = "nobody" | "close-friends" | "friends" | "custom";
export interface PresencePrivacy {
    shareListening: boolean;
    shareTrack: boolean;
    shareExperience: boolean;
    shareParticipants: boolean;
    allowJoin: boolean;
    audience: PresenceAudience;
}

export interface ContextualPresencePolicy {
    contextId: string;
    privacy: PresencePrivacy;
}

export function presenceForContext(
    contextId: string,
    fallback: PresencePrivacy,
    policies: readonly ContextualPresencePolicy[],
): PresencePrivacy {
    return policies.find((policy) => policy.contextId === contextId)?.privacy ?? fallback;
}

export function privateSessionToggle(persistentTasteLearning: boolean): {
    privacy: PresencePrivacy;
    socialHistory: false;
    memorySharing: false;
    persistentTasteLearning: boolean;
} {
    return {
        privacy: {
            shareListening: false,
            shareTrack: false,
            shareExperience: false,
            shareParticipants: false,
            allowJoin: false,
            audience: "nobody",
        },
        socialHistory: false,
        memorySharing: false,
        persistentTasteLearning,
    };
}

export interface NearbyDiscovery {
    enabled: boolean;
    identifier: string | null;
    expiresAt: number | null;
    persistentIdentifierBroadcast: false;
}

export function nearbyDiscovery(
    explicitlyEnabled: boolean,
    ephemeralId: string,
    now: number,
    ttlMs = 60_000,
): NearbyDiscovery {
    return {
        enabled: explicitlyEnabled,
        identifier: explicitlyEnabled ? ephemeralId : null,
        expiresAt: explicitlyEnabled ? now + Math.max(1, ttlMs) : null,
        persistentIdentifierBroadcast: false,
    };
}

export interface JoinToken {
    token: string;
    expiresAt: number;
    singleUse: true;
    approvalRequired: boolean;
}

export function socialJoinToken(token: string, now: number, privacyMode: boolean, ttlMs = 5 * 60_000): JoinToken {
    return {
        token,
        expiresAt: now + Math.max(1, ttlMs),
        singleUse: true,
        approvalRequired: privacyMode,
    };
}

export type DisclosureLevel = "listener" | "enthusiast" | "dj" | "developer-lab";
const DISCLOSURE_CONTROLS: Record<DisclosureLevel, readonly string[]> = {
    listener: ["experience", "familiar-discover", "queue"],
    enthusiast: ["energy-journey", "mix-personality", "crowd-influence"],
    dj: ["waveform", "grid", "cues", "stems", "transition"],
    "developer-lab": ["confidence", "critic", "models", "plans"],
};

export function progressiveControls(level: DisclosureLevel): string[] {
    const order: DisclosureLevel[] = ["listener", "enthusiast", "dj", "developer-lab"];
    return order.slice(0, order.indexOf(level) + 1).flatMap((item) => DISCLOSURE_CONTROLS[item]);
}

export type UxOverrideScope = "next-track" | "session" | "persistent";
export interface SessionOverride {
    field: "energy" | "discovery" | "mix-aggression" | "crowd-influence";
    value: number;
    scope: UxOverrideScope;
    createdAt: number;
    expiresAt?: number;
}

export function createSessionOverride(
    field: SessionOverride["field"],
    value: number,
    scope: UxOverrideScope,
    now: number,
    sessionExpiresAt?: number,
): SessionOverride {
    const base = { field, value: clamp01(value), scope, createdAt: now };
    if (scope === "persistent") return base;
    return { ...base, expiresAt: scope === "next-track" ? now : Math.max(now, sessionExpiresAt ?? now) };
}

export function isOverrideActive(override: SessionOverride, now: number, nextTrackStarted: boolean): boolean {
    if (override.scope === "persistent") return true;
    if (override.scope === "next-track") return !nextTrackStarted;
    return now <= (override.expiresAt ?? override.createdAt);
}

export interface UxSessionContract {
    energy: number;
    discovery: number;
    mixAggression: number;
    crowdInfluence: number;
    revision: number;
}

export function editSessionContract(
    contract: UxSessionContract,
    edit: {
        source: "natural-language" | "direct-manipulation";
        field: keyof Omit<UxSessionContract, "revision">;
        value: number;
    },
): UxSessionContract & { lastEditSource: typeof edit.source } {
    return {
        ...contract,
        [edit.field]: clamp01(edit.value),
        revision: contract.revision + 1,
        lastEditSource: edit.source,
    };
}

export function permissionPrompt(action: "guest-requests" | "direct-queue" | "presence" | "nearby-join"): string {
    return {
        "guest-requests": "Let friends add requests to this session?",
        "direct-queue": "Let guests add songs directly to the queue?",
        presence: "Show friends what you are listening to?",
        "nearby-join": "Let nearby people discover this session?",
    }[action];
}

export const ZERO_CONFIGURATION_EXPERIENCE = {
    primaryAction: "play",
    requiredTechnicalChoices: 0,
    directorEnabled: true,
    qualityTarget: "great-playback",
} as const;

export type ExplanationDepth = "short" | "detail" | "technical";
export function recommendationExplanation(
    depth: ExplanationDepth,
    input: { bpm: number; key: string; phraseFit: number; confidence: number },
): string {
    if (depth === "short") return "Fits the vibe";
    if (depth === "detail") return "Known by most people + smooth bridge";
    return `${input.bpm} BPM • ${input.key} • phrase ${Math.round(input.phraseFit * 100)}% • confidence ${Math.round(input.confidence * 100)}%`;
}

export interface JourneyPoint {
    id: string;
    offsetMinutes: number;
    energy: number;
    label: string;
}

export function editJourneyPoint(
    points: readonly JourneyPoint[],
    id: string,
    patch: Partial<Pick<JourneyPoint, "offsetMinutes" | "energy" | "label">>,
): { points: JourneyPoint[]; replanRequired: boolean } {
    let changed = false;
    const edited = points.map((point) => {
        if (point.id !== id) return point;
        changed = true;
        return { ...point, ...patch, energy: clamp01(patch.energy ?? point.energy) };
    });
    return { points: edited.sort((a, b) => a.offsetMinutes - b.offsetMinutes), replanRequired: changed };
}

export type FutureCommitment =
    | { horizon: "now"; trackId: string; certainty: "playing" }
    | { horizon: "next"; trackId: string; certainty: "committed" }
    | { horizon: "later"; corridor: string; certainty: "planned" }
    | { horizon: "future"; intention: string; certainty: "intention" };

export function separateQueueAndJourney(input: { explicitTrackIds: string[]; journey: JourneyPoint[] }): {
    queue: { kind: "explicit-tracks"; trackIds: string[] };
    journey: { kind: "musical-direction"; points: JourneyPoint[] };
} {
    return {
        queue: { kind: "explicit-tracks", trackIds: [...input.explicitTrackIds] },
        journey: { kind: "musical-direction", points: [...input.journey] },
    };
}

export function routeGuestRequest(
    hostAllowsDirectQueue: boolean,
    estimatedMinutes: number,
): {
    route: "request" | "direct-queue";
    etaMinutes: number;
    hostCanPlaySooner: true;
} {
    return {
        route: hostAllowsDirectQueue ? "direct-queue" : "request",
        etaMinutes: Math.max(0, Math.round(estimatedMinutes)),
        hostCanPlaySooner: true,
    };
}

export function socialRecommendationValue(input: {
    relationshipStrength: number;
    senderTrust: number;
    tasteCompatibility: number;
    trackFit: number;
}): number {
    return (
        Math.round(
            clamp01(input.relationshipStrength) *
                clamp01(input.senderTrust) *
                clamp01(input.tasteCompatibility) *
                clamp01(input.trackFit) *
                1_000_000,
        ) / 1_000_000
    );
}

export const SOCIAL_EXPERIENCE = {
    principle: "Presence before posting. Listening before content creation.",
    surfaces: ["listening-now", "shared-sessions", "music-messages", "session-memories", "friend-recommendations"],
    forbiddenMechanics: ["infinite-feed", "follower-race", "public-like-counts", "algorithmic-outrage"],
    musicRemainsPrimary: true,
} as const;
