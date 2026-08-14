import { describe, expect, test } from "bun:test";
import {
    audioOnlyAffect,
    beatcordExperienceSpace,
    calibratedEmotionPrediction,
    EmotionalTimeline,
    evaluateCrossDatasetEmotion,
    experiencePoint,
    fuseMultimodalEmbedding,
    planMoodRegulation,
    resolveMoodInput,
} from "./affect-intelligence";

describe("multimodal affect intelligence", () => {
    test("supports cold-start tracks with whichever modalities are available", () => {
        const fused = fuseMultimodalEmbedding({
            trackId: "new",
            embeddings: { audio: [1, 0], lyrics: [0, 1], tags: [0.5, 0.5] },
            confidences: { audio: 1, lyrics: 0.5, tags: 1 },
        });
        expect(fused.modalities).toEqual(["audio", "lyrics", "tags"]);
        expect(fused.embedding).toHaveLength(2);
        expect(fused.confidence).toBeGreaterThan(0);
    });

    test("represents mood continuously in valence and arousal", () => {
        const affect = beatcordExperienceSpace({
            acousticArousal: 0.9,
            rhythmicDrive: 0.8,
            lyricalValence: -0.8,
            harmonicValence: -0.4,
            tension: 0.7,
            danceability: 0.9,
            audioConfidence: 0.9,
            semanticConfidence: 0.8,
        });
        expect(affect.arousal).toBeGreaterThan(0.8);
        expect(affect.valence).toBeLessThan(0);
    });

    test("adds independent experience dimensions without collapsing energy into happiness", () => {
        const point = experiencePoint({
            acousticArousal: 1,
            rhythmicDrive: 1,
            lyricalValence: -1,
            harmonicValence: -1,
            tension: 1,
            danceability: 0.8,
            audioConfidence: 1,
            semanticConfidence: 1,
        });
        expect(point.energy).toBe(1);
        expect(point.valence).toBe(-1);
        expect(point.tension).toBe(1);
    });

    test("interpolates dynamic emotion over a track", () => {
        const timeline = new EmotionalTimeline([
            { timeSec: 0, valence: -0.5, arousal: 0.2, valenceConfidence: 0.7, arousalConfidence: 0.9 },
            { timeSec: 100, valence: 0.5, arousal: 1, valenceConfidence: 0.7, arousalConfidence: 0.9 },
        ]);
        expect(timeline.at(50)?.valence).toBe(0);
        expect(timeline.change(0, 100)).toEqual({ valenceDelta: 1, arousalDelta: 0.8 });
    });

    test("calibrates emotion confidence with domain generalization", () => {
        const prediction = calibratedEmotionPrediction({
            affect: { valence: 0.5, arousal: 0.8, valenceConfidence: 0.7, arousalConfidence: 0.9 },
            modelConfidence: 0.9,
            domainConfidence: 0.4,
            dataset: "source",
        });
        expect(prediction.effectiveConfidence).toBe(0.36);
    });

    test("requires cross-dataset robustness instead of a single benchmark", () => {
        const robust = evaluateCrossDatasetEmotion([
            {
                sourceDataset: "a",
                targetDataset: "b",
                valenceCorrelation: 0.6,
                arousalCorrelation: 0.8,
                calibrationError: 0.1,
            },
            {
                sourceDataset: "b",
                targetDataset: "c",
                valenceCorrelation: 0.55,
                arousalCorrelation: 0.7,
                calibrationError: 0.15,
            },
        ]);
        expect(robust.robust).toBe(true);
        expect(robust.weakestDatasetPair).toBe("b->c");
    });

    test("assigns audio higher confidence for arousal than valence", () => {
        const affect = audioOnlyAffect({ predictedValence: 0.4, predictedArousal: 0.9, audioConfidence: 1 });
        expect(affect.arousalConfidence).toBeGreaterThan(affect.valenceConfidence);
    });

    test("prioritizes explicit mood and distinguishes matching from regulation", () => {
        const inferred = {
            affect: { valence: -0.5, arousal: 0.8, valenceConfidence: 0.5, arousalConfidence: 0.8 },
            source: "behavioral" as const,
            atMs: 10,
        };
        const explicit = {
            affect: { valence: 0.2, arousal: 0.3, valenceConfidence: 1, arousalConfidence: 1 },
            source: "explicit" as const,
            atMs: 1,
        };
        expect(resolveMoodInput([inferred, explicit])?.source).toBe("explicit");
        const regulation = planMoodRegulation(inferred.affect, explicit.affect, "regulate", 3);
        expect(regulation.steps).toHaveLength(3);
        expect(regulation.steps.at(-1)?.valence).toBe(0.2);
        expect(planMoodRegulation(inferred.affect, explicit.affect, "match").target.valence).toBe(-0.5);
    });
});
