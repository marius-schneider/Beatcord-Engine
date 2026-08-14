import type { TasteVector } from "./recommendation-intelligence";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

export interface ExposureForces {
    familiarityGain: number;
    overplayFatigue: number;
    interest: number;
}

export function mereExposureInterest(exposures: number, preferredPeak = 8, spread = 8): ExposureForces {
    const count = Math.max(0, exposures);
    const familiarityGain = clamp01(1 - Math.exp(-count / Math.max(1, preferredPeak / 2)));
    const overplayFatigue = count <= preferredPeak ? 0 : clamp01((count - preferredPeak) / Math.max(1, spread));
    return {
        familiarityGain: round(familiarityGain),
        overplayFatigue: round(overplayFatigue),
        interest: round(clamp01(familiarityGain * (1 - overplayFatigue))),
    };
}

export type ExposureState =
    | "unknown"
    | "discovered"
    | "growing-familiarity"
    | "sweet-spot"
    | "familiar"
    | "overplayed"
    | "resting"
    | "rediscovery-ready";

export function classifyExposureState(input: {
    exposures: number;
    recentExposures: number;
    daysSinceLastExposure: number;
    liked: boolean;
}): ExposureState {
    if (input.exposures === 0) return "unknown";
    if (input.daysSinceLastExposure >= 90 && input.liked) return "rediscovery-ready";
    if (input.daysSinceLastExposure >= 21 && input.recentExposures === 0) return "resting";
    if (input.recentExposures >= 12) return "overplayed";
    if (input.exposures >= 12) return "familiar";
    if (input.exposures >= 6) return "sweet-spot";
    if (input.exposures >= 2) return "growing-familiarity";
    return "discovered";
}

export interface RelisteningEvidence {
    frequency: number;
    hoursSinceLastPlay: number;
    contextualCooccurrence: number;
    familiarity: number;
}

export function predictRelistening(evidence: RelisteningEvidence): number {
    const frequencyActivation = 1 - Math.exp(-Math.max(0, evidence.frequency) / 5);
    const recencyActivation = 2 ** (-Math.max(0, evidence.hoursSinceLastPlay) / 72);
    return round(
        clamp01(
            frequencyActivation * 0.32 +
                recencyActivation * 0.25 +
                evidence.contextualCooccurrence * 0.18 +
                evidence.familiarity * 0.25,
        ),
    );
}

export interface PerceivedRepetitionInput {
    trackRepetition: number;
    artistRepetition: number;
    embeddingSimilarity: number;
    genreConcentration: number;
    timbreConcentration: number;
}

export function perceivedRepetition(input: PerceivedRepetitionInput): number {
    return round(
        clamp01(
            input.trackRepetition * 0.24 +
                input.artistRepetition * 0.22 +
                input.embeddingSimilarity * 0.2 +
                input.genreConcentration * 0.17 +
                input.timbreConcentration * 0.17,
        ),
    );
}

export interface DiscoveryPersonality {
    context: string;
    familiarityTarget: number;
    diversityTarget: number;
    noveltyTolerance: number;
    confidence: number;
    globalAlgorithm: false;
}

export function learnDiscoveryPersonality(input: {
    context: string;
    sliderSelections: readonly number[];
    acceptedNovelty: readonly number[];
}): DiscoveryPersonality {
    const slider = input.sliderSelections.length
        ? input.sliderSelections.reduce((sum, value) => sum + clamp01(value), 0) / input.sliderSelections.length
        : 0.5;
    const acceptance = input.acceptedNovelty.length
        ? input.acceptedNovelty.reduce((sum, value) => sum + clamp01(value), 0) / input.acceptedNovelty.length
        : slider;
    const diversityTarget = slider * 0.55 + acceptance * 0.45;
    return {
        context: input.context,
        familiarityTarget: round(1 - diversityTarget),
        diversityTarget: round(diversityTarget),
        noveltyTolerance: round(acceptance),
        confidence: round(clamp01((input.sliderSelections.length + input.acceptedNovelty.length) / 12)),
        globalAlgorithm: false,
    };
}

export interface TimePattern {
    weekdays: number[];
    startHour: number;
    endHour: number;
}

export interface RoutineProfile {
    id: string;
    temporalPattern: TimePattern;
    contextEmbedding: number[];
    tasteEmbedding: TasteVector;
    confidence: number;
}

export class RoutineAwareTasteMemory {
    readonly #routines: RoutineProfile[] = [];

    add(profile: RoutineProfile): void {
        this.#routines.push(structuredClone(profile));
    }

    match(weekday: number, hour: number): RoutineProfile | null {
        const candidates = this.#routines.filter(
            (routine) =>
                routine.temporalPattern.weekdays.includes(weekday) &&
                hour >= routine.temporalPattern.startHour &&
                hour < routine.temporalPattern.endHour,
        );
        const selected = [...candidates].sort((a, b) => b.confidence - a.confidence)[0];
        return selected ? structuredClone(selected) : null;
    }

    contextualTaste(
        globalTaste: TasteVector,
        weekday: number,
        hour: number,
    ): { effective: TasteVector; globalPreserved: true; routineId?: string } {
        const routine = this.match(weekday, hour);
        if (!routine) return { effective: { ...globalTaste }, globalPreserved: true };
        const keys = [...new Set([...Object.keys(globalTaste), ...Object.keys(routine.tasteEmbedding)])];
        return {
            effective: Object.fromEntries(
                keys.map((key) => [
                    key,
                    round((globalTaste[key] ?? 0) * 0.4 + (routine.tasteEmbedding[key] ?? 0) * 0.6),
                ]),
            ),
            globalPreserved: true,
            routineId: routine.id,
        };
    }
}

export interface RegionalPopularityContext {
    globalPopularity: number;
    regionalPopularity: number;
    regionConfidence: number;
    countryArchetype?: string;
}

export function culturallyContextualPopularity(input: RegionalPopularityContext): {
    score: number;
    globalWeight: number;
    regionalWeight: number;
    culturallyNeutral: false;
} {
    const regionalWeight = clamp01(input.regionConfidence) * 0.75;
    const globalWeight = 1 - regionalWeight;
    return {
        score: round(
            clamp01(input.globalPopularity) * globalWeight + clamp01(input.regionalPopularity) * regionalWeight,
        ),
        globalWeight: round(globalWeight),
        regionalWeight: round(regionalWeight),
        culturallyNeutral: false,
    };
}
