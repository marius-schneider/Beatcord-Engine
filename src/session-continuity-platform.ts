export type DeviceRole = "audio-master" | "controller" | "display" | "lyrics" | "crowd-client" | "lighting" | "haptics";
export interface SessionHandoffState {
    currentTrack: string;
    playbackPosition: number;
    queue: string[];
    history: string[];
    experience: string;
    journey: string[];
    crowd?: { sessionId: string; members: number };
    requests: string[];
    currentContext: string;
    tasteProfileScope: string;
    plannedRoute: string[];
    committedTransition?: string;
}
export function validateHandoffState(state: SessionHandoffState): {
    complete: boolean;
    missing: string[];
    sessionContinuityNotOnlyPlayback: true;
} {
    const required: Array<keyof SessionHandoffState> = [
        "currentTrack",
        "playbackPosition",
        "queue",
        "history",
        "experience",
        "journey",
        "requests",
        "currentContext",
        "tasteProfileScope",
        "plannedRoute",
    ];
    const missing = required.filter((key) => state[key] === undefined || state[key] === null).map(String);
    return { complete: missing.length === 0, missing, sessionContinuityNotOnlyPlayback: true };
}
export type ContinuityAction = "transfer" | "remote-control";
export function continuityAction(
    action: ContinuityAction,
    sourceDevice: string,
    targetDevice: string,
): { renderer: string; controller: string; playbackMoves: boolean } {
    return action === "transfer"
        ? { renderer: targetDevice, controller: targetDevice, playbackMoves: true }
        : { renderer: sourceDevice, controller: targetDevice, playbackMoves: false };
}
export interface DeviceCapabilities {
    deviceId: string;
    roles: DeviceRole[];
    dspTier: 0 | 1 | 2 | 3;
    stems: boolean;
    sampleRate: number;
}
export function assignDeviceRoles(device: DeviceCapabilities): { roles: DeviceRole[]; multipleRolesAllowed: true } {
    return { roles: [...new Set(device.roles)], multipleRolesAllowed: true };
}
export type HandoffSafety = "now" | "after-transition" | "after-track";
export function intelligentHandoffTiming(input: {
    secondsToTransition: number;
    transitionCommitted: boolean;
    complexStemHandoff: boolean;
    secondsToTrackEnd: number;
}): { safety: HandoffSafety; reason: string } {
    if (input.transitionCommitted || (input.complexStemHandoff && input.secondsToTransition <= 20))
        return { safety: "after-transition", reason: "protect-committed-musical-transition" };
    if (input.secondsToTrackEnd <= 5) return { safety: "after-track", reason: "natural-track-boundary" };
    return { safety: "now", reason: "outside-commit-horizon" };
}
export function capabilityAwareHandoff(
    source: DeviceCapabilities,
    target: DeviceCapabilities,
    experience: string,
): { experience: string; dspTier: number; stems: boolean; degradedGracefully: boolean } {
    return {
        experience,
        dspTier: Math.min(source.dspTier, target.dspTier),
        stems: source.stems && target.stems,
        degradedGracefully: target.dspTier < source.dspTier || (source.stems && !target.stems),
    };
}

export interface BeatcordMediaSession {
    sessionId: string;
    state: "playing" | "paused";
    currentTrack: string;
    position: number;
    commands: string[];
    customCommands: string[];
}
export type OsAdapter =
    | "apple-now-playing"
    | "android-media3"
    | "windows-smtc"
    | "linux-mpris"
    | "discord-presence"
    | "web-media-session";
export function adaptMediaSession(
    session: BeatcordMediaSession,
    adapter: OsAdapter,
): { adapter: OsAdapter; coreSessionId: string; supportedCommands: string[]; coreFeatureSetPreserved: true } {
    return {
        adapter,
        coreSessionId: session.sessionId,
        supportedCommands: [...session.commands, ...session.customCommands],
        coreFeatureSetPreserved: true,
    };
}
export const OS_INTEGRATION_ARCHITECTURE = {
    coreFirst: true,
    adapters: [
        "apple-now-playing",
        "android-media3",
        "windows-smtc",
        "linux-mpris",
        "discord-presence",
        "web-media-session",
    ],
    productBehaviorBoundToOsApi: false,
    systemSurfacesPrimary: true,
} as const;

export type ControlSurface = "lock-screen" | "watch" | "desktop" | "car" | "tv" | "phone";
export function surfaceControls(surface: ControlSurface): {
    controls: string[];
    interaction: "touch" | "voice-first" | "full" | "display";
    complementary: true;
} {
    const controls =
        surface === "lock-screen"
            ? ["play", "pause", "skip", "like"]
            : surface === "watch"
              ? ["play", "skip", "reaction", "energy-adjust"]
              : surface === "desktop"
                ? ["full-director"]
                : surface === "car"
                  ? ["play", "pause", "skip", "voice-request"]
                  : surface === "tv"
                    ? ["lyrics", "visuals", "crowd"]
                    : ["requests", "reactions", "remote-control"];
    return {
        controls,
        interaction:
            surface === "car" ? "voice-first" : surface === "desktop" ? "full" : surface === "tv" ? "display" : "touch",
        complementary: true,
    };
}
export function complementaryPartyDevices(): Record<string, string[]> {
    return {
        desktop: ["audio", "director"],
        tv: ["lyrics", "visuals", "crowd"],
        phones: ["requests", "reactions"],
        watch: ["haptic", "quick-control"],
    };
}
export const CONTINUITY_PRINCIPLE = {
    queueRebuildForbidden: true,
    trackRestartForbidden: true,
    sessionContextLossForbidden: true,
    oneTapHandoff: true,
    continuityInDataModel: true,
} as const;
