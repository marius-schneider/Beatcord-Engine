const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
export const DRIVING_MODE = {
    interaction: "voice-first",
    largeControls: true,
    waveformEditor: false,
    complexQueueManipulation: false,
    attentionHeavyVisuals: false,
} as const;
export type CarRole = "driver-host" | "passenger-requester" | "passenger-controller";
export function carSessionPermissions(
    role: CarRole,
    moving: boolean,
): { voiceRequests: boolean; playbackControl: boolean; safetyPolicyOwner: boolean; deepTouchWorkflow: false } {
    return {
        voiceRequests: true,
        playbackControl: role === "driver-host" ? !moving : role === "passenger-controller",
        safetyPolicyOwner: role === "driver-host",
        deepTouchWorkflow: false,
    };
}
export function availabilityAwareUtility(
    baseUtility: number,
    availabilityConfidence: number,
    cached: boolean,
    connectivity: number,
): number {
    const offlineBonus = cached && connectivity < 0.4 ? 0.2 : 0;
    return clamp01(baseUtility * clamp01(availabilityConfidence) + offlineBonus);
}
export function connectivityRoute(
    candidates: readonly { id: string; utility: number; availabilityConfidence: number; cached: boolean }[],
    connectivity: number,
): string | null {
    return (
        [...candidates].sort(
            (a, b) =>
                availabilityAwareUtility(b.utility, b.availabilityConfidence, b.cached, connectivity) -
                availabilityAwareUtility(a.utility, a.availabilityConfidence, a.cached, connectivity),
        )[0]?.id ?? null
    );
}

export const WATCH_CONTROLS = ["now-playing", "love", "fire-reaction", "skip", "energy-adjust"] as const;
export function watchCrowdRemote(enabled: boolean): { actions: string[]; glanceable: true } {
    return { actions: enabled ? ["fire-reaction", "love", "skip-vote"] : ["now-playing"], glanceable: true };
}
export function hapticEvent(
    event: "countdown" | "drop" | "karaoke-cue",
    input: { enabled: boolean; reducedMotion: boolean },
): { emit: boolean; pattern: "subtle" | "standard"; configurable: true } {
    void event;
    return { emit: input.enabled, pattern: input.reducedMotion ? "subtle" : "standard", configurable: true };
}
export const TV_EXPERIENCE_SURFACE = ["lyrics", "visuals", "crowd", "album-art", "session-journey"] as const;

export interface TimedLyricLine {
    start: number;
    end: number;
    text: string;
}
export interface TimedLyricWord {
    start: number;
    end: number;
    text: string;
    lineIndex: number;
}
export interface TranslationTrack {
    language: string;
    lines: TimedLyricLine[];
}
export interface ExperienceLyricTimeline {
    lines: TimedLyricLine[];
    words?: TimedLyricWord[];
    language: string;
    translations?: TranslationTrack[];
    confidence: number;
}
export function validateLyricTimeline(timeline: ExperienceLyricTimeline): {
    valid: boolean;
    timedMedia: true;
    failures: string[];
} {
    const failures: string[] = [];
    if (timeline.lines.some((line) => line.end <= line.start)) failures.push("invalid-line-range");
    if (timeline.words?.some((word) => word.end <= word.start || !timeline.lines[word.lineIndex]))
        failures.push("invalid-word-timing");
    return { valid: failures.length === 0, timedMedia: true, failures };
}
export function lyricsAtPresentationTime(
    timeline: ExperienceLyricTimeline,
    audioPresentationTime: number,
    display: "original" | "translation" | "both",
    translationLanguage?: string,
): { original: string | null; translation: string | null; alignedToAudioClock: true } {
    const index = timeline.lines.findIndex(
        (line) => audioPresentationTime >= line.start && audioPresentationTime < line.end,
    );
    const translated =
        timeline.translations?.find((track) => track.language === translationLanguage)?.lines[index]?.text ?? null;
    return {
        original: display === "translation" ? null : (timeline.lines[index]?.text ?? null),
        translation: display === "original" ? null : translated,
        alignedToAudioClock: true,
    };
}
export function karaokeStemMix(input: {
    leadVocalDb: number;
    backingVocalsDb: number;
    leadAvailable: boolean;
    backingAvailable: boolean;
}): { leadVocalDb: number; backingVocalsDb: number; instrumentalPreserved: true } {
    return {
        leadVocalDb: input.leadAvailable ? Math.max(-60, Math.min(0, input.leadVocalDb)) : 0,
        backingVocalsDb: input.backingAvailable ? Math.max(-24, Math.min(0, input.backingVocalsDb)) : 0,
        instrumentalPreserved: true,
    };
}
export type KaraokeRole = "singer" | "next-singer" | "audience" | "host";
export interface KaraokeRequest {
    singerId: string;
    trackId: string;
    keyPreference?: number;
    prepared: boolean;
}
export function fairKaraokeQueue(
    requests: readonly KaraokeRequest[],
    recentSingers: readonly string[],
): KaraokeRequest[] {
    const seenTracks = new Set<string>();
    return [...requests]
        .filter((request) => {
            if (seenTracks.has(request.trackId)) return false;
            seenTracks.add(request.trackId);
            return true;
        })
        .sort(
            (a, b) =>
                Number(recentSingers.includes(a.singerId)) - Number(recentSingers.includes(b.singerId)) ||
                Number(b.prepared) - Number(a.prepared),
        );
}
export function karaokeMode(mode: "party" | "practice"): {
    pitchVisualization: boolean;
    timingFeedback: boolean;
    judgment: "none" | "training-only";
    forgiving: boolean;
} {
    return mode === "party"
        ? { pitchVisualization: false, timingFeedback: false, judgment: "none", forgiving: true }
        : { pitchVisualization: true, timingFeedback: true, judgment: "training-only", forgiving: false };
}

export interface SessionMemory {
    date: string;
    duration: number;
    participants: number;
    tracks: string[];
    discoveries: string[];
    reactions: number;
    peakMoments: string[];
    favoriteTransitions: string[];
    photos?: string[];
    title?: string;
}
export function buildSessionMemory(
    memory: SessionMemory,
    individualBehaviorEvents: readonly string[],
): SessionMemory & { surveillanceEventsStored: false; meaningfulMomentCount: number } {
    void individualBehaviorEvents;
    return {
        ...memory,
        tracks: [...new Set(memory.tracks)],
        discoveries: [...new Set(memory.discoveries)],
        surveillanceEventsStored: false,
        meaningfulMomentCount:
            memory.peakMoments.length + memory.favoriteTransitions.length + memory.discoveries.length,
    };
}
export function socialMemoryRecap(memory: SessionMemory): { title: string; lines: string[] } {
    return {
        title: memory.title ?? memory.date,
        lines: [
            `${memory.participants} people • ${Math.round(memory.duration / 60)} min`,
            `Peak moments: ${memory.peakMoments.length}`,
            `Discoveries: ${memory.discoveries.length}`,
            `Reactions: ${memory.reactions}`,
        ],
    };
}
export function memoryRetrieval(query: string, memories: readonly SessionMemory[]): SessionMemory[] {
    const normalized = query.toLowerCase();
    return memories.filter((memory) =>
        [memory.title, ...memory.tracks, ...memory.discoveries, ...memory.peakMoments]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalized)),
    );
}
export function userOwnedMemoryLabel(
    memory: SessionMemory,
    suggested: string,
    userLabel?: string | null,
): SessionMemory {
    if (userLabel === null) {
        const { title: _title, ...withoutTitle } = memory;
        return withoutTitle;
    }
    return { ...memory, title: userLabel ?? memory.title ?? suggested };
}
export const MEMORY_SURFACES = ["yesterday", "this-week", "trip", "party", "group", "year", "artist-era"] as const;
