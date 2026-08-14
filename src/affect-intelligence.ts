const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const clampSigned = (value: number) => Math.max(-1, Math.min(1, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

export type MusicModality = "audio" | "lyrics" | "artist" | "album" | "tags" | "playlist-graph";
export type Embedding = readonly number[];

export interface MultimodalTrackRepresentation {
    trackId: string;
    embeddings: Partial<Record<MusicModality, Embedding>>;
    confidences?: Partial<Record<MusicModality, number>>;
}

export const COLD_START_MODALITY_WEIGHTS: Record<MusicModality, number> = {
    audio: 0.3,
    lyrics: 0.18,
    artist: 0.14,
    album: 0.08,
    tags: 0.14,
    "playlist-graph": 0.16,
};

export function fuseMultimodalEmbedding(
    representation: MultimodalTrackRepresentation,
    weights: Record<MusicModality, number> = COLD_START_MODALITY_WEIGHTS,
): { embedding: number[]; modalities: MusicModality[]; confidence: number } {
    const available = (Object.keys(representation.embeddings) as MusicModality[]).filter(
        (modality) => (representation.embeddings[modality]?.length ?? 0) > 0,
    );
    const dimensions = Math.max(0, ...available.map((modality) => representation.embeddings[modality]?.length ?? 0));
    const effectiveWeights = available.map(
        (modality) => weights[modality] * clamp01(representation.confidences?.[modality] ?? 1),
    );
    const weightSum = effectiveWeights.reduce((sum, weight) => sum + weight, 0);
    const embedding = Array.from({ length: dimensions }, (_, dimension) => {
        if (!weightSum) return 0;
        const value = available.reduce(
            (sum, modality, index) =>
                sum + (representation.embeddings[modality]?.[dimension] ?? 0) * effectiveWeights[index]!,
            0,
        );
        return round(value / weightSum);
    });
    return {
        embedding,
        modalities: available,
        confidence: round(clamp01(weightSum / Object.values(weights).reduce((sum, weight) => sum + weight, 0))),
    };
}

export interface AffectState {
    valence: number;
    arousal: number;
    valenceConfidence: number;
    arousalConfidence: number;
}

export function normalizeAffect(state: AffectState): AffectState {
    return {
        valence: round(clampSigned(state.valence)),
        arousal: round(clamp01(state.arousal)),
        valenceConfidence: round(clamp01(state.valenceConfidence)),
        arousalConfidence: round(clamp01(state.arousalConfidence)),
    };
}

export interface BeatcordExperiencePoint extends AffectState {
    energy: number;
    tension: number;
    danceability: number;
}

export function beatcordExperienceSpace(input: {
    acousticArousal: number;
    rhythmicDrive: number;
    lyricalValence: number;
    harmonicValence: number;
    tension: number;
    danceability: number;
    audioConfidence: number;
    semanticConfidence: number;
}): AffectState {
    return normalizeAffect({
        valence: input.lyricalValence * 0.6 + input.harmonicValence * 0.4,
        arousal: input.acousticArousal * 0.65 + input.rhythmicDrive * 0.35,
        valenceConfidence: input.semanticConfidence * 0.65 + input.audioConfidence * 0.35,
        arousalConfidence: input.audioConfidence,
    });
}

export function experiencePoint(input: Parameters<typeof beatcordExperienceSpace>[0]): BeatcordExperiencePoint {
    const affect = beatcordExperienceSpace(input);
    return {
        ...affect,
        energy: round(clamp01(input.acousticArousal * 0.55 + input.rhythmicDrive * 0.45)),
        tension: round(clamp01(input.tension)),
        danceability: round(clamp01(input.danceability)),
    };
}

export interface TimedAffectPoint extends AffectState {
    timeSec: number;
}

export class EmotionalTimeline {
    readonly #points: TimedAffectPoint[];

    constructor(points: readonly TimedAffectPoint[]) {
        this.#points = [...points]
            .sort((a, b) => a.timeSec - b.timeSec)
            .map((point) => ({ ...normalizeAffect(point), timeSec: point.timeSec }));
    }

    at(timeSec: number): TimedAffectPoint | null {
        if (!this.#points.length) return null;
        const rightIndex = this.#points.findIndex((point) => point.timeSec >= timeSec);
        if (rightIndex <= 0) return { ...this.#points[Math.max(0, rightIndex)]! };
        if (rightIndex === -1) return { ...this.#points.at(-1)! };
        const left = this.#points[rightIndex - 1]!;
        const right = this.#points[rightIndex]!;
        const progress = (timeSec - left.timeSec) / Math.max(0.001, right.timeSec - left.timeSec);
        return {
            timeSec,
            valence: round(left.valence + (right.valence - left.valence) * progress),
            arousal: round(left.arousal + (right.arousal - left.arousal) * progress),
            valenceConfidence: round(
                left.valenceConfidence + (right.valenceConfidence - left.valenceConfidence) * progress,
            ),
            arousalConfidence: round(
                left.arousalConfidence + (right.arousalConfidence - left.arousalConfidence) * progress,
            ),
        };
    }

    change(fromSec: number, toSec: number): { valenceDelta: number; arousalDelta: number } | null {
        const from = this.at(fromSec);
        const to = this.at(toSec);
        return from && to
            ? { valenceDelta: round(to.valence - from.valence), arousalDelta: round(to.arousal - from.arousal) }
            : null;
    }
}

export interface EmotionPrediction {
    affect: AffectState;
    modelConfidence: number;
    domainConfidence: number;
    dataset: string;
}

export function calibratedEmotionPrediction(
    prediction: EmotionPrediction,
): EmotionPrediction & { effectiveConfidence: number } {
    return {
        ...prediction,
        affect: normalizeAffect(prediction.affect),
        modelConfidence: clamp01(prediction.modelConfidence),
        domainConfidence: clamp01(prediction.domainConfidence),
        effectiveConfidence: round(clamp01(prediction.modelConfidence) * clamp01(prediction.domainConfidence)),
    };
}

export interface CrossDatasetResult {
    sourceDataset: string;
    targetDataset: string;
    valenceCorrelation: number;
    arousalCorrelation: number;
    calibrationError: number;
}

export function evaluateCrossDatasetEmotion(results: readonly CrossDatasetResult[]): {
    robust: boolean;
    meanValence: number;
    meanArousal: number;
    meanCalibrationError: number;
    weakestDatasetPair: string | null;
} {
    if (!results.length)
        return { robust: false, meanValence: 0, meanArousal: 0, meanCalibrationError: 1, weakestDatasetPair: null };
    const meanValence = results.reduce((sum, result) => sum + result.valenceCorrelation, 0) / results.length;
    const meanArousal = results.reduce((sum, result) => sum + result.arousalCorrelation, 0) / results.length;
    const meanCalibrationError = results.reduce((sum, result) => sum + result.calibrationError, 0) / results.length;
    const weakest = [...results].sort(
        (a, b) =>
            a.valenceCorrelation +
            a.arousalCorrelation -
            a.calibrationError -
            (b.valenceCorrelation + b.arousalCorrelation - b.calibrationError),
    )[0]!;
    return {
        robust: meanValence >= 0.5 && meanArousal >= 0.65 && meanCalibrationError <= 0.2,
        meanValence: round(meanValence),
        meanArousal: round(meanArousal),
        meanCalibrationError: round(meanCalibrationError),
        weakestDatasetPair: `${weakest.sourceDataset}->${weakest.targetDataset}`,
    };
}

export function audioOnlyAffect(input: {
    predictedValence: number;
    predictedArousal: number;
    audioConfidence: number;
}): AffectState {
    return normalizeAffect({
        valence: input.predictedValence,
        arousal: input.predictedArousal,
        valenceConfidence: input.audioConfidence * 0.58,
        arousalConfidence: input.audioConfidence * 0.9,
    });
}

export interface MoodObservation {
    affect: AffectState;
    source: "explicit" | "behavioral" | "audio-context" | "default";
    atMs: number;
}

const MOOD_SOURCE_PRIORITY: Record<MoodObservation["source"], number> = {
    explicit: 4,
    behavioral: 3,
    "audio-context": 2,
    default: 1,
};

export function resolveMoodInput(observations: readonly MoodObservation[]): MoodObservation | null {
    return (
        [...observations].sort(
            (a, b) => MOOD_SOURCE_PRIORITY[b.source] - MOOD_SOURCE_PRIORITY[a.source] || b.atMs - a.atMs,
        )[0] ?? null
    );
}

export type MoodGoal = "match" | "regulate" | "maintain";
export interface MoodRegulationPlan {
    goal: MoodGoal;
    current: AffectState;
    target: AffectState;
    steps: AffectState[];
}

export function planMoodRegulation(
    current: AffectState,
    requestedTarget: AffectState | undefined,
    goal: MoodGoal,
    steps = 3,
): MoodRegulationPlan {
    const normalizedCurrent = normalizeAffect(current);
    const target = goal === "regulate" && requestedTarget ? normalizeAffect(requestedTarget) : normalizedCurrent;
    const planned = Array.from({ length: Math.max(1, steps) }, (_, index) => {
        const progress = (index + 1) / Math.max(1, steps);
        return normalizeAffect({
            valence: normalizedCurrent.valence + (target.valence - normalizedCurrent.valence) * progress,
            arousal: normalizedCurrent.arousal + (target.arousal - normalizedCurrent.arousal) * progress,
            valenceConfidence: Math.min(normalizedCurrent.valenceConfidence, target.valenceConfidence),
            arousalConfidence: Math.min(normalizedCurrent.arousalConfidence, target.arousalConfidence),
        });
    });
    return { goal, current: normalizedCurrent, target, steps: planned };
}
