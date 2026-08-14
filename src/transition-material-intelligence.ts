const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

export const VALIDATION_EVIDENCE_KINDS = ["study-listening-test", "practitioner-experience", "user-report"] as const;

export interface TransitionEvaluation {
    technicalQuality: number;
    musicalFit: number;
    continuity: number;
    salience: number;
    novelty: number;
}

export type TransitionExperience = "chill" | "love" | "energy" | "party";

export function transitionExperienceScore(evaluation: TransitionEvaluation, experience: TransitionExperience): number {
    const saliencePenalty = { chill: 0.35, love: 0.25, energy: 0.12, party: 0.05 }[experience];
    const noveltyReward = { chill: 0.03, love: 0.05, energy: 0.1, party: 0.15 }[experience];
    return round(
        clamp01(
            evaluation.technicalQuality * 0.3 +
                evaluation.musicalFit * 0.3 +
                evaluation.continuity * 0.25 +
                evaluation.novelty * noveltyReward -
                evaluation.salience * saliencePenalty,
        ),
    );
}

export const TRANSITION_NOTICEABILITY_TARGETS: Record<
    TransitionExperience,
    { min: number; max: number; deliberateMoments: boolean }
> = {
    chill: { min: 0, max: 0.2, deliberateMoments: false },
    love: { min: 0.05, max: 0.35, deliberateMoments: false },
    energy: { min: 0.2, max: 0.55, deliberateMoments: true },
    party: { min: 0.1, max: 0.85, deliberateMoments: true },
};

export type MaterialType = "locked-electronic" | "live-drums" | "beatless" | "classical" | "unknown";
export interface MaterialTransitionPolicy {
    material: MaterialType;
    beatmatching: "enabled" | "dynamic-map-required" | "disabled";
    preferredBasis: readonly string[];
    confidenceMultiplier: number;
}

export function materialTransitionPolicy(material: MaterialType): MaterialTransitionPolicy {
    if (material === "locked-electronic")
        return {
            material,
            beatmatching: "enabled",
            preferredBasis: ["beat", "phrase", "harmony"],
            confidenceMultiplier: 1,
        };
    if (material === "live-drums")
        return {
            material,
            beatmatching: "dynamic-map-required",
            preferredBasis: ["dynamic-tempo", "phrase", "energy"],
            confidenceMultiplier: 0.72,
        };
    if (material === "beatless")
        return {
            material,
            beatmatching: "disabled",
            preferredBasis: ["loudness", "timbre", "semantic", "phrase"],
            confidenceMultiplier: 0.68,
        };
    if (material === "classical")
        return {
            material,
            beatmatching: "disabled",
            preferredBasis: ["semantic", "loudness", "phrase", "structure"],
            confidenceMultiplier: 0.62,
        };
    return {
        material,
        beatmatching: "disabled",
        preferredBasis: ["continuity", "loudness"],
        confidenceMultiplier: 0.4,
    };
}

export interface SegmentPolicy {
    mixUtility: number;
    artisticImportance: number;
    truncationRisk: number;
}

export function evaluateSegmentPolicy(input: {
    mixUtility: number;
    artisticImportance: number;
    experience: TransitionExperience;
    albumMode: boolean;
}): SegmentPolicy {
    const preservation =
        (input.albumMode ? 0.35 : 0) + { chill: 0.25, love: 0.3, energy: 0.12, party: 0.05 }[input.experience];
    const artisticImportance = clamp01(input.artisticImportance);
    return {
        mixUtility: round(clamp01(input.mixUtility)),
        artisticImportance: round(artisticImportance),
        truncationRisk: round(
            clamp01(artisticImportance * preservation + Math.max(0, artisticImportance - input.mixUtility) * 0.5),
        ),
    };
}

export interface LearnedControlPoint {
    progress: number;
    outgoingGain: number;
    incomingGain: number;
    lowEqSwap: number;
    effectAmount: number;
}

export interface LearnedTransitionPolicy {
    source: "human-dj-mixes";
    controls: LearnedControlPoint[];
    audioGeneration: false;
    deterministicDsp: true;
}

export function sanitizeLearnedControlTrajectory(points: readonly LearnedControlPoint[]): LearnedTransitionPolicy {
    return {
        source: "human-dj-mixes",
        controls: [...points]
            .sort((a, b) => a.progress - b.progress)
            .map((point) => ({
                progress: clamp01(point.progress),
                outgoingGain: clamp01(point.outgoingGain),
                incomingGain: clamp01(point.incomingGain),
                lowEqSwap: clamp01(point.lowEqSwap),
                effectAmount: clamp01(point.effectAmount),
            })),
        audioGeneration: false,
        deterministicDsp: true,
    };
}

export interface SegmentMixabilityInput {
    beat: number;
    chroma: number;
    latentTopic: number;
    phrase: number;
    texture: number;
}

export function segmentPairMixability(
    outgoingSegmentId: string,
    incomingSegmentId: string,
    input: SegmentMixabilityInput,
): {
    outgoingSegmentId: string;
    incomingSegmentId: string;
    score: number;
} {
    return {
        outgoingSegmentId,
        incomingSegmentId,
        score: round(
            clamp01(
                input.beat * 0.18 +
                    input.chroma * 0.2 +
                    input.latentTopic * 0.18 +
                    input.phrase * 0.26 +
                    input.texture * 0.18,
            ),
        ),
    };
}

export interface CompleteTransitionFactors {
    beat: number;
    phrase: number;
    harmony: number;
    density: number;
    vocals: number;
    structure: number;
    energy: number;
    policyFit: number;
}

export function completeTransitionQuality(factors: CompleteTransitionFactors): number {
    return round(
        clamp01(
            factors.beat * 0.08 +
                factors.phrase * 0.17 +
                factors.harmony * 0.12 +
                factors.density * 0.13 +
                factors.vocals * 0.13 +
                factors.structure * 0.15 +
                factors.energy * 0.1 +
                factors.policyFit * 0.12,
        ),
    );
}

export interface SegmentTexture {
    density: number;
    vocalPresence: number;
    leadPresence: number;
    percussionPresence: number;
    bassPresence: number;
}

export interface ArrangementCompetition {
    score: number;
    vocalOverlap: number;
    leadOverlap: number;
    bassOverlap: number;
    densityOverlap: number;
    mitigations: ("shorter-transition" | "stem-isolation" | "aggressive-eq" | "different-phrase")[];
}

export function arrangementCompetition(outgoing: SegmentTexture, incoming: SegmentTexture): ArrangementCompetition {
    const vocalOverlap = outgoing.vocalPresence * incoming.vocalPresence;
    const leadOverlap = outgoing.leadPresence * incoming.leadPresence;
    const bassOverlap = outgoing.bassPresence * incoming.bassPresence;
    const densityOverlap = outgoing.density * incoming.density;
    const score = clamp01(vocalOverlap * 0.3 + leadOverlap * 0.25 + bassOverlap * 0.25 + densityOverlap * 0.2);
    const mitigations: ArrangementCompetition["mitigations"] = [];
    if (score >= 0.55) mitigations.push("shorter-transition");
    if (vocalOverlap >= 0.55 || leadOverlap >= 0.65) mitigations.push("stem-isolation");
    if (bassOverlap >= 0.5) mitigations.push("aggressive-eq");
    if (densityOverlap >= 0.7) mitigations.push("different-phrase");
    return {
        score: round(score),
        vocalOverlap: round(vocalOverlap),
        leadOverlap: round(leadOverlap),
        bassOverlap: round(bassOverlap),
        densityOverlap: round(densityOverlap),
        mitigations,
    };
}

export interface HarmonicTransitionStrategy {
    risk: number;
    preferPercussiveSegments: boolean;
    shortenOverlap: boolean;
    reduceTonalOverlap: boolean;
}

export function harmonicTransitionStrategy(
    keyCompatibility: number,
    outgoingActivity: number,
    incomingActivity: number,
): HarmonicTransitionStrategy {
    const harmonicActivity = clamp01((outgoingActivity + incomingActivity) / 2);
    const risk = clamp01((1 - keyCompatibility) * harmonicActivity);
    return {
        risk: round(risk),
        preferPercussiveSegments: risk >= 0.35,
        shortenOverlap: risk >= 0.5,
        reduceTonalOverlap: risk >= 0.3,
    };
}
