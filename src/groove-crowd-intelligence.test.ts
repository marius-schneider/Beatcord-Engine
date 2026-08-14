import { describe, expect, test } from "bun:test";
import {
    buildGrooveProfile,
    decideCrowdLeadership,
    evaluateRequest,
    familiarityMediatedPleasure,
    perceivedMusicState,
    syncopationGroovePleasure,
    updateCrowdPrior,
} from "./groove-crowd-intelligence";

describe("groove, crowd prior and request intelligence", () => {
    test("uses an inverted-U rather than maximizing rhythmic complexity", () => {
        expect(syncopationGroovePleasure(0.5)).toBeGreaterThan(syncopationGroovePleasure(0));
        expect(syncopationGroovePleasure(0.5)).toBeGreaterThan(syncopationGroovePleasure(1));
    });

    test("models house groove with pulse clarity and low-frequency drive", () => {
        const bassy = buildGrooveProfile({
            syncopation: 0.5,
            pulseClarity: 0.9,
            lowFrequencyDrive: 1,
            rhythmicComplexity: 0.5,
        });
        const thin = buildGrooveProfile({
            syncopation: 0.5,
            pulseClarity: 0.9,
            lowFrequencyDrive: 0.1,
            rhythmicComplexity: 0.5,
        });
        expect(bassy.danceabilityEstimate).toBeGreaterThan(thin.danceabilityEstimate);
    });

    test("does not equate BPM with perceived energy", () => {
        const fastAmbient = perceivedMusicState({
            tempo: 128,
            arousal: 0.2,
            groove: 0.1,
            danceability: 0.1,
            lowFrequencyDrive: 0.1,
            rhythmicActivity: 0.1,
            spectralIntensity: 0.2,
            density: 0.2,
            dynamics: 0.2,
        });
        const funk = perceivedMusicState({
            tempo: 110,
            arousal: 0.8,
            groove: 1,
            danceability: 0.9,
            lowFrequencyDrive: 0.9,
            rhythmicActivity: 0.9,
            spectralIntensity: 0.7,
            density: 0.7,
            dynamics: 0.8,
        });
        expect(funk.perceivedEnergy).toBeGreaterThan(fastAmbient.perceivedEnergy);
        expect(fastAmbient.tempo).toBeGreaterThan(funk.tempo);
    });

    test("updates prior context with live crowd evidence Bayesian-style", () => {
        const weakEvidence = updateCrowdPrior(
            { eventType: "wedding", expectedGenres: { pop: 0.9 }, confidence: 0.9 },
            { dancing: 0.5, leaving: 0, entering: 0, reactionChange: 0.2, genreSignals: { techno: 1 }, sampleSize: 1 },
        );
        const strongEvidence = updateCrowdPrior(
            { eventType: "wedding", expectedGenres: { pop: 0.9 }, confidence: 0.9 },
            {
                dancing: 0.9,
                leaving: 0,
                entering: 0.5,
                reactionChange: 0.8,
                genreSignals: { techno: 1 },
                sampleSize: 30,
            },
        );
        expect(weakEvidence.priorWeight).toBeGreaterThan(strongEvidence.priorWeight);
        expect(strongEvidence.genres.techno ?? 0).toBeGreaterThan(weakEvidence.genres.techno ?? 0);
    });

    test("balances following and leading instead of overreacting", () => {
        expect(decideCrowdLeadership(0, 0.5).action).toBe("follow");
        expect(decideCrowdLeadership(1, 0.5).action).toBe("lead");
        expect(decideCrowdLeadership(1, 0.95).action).toBe("follow");
    });

    test("treats requests as preference evidence plus scheduling constraints", () => {
        const normal = evaluateRequest({
            requesterWeight: 1,
            requestVotes: 3,
            crowdCompatibility: 0.9,
            contextFit: 0.9,
            explicitPlayNext: false,
        });
        expect(normal.schedulingConstraint).toBe("route-soon");
        expect(normal.updatesCrowdTasteEvenIfRejected).toBe(true);
        expect(
            evaluateRequest({
                requesterWeight: 0.1,
                requestVotes: 1,
                crowdCompatibility: 0.1,
                contextFit: 0.1,
                explicitPlayNext: true,
            }).schedulingConstraint,
        ).toBe("play-next");
    });

    test("treats familiarity as psychological signal independent from popularity", () => {
        const familiar = familiarityMediatedPleasure({
            familiarity: 1,
            arousal: 0.7,
            preferenceFit: 0.8,
            catalogPopularity: 0,
        });
        const popularUnknown = familiarityMediatedPleasure({
            familiarity: 0,
            arousal: 0.7,
            preferenceFit: 0.8,
            catalogPopularity: 1,
        });
        expect(familiar.pleasure).toBeGreaterThan(popularUnknown.pleasure);
        expect(familiar.familiarityContribution).toBeGreaterThan(familiar.popularityContribution);
        expect(familiar.independentSignal).toBe(true);
    });
});
