import type { ConcreteExperienceId, ExperienceId } from "./experience-engine";
import {
    type DirectedTransition,
    type DirectorTransitionOptions,
    MusicDirector,
    type MusicDirectorSnapshot,
    type SessionFingerprint,
    type TrackSelectionScore,
} from "./music-director";
import type { TrackProfile } from "./track-profile";
import type { TrackTraits } from "./transition-planner";

export const OFFLINE_DIRECTOR_BUNDLE_VERSION = 1 as const;

export type OfflineDirectorSignal = "beat-grid" | "structure" | "stems" | "vocal-activity" | "genre";
export type OfflineDirectorMode = "full" | "degraded" | "safe";

export interface OfflineDirectorTrack {
    id: string;
    profile: TrackProfile;
    traits: TrackTraits;
}

export interface OfflineDirectorExperience {
    requested: ExperienceId;
    intensity: number;
    weights: Record<ConcreteExperienceId, number>;
}

/**
 * Portable input for the entire TrackProfile -> Director -> Plan chain.
 * Deliberately excludes audio, source URLs, local paths and service credentials.
 */
export interface OfflineDirectorBundle {
    version: typeof OFFLINE_DIRECTOR_BUNDLE_VERSION;
    kind: "beatcord-offline-director";
    createdAtMs: number;
    directorSnapshot: MusicDirectorSnapshot;
    sessionFingerprint: SessionFingerprint;
    experience: OfflineDirectorExperience;
    tracks: OfflineDirectorTrack[];
    analyzerVersions: Record<string, string>;
    policy: {
        externalCalls: false;
        includesAudio: false;
        includesSourceLocations: false;
    };
}

export interface OfflineSignalAvailability {
    availableTracks: number;
    totalTracks: number;
    status: "complete" | "partial" | "unavailable";
}

export interface OfflineDirectorReadiness {
    bundleVersion: typeof OFFLINE_DIRECTOR_BUNDLE_VERSION;
    mode: OfflineDirectorMode;
    offlineCapable: true;
    networkRequired: false;
    deterministicClockMs: number;
    tracks: number;
    capabilities: Record<OfflineDirectorSignal, OfflineSignalAvailability>;
    missingByTrack: Record<string, OfflineDirectorSignal[]>;
    reasons: string[];
}

export interface CreateOfflineDirectorBundleOptions {
    createdAtMs?: number;
    analyzerVersions?: Readonly<Record<string, string>>;
}

export interface OfflineTransitionRequest {
    fromTrackId: string;
    toTrackId: string;
    lookaheadTrackIds?: readonly string[];
    options?: Partial<Omit<DirectorTransitionOptions, "stemsReady" | "lookaheadProfiles">>;
}

const EXPERIENCE_IDS = new Set<ExperienceId>(["auto", "chill", "love", "energy", "party"]);
const PROFILE_NUMBERS = [
    "bpm",
    "bpmConfidence",
    "keyConfidence",
    "energy",
    "valence",
    "danceability",
    "acousticness",
    "vocalness",
    "intensity",
    "complexity",
    "loudness",
    "dynamicRange",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function isBeatGrid(value: unknown): boolean {
    if (!isRecord(value) || !isRecord(value.key) || !isRecord(value.energy) || !isRecord(value.spectral)) return false;
    return (
        isFiniteNumber(value.bpm) &&
        isFiniteNumber(value.beatInterval) &&
        isFiniteNumber(value.musicalEndSec) &&
        Array.isArray(value.beats) &&
        value.beats.every(isFiniteNumber) &&
        typeof value.key.name === "string" &&
        typeof value.key.camelot === "string" &&
        isFiniteNumber(value.key.confidence) &&
        isFiniteNumber(value.energy.energy) &&
        isFiniteNumber(value.energy.percussiveness) &&
        isFiniteNumber(value.energy.danceability)
    );
}

function isProfile(value: unknown, trackId: string): value is TrackProfile {
    if (!isRecord(value) || value.trackId !== trackId || typeof value.key !== "string") return false;
    if (value.mode !== "major" && value.mode !== "minor") return false;
    if (!PROFILE_NUMBERS.every((field) => isFiniteNumber(value[field]))) return false;
    if (!Array.isArray(value.genres) || !Array.isArray(value.sections) || !Array.isArray(value.vocalRegions))
        return false;
    if (!isRecord(value.confidence) || !isRecord(value.provenance)) return false;
    if (value.beatGrid !== null && !isBeatGrid(value.beatGrid)) return false;
    return value.genres.every(
        (genre) => isRecord(genre) && typeof genre.genre === "string" && isFiniteNumber(genre.confidence),
    );
}

function isTrack(value: unknown): value is OfflineDirectorTrack {
    if (!isRecord(value) || typeof value.id !== "string" || !value.id || !isRecord(value.traits)) return false;
    if (typeof value.traits.title !== "string" || !isFiniteNumber(value.traits.durationMs)) return false;
    if (value.traits.grid !== null && !isBeatGrid(value.traits.grid)) return false;
    return isProfile(value.profile, value.id);
}

function availability(count: number, total: number): OfflineSignalAvailability {
    return {
        availableTracks: count,
        totalTracks: total,
        status: count === 0 ? "unavailable" : count === total ? "complete" : "partial",
    };
}

function safeJsonClone<T>(value: T): T | null {
    try {
        return JSON.parse(JSON.stringify(value)) as T;
    } catch {
        return null;
    }
}

/** Validate and detach an untrusted or deserialized bundle before execution. */
export function parseOfflineDirectorBundle(value: unknown): OfflineDirectorBundle | null {
    const bundle = safeJsonClone(value);
    if (!isRecord(bundle)) return null;
    if (
        bundle.version !== OFFLINE_DIRECTOR_BUNDLE_VERSION ||
        bundle.kind !== "beatcord-offline-director" ||
        !isFiniteNumber(bundle.createdAtMs) ||
        !Array.isArray(bundle.tracks) ||
        !bundle.tracks.length ||
        !bundle.tracks.every(isTrack) ||
        !isRecord(bundle.experience) ||
        !EXPERIENCE_IDS.has(bundle.experience.requested as ExperienceId) ||
        !isFiniteNumber(bundle.experience.intensity) ||
        !isRecord(bundle.experience.weights) ||
        !isRecord(bundle.analyzerVersions) ||
        !Object.values(bundle.analyzerVersions).every((version) => typeof version === "string") ||
        !isRecord(bundle.policy) ||
        bundle.policy.externalCalls !== false ||
        bundle.policy.includesAudio !== false ||
        bundle.policy.includesSourceLocations !== false
    ) {
        return null;
    }
    if (new Set(bundle.tracks.map((track) => track.id)).size !== bundle.tracks.length) return null;
    const probe = new MusicDirector({ now: () => bundle.createdAtMs as number });
    if (!probe.restoreSnapshot(bundle.directorSnapshot)) return null;
    if (!probe.applySessionFingerprint(bundle.sessionFingerprint, bundle.experience.requested as ExperienceId))
        return null;
    return bundle as unknown as OfflineDirectorBundle;
}

/** Snapshot the already-computed local intelligence needed by the DJ brain. */
export function createOfflineDirectorBundle(
    director: MusicDirector,
    tracks: readonly OfflineDirectorTrack[],
    options: CreateOfflineDirectorBundleOptions = {},
): OfflineDirectorBundle {
    if (!tracks.length) throw new Error("offline director bundle needs at least one track");
    const seenTrackIds = new Set<string>();
    const detachedTracks = tracks.flatMap((track) => {
        if (seenTrackIds.has(track.id)) return [];
        seenTrackIds.add(track.id);
        return [{ id: track.id, profile: track.profile, traits: track.traits }];
    });
    const profiles = detachedTracks.map((track) => track.profile);
    const state = director.state(profiles);
    const createdAtMs = options.createdAtMs ?? Date.now();
    const bundle: OfflineDirectorBundle = {
        version: OFFLINE_DIRECTOR_BUNDLE_VERSION,
        kind: "beatcord-offline-director",
        createdAtMs,
        directorSnapshot: director.exportSnapshot(),
        sessionFingerprint: director.exportSessionFingerprint(profiles),
        experience: {
            requested: state.experience.requested,
            intensity: state.experience.intensity,
            weights: { ...state.experience.weights },
        },
        tracks: detachedTracks,
        analyzerVersions: { ...(options.analyzerVersions ?? {}) },
        policy: {
            externalCalls: false,
            includesAudio: false,
            includesSourceLocations: false,
        },
    };
    const parsed = parseOfflineDirectorBundle(bundle);
    if (!parsed) throw new Error("cannot create invalid offline director bundle");
    return parsed;
}

export function offlineDirectorReadiness(bundle: OfflineDirectorBundle): OfflineDirectorReadiness {
    const signals: Record<OfflineDirectorSignal, number> = {
        "beat-grid": 0,
        structure: 0,
        stems: 0,
        "vocal-activity": 0,
        genre: 0,
    };
    const missingByTrack: Record<string, OfflineDirectorSignal[]> = {};
    for (const track of bundle.tracks) {
        const available = new Set<OfflineDirectorSignal>();
        if (track.traits.grid && track.profile.confidence.beatGrid > 0) available.add("beat-grid");
        if (track.profile.sections.length && track.profile.confidence.structure > 0) available.add("structure");
        if (track.traits.stemQuality?.usableForMixing) available.add("stems");
        if (track.traits.vocalActivity) available.add("vocal-activity");
        if (track.profile.genres.some((genre) => genre.genre !== "unknown" && genre.confidence > 0)) {
            available.add("genre");
        }
        for (const signal of available) signals[signal]++;
        const missing = (Object.keys(signals) as OfflineDirectorSignal[]).filter((signal) => !available.has(signal));
        if (missing.length) missingByTrack[track.id] = missing;
    }
    const total = bundle.tracks.length;
    const capabilities = Object.fromEntries(
        (Object.keys(signals) as OfflineDirectorSignal[]).map((signal) => [
            signal,
            availability(signals[signal], total),
        ]),
    ) as Record<OfflineDirectorSignal, OfflineSignalAvailability>;
    const coreComplete = capabilities["beat-grid"].status === "complete" && capabilities.genre.status === "complete";
    const richComplete = coreComplete && capabilities.structure.status === "complete";
    const mode: OfflineDirectorMode = richComplete ? "full" : coreComplete ? "degraded" : "safe";
    const reasons = [
        "TrackProfile, Music Director, transition planning and cue selection execute locally",
        "cloud inference is disabled; optional missing signals never trigger an external call",
    ];
    if (mode === "degraded")
        reasons.push("some structural detail is missing; conservative region fallbacks remain active");
    if (mode === "safe") reasons.push("beat or genre evidence is incomplete; safe fade/cut fallbacks remain active");
    return {
        bundleVersion: OFFLINE_DIRECTOR_BUNDLE_VERSION,
        mode,
        offlineCapable: true,
        networkRequired: false,
        deterministicClockMs: bundle.createdAtMs,
        tracks: total,
        capabilities,
        missingByTrack,
        reasons,
    };
}

/** Stateful local runtime. Independent instances produce identical decisions from the same bundle and request. */
export class OfflineFirstDirector {
    readonly bundle: OfflineDirectorBundle;
    readonly readiness: OfflineDirectorReadiness;
    readonly director: MusicDirector;
    #tracks: Map<string, OfflineDirectorTrack>;

    constructor(value: unknown) {
        const bundle = parseOfflineDirectorBundle(value);
        if (!bundle) throw new Error("invalid offline director bundle");
        this.bundle = bundle;
        this.readiness = offlineDirectorReadiness(bundle);
        this.#tracks = new Map(bundle.tracks.map((track) => [track.id, track]));
        this.director = new MusicDirector({ now: () => bundle.createdAtMs });
        if (!this.director.restoreSnapshot(bundle.directorSnapshot)) throw new Error("invalid director snapshot");
        if (!this.director.applySessionFingerprint(bundle.sessionFingerprint, bundle.experience.requested)) {
            throw new Error("invalid session fingerprint");
        }
    }

    track(trackId: string): OfflineDirectorTrack | null {
        return this.#tracks.get(trackId) ?? null;
    }

    rank(currentTrackId: string, candidateTrackIds?: readonly string[]): TrackSelectionScore[] {
        const current = this.#requiredTrack(currentTrackId);
        const ids = candidateTrackIds ?? this.bundle.tracks.map((track) => track.id);
        const candidates = ids.filter((id) => id !== currentTrackId).map((id) => this.#requiredTrack(id).profile);
        return this.director.rankTrackCandidates(current.profile, candidates);
    }

    plan(request: OfflineTransitionRequest): DirectedTransition {
        const current = this.#requiredTrack(request.fromTrackId);
        const next = this.#requiredTrack(request.toTrackId);
        const lookaheadProfiles = (request.lookaheadTrackIds ?? [])
            .filter((id) => id !== current.id && id !== next.id)
            .map((id) => this.#requiredTrack(id).profile);
        return this.director.planTransition(current.traits, next.traits, current.profile, next.profile, {
            fadeSec: 8,
            tempoSync: true,
            eqSweep: true,
            harmonic: true,
            outgoingTempoRatio: 1,
            maxFadeSec: 14,
            ...request.options,
            stemsReady:
                current.traits.stemQuality?.tier === "high" &&
                current.traits.stemQuality.usableForAcapella &&
                current.traits.stemQuality.score >= 58,
            lookaheadProfiles,
        });
    }

    #requiredTrack(trackId: string): OfflineDirectorTrack {
        const track = this.#tracks.get(trackId);
        if (!track) throw new Error(`offline director track not found: ${trackId}`);
        return track;
    }
}
