const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export type SearchIntentKind = "song" | "artist" | "album" | "playlist" | "theme";
export interface SearchIntentCandidate {
    kind: SearchIntentKind;
    score: number;
}

export function resolveSearchIntent(
    candidates: readonly SearchIntentCandidate[],
    contextualIntent?: SearchIntentKind,
): { ranked: SearchIntentCandidate[]; ambiguous: boolean; contextualBoostApplied: boolean } {
    const ranked = candidates
        .map((candidate) => ({
            ...candidate,
            score: clamp01(candidate.score + (candidate.kind === contextualIntent ? 0.08 : 0)),
        }))
        .sort((a, b) => b.score - a.score);
    return {
        ranked,
        ambiguous: ranked.length > 1 && (ranked[0]?.score ?? 0) - (ranked[1]?.score ?? 0) < 0.1,
        contextualBoostApplied:
            contextualIntent !== undefined && candidates.some((item) => item.kind === contextualIntent),
    };
}

export interface SemanticMusicQuery {
    vocal?: "female" | "male" | "mixed";
    instruments: string[];
    decade?: number;
    description: string;
}

export function parseSemanticMusicDescription(description: string): SemanticMusicQuery {
    const normalized = description.toLowerCase();
    const decadeMatch = normalized.match(/\b(19|20)\d0s\b/);
    const instruments = ["trumpet", "guitar", "piano", "saxophone", "violin", "synth"].filter((instrument) =>
        normalized.includes(instrument),
    );
    const vocal = normalized.includes("female vocal")
        ? "female"
        : normalized.includes("male vocal")
          ? "male"
          : normalized.includes("mixed vocal")
            ? "mixed"
            : undefined;
    return {
        description,
        instruments,
        ...(vocal ? { vocal } : {}),
        ...(decadeMatch ? { decade: Number.parseInt(decadeMatch[0], 10) } : {}),
    };
}

export type PaletteAction = "play" | "energy" | "join" | "move-device" | "connect-integration" | "search";
export function commandPaletteAction(command: string): {
    action: PaletteAction;
    argument: string;
    universalSurface: true;
} {
    const normalized = command.trim();
    const rules: [RegExp, PaletteAction][] = [
        [/^play\s+/i, "play"],
        [/^(more|less) energy/i, "energy"],
        [/^join\s+/i, "join"],
        [/^move to\s+/i, "move-device"],
        [/^connect\s+/i, "connect-integration"],
    ];
    const match = rules.find(([pattern]) => pattern.test(normalized));
    return {
        action: match?.[1] ?? "search",
        argument: match ? normalized.replace(match[0], "").trim() : normalized,
        universalSurface: true,
    };
}

export const ACCOUNT_SYNC_SCOPE = {
    shared: ["library", "taste", "playlists", "session-memories", "settings", "integrations"],
    deviceLocal: ["audio-device-calibration", "downloads"],
} as const;

export type PlaylistOperationType = "insert" | "delete" | "move" | "annotate";
export interface PlaylistOperation {
    operationId: string;
    actorId: string;
    lamport: number;
    type: PlaylistOperationType;
    itemId: string;
    afterItemId?: string | null;
    trackId?: string;
    annotation?: string;
}

export function mergePlaylistOperations(
    local: readonly PlaylistOperation[],
    remote: readonly PlaylistOperation[],
): PlaylistOperation[] {
    const operations = new Map<string, PlaylistOperation>();
    for (const operation of [...local, ...remote]) {
        const existing = operations.get(operation.operationId);
        if (!existing || operation.lamport > existing.lamport) operations.set(operation.operationId, operation);
    }
    return [...operations.values()].sort(
        (a, b) =>
            a.lamport - b.lamport || a.actorId.localeCompare(b.actorId) || a.operationId.localeCompare(b.operationId),
    );
}

export const CONSISTENCY_MODELS = {
    sharedQueue: {
        persistence: "ephemeral",
        ordering: "authoritative-playback",
        conflictResolution: "server-revision",
    },
    collaborativePlaylist: { persistence: "persistent", ordering: "stable-item-crdt", conflictResolution: "merge" },
} as const;

export function cloudOutagePlan(audioMasterAvailable: boolean): {
    playback: "continue-local" | "safe-stop";
    localQueue: boolean;
    director: "local-safe-mode" | "unavailable";
    socialUpdates: "paused";
    cloudDegradationInterruptsAudio: false;
} {
    return {
        playback: audioMasterAvailable ? "continue-local" : "safe-stop",
        localQueue: audioMasterAvailable,
        director: audioMasterAvailable ? "local-safe-mode" : "unavailable",
        socialUpdates: "paused",
        cloudDegradationInterruptsAudio: false,
    };
}

export const OFFLINE_DIRECTOR_TIER = {
    inputs: ["local-taste-subset", "cached-analysis", "local-queue"],
    director: "basic-local",
    cloudRequired: false,
} as const;

export function offlineMemorySync(
    memoryId: string,
    online: boolean,
): {
    memoryId: string;
    storedLocally: true;
    sync: "complete" | "pending";
} {
    return { memoryId, storedLocally: true, sync: online ? "complete" : "pending" };
}

export const SOCIAL_RETENTION = {
    presence: "ephemeral",
    sessionMemory: "user-controlled",
    analytics: "aggregated",
    rawSocialTelemetryForever: false,
} as const;

export function socialAvailability(
    visible: boolean,
    joinable: boolean,
): { visible: boolean; joinable: boolean; independent: true } {
    return { visible, joinable, independent: true };
}

export function quietJoin(hostAllows: boolean): {
    joined: boolean;
    playbackInterrupted: false;
    hostNotification: "subtle" | "none";
} {
    return { joined: hostAllows, playbackInterrupted: false, hostNotification: hostAllows ? "subtle" : "none" };
}

export function requestRateLimit(
    requestsInWindow: number,
    participantRequests: number,
    maxSessionRequests = 20,
    maxParticipantRequests = 3,
): { allowed: boolean; fairnessApplied: true; retryLater: boolean } {
    const allowed = requestsInWindow < maxSessionRequests && participantRequests < maxParticipantRequests;
    return { allowed, fairnessApplied: true, retryLater: !allowed };
}

export const CROWD_MODERATION_ACTIONS = ["mute-requests", "remove-participant", "block-track", "lock-queue"] as const;
export const PUBLIC_SESSION_SAFETY = {
    initialAudience: "private-friend-groups",
    contentRestrictionsRequired: true,
    moderationRequired: true,
    invitePolicyRequired: true,
} as const;

export function artistDiscoveryMemory(artist: string): { recap: string; relationshipSignal: "shared-discovery" } {
    return { recap: `You discovered ${artist} together.`, relationshipSignal: "shared-discovery" };
}

export function memoryJourneySeed(
    memoryId: string,
    label: string,
): {
    memoryId: string;
    prompt: string;
    seedType: "explicit-journey";
} {
    return { memoryId, prompt: `Continue the vibe from ${label}`, seedType: "explicit-journey" };
}

export type ConfidenceLabel = "low" | "medium" | "high";
export function confidencePresentation(
    confidence: number,
    value: number,
): {
    state: "low" | "medium" | "high";
    confidence: ConfidenceLabel;
    fakePrecision: false;
} {
    const band = (score: number): ConfidenceLabel => (score >= 0.75 ? "high" : score >= 0.4 ? "medium" : "low");
    return { state: band(value), confidence: band(confidence), fakePrecision: false };
}

export function confidenceActionPolicy(confidence: number): { behavior: "act" | "conservative" | "ask" } {
    return { behavior: confidence >= 0.75 ? "act" : confidence >= 0.4 ? "conservative" : "ask" };
}

export interface ReversibleDirectorAction<T> {
    id: string;
    at: number;
    description: string;
    before: T;
    after: T;
    realtime: boolean;
}

export function reversibleDirectorAction<T>(action: ReversibleDirectorAction<T>): ReversibleDirectorAction<T> & {
    visible: true;
    undoAvailable: boolean;
} {
    return { ...action, visible: true, undoAvailable: !action.realtime };
}

export function undoDirectorAction<T>(action: ReversibleDirectorAction<T>): T {
    return action.before;
}

export interface DirectorHistoryEntry {
    at: number;
    description: string;
    reason: string;
}

export function directorHistory(entries: readonly DirectorHistoryEntry[]): DirectorHistoryEntry[] {
    return [...entries].sort((a, b) => a.at - b.at);
}

export const CORE_STATE_VIEWS = ["phone", "desktop", "watch", "tv", "discord", "car"] as const;
export function projectCoreState<T extends object, K extends keyof T>(state: T, fields: readonly K[]): Pick<T, K> {
    return Object.fromEntries(fields.map((field) => [field, state[field]])) as Pick<T, K>;
}

export const ECOSYSTEM_BRAIN_LAYERS = [
    "continuity",
    "social",
    "integrations",
    "surfaces",
    "memories",
    "ux",
    "accessibility",
] as const;

export const FULL_PLATFORM_FLOW = [
    "user-crowd-artist-intent",
    "session-contract",
    "taste-crowd-artist-brains",
    "music-knowledge",
    "recommendation-route",
    "music-director",
    "transition-dsp",
    "audio-master",
    "experience-event-bus",
    "session-sync",
] as const;
