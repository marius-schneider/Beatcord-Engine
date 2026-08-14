import type { ConcreteExperienceId } from "./experience-engine";
import type { DirectorDecisionLog } from "./music-director";

export type FeatureSource = "model" | "metadata" | "user" | "community" | "derived";

export interface FeatureValue<T> {
    value: T;
    confidence: number;
    source: FeatureSource;
    version?: string;
    createdAtMs?: number;
}

export interface CommunityCorrection<T> extends FeatureValue<T> {
    source: "user" | "community";
    fingerprint: string;
    contributorCount: number;
    trust: number;
}

export interface ResolvedFeature<T> {
    effective: FeatureValue<T>;
    original: FeatureValue<T>;
    override: CommunityCorrection<T> | null;
    rejected: CommunityCorrection<T>[];
}

/** Corrections remain overlays; the analyzer output is retained for audit and rollback. */
export function resolveFeature<T>(
    original: FeatureValue<T>,
    corrections: readonly CommunityCorrection<T>[],
    localFingerprint: string,
): ResolvedFeature<T> {
    const eligible = corrections.filter(
        (item) =>
            item.fingerprint === localFingerprint &&
            item.trust >= 0.6 &&
            (item.source === "user" || item.contributorCount >= 3),
    );
    const override =
        [...eligible].sort(
            (a, b) =>
                Number(b.source === "user") - Number(a.source === "user") ||
                b.confidence * b.trust - a.confidence * a.trust,
        )[0] ?? null;
    return {
        original,
        override,
        effective: override ?? original,
        rejected: corrections.filter((item) => item !== override),
    };
}

export interface HumanMixRating {
    audioArtifacts: 1 | 2 | 3 | 4 | 5;
    musicalTiming: 1 | 2 | 3 | 4 | 5;
    energyFlow: 1 | 2 | 3 | 4 | 5;
    naturalness: 1 | 2 | 3 | 4 | 5;
    overallPreference: "A" | "B" | "tie";
}

export interface PairwiseEvaluation {
    winner: "A" | "B" | "tie";
    preferenceShareA: number;
    mean: Omit<HumanMixRating, "overallPreference">;
    sampleSize: number;
}

export function evaluatePairwiseMixes(ratings: readonly HumanMixRating[]): PairwiseEvaluation {
    const sampleSize = ratings.length;
    const countA = ratings.filter((rating) => rating.overallPreference === "A").length;
    const countB = ratings.filter((rating) => rating.overallPreference === "B").length;
    const mean = (key: keyof Omit<HumanMixRating, "overallPreference">) =>
        sampleSize ? ratings.reduce((sum, rating) => sum + rating[key], 0) / sampleSize : 0;
    return {
        winner: countA === countB ? "tie" : countA > countB ? "A" : "B",
        preferenceShareA: sampleSize ? (countA + (sampleSize - countA - countB) * 0.5) / sampleSize : 0.5,
        mean: {
            audioArtifacts: mean("audioArtifacts") as 1,
            musicalTiming: mean("musicalTiming") as 1,
            energyFlow: mean("energyFlow") as 1,
            naturalness: mean("naturalness") as 1,
        },
        sampleSize,
    };
}

export interface ExperienceHysteresisState {
    current: ConcreteExperienceId;
    enteredAtMs: number;
    smoothedScores: Record<ConcreteExperienceId, number>;
}

export interface ExperienceHysteresisDecision {
    state: ExperienceHysteresisState;
    switched: boolean;
    reason: string;
}

const EXPERIENCE_IDS: ConcreteExperienceId[] = ["chill", "love", "energy", "party"];

export function applyExperienceHysteresis(
    previous: ExperienceHysteresisState,
    detected: Record<ConcreteExperienceId, number>,
    nowMs: number,
    options: { minimumDwellMs?: number; switchMargin?: number; smoothing?: number } = {},
): ExperienceHysteresisDecision {
    const smoothing = Math.max(0, Math.min(1, options.smoothing ?? 0.3));
    const smoothedScores = Object.fromEntries(
        EXPERIENCE_IDS.map((id) => [id, previous.smoothedScores[id] * (1 - smoothing) + detected[id] * smoothing]),
    ) as Record<ConcreteExperienceId, number>;
    const candidate = EXPERIENCE_IDS.reduce(
        (best, id) => (smoothedScores[id] > smoothedScores[best] ? id : best),
        previous.current,
    );
    const dwellSatisfied = nowMs - previous.enteredAtMs >= (options.minimumDwellMs ?? 10 * 60_000);
    const margin = smoothedScores[candidate] - smoothedScores[previous.current];
    const switched = candidate !== previous.current && dwellSatisfied && margin >= (options.switchMargin ?? 0.12);
    return {
        switched,
        state: {
            current: switched ? candidate : previous.current,
            enteredAtMs: switched ? nowMs : previous.enteredAtMs,
            smoothedScores,
        },
        reason: switched
            ? `${previous.current} → ${candidate} after dwell, margin ${margin.toFixed(2)}`
            : `held ${previous.current}; dwell=${dwellSatisfied}, margin=${margin.toFixed(2)}`,
    };
}

export type ExperienceTransitionStyle =
    | "slow"
    | "soft"
    | "warm"
    | "build"
    | "lift"
    | "push"
    | "cool"
    | "soften"
    | "reset"
    | "hold";

export const EXPERIENCE_TRANSITION_MATRIX: Record<
    ConcreteExperienceId,
    Record<ConcreteExperienceId, ExperienceTransitionStyle>
> = {
    chill: { chill: "hold", love: "slow", energy: "build", party: "build" },
    love: { chill: "soft", love: "hold", energy: "warm", party: "lift" },
    energy: { chill: "cool", love: "soften", energy: "hold", party: "push" },
    party: { chill: "cool", love: "reset", energy: "hold", party: "hold" },
};

export type MusicEventType =
    | "beat"
    | "bar"
    | "phrase"
    | "section"
    | "drop"
    | "transition"
    | "energy"
    | "experience"
    | "stinger";

export interface MusicEvent {
    id: string;
    type: MusicEventType;
    sessionTimeSec: number;
    beat: number;
    energy: number;
    payload?: Record<string, unknown>;
}

export type MusicEventListener = (event: MusicEvent) => void;

export class ExperienceEventBus {
    readonly #listeners = new Map<MusicEventType | "*", Set<MusicEventListener>>();

    subscribe(type: MusicEventType | "*", listener: MusicEventListener): () => void {
        const listeners = this.#listeners.get(type) ?? new Set<MusicEventListener>();
        listeners.add(listener);
        this.#listeners.set(type, listeners);
        return () => listeners.delete(listener);
    }

    publish(event: MusicEvent): void {
        for (const listener of this.#listeners.get(event.type) ?? []) listener(event);
        for (const listener of this.#listeners.get("*") ?? []) listener(event);
    }
}

export interface SessionClockSnapshot {
    wallTimeMs: number;
    sessionTimeSec: number;
    musicalBeat: number;
    trackTimeSec: number;
    outputTimeSec: number;
    bpm: number;
}

/** Explicitly converts wall, session, musical, source and device clocks. */
export class SessionClock {
    readonly #startedAtMs: number;
    #offsetSec = 0;

    constructor(startedAtMs: number) {
        this.#startedAtMs = startedAtMs;
    }

    synchronize(measuredSessionSec: number, wallTimeMs: number): void {
        this.#offsetSec = measuredSessionSec - (wallTimeMs - this.#startedAtMs) / 1000;
    }

    snapshot(wallTimeMs: number, bpm: number, trackOffsetSec = 0, outputLatencySec = 0): SessionClockSnapshot {
        const sessionTimeSec = Math.max(0, (wallTimeMs - this.#startedAtMs) / 1000 + this.#offsetSec);
        return {
            wallTimeMs,
            sessionTimeSec,
            musicalBeat: bpm > 0 ? (sessionTimeSec * bpm) / 60 : 0,
            trackTimeSec: Math.max(0, sessionTimeSec - trackOffsetSec),
            outputTimeSec: sessionTimeSec + Math.max(0, outputLatencySec),
            bpm,
        };
    }
}

export interface QuantizedStinger {
    event: MusicEvent;
    optional: true;
    quantization: "bar" | "phrase";
}

export function planStinger(
    kind: "session-start" | "request-arrival" | "peak" | "countdown" | "reaction",
    clock: SessionClockSnapshot,
    beatsPerBar = 4,
    phraseBars = 4,
): QuantizedStinger {
    const quantum = kind === "peak" || kind === "countdown" ? beatsPerBar * phraseBars : beatsPerBar;
    const beat = Math.ceil(clock.musicalBeat / quantum) * quantum;
    return {
        optional: true,
        quantization: quantum === beatsPerBar ? "bar" : "phrase",
        event: {
            id: `stinger-${kind}-${beat}`,
            type: "stinger",
            sessionTimeSec: (beat * 60) / Math.max(1, clock.bpm),
            beat,
            energy: kind === "peak" ? 1 : 0.65,
            payload: { kind },
        },
    };
}

export interface LightingCue {
    scene: "calm" | "motion" | "impact" | "atmosphere" | "full";
    intensity: number;
    transitionBeats: number;
}

export function lightingCueForSection(
    section: "verse" | "build" | "drop" | "breakdown" | "final-chorus",
    energy: number,
): LightingCue {
    const scene = { verse: "calm", build: "motion", drop: "impact", breakdown: "atmosphere", "final-chorus": "full" }[
        section
    ] as LightingCue["scene"];
    return { scene, intensity: Math.max(0, Math.min(1, energy)), transitionBeats: section === "drop" ? 0 : 4 };
}

export interface ExternalMusicEvent {
    event: MusicEventType;
    sessionTime: number;
    beatsUntilEvent: number;
    energy: number;
    dispatchAtSessionTime: number;
}

export function scheduleExternalEvent(
    event: MusicEvent,
    clock: SessionClockSnapshot,
    networkLeadSec = 0.5,
): ExternalMusicEvent {
    return {
        event: event.type,
        sessionTime: event.sessionTimeSec,
        beatsUntilEvent: Math.max(0, event.beat - clock.musicalBeat),
        energy: event.energy,
        dispatchAtSessionTime: Math.max(clock.sessionTimeSec, event.sessionTimeSec - Math.max(0, networkLeadSec)),
    };
}

export interface ReplayVerification {
    reproducible: boolean;
    inputMatches: boolean;
    selectionMatches: boolean;
    versionMatches: boolean;
}

export function verifyDecisionReplay(recorded: DirectorDecisionLog, replayed: DirectorDecisionLog): ReplayVerification {
    const inputMatches = recorded.inputStateHash === replayed.inputStateHash && recorded.seed === replayed.seed;
    const selectionMatches = recorded.selectedPlan.type === replayed.selectedPlan.type;
    const versionMatches =
        recorded.directorVersion === replayed.directorVersion &&
        JSON.stringify(recorded.analyzerVersions) === JSON.stringify(replayed.analyzerVersions);
    return {
        reproducible: inputMatches && selectionMatches && versionMatches,
        inputMatches,
        selectionMatches,
        versionMatches,
    };
}
