import { hashDirectorInput } from "./music-director";
import type { TransitionPreview, TransitionPreviewVariant } from "./transition-preview";

export const PERCEPTUAL_DIMENSIONS = [
    "naturalness",
    "musicalLogic",
    "energyFlow",
    "audioQuality",
    "surprise",
    "emotionality",
    "continueListening",
] as const;

export type PerceptualDimension = (typeof PERCEPTUAL_DIMENSIONS)[number];
export type PerceptualRatings = Record<PerceptualDimension, number>;
export type BlindChoice = "A" | "B" | "no-preference";

export interface BlindListeningTrial {
    version: 1;
    id: string;
    previewId: string;
    createdAtMs: number;
    raterHash: string;
    samples: [{ label: "A"; sampleId: string; variantId: string }, { label: "B"; sampleId: string; variantId: string }];
}

export interface PublicBlindListeningTrial {
    version: 1;
    id: string;
    previewId: string;
    createdAtMs: number;
    prompt: "Which transition sounds better?";
    dimensions: readonly PerceptualDimension[];
    samples: [{ label: "A"; sampleId: string }, { label: "B"; sampleId: string }];
}

export interface BlindListeningResponseInput {
    choice: BlindChoice;
    ratings: { A: PerceptualRatings; B: PerceptualRatings };
    confidence: number;
}

export interface PerceptualObservation {
    version: 1;
    id: string;
    timestamp: number;
    trialId: string;
    previewId: string;
    raterHash: string;
    comparedVariantIds: [string, string];
    selectedVariantId: string | null;
    noPreference: boolean;
    ratingsByVariant: Record<string, PerceptualRatings>;
    confidence: number;
}

export interface PerceptualVariantSummary {
    variantId: string;
    comparisons: number;
    wins: number;
    losses: number;
    ties: number;
    preferenceRate: number;
    preferenceInterval95: { low: number; high: number };
    meanRatings: PerceptualRatings;
    meanConfidence: number;
    humanQualityScore: number;
}

export interface PerceptualEvaluationSummary {
    version: 1;
    responses: number;
    uniqueRaters: number;
    duplicateResponsesRemoved: number;
    variants: PerceptualVariantSummary[];
}

export interface JointVariantScore {
    variantId: string;
    technicalScore: number;
    humanScore: number | null;
    humanWeight: number;
    jointScore: number;
    evidence: number;
    reason: string;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round = (value: number, digits = 3) => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

function participantHash(participantId: string): string {
    const normalized = participantId.trim();
    if (!normalized || normalized.length > 128) throw new Error("participantId must contain 1 to 128 characters");
    return hashDirectorInput({ participant: normalized });
}

function ratingVector(value: unknown): value is PerceptualRatings {
    if (typeof value !== "object" || value === null) return false;
    const ratings = value as Partial<PerceptualRatings>;
    return PERCEPTUAL_DIMENSIONS.every((dimension) => {
        const rating = ratings[dimension];
        return typeof rating === "number" && Number.isInteger(rating) && rating >= 1 && rating <= 5;
    });
}

export function validateBlindListeningResponse(
    value: unknown,
): { ok: true; value: BlindListeningResponseInput } | { ok: false; error: string } {
    if (typeof value !== "object" || value === null) return { ok: false, error: "response must be an object" };
    const response = value as Partial<BlindListeningResponseInput>;
    if (response.choice !== "A" && response.choice !== "B" && response.choice !== "no-preference") {
        return { ok: false, error: "choice must be A, B or no-preference" };
    }
    if (
        typeof response.ratings !== "object" ||
        response.ratings === null ||
        !ratingVector(response.ratings.A) ||
        !ratingVector(response.ratings.B)
    ) {
        return { ok: false, error: "ratings for A and B must contain integer values from 1 to 5" };
    }
    if (
        typeof response.confidence !== "number" ||
        !Number.isFinite(response.confidence) ||
        response.confidence < 0 ||
        response.confidence > 1
    ) {
        return { ok: false, error: "confidence must be between 0 and 1" };
    }
    return { ok: true, value: response as BlindListeningResponseInput };
}

/** Counterbalanced and deterministic per participant, without exposing variant identities. */
export function createBlindListeningTrial(
    preview: TransitionPreview,
    participantId: string,
    now: () => number = Date.now,
): BlindListeningTrial {
    if (preview.variants.length < 2) throw new Error("blind listening trial needs two preview variants");
    const raterHash = participantHash(participantId);
    const recommended =
        preview.variants.find((variant) => variant.id === preview.recommendedVariantId) ?? preview.variants[0]!;
    const challenger = preview.variants.find((variant) => variant.id !== recommended.id)!;
    const assignmentHash = hashDirectorInput({
        previewId: preview.id,
        raterHash,
        pair: [recommended.id, challenger.id].sort(),
    });
    const swap = (Number.parseInt(assignmentHash.slice(-2), 16) & 1) === 1;
    const variants = swap ? [challenger, recommended] : [recommended, challenger];
    const id = `trial-${hashDirectorInput({ previewId: preview.id, raterHash, variants: variants.map((variant) => variant.id) })}`;
    return {
        version: 1,
        id,
        previewId: preview.id,
        createdAtMs: now(),
        raterHash,
        samples: [
            {
                label: "A",
                sampleId: `sample-${hashDirectorInput({ trialId: id, label: "A" })}`,
                variantId: variants[0]!.id,
            },
            {
                label: "B",
                sampleId: `sample-${hashDirectorInput({ trialId: id, label: "B" })}`,
                variantId: variants[1]!.id,
            },
        ],
    };
}

export function publicBlindListeningTrial(trial: BlindListeningTrial): PublicBlindListeningTrial {
    return {
        version: 1,
        id: trial.id,
        previewId: trial.previewId,
        createdAtMs: trial.createdAtMs,
        prompt: "Which transition sounds better?",
        dimensions: PERCEPTUAL_DIMENSIONS,
        samples: trial.samples.map(({ label, sampleId }) => ({
            label,
            sampleId,
        })) as PublicBlindListeningTrial["samples"],
    };
}

export function createPerceptualObservation(
    trial: BlindListeningTrial,
    participantId: string,
    response: BlindListeningResponseInput,
    timestamp = Date.now(),
): PerceptualObservation {
    const raterHash = participantHash(participantId);
    if (raterHash !== trial.raterHash) throw new Error("trial belongs to a different participant");
    const a = trial.samples[0].variantId;
    const b = trial.samples[1].variantId;
    const selectedVariantId = response.choice === "A" ? a : response.choice === "B" ? b : null;
    return {
        version: 1,
        id: `${timestamp}-${hashDirectorInput({ trialId: trial.id, raterHash, response, timestamp })}`,
        timestamp,
        trialId: trial.id,
        previewId: trial.previewId,
        raterHash,
        comparedVariantIds: [a, b],
        selectedVariantId,
        noPreference: response.choice === "no-preference",
        ratingsByVariant: { [a]: response.ratings.A, [b]: response.ratings.B },
        confidence: response.confidence,
    };
}

function emptyRatings(): PerceptualRatings {
    return {
        naturalness: 0,
        musicalLogic: 0,
        energyFlow: 0,
        audioQuality: 0,
        surprise: 0,
        emotionality: 0,
        continueListening: 0,
    };
}

function wilson(successes: number, total: number): { low: number; high: number } {
    if (!total) return { low: 0, high: 1 };
    const z = 1.96;
    const probability = successes / total;
    const denominator = 1 + (z * z) / total;
    const center = (probability + (z * z) / (2 * total)) / denominator;
    const margin =
        (z / denominator) * Math.sqrt((probability * (1 - probability)) / total + (z * z) / (4 * total * total));
    return { low: round(clamp01(center - margin)), high: round(clamp01(center + margin)) };
}

/** Aggregate one response per participant/trial to prevent accidental vote amplification. */
export function summarizePerceptualEvaluations(
    observations: readonly PerceptualObservation[],
): PerceptualEvaluationSummary {
    const unique = new Map<string, PerceptualObservation>();
    for (const observation of observations) {
        const key = `${observation.trialId}:${observation.raterHash}`;
        if (!unique.has(key)) unique.set(key, observation);
    }
    const values = [...unique.values()];
    const ids = new Set(values.flatMap((observation) => observation.comparedVariantIds));
    const variants = [...ids].map((variantId): PerceptualVariantSummary => {
        const relevant = values.filter((observation) => observation.comparedVariantIds.includes(variantId));
        const wins = relevant.filter((observation) => observation.selectedVariantId === variantId).length;
        const ties = relevant.filter((observation) => observation.noPreference).length;
        const losses = relevant.length - wins - ties;
        const ratingSums = emptyRatings();
        let rated = 0;
        for (const observation of relevant) {
            const ratings = observation.ratingsByVariant[variantId];
            if (!ratings) continue;
            rated++;
            for (const dimension of PERCEPTUAL_DIMENSIONS) ratingSums[dimension] += ratings[dimension];
        }
        const meanRatings = emptyRatings();
        for (const dimension of PERCEPTUAL_DIMENSIONS)
            meanRatings[dimension] = round(rated ? ratingSums[dimension] / rated : 0);
        const preferenceRate = relevant.length ? (wins + ties * 0.5) / relevant.length : 0.5;
        const humanQualityScore =
            (PERCEPTUAL_DIMENSIONS.reduce((sum, dimension) => sum + meanRatings[dimension], 0) /
                (PERCEPTUAL_DIMENSIONS.length * 5)) *
            100;
        return {
            variantId,
            comparisons: relevant.length,
            wins,
            losses,
            ties,
            preferenceRate: round(preferenceRate),
            preferenceInterval95: wilson(wins + ties * 0.5, relevant.length),
            meanRatings,
            meanConfidence: round(
                relevant.length
                    ? relevant.reduce((sum, observation) => sum + observation.confidence, 0) / relevant.length
                    : 0,
            ),
            humanQualityScore: round(humanQualityScore, 1),
        };
    });
    variants.sort((a, b) => b.preferenceRate - a.preferenceRate || b.humanQualityScore - a.humanQualityScore);
    return {
        version: 1,
        responses: values.length,
        uniqueRaters: new Set(values.map((observation) => observation.raterHash)).size,
        duplicateResponsesRemoved: observations.length - values.length,
        variants,
    };
}

/** Human evidence gains influence only after a minimum panel size and is capped at 50%. */
export function scoreVariantWithPerception(
    variant: TransitionPreviewVariant,
    summary: PerceptualEvaluationSummary,
    minimumResponses = 5,
): JointVariantScore {
    const technicalScore = variant.metrics.recommendationScore;
    const human = summary.variants.find((item) => item.variantId === variant.id);
    if (!human || human.comparisons < minimumResponses) {
        return {
            variantId: variant.id,
            technicalScore,
            humanScore: human?.humanQualityScore ?? null,
            humanWeight: 0,
            jointScore: technicalScore,
            evidence: human?.comparisons ?? 0,
            reason: `technical-only; need ${minimumResponses} independent responses`,
        };
    }
    const evidenceStrength = clamp01((human.comparisons - minimumResponses + 1) / (minimumResponses * 3));
    const humanWeight = round(Math.min(0.5, evidenceStrength * human.meanConfidence * 0.5));
    const humanScore = round(human.humanQualityScore * 0.7 + human.preferenceRate * 100 * 0.3, 1);
    return {
        variantId: variant.id,
        technicalScore,
        humanScore,
        humanWeight,
        jointScore: round(technicalScore * (1 - humanWeight) + humanScore * humanWeight, 1),
        evidence: human.comparisons,
        reason: `technical ${(1 - humanWeight).toFixed(2)} + perceptual ${humanWeight.toFixed(2)} from ${human.comparisons} responses`,
    };
}
