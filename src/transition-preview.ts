import { decideAdaptiveStretch, type StretchDecision } from "./adaptive-stretch";
import { selectTransitionRegions } from "./mix-regions";
import { hashDirectorInput } from "./music-director";
import { assessPerceptualMasking, type PerceptualMaskingAssessment } from "./perceptual-masking";
import { chooseTransitionCue, type TransitionCue } from "./phrase-cues";
import type { TrackProfile } from "./track-profile";
import {
    buildTransitionCandidates,
    type CandidatePlannerConfig,
    type TransitionCandidate,
} from "./transition-candidates";
import type { TrackTraits, TransitionPlan, TransitionType } from "./transition-planner";

export interface TransitionPreviewOptions extends CandidatePlannerConfig {
    fadeSec: number;
    outgoingTempoRatio?: number;
    preserveStructure?: number;
    vocalOverlapTolerance?: number;
    targetEnergyDelta?: number;
    stretcherProfile?: "atempo" | "rubberband";
    highQualityStretch?: boolean;
    maxVariants?: number;
    now?: () => number;
}

export interface TransitionPreviewMetrics {
    /** Expected subjective continuity, 0..100. */
    naturalness: number;
    /** Pair-specific musical fit, 0..100. */
    musicalFit: number;
    /** Predicted audible artifact/collision risk, 0..100 (lower is better). */
    artifactRisk: number;
    /** Analysis confidence behind the estimate, 0..100. */
    confidence: number;
    recommendationScore: number;
}

export interface TransitionPreviewVariant {
    id: string;
    label: string;
    plan: TransitionPlan;
    cue: TransitionCue;
    masking: PerceptualMaskingAssessment;
    stretch: StretchDecision;
    metrics: TransitionPreviewMetrics;
    reasons: string[];
}

export interface TransitionPreview {
    version: 1;
    id: string;
    createdAtMs: number;
    fromTrackId: string;
    toTrackId: string;
    inputStateHash: string;
    recommendedVariantId: string;
    variants: TransitionPreviewVariant[];
}

const COMPLEXITY: Record<TransitionType, number> = {
    fade: 0.08,
    blend: 0.35,
    cut: 0.28,
    echo: 0.38,
    filter: 0.48,
    bassdrop: 0.62,
    gate: 0.65,
    riser: 0.66,
    spinback: 0.72,
    roll: 0.76,
    acapella: 0.92,
};

const REQUIRED_CONFIDENCE: Record<TransitionType, number> = {
    fade: 0.05,
    blend: 0.2,
    echo: 0.28,
    cut: 0.34,
    filter: 0.42,
    bassdrop: 0.58,
    gate: 0.58,
    riser: 0.58,
    spinback: 0.62,
    roll: 0.68,
    acapella: 0.78,
};

type PreviewFamily = "gentle" | "seamless" | "impact";

function family(type: TransitionType): PreviewFamily {
    if (type === "fade" || type === "echo") return "gentle";
    if (type === "blend" || type === "filter" || type === "acapella") return "seamless";
    return "impact";
}

function label(type: TransitionType): string {
    switch (family(type)) {
        case "gentle":
            return type === "fade" ? "Sanfter Übergang" : "Weicher Echo-Ausklang";
        case "seamless":
            return type === "filter" ? "Maskierter Club-Mix" : type === "acapella" ? "Vocal-Layer" : "Nahtloser Blend";
        case "impact":
            return `Akzent: ${type}`;
    }
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round = (value: number, digits = 1) => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

function analysisConfidence(current: TrackProfile, next: TrackProfile): number {
    return clamp01(
        current.confidence.overall * 0.3 +
            next.confidence.overall * 0.3 +
            current.confidence.phrase * 0.2 +
            next.confidence.phrase * 0.2,
    );
}

function diverseCandidates(
    candidates: readonly TransitionCandidate[],
    confidence: number,
    maxVariants: number,
): TransitionCandidate[] {
    const eligible = candidates.filter((candidate) => confidence >= REQUIRED_CONFIDENCE[candidate.plan.type]);
    // Always retain enough conservative alternatives for a useful A/B preview.
    const pool = [...eligible];
    for (const candidate of candidates) {
        if (pool.length >= 2) break;
        if (["fade", "blend", "echo"].includes(candidate.plan.type) && !pool.includes(candidate)) pool.push(candidate);
    }
    if (pool.length === 1 && pool[0]?.plan.type !== "fade") {
        const source = pool[0]!;
        pool.push({
            plan: {
                type: "fade",
                fadeSec: source.plan.fadeSec,
                eqSweep: false,
                tempoRatio: 1,
                reason: "preview conservative fade",
            },
            score: Math.min(source.score, 72),
            musicalScore: Math.min(source.musicalScore, 72),
            feedbackBias: 0,
            reasons: ["low-confidence conservative alternative"],
            signals: { ...source.signals },
        });
    }
    if (!pool.length && candidates[0]) pool.push(candidates[0]);

    const selected: TransitionCandidate[] = [];
    for (const name of ["gentle", "seamless", "impact"] satisfies PreviewFamily[]) {
        const candidate = pool.find((item) => family(item.plan.type) === name);
        if (candidate) selected.push(candidate);
    }
    for (const candidate of pool) {
        if (selected.length >= maxVariants) break;
        if (!selected.includes(candidate)) selected.push(candidate);
    }
    return selected.slice(0, maxVariants);
}

function materializeVariant(
    candidate: TransitionCandidate,
    currentTraits: TrackTraits,
    nextTraits: TrackTraits,
    current: TrackProfile,
    next: TrackProfile,
    confidence: number,
    options: TransitionPreviewOptions,
): Omit<TransitionPreviewVariant, "id"> {
    const plan: TransitionPlan = { ...candidate.plan };
    const stretch = decideAdaptiveStretch(next, plan.tempoRatio, {
        rubberbandAvailable: options.stretcherProfile !== "atempo",
        highQualityAvailable: options.highQualityStretch ?? false,
    });
    plan.tempoRatio = stretch.appliedRatio;
    if (stretch.appliedRatio !== 1) plan.stretch = stretch;
    else delete plan.stretch;
    if (!stretch.allowed) plan.reason = `${plan.reason}; tempo sync disabled (${stretch.reason})`;

    const regions = selectTransitionRegions({
        current,
        next,
        transitionType: plan.type,
        fadeSec: plan.fadeSec,
        preserveStructure: clamp01(options.preserveStructure ?? 0.75),
        vocalOverlapTolerance: clamp01(options.vocalOverlapTolerance ?? 0.15),
        targetEnergyDelta: options.targetEnergyDelta ?? next.energy - current.energy,
    });
    if (regions) plan.regions = regions;

    const masking = assessPerceptualMasking({
        current,
        next,
        currentDurationSec: currentTraits.durationMs / 1000,
        overlapSec: plan.fadeSec,
        transitionType: plan.type,
    });
    const cue = chooseTransitionCue({
        currentGrid: currentTraits.grid,
        nextGrid: nextTraits.grid,
        currentDurationSec: currentTraits.durationMs / 1000,
        transitionType: plan.type,
        fadeSec: plan.fadeSec,
        outgoingTempoRatio: options.outgoingTempoRatio ?? 1,
        ...(regions ? { outgoingRegion: regions.outgoing, incomingRegion: regions.incoming } : {}),
    });

    const artifactRisk = clamp01(masking.risk * 0.62 + stretch.risk.total * 0.28 + COMPLEXITY[plan.type] * 0.1);
    const musicalFit = clamp01(candidate.musicalScore / 100);
    const naturalness = clamp01(musicalFit * 0.48 + (1 - artifactRisk) * 0.37 + confidence * 0.15);
    const recommendationScore = clamp01(naturalness * 0.55 + musicalFit * 0.3 + (1 - artifactRisk) * 0.15);
    const reasons = [
        ...candidate.reasons,
        ...masking.reasons,
        stretch.reason,
        ...(regions ? [regions.reason] : ["no structured regions available"]),
    ];
    return {
        label: label(plan.type),
        plan,
        cue,
        masking,
        stretch,
        metrics: {
            naturalness: round(naturalness * 100),
            musicalFit: round(musicalFit * 100),
            artifactRisk: round(artifactRisk * 100),
            confidence: round(confidence * 100),
            recommendationScore: round(recommendationScore * 100),
        },
        reasons,
    };
}

/** Build a read-only A/B preview. No Director or session state is mutated. */
export function buildTransitionPreview(
    currentTraits: TrackTraits,
    nextTraits: TrackTraits,
    current: TrackProfile,
    next: TrackProfile,
    options: TransitionPreviewOptions,
): TransitionPreview {
    const maxVariants = Math.min(3, Math.max(2, Math.round(options.maxVariants ?? 3)));
    const confidence = analysisConfidence(current, next);
    const inputStateHash = hashDirectorInput({
        currentTraits,
        nextTraits,
        current,
        next,
        options: {
            fadeSec: options.fadeSec,
            maxFadeSec: options.maxFadeSec,
            tempoTolerance: options.tempoTolerance,
            stemsReady: options.stemsReady ?? false,
            outgoingTempoRatio: options.outgoingTempoRatio ?? 1,
            preserveStructure: options.preserveStructure ?? 0.75,
            vocalOverlapTolerance: options.vocalOverlapTolerance ?? 0.15,
            targetEnergyDelta: options.targetEnergyDelta ?? null,
            stretcherProfile: options.stretcherProfile ?? "rubberband",
            highQualityStretch: options.highQualityStretch ?? false,
            maxVariants,
        },
    });
    const candidates = diverseCandidates(
        buildTransitionCandidates(currentTraits, nextTraits, options.fadeSec, options),
        confidence,
        maxVariants,
    );
    if (!candidates.length) throw new Error("transition preview needs at least one candidate");
    const variants = candidates.map((candidate) => {
        const variant = materializeVariant(candidate, currentTraits, nextTraits, current, next, confidence, options);
        const id = `variant-${hashDirectorInput({ inputStateHash, plan: variant.plan, cue: variant.cue })}`;
        return { id, ...variant };
    });
    variants.sort(
        (a, b) =>
            b.metrics.recommendationScore - a.metrics.recommendationScore || a.plan.type.localeCompare(b.plan.type),
    );
    return {
        version: 1,
        id: `preview-${inputStateHash}`,
        createdAtMs: (options.now ?? Date.now)(),
        fromTrackId: current.trackId,
        toTrackId: next.trackId,
        inputStateHash,
        recommendedVariantId: variants[0]!.id,
        variants,
    };
}
