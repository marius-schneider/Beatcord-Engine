export interface PortableTransitionRecipe {
    id: string;
    fromTrackId: string;
    toTrackId: string;
    entryWindow: { start: number; end: number };
    exitWindow: { start: number; end: number };
    tempoPlan: { sourceBpm: number; targetBpm: number; preservePitch: boolean };
    stemHandoff?: string;
    eqAutomation: Array<{ time: number; band: string; gainDb: number }>;
    effects: Array<{ time: number; effect: string; amount: number }>;
    author: "human" | "director";
    portable: true;
}
export interface MixedPlaylist {
    tracks: string[];
    transitions: PortableTransitionRecipe[];
    automation: Array<{ parameter: string; points: number[] }>;
    sequenceIntent?: { energy: number[]; semantics: string[] };
}

export function validateMixedPlaylist(playlist: MixedPlaylist): {
    valid: boolean;
    failures: string[];
    mediaObject: "mixed-playlist";
} {
    const pairs = new Set(
        playlist.tracks.slice(0, -1).map((track, index) => `${track}->${playlist.tracks[index + 1]}`),
    );
    const failures = playlist.transitions
        .filter((recipe) => !pairs.has(`${recipe.fromTrackId}->${recipe.toTrackId}`))
        .map((recipe) => `non-adjacent:${recipe.id}`);
    return { valid: failures.length === 0, failures, mediaObject: "mixed-playlist" };
}

export function recipeLifecycle(
    recipe: PortableTransitionRecipe,
    action: "learn" | "share" | "rate" | "remix",
): { recipeId: string; action: string; sourcePreserved: true; renderedAudioRequired: false } {
    return { recipeId: recipe.id, action, sourcePreserved: true, renderedAudioRequired: false };
}

export interface TrackRightsCapabilities {
    playback: boolean;
    crossfade: boolean;
    beatmatch: boolean;
    eqMix: boolean;
    stems: boolean;
    remix: boolean;
    export: boolean;
}
export type TransitionOperation = keyof Omit<TrackRightsCapabilities, "playback">;
export function sharedRights(a: TrackRightsCapabilities, b: TrackRightsCapabilities): TrackRightsCapabilities {
    return Object.fromEntries(
        (Object.keys(a) as (keyof TrackRightsCapabilities)[]).map((key) => [key, a[key] && b[key]]),
    ) as unknown as TrackRightsCapabilities;
}
export function capabilityAwareTransition(
    a: TrackRightsCapabilities,
    b: TrackRightsCapabilities,
    requested: readonly TransitionOperation[],
): {
    allowed: TransitionOperation[];
    denied: TransitionOperation[];
    strategy: "neural-stem-handoff" | "classic-eq-transition" | "crossfade" | "sequential";
} {
    const rights = sharedRights(a, b);
    const allowed = requested.filter((operation) => rights[operation]);
    const denied = requested.filter((operation) => !rights[operation]);
    const strategy =
        rights.stems && requested.includes("stems")
            ? "neural-stem-handoff"
            : rights.eqMix
              ? "classic-eq-transition"
              : rights.crossfade
                ? "crossfade"
                : "sequential";
    return { allowed, denied, strategy };
}

export const PARTICIPATORY_PLAYBACK_LAYERS = ["play", "mix", "arrange", "personalize", "participate"] as const;
export const MIXING_INNOVATION_RADAR = {
    playback: "participatory-playback",
    playlist: "mixable-playlist",
    recommender: "conversational-music-agent",
    features: "audio-language-reasoning",
    stems: "restoration-generative-modeling",
    catalog: "provenance-ai-origin-aware",
    consumerMixingValidated: true,
} as const;
export const CONVERSATIONAL_DIFFERENTIATION = {
    mainstreamScale: true,
    basicRequest: "request-music",
    beatcord: "request-session-behavior",
} as const;
