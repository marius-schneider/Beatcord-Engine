import type { ExperienceId } from "./experience-engine";
import type { TasteVector } from "./recommendation-intelligence";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

export function syncopationGroovePleasure(syncopation: number, preferredCenter = 0.5, width = 0.5): number {
    const distance = Math.abs(clamp01(syncopation) - clamp01(preferredCenter)) / Math.max(0.05, width);
    return round(clamp01(1 - distance ** 2));
}

export interface GrooveProfile {
    syncopation: number;
    pulseClarity: number;
    lowFrequencyDrive: number;
    rhythmicComplexity: number;
    danceabilityEstimate: number;
}

export function buildGrooveProfile(input: Omit<GrooveProfile, "danceabilityEstimate">): GrooveProfile {
    const optimalComplexity =
        syncopationGroovePleasure(input.syncopation) * 0.55 +
        syncopationGroovePleasure(input.rhythmicComplexity) * 0.45;
    return {
        syncopation: round(clamp01(input.syncopation)),
        pulseClarity: round(clamp01(input.pulseClarity)),
        lowFrequencyDrive: round(clamp01(input.lowFrequencyDrive)),
        rhythmicComplexity: round(clamp01(input.rhythmicComplexity)),
        danceabilityEstimate: round(
            clamp01(optimalComplexity * 0.35 + input.pulseClarity * 0.25 + input.lowFrequencyDrive * 0.4),
        ),
    };
}

export interface PerceivedEnergyInput {
    tempo: number;
    arousal: number;
    groove: number;
    danceability: number;
    lowFrequencyDrive: number;
    rhythmicActivity: number;
    spectralIntensity: number;
    density: number;
    dynamics: number;
}

export interface PerceptualMusicState {
    tempo: number;
    arousal: number;
    groove: number;
    danceability: number;
    perceivedEnergy: number;
}

export function perceivedMusicState(input: PerceivedEnergyInput): PerceptualMusicState {
    const tempoNormalized = clamp01((input.tempo - 60) / 140);
    const perceivedEnergy =
        tempoNormalized * 0.08 +
        input.arousal * 0.18 +
        input.groove * 0.15 +
        input.danceability * 0.12 +
        input.lowFrequencyDrive * 0.14 +
        input.rhythmicActivity * 0.11 +
        input.spectralIntensity * 0.08 +
        input.density * 0.08 +
        input.dynamics * 0.06;
    return {
        tempo: Math.max(0, input.tempo),
        arousal: round(clamp01(input.arousal)),
        groove: round(clamp01(input.groove)),
        danceability: round(clamp01(input.danceability)),
        perceivedEnergy: round(clamp01(perceivedEnergy)),
    };
}

export interface CrowdPrior {
    eventType?: string;
    savedGroup?: string;
    expectedGenres?: TasteVector;
    hostIntent?: ExperienceId;
    timeOfDay?: number;
    confidence: number;
}

export interface LiveCrowdEvidence {
    dancing: number;
    leaving: number;
    entering: number;
    reactionChange: number;
    genreSignals?: TasteVector;
    sampleSize: number;
}

export interface PosteriorCrowdState {
    engagement: number;
    retention: number;
    genres: TasteVector;
    priorWeight: number;
    evidenceWeight: number;
    confidence: number;
}

export function updateCrowdPrior(prior: CrowdPrior, evidence: LiveCrowdEvidence): PosteriorCrowdState {
    const evidenceConfidence = clamp01(1 - Math.exp(-Math.max(0, evidence.sampleSize) / 8));
    const priorWeight = clamp01(prior.confidence) * (1 - evidenceConfidence * 0.7);
    const evidenceWeight = evidenceConfidence;
    const totalWeight = Math.max(0.001, priorWeight + evidenceWeight);
    const keys = [
        ...new Set([...Object.keys(prior.expectedGenres ?? {}), ...Object.keys(evidence.genreSignals ?? {})]),
    ];
    const genres = Object.fromEntries(
        keys.map((key) => [
            key,
            round(
                ((prior.expectedGenres?.[key] ?? 0) * priorWeight +
                    (evidence.genreSignals?.[key] ?? 0) * evidenceWeight) /
                    totalWeight,
            ),
        ]),
    );
    return {
        engagement: round(
            clamp01(evidence.dancing * 0.5 + evidence.entering * 0.2 + clamp01(evidence.reactionChange) * 0.3),
        ),
        retention: round(clamp01(0.5 + evidence.entering * 0.25 - evidence.leaving * 0.5)),
        genres,
        priorWeight: round(priorWeight / totalWeight),
        evidenceWeight: round(evidenceWeight / totalWeight),
        confidence: round(clamp01(priorWeight + evidenceWeight)),
    };
}

export interface CrowdLeadershipDecision {
    crowdLeadership: number;
    signalStrength: number;
    action: "follow" | "balance" | "lead";
    journeyOverride: boolean;
}

export function decideCrowdLeadership(crowdLeadership: number, signalStrength: number): CrowdLeadershipDecision {
    const leadership = clamp01(crowdLeadership);
    const signal = clamp01(signalStrength);
    const threshold = 0.35 + leadership * 0.55;
    return {
        crowdLeadership: round(leadership),
        signalStrength: round(signal),
        action: signal >= threshold ? "follow" : leadership >= 0.7 ? "lead" : "balance",
        journeyOverride: signal >= threshold && signal >= 0.7,
    };
}

export interface RequestEvidenceInput {
    requesterWeight: number;
    requestVotes: number;
    crowdCompatibility: number;
    contextFit: number;
    explicitPlayNext: boolean;
}

export interface RequestDecision {
    requestSignal: number;
    preferenceEvidence: number;
    schedulingConstraint: "play-next" | "route-soon" | "defer";
    updatesCrowdTasteEvenIfRejected: true;
}

export function evaluateRequest(input: RequestEvidenceInput): RequestDecision {
    const voteStrength = clamp01(input.requestVotes / 5);
    const requestSignal =
        clamp01(input.requesterWeight) * voteStrength * clamp01(input.crowdCompatibility) * clamp01(input.contextFit);
    return {
        requestSignal: round(requestSignal),
        preferenceEvidence: round(clamp01(input.requesterWeight) * voteStrength),
        schedulingConstraint: input.explicitPlayNext ? "play-next" : requestSignal >= 0.35 ? "route-soon" : "defer",
        updatesCrowdTasteEvenIfRejected: true,
    };
}

export interface FamiliarityPleasureInput {
    familiarity: number;
    arousal: number;
    preferenceFit: number;
    catalogPopularity: number;
}

export function familiarityMediatedPleasure(input: FamiliarityPleasureInput): {
    pleasure: number;
    familiarityContribution: number;
    popularityContribution: number;
    independentSignal: true;
} {
    const familiarity = clamp01(input.familiarity);
    const arousalFit = syncopationGroovePleasure(input.arousal, 0.65, 0.65);
    const familiarityContribution = familiarity * 0.35;
    const popularityContribution = clamp01(input.catalogPopularity) * 0.05;
    return {
        pleasure: round(
            clamp01(input.preferenceFit * 0.4 + arousalFit * 0.2 + familiarityContribution + popularityContribution),
        ),
        familiarityContribution: round(familiarityContribution),
        popularityContribution: round(popularityContribution),
        independentSignal: true,
    };
}
