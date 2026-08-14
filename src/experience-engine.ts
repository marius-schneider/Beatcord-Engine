import type { TrackProfile } from "./track-profile";

export type ExperienceId = "auto" | "chill" | "love" | "energy" | "party";
export type ConcreteExperienceId = Exclude<ExperienceId, "auto">;
export type TransitionLength = "short" | "medium" | "medium-long" | "phrase";

export interface ExperienceVector {
    targetEnergy: number;
    transitionIntensity: number;
    tempoManipulation: number;
    preserveSongStructure: number;
    vocalOverlapTolerance: number;
    preferredTransitionLength: TransitionLength;
    dynamicVariation: number;
    harmonicContinuity: number;
    warmth: number;
}

export interface ExperienceSelection {
    requested: ExperienceId;
    resolved: ConcreteExperienceId;
    intensity: number;
    vector: ExperienceVector;
    weights: Record<ConcreteExperienceId, number>;
    confidence: number;
    reason: string;
    evolution?: ExperienceEvolutionState;
}

export interface ExperienceEvolutionState {
    from: ConcreteExperienceId;
    to: ConcreteExperienceId;
    progress: number;
    durationSec: number;
    remainingSec: number;
}

export const EXPERIENCE_RECIPES: Record<ConcreteExperienceId, ExperienceVector> = {
    chill: {
        targetEnergy: 0.35,
        transitionIntensity: 0.2,
        tempoManipulation: 0.1,
        preserveSongStructure: 0.9,
        vocalOverlapTolerance: 0.1,
        preferredTransitionLength: "medium-long",
        dynamicVariation: 0.25,
        harmonicContinuity: 0.65,
        warmth: 0.72,
    },
    love: {
        targetEnergy: 0.48,
        transitionIntensity: 0.3,
        tempoManipulation: 0.18,
        preserveSongStructure: 0.86,
        vocalOverlapTolerance: 0.06,
        preferredTransitionLength: "medium-long",
        dynamicVariation: 0.38,
        harmonicContinuity: 0.92,
        warmth: 0.95,
    },
    energy: {
        targetEnergy: 0.74,
        transitionIntensity: 0.68,
        tempoManipulation: 0.38,
        preserveSongStructure: 0.62,
        vocalOverlapTolerance: 0.14,
        preferredTransitionLength: "short",
        dynamicVariation: 0.52,
        harmonicContinuity: 0.55,
        warmth: 0.38,
    },
    party: {
        targetEnergy: 0.85,
        transitionIntensity: 0.9,
        tempoManipulation: 0.8,
        preserveSongStructure: 0.4,
        vocalOverlapTolerance: 0.25,
        preferredTransitionLength: "phrase",
        dynamicVariation: 0.7,
        harmonicContinuity: 0.72,
        warmth: 0.42,
    },
};

const IDS: ConcreteExperienceId[] = ["chill", "love", "energy", "party"];
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function normalizeWeights(input: Partial<Record<ConcreteExperienceId, number>>): Record<ConcreteExperienceId, number> {
    const values = Object.fromEntries(IDS.map((id) => [id, Math.max(0, input[id] ?? 0)])) as Record<
        ConcreteExperienceId,
        number
    >;
    const total = Object.values(values).reduce((sum, value) => sum + value, 0);
    if (total <= 0) values.chill = 1;
    const normalizedTotal = total > 0 ? total : 1;
    for (const id of IDS) values[id] /= normalizedTotal;
    return values;
}

function lengthFor(value: number): TransitionLength {
    if (value < 0.25) return "short";
    if (value < 0.5) return "medium";
    if (value < 0.75) return "medium-long";
    return "phrase";
}

function transitionLengthValue(length: TransitionLength): number {
    return { short: 0.1, medium: 0.4, "medium-long": 0.65, phrase: 0.9 }[length];
}

/** Blend experiences as continuous vectors instead of mutually-exclusive presets. */
export function blendExperiences(input: Partial<Record<ConcreteExperienceId, number>>): ExperienceVector {
    const weights = normalizeWeights(input);
    const numeric = (field: Exclude<keyof ExperienceVector, "preferredTransitionLength">) =>
        IDS.reduce((sum, id) => sum + EXPERIENCE_RECIPES[id][field] * weights[id], 0);
    const lengthValue = IDS.reduce(
        (sum, id) => sum + transitionLengthValue(EXPERIENCE_RECIPES[id].preferredTransitionLength) * weights[id],
        0,
    );
    return {
        targetEnergy: numeric("targetEnergy"),
        transitionIntensity: numeric("transitionIntensity"),
        tempoManipulation: numeric("tempoManipulation"),
        preserveSongStructure: numeric("preserveSongStructure"),
        vocalOverlapTolerance: numeric("vocalOverlapTolerance"),
        preferredTransitionLength: lengthFor(lengthValue),
        dynamicVariation: numeric("dynamicVariation"),
        harmonicContinuity: numeric("harmonicContinuity"),
        warmth: numeric("warmth"),
    };
}

/** Smoothly move every musical control from one resolved experience to another. */
export function interpolateExperiences(
    from: ExperienceSelection,
    to: ExperienceSelection,
    progress: number,
    durationSec: number,
): ExperienceSelection {
    const t = clamp01(progress);
    if (t >= 1) return to;
    const mix = (a: number, b: number) => a + (b - a) * t;
    const weights = normalizeWeights(
        Object.fromEntries(IDS.map((id) => [id, mix(from.weights[id], to.weights[id])])) as Record<
            ConcreteExperienceId,
            number
        >,
    );
    const resolved = IDS.reduce((best, id) => (weights[id] > weights[best] ? id : best), from.resolved);
    return {
        requested: to.requested,
        resolved,
        intensity: mix(from.intensity, to.intensity),
        weights,
        confidence: mix(from.confidence, to.confidence),
        reason: `Experience evolution ${from.resolved} → ${to.resolved} (${Math.round(t * 100)}%)`,
        vector: {
            targetEnergy: mix(from.vector.targetEnergy, to.vector.targetEnergy),
            transitionIntensity: mix(from.vector.transitionIntensity, to.vector.transitionIntensity),
            tempoManipulation: mix(from.vector.tempoManipulation, to.vector.tempoManipulation),
            preserveSongStructure: mix(from.vector.preserveSongStructure, to.vector.preserveSongStructure),
            vocalOverlapTolerance: mix(from.vector.vocalOverlapTolerance, to.vector.vocalOverlapTolerance),
            preferredTransitionLength: lengthFor(
                mix(
                    transitionLengthValue(from.vector.preferredTransitionLength),
                    transitionLengthValue(to.vector.preferredTransitionLength),
                ),
            ),
            dynamicVariation: mix(from.vector.dynamicVariation, to.vector.dynamicVariation),
            harmonicContinuity: mix(from.vector.harmonicContinuity, to.vector.harmonicContinuity),
            warmth: mix(from.vector.warmth, to.vector.warmth),
        },
        evolution: {
            from: from.resolved,
            to: to.resolved,
            progress: t,
            durationSec,
            remainingSec: Math.max(0, durationSec * (1 - t)),
        },
    };
}

/** Infer Auto from measured queue/session features, returning transparent weights. */
export function detectExperience(profiles: readonly TrackProfile[]): ExperienceSelection {
    const usable = profiles.filter((profile) => profile.confidence.overall > 0.15);
    if (!usable.length) {
        const fallback = selectExperience("chill", 0.5, undefined, "Auto fallback: insufficient analysis");
        return { ...fallback, requested: "auto", confidence: 0.2 };
    }
    const avg = (
        field: keyof Pick<TrackProfile, "energy" | "danceability" | "acousticness" | "valence" | "vocalness">,
    ) => usable.reduce((sum, profile) => sum + profile[field], 0) / usable.length;
    const energy = avg("energy");
    const dance = avg("danceability");
    const acoustic = avg("acousticness");
    const valence = avg("valence");
    const vocalness = avg("vocalness");
    const edmShare = usable.filter((profile) => profile.genres[0]?.genre === "edm").length / usable.length;
    const chillShare = usable.filter((profile) => profile.genres[0]?.genre === "chill").length / usable.length;
    const raw = {
        chill: clamp01((1 - energy) * 0.65 + acoustic * 0.25 + chillShare * 0.45),
        love: clamp01((1 - Math.abs(valence - 0.58)) * 0.45 + vocalness * 0.25 + acoustic * 0.18),
        energy: clamp01(energy * 0.72 + (1 - dance) * 0.1),
        party: clamp01(energy * 0.45 + dance * 0.45 + edmShare * 0.35),
    };
    const weights = normalizeWeights(raw);
    const resolved = IDS.reduce((best, id) => (weights[id] > weights[best] ? id : best), "chill");
    const sorted = Object.values(weights).sort((a, b) => b - a);
    const confidence = clamp01(0.45 + ((sorted[0] ?? 0) - (sorted[1] ?? 0)) + usable.length * 0.04);
    return {
        requested: "auto",
        resolved,
        intensity: 1,
        vector: blendExperiences(weights),
        weights,
        confidence,
        reason: `Auto: energy ${energy.toFixed(2)}, dance ${dance.toFixed(2)}, acoustic ${acoustic.toFixed(2)}`,
    };
}

export function selectExperience(
    requested: ExperienceId,
    intensity = 1,
    blend?: Partial<Record<ConcreteExperienceId, number>>,
    reason?: string,
): ExperienceSelection {
    if (requested === "auto") throw new Error("Auto requires detectExperience(profiles)");
    const normalizedIntensity = clamp01(intensity);
    const weights = normalizeWeights(blend ?? { [requested]: 1 });
    const resolved = IDS.reduce((best, id) => (weights[id] > weights[best] ? id : best), requested);
    const neutral: ExperienceVector = {
        targetEnergy: 0.55,
        transitionIntensity: 0.45,
        tempoManipulation: 0.3,
        preserveSongStructure: 0.7,
        vocalOverlapTolerance: 0.12,
        preferredTransitionLength: "medium",
        dynamicVariation: 0.45,
        harmonicContinuity: 0.62,
        warmth: 0.5,
    };
    const target = blendExperiences(weights);
    const mix = (a: number, b: number) => a + (b - a) * normalizedIntensity;
    return {
        requested,
        resolved,
        intensity: normalizedIntensity,
        weights,
        confidence: 1,
        reason: reason ?? `Explicit ${requested} experience`,
        vector: {
            targetEnergy: mix(neutral.targetEnergy, target.targetEnergy),
            transitionIntensity: mix(neutral.transitionIntensity, target.transitionIntensity),
            tempoManipulation: mix(neutral.tempoManipulation, target.tempoManipulation),
            preserveSongStructure: mix(neutral.preserveSongStructure, target.preserveSongStructure),
            vocalOverlapTolerance: mix(neutral.vocalOverlapTolerance, target.vocalOverlapTolerance),
            preferredTransitionLength: target.preferredTransitionLength,
            dynamicVariation: mix(neutral.dynamicVariation, target.dynamicVariation),
            harmonicContinuity: mix(neutral.harmonicContinuity, target.harmonicContinuity),
            warmth: mix(neutral.warmth, target.warmth),
        },
    };
}
