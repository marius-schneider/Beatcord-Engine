export type SharedRole = "host" | "co-host" | "dj" | "guest" | "listener";
export interface SessionPermissions {
    canPause: SharedRole[];
    canSkip: SharedRole[];
    canAddQueue: SharedRole[];
    canReorderQueue: SharedRole[];
    canChangeExperience: SharedRole[];
    canRequest: SharedRole[];
    canVote: SharedRole[];
}
export const DEFAULT_SESSION_PERMISSIONS: SessionPermissions = {
    canPause: ["host", "co-host", "dj"],
    canSkip: ["host", "co-host", "dj"],
    canAddQueue: ["host", "co-host", "dj"],
    canReorderQueue: ["host", "co-host", "dj"],
    canChangeExperience: ["host", "co-host"],
    canRequest: ["host", "co-host", "dj", "guest"],
    canVote: ["host", "co-host", "dj", "guest", "listener"],
};
export function canSessionAction(
    permissions: SessionPermissions,
    role: SharedRole,
    action: keyof SessionPermissions,
): boolean {
    return permissions[action].includes(role);
}
export function sessionJoinConsent(input: { userConfirmed: boolean; sessionVisible: boolean; joinAllowed: boolean }): {
    joined: boolean;
    obviousSharedState: true;
} {
    return { joined: input.userConfirmed && input.sessionVisible && input.joinAllowed, obviousSharedState: true };
}
export function ownershipIndicator(
    participants: number,
    audioOwner: string,
    device: string,
): { text: string; permanentWhileShared: true } {
    return { text: `Party with ${participants} people • Audio: ${audioOwner}'s ${device}`, permanentWhileShared: true };
}

export interface SessionStateEnvelope<T> {
    revision: bigint;
    serverTime: number;
    stateHash: string;
    payload: T;
}
export function applySessionEnvelope<T>(
    lastRevision: bigint,
    envelope: SessionStateEnvelope<T>,
): { action: "apply" | "resync" | "ignore"; acknowledgeRevision?: bigint; authoritative: true } {
    if (envelope.revision <= lastRevision) return { action: "ignore", authoritative: true };
    if (envelope.revision !== lastRevision + 1n) return { action: "resync", authoritative: true };
    return { action: "apply", acknowledgeRevision: envelope.revision, authoritative: true };
}
export type SharedAction = "reaction" | "skip" | "queue-reorder";
export function sharedActionConsistency(action: SharedAction): {
    execution: "optimistic" | "authoritative";
    rollbackRequired: boolean;
} {
    return action === "reaction"
        ? { execution: "optimistic", rollbackRequired: true }
        : { execution: "authoritative", rollbackRequired: false };
}

export interface DiscordPresenceInput {
    experience: string;
    people: number;
    track: string;
    sessionId?: string;
    joinSecret?: string;
    privacyAllowsJoin: boolean;
}
export function discordPresence(input: DiscordPresenceInput): {
    detail: string;
    join?: { sessionId: string; secret: string };
    rebroadcastAudio: false;
} {
    return {
        detail: `${input.experience} • ${input.people} people • ${input.track}`,
        ...(input.privacyAllowsJoin && input.sessionId && input.joinSecret
            ? { join: { sessionId: input.sessionId, secret: input.joinSecret } }
            : {}),
        rebroadcastAudio: false,
    };
}
export function integrationIsolation(
    adapter: string,
    failed: boolean,
): { adapter: string; corePlaybackAffected: false; status: "healthy" | "failed-isolated" } {
    return { adapter, corePlaybackAffected: false, status: failed ? "failed-isolated" : "healthy" };
}
export function integrationCircuitBreaker(
    failures: number,
    threshold = 3,
): { state: "closed" | "open"; retryStormPrevented: true; temporaryDisable: boolean } {
    const open = failures >= threshold;
    return { state: open ? "open" : "closed", retryStormPrevented: true, temporaryDisable: open };
}

export type BeatcordEventType =
    | "track-started"
    | "track-changed"
    | "beat"
    | "bar"
    | "phrase"
    | "section"
    | "chorus"
    | "build"
    | "drop"
    | "transition-started"
    | "dominance-handoff"
    | "transition-ended"
    | "experience-changed"
    | "crowd-reaction"
    | "session-joined";
export type EventClass = "realtime" | "musical" | "product" | "social";
export function eventClass(event: BeatcordEventType): EventClass {
    if (["beat", "bar"].includes(event)) return "realtime";
    if (["phrase", "section", "chorus", "build", "drop", "dominance-handoff"].includes(event)) return "musical";
    if (["crowd-reaction", "session-joined"].includes(event)) return "social";
    return "product";
}
export function eventDelivery(
    event: BeatcordEventType,
    target: "local-plugin" | "network-api",
): { precision: "high-local" | "future-predicted"; rawAudioCallbackExposed: false; eventClass: EventClass } {
    return {
        precision: target === "local-plugin" ? "high-local" : "future-predicted",
        rawAudioCallbackExposed: false,
        eventClass: eventClass(event),
    };
}

export type PluginCapability =
    | "read-track"
    | "read-beat"
    | "read-crowd-aggregate"
    | "control-lights"
    | "add-queue"
    | "control-playback";
export function pluginAuthorization(
    requested: readonly PluginCapability[],
    approved: readonly PluginCapability[],
): {
    granted: PluginCapability[];
    denied: PluginCapability[];
    audioThreadCodeAllowed: false;
    privateTasteAutomaticAccess: false;
} {
    return {
        granted: requested.filter((capability) => approved.includes(capability)),
        denied: requested.filter((capability) => !approved.includes(capability)),
        audioThreadCodeAllowed: false,
        privateTasteAutomaticAccess: false,
    };
}
export interface LightingIntent {
    energy: number;
    tension: number;
    moment?: "build" | "drop" | "break";
    confidence: number;
}
export function lightingIntent(input: LightingIntent): LightingIntent & { colorsChosenByIntegration: true } {
    return { ...input, colorsChosenByIntegration: true };
}

export interface ExternalGameContext {
    state: "menu" | "exploration" | "combat" | "boss" | "cutscene";
    intensity: number;
    confidence: number;
    adaptiveGamingMode: boolean;
}
export function gameIntegrationPolicy(context: ExternalGameContext): {
    energyTarget: number;
    reduceVocalForeground: boolean;
    influence: "soft" | "adaptive";
    abruptReplacementForbidden: true;
} {
    const target = { menu: 0.25, exploration: 0.5, combat: 0.8, boss: 0.95, cutscene: 0.35 }[context.state];
    return {
        energyTarget: Math.round(target * context.confidence * 1000) / 1000,
        reduceVocalForeground: context.state === "cutscene",
        influence: context.adaptiveGamingMode ? "adaptive" : "soft",
        abruptReplacementForbidden: true,
    };
}
export const LIVE_MUSIC_AGENT_ROLES = ["director", "accompanist", "responder", "curator", "performer"] as const;
export const NORMAL_PLAYBACK_AGENT_ROLES = ["director", "curator"] as const;
