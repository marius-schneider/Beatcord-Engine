export type SocialSessionType = "party" | "couple" | "friends" | "family" | "study" | "gaming" | "artist-event";
export interface SocialPresence {
    userId: string;
    activity: "listening" | "idle";
    experience?: string;
    sessionPreviewAllowed: boolean;
    quietJoinAllowed: boolean;
}
export function socialPresenceLoop(
    presence: SocialPresence,
    requestJoin: boolean,
): { stages: string[]; ambientOnly: boolean; chatRequired: false; voiceRequired: false } {
    const stages = presence.activity === "listening" ? ["friend-activity", "session-preview"] : ["friend-activity"];
    if (requestJoin && presence.sessionPreviewAllowed)
        stages.push("join-request", "shared-session", "reaction", "memory");
    return { stages, ambientOnly: presence.quietJoinAllowed, chatRequired: false, voiceRequired: false };
}
export function ambientMusicPresence(
    name: string,
    experience: string,
    quietJoinAllowed: boolean,
): { text: string; action: "join-quietly" | "view-only"; pressure: "low" } {
    return {
        text: `${name} is listening • ${experience}`,
        action: quietJoinAllowed ? "join-quietly" : "view-only",
        pressure: "low",
    };
}
export interface SocialContextPolicy {
    fairness: number;
    sharedMemories: number;
    bridgeTaste: number;
    crowdResponse: number;
    requests: number;
    fairnessWindow: number;
    energyAdaptation: number;
}
export function socialContextPolicy(type: SocialSessionType, participants: number): SocialContextPolicy {
    if (type === "couple")
        return {
            fairness: 0.9,
            sharedMemories: 0.9,
            bridgeTaste: 0.9,
            crowdResponse: 0.2,
            requests: 0.5,
            fairnessWindow: 0.7,
            energyAdaptation: 0.3,
        };
    if (type === "party")
        return {
            fairness: 0.7,
            sharedMemories: 0.3,
            bridgeTaste: 0.4,
            crowdResponse: 0.95,
            requests: 0.9,
            fairnessWindow: Math.min(1, participants / 8),
            energyAdaptation: 0.9,
        };
    if (type === "family")
        return {
            fairness: 0.85,
            sharedMemories: 0.8,
            bridgeTaste: 0.75,
            crowdResponse: 0.35,
            requests: 0.6,
            fairnessWindow: 0.8,
            energyAdaptation: 0.4,
        };
    if (type === "study")
        return {
            fairness: 0.7,
            sharedMemories: 0.3,
            bridgeTaste: 0.6,
            crowdResponse: 0.1,
            requests: 0.4,
            fairnessWindow: 0.6,
            energyAdaptation: 0.1,
        };
    return {
        fairness: 0.7,
        sharedMemories: 0.5,
        bridgeTaste: 0.6,
        crowdResponse: 0.5,
        requests: 0.6,
        fairnessWindow: 0.6,
        energyAdaptation: 0.5,
    };
}

export type SharedSessionRole = "host" | "co-host" | "dj" | "guest" | "listener";
export type SessionPermission = "experience" | "queue" | "playback" | "requests" | "mix-controls" | "crowd-moderation";
export type HostAuthorityMode = "anyone-controls" | "requests-only" | "queue-edits" | "host-approval";
const BASE_PERMISSIONS: Record<SharedSessionRole, SessionPermission[]> = {
    host: ["experience", "queue", "playback", "requests", "mix-controls", "crowd-moderation"],
    "co-host": ["experience", "queue", "playback", "requests", "mix-controls", "crowd-moderation"],
    dj: ["queue", "playback", "requests", "mix-controls"],
    guest: ["requests"],
    listener: [],
};
export function sessionPermissions(role: SharedSessionRole, mode: HostAuthorityMode): SessionPermission[] {
    if (role === "host") return [...BASE_PERMISSIONS.host];
    if (mode === "anyone-controls")
        return [...new Set([...BASE_PERMISSIONS[role], "playback" as const, "queue" as const])];
    if (mode === "queue-edits" && role !== "listener")
        return [...new Set([...BASE_PERMISSIONS[role], "queue" as const])];
    if (mode === "requests-only" || mode === "host-approval") return role === "listener" ? [] : ["requests"];
    return [...BASE_PERMISSIONS[role]];
}
export interface SharedSessionMember {
    userId: string;
    role: SharedSessionRole;
}
export function authorizeSessionAction(
    member: SharedSessionMember,
    permission: SessionPermission,
    mode: HostAuthorityMode,
): { allowed: boolean; requiresHostApproval: boolean; authorityExplicit: true } {
    const allowed = sessionPermissions(member.role, mode).includes(permission);
    return {
        allowed,
        requiresHostApproval: mode === "host-approval" && member.role !== "host",
        authorityExplicit: true,
    };
}

export interface SharedSessionMemory {
    sessionId: string;
    type: SocialSessionType;
    participants: number;
    reactions: number;
    sharedTracks: string[];
    conversationRequired: false;
}
export function createSharedMemory(
    sessionId: string,
    type: SocialSessionType,
    participants: number,
    reactions: number,
    sharedTracks: readonly string[],
): SharedSessionMemory {
    return {
        sessionId,
        type,
        participants,
        reactions,
        sharedTracks: [...new Set(sharedTracks)],
        conversationRequired: false,
    };
}
export const SOCIAL_EXPERIENCE_PRINCIPLE = {
    loop: ["see", "join", "shared-experience", "reaction", "memory"],
    shareLinkOnlyInsufficient: true,
    partyNotOnlySocialMode: true,
    explicitAuthorityRequired: true,
} as const;
