const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

export type EvidenceKind = "objective" | "behavioral" | "subjective";
export type EvidenceLevel = "established" | "supported" | "experimental" | "hypothesis";

export interface ResearchArchitectureEvidence {
    id: string;
    kind: EvidenceKind;
    level: EvidenceLevel;
    confidence: number;
    source: string;
    claim: string;
}

const LEVEL_WEIGHT: Record<EvidenceLevel, number> = {
    established: 1,
    supported: 0.8,
    experimental: 0.55,
    hypothesis: 0.25,
};

export class EvidenceRegistry {
    readonly #items = new Map<string, ResearchArchitectureEvidence>();

    register(evidence: ResearchArchitectureEvidence): void {
        this.#items.set(evidence.id, { ...evidence, confidence: clamp01(evidence.confidence) });
    }

    get(id: string): ResearchArchitectureEvidence | null {
        const item = this.#items.get(id);
        return item ? { ...item } : null;
    }

    decisionConfidence(ids: readonly string[]): {
        confidence: number;
        kinds: EvidenceKind[];
        weakestLevel: EvidenceLevel;
    } {
        const evidence = ids.flatMap((id) => {
            const item = this.#items.get(id);
            return item ? [item] : [];
        });
        if (!evidence.length) return { confidence: 0, kinds: [], weakestLevel: "hypothesis" };
        const confidence =
            evidence.reduce((sum, item) => sum + item.confidence * LEVEL_WEIGHT[item.level], 0) / evidence.length;
        const ordered: EvidenceLevel[] = ["hypothesis", "experimental", "supported", "established"];
        return {
            confidence: round(confidence),
            kinds: [...new Set(evidence.map((item) => item.kind))],
            weakestLevel: ordered.find((level) => evidence.some((item) => item.level === level)) ?? "hypothesis",
        };
    }
}

export interface SequentialPreferenceInput {
    standaloneAffinity: number;
    previousTrackCompatibility: number;
    sessionPhaseFit: number;
    recentHistoryFit: number;
    nextTrackOpportunity: number;
}

export function sequentialPreference(input: SequentialPreferenceInput): number {
    return round(
        clamp01(
            input.standaloneAffinity * 0.28 +
                input.previousTrackCompatibility * 0.26 +
                input.sessionPhaseFit * 0.2 +
                input.recentHistoryFit * 0.14 +
                input.nextTrackOpportunity * 0.12,
        ),
    );
}

export interface RepeatUtilityInput {
    affinity: number;
    familiarity: number;
    recentPlayCount: number;
    hoursSinceLastPlay: number;
    contextFit: number;
    requested: boolean;
}

export function repeatUtility(input: RepeatUtilityInput): { utility: number; repeatAllowed: boolean; reason: string } {
    const recencyRecovery = clamp01(input.hoursSinceLastPlay / 72);
    const saturation = clamp01(input.recentPlayCount / 12);
    const utility = clamp01(
        input.affinity * 0.3 +
            input.familiarity * 0.18 +
            input.contextFit * 0.25 +
            recencyRecovery * 0.17 +
            Number(input.requested) * 0.25 -
            saturation * 0.3,
    );
    return {
        utility: round(utility),
        repeatAllowed: input.requested || utility >= 0.45,
        reason: input.requested ? "explicit-request" : saturation > 0.7 ? "saturation-controlled" : "contextual-repeat",
    };
}

export function familiarityDiscoveryValue(
    familiarity: number,
    novelty: number,
    bridgeFit: number,
): {
    familiarityValue: number;
    discoveryValue: number;
    combined: number;
} {
    const familiarityValue = clamp01(familiarity);
    const discoveryValue = clamp01(novelty) * clamp01(bridgeFit);
    return {
        familiarityValue: round(familiarityValue),
        discoveryValue: round(discoveryValue),
        combined: round(clamp01(familiarityValue * 0.5 + discoveryValue * 0.5)),
    };
}

export interface MemoryEvidence {
    exposureCount: number;
    daysSinceExposure: number;
    contextSimilarity: number;
    emotionalSalience: number;
}

export function memoryAccessibility(input: MemoryEvidence): number {
    const frequency = 1 - Math.exp(-Math.max(0, input.exposureCount) / 4);
    const recency = 2 ** (-Math.max(0, input.daysSinceExposure) / 30);
    return round(
        clamp01(
            frequency * 0.35 +
                recency * 0.25 +
                clamp01(input.contextSimilarity) * 0.22 +
                clamp01(input.emotionalSalience) * 0.18,
        ),
    );
}

export interface SequenceCandidate {
    trackId: string;
    rankingScore: number;
    energy: number;
    valence: number;
    familiarity: number;
}

export interface SequenceOptimizationOptions {
    startEnergy: number;
    targetEnergy: number;
    desiredMicroContrast: number;
    beamWidth?: number;
    length?: number;
}

export interface OptimizedSequence {
    trackIds: string[];
    rankingMean: number;
    macroJourneyScore: number;
    microContrastScore: number;
    score: number;
}

function sequenceScore(
    sequence: readonly SequenceCandidate[],
    options: SequenceOptimizationOptions,
): OptimizedSequence {
    if (!sequence.length)
        return { trackIds: [], rankingMean: 0, macroJourneyScore: 0, microContrastScore: 0, score: 0 };
    const rankingMean = sequence.reduce((sum, item) => sum + item.rankingScore, 0) / sequence.length;
    const expectedStep = (options.targetEnergy - options.startEnergy) / sequence.length;
    const journeyErrors = sequence.map((item, index) => {
        const expected = options.startEnergy + expectedStep * (index + 1);
        return Math.abs(item.energy - expected);
    });
    const macroJourneyScore = clamp01(1 - journeyErrors.reduce((sum, error) => sum + error, 0) / sequence.length);
    const contrasts = sequence
        .slice(1)
        .map(
            (item, index) =>
                (Math.abs(item.energy - sequence[index]!.energy) + Math.abs(item.valence - sequence[index]!.valence)) /
                2,
        );
    const microContrastScore = contrasts.length
        ? clamp01(
              1 -
                  contrasts.reduce((sum, contrast) => sum + Math.abs(contrast - options.desiredMicroContrast), 0) /
                      contrasts.length,
          )
        : 0.5;
    const score = rankingMean * 0.45 + macroJourneyScore * 0.35 + microContrastScore * 0.2;
    return {
        trackIds: sequence.map((item) => item.trackId),
        rankingMean: round(rankingMean),
        macroJourneyScore: round(macroJourneyScore),
        microContrastScore: round(microContrastScore),
        score: round(clamp01(score)),
    };
}

export function optimizeSequence(
    candidates: readonly SequenceCandidate[],
    options: SequenceOptimizationOptions,
): OptimizedSequence {
    const length = Math.min(options.length ?? 5, candidates.length);
    const beamWidth = Math.max(1, options.beamWidth ?? 24);
    let beams: SequenceCandidate[][] = [[]];
    for (let index = 0; index < length; index += 1) {
        const expanded = beams.flatMap((sequence) =>
            candidates
                .filter((candidate) => !sequence.includes(candidate))
                .map((candidate) => [...sequence, candidate]),
        );
        beams = expanded
            .map((sequence) => ({ sequence, score: sequenceScore(sequence, { ...options, length }).score }))
            .sort((a, b) => b.score - a.score)
            .slice(0, beamWidth)
            .map(({ sequence }) => sequence);
    }
    return sequenceScore(beams[0] ?? [], options);
}

export interface HumanSequencePattern {
    macroDirection: "rise" | "fall" | "arc" | "stable";
    meanMicroContrast: number;
    familiarityCadence: number;
}

export function learnHumanSequencePattern(sequence: readonly SequenceCandidate[]): HumanSequencePattern {
    if (sequence.length < 2) return { macroDirection: "stable", meanMicroContrast: 0, familiarityCadence: 0 };
    const first = sequence[0]!.energy;
    const last = sequence.at(-1)!.energy;
    const middlePeak = Math.max(...sequence.map((item) => item.energy));
    const macroDirection =
        middlePeak > Math.max(first, last) + 0.15
            ? "arc"
            : last > first + 0.12
              ? "rise"
              : last < first - 0.12
                ? "fall"
                : "stable";
    const contrasts = sequence.slice(1).map((item, index) => Math.abs(item.energy - sequence[index]!.energy));
    const familiarityCadence = sequence.reduce((sum, item) => sum + item.familiarity, 0) / sequence.length;
    return {
        macroDirection,
        meanMicroContrast: round(contrasts.reduce((sum, contrast) => sum + contrast, 0) / contrasts.length),
        familiarityCadence: round(familiarityCadence),
    };
}

export interface PlaylistContinuationStages {
    represented: number;
    retrieved: number;
    ranked: number;
    sequenced: number;
    stages: readonly ["represent", "retrieve", "rank", "sequence"];
}

export function scalablePlaylistContinuation(input: {
    catalogSize: number;
    retrievalLimit: number;
    rankingLimit: number;
    sequenceLength: number;
}): PlaylistContinuationStages {
    const represented = Math.max(0, Math.floor(input.catalogSize));
    const retrieved = Math.min(represented, Math.max(0, Math.floor(input.retrievalLimit)));
    const ranked = Math.min(retrieved, Math.max(0, Math.floor(input.rankingLimit)));
    const sequenced = Math.min(ranked, Math.max(0, Math.floor(input.sequenceLength)));
    return { represented, retrieved, ranked, sequenced, stages: ["represent", "retrieve", "rank", "sequence"] };
}
