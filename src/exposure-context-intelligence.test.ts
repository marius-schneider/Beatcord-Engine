import { describe, expect, test } from "bun:test";
import {
    classifyExposureState,
    culturallyContextualPopularity,
    learnDiscoveryPersonality,
    mereExposureInterest,
    perceivedRepetition,
    predictRelistening,
    RoutineAwareTasteMemory,
} from "./exposure-context-intelligence";

describe("exposure, repetition and routine context", () => {
    test("models familiarity gain and overplay fatigue as separate inverted-U forces", () => {
        expect(mereExposureInterest(8).interest).toBeGreaterThan(mereExposureInterest(1).interest);
        expect(mereExposureInterest(8).interest).toBeGreaterThan(mereExposureInterest(20).interest);
        expect(mereExposureInterest(20).overplayFatigue).toBeGreaterThan(0);
    });

    test("implements the complete exposure state machine", () => {
        expect(
            classifyExposureState({ exposures: 0, recentExposures: 0, daysSinceLastExposure: 0, liked: false }),
        ).toBe("unknown");
        expect(classifyExposureState({ exposures: 7, recentExposures: 3, daysSinceLastExposure: 1, liked: true })).toBe(
            "sweet-spot",
        );
        expect(
            classifyExposureState({ exposures: 20, recentExposures: 12, daysSinceLastExposure: 1, liked: true }),
        ).toBe("overplayed");
        expect(
            classifyExposureState({ exposures: 20, recentExposures: 0, daysSinceLastExposure: 100, liked: true }),
        ).toBe("rediscovery-ready");
    });

    test("predicts relistening from recency, frequency, co-occurrence and familiarity", () => {
        const likely = predictRelistening({
            frequency: 12,
            hoursSinceLastPlay: 12,
            contextualCooccurrence: 0.9,
            familiarity: 0.9,
        });
        const unlikely = predictRelistening({
            frequency: 1,
            hoursSinceLastPlay: 1_000,
            contextualCooccurrence: 0.1,
            familiarity: 0.1,
        });
        expect(likely).toBeGreaterThan(unlikely);
    });

    test("detects perceptual repetition beyond duplicate tracks", () => {
        expect(
            perceivedRepetition({
                trackRepetition: 0,
                artistRepetition: 0.9,
                embeddingSimilarity: 0.95,
                genreConcentration: 1,
                timbreConcentration: 0.9,
            }),
        ).toBeGreaterThan(0.7);
    });

    test("learns a context-specific discovery personality rather than one global algorithm", () => {
        const profile = learnDiscoveryPersonality({
            context: "friday-party",
            sliderSelections: [0.8, 0.9],
            acceptedNovelty: [0.7, 0.9],
        });
        expect(profile.diversityTarget).toBeGreaterThan(0.7);
        expect(profile.globalAlgorithm).toBe(false);
    });

    test("applies routine taste without overwriting the global vector", () => {
        const memory = new RoutineAwareTasteMemory();
        memory.add({
            id: "friday",
            temporalPattern: { weekdays: [5], startHour: 18, endHour: 24 },
            contextEmbedding: [1, 0],
            tasteEmbedding: { house: 1, ambient: 0 },
            confidence: 0.9,
        });
        const global = { house: 0.2, ambient: 0.8 };
        const result = memory.contextualTaste(global, 5, 20);
        expect(result.effective.house).toBeGreaterThan(global.house);
        expect(result.globalPreserved).toBe(true);
        expect(global).toEqual({ house: 0.2, ambient: 0.8 });
    });

    test("treats global popularity as culturally non-neutral", () => {
        const local = culturallyContextualPopularity({
            globalPopularity: 0.9,
            regionalPopularity: 0.2,
            regionConfidence: 1,
            countryArchetype: "local-niche",
        });
        expect(local.regionalWeight).toBeGreaterThan(local.globalWeight);
        expect(local.culturallyNeutral).toBe(false);
    });
});
