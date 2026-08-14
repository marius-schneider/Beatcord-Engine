import { describe, expect, test } from "bun:test";
import {
    EvidenceRegistry,
    familiarityDiscoveryValue,
    learnHumanSequencePattern,
    memoryAccessibility,
    optimizeSequence,
    repeatUtility,
    type SequenceCandidate,
    scalablePlaylistContinuation,
    sequentialPreference,
} from "./evidence-sequencing";

describe("evidence and sequence intelligence", () => {
    test("keeps objective, behavioral and subjective evidence explicit", () => {
        const registry = new EvidenceRegistry();
        registry.register({
            id: "audio",
            kind: "objective",
            level: "established",
            confidence: 0.95,
            source: "signal",
            claim: "tempo",
        });
        registry.register({
            id: "skip",
            kind: "behavioral",
            level: "supported",
            confidence: 0.8,
            source: "session",
            claim: "preference",
        });
        registry.register({
            id: "mood",
            kind: "subjective",
            level: "experimental",
            confidence: 0.7,
            source: "input",
            claim: "felt mood",
        });
        const result = registry.decisionConfidence(["audio", "skip", "mood"]);
        expect(result.kinds).toEqual(["objective", "behavioral", "subjective"]);
        expect(result.weakestLevel).toBe("experimental");
    });

    test("treats sequential context as fundamental", () => {
        const score = sequentialPreference({
            standaloneAffinity: 0.4,
            previousTrackCompatibility: 1,
            sessionPhaseFit: 1,
            recentHistoryFit: 0.8,
            nextTrackOpportunity: 0.9,
        });
        expect(score).toBeGreaterThan(0.75);
    });

    test("allows useful repeats while controlling saturation", () => {
        expect(
            repeatUtility({
                affinity: 1,
                familiarity: 1,
                recentPlayCount: 2,
                hoursSinceLastPlay: 48,
                contextFit: 1,
                requested: false,
            }).repeatAllowed,
        ).toBe(true);
        expect(
            repeatUtility({
                affinity: 0.6,
                familiarity: 0.7,
                recentPlayCount: 12,
                hoursSinceLastPlay: 1,
                contextFit: 0.2,
                requested: false,
            }).repeatAllowed,
        ).toBe(false);
    });

    test("models familiarity and discovery as simultaneous benefits", () => {
        const value = familiarityDiscoveryValue(0.8, 0.7, 0.9);
        expect(value.familiarityValue).toBe(0.8);
        expect(value.discoveryValue).toBeCloseTo(0.63, 3);
    });

    test("uses frequency, recency, context and salience for human memory", () => {
        const accessible = memoryAccessibility({
            exposureCount: 8,
            daysSinceExposure: 2,
            contextSimilarity: 0.9,
            emotionalSalience: 1,
        });
        const forgotten = memoryAccessibility({
            exposureCount: 1,
            daysSinceExposure: 365,
            contextSimilarity: 0.1,
            emotionalSalience: 0.1,
        });
        expect(accessible).toBeGreaterThan(forgotten);
    });

    test("optimizes sequence separately from standalone ranking", () => {
        const candidates: SequenceCandidate[] = [
            { trackId: "high-ranked-peak", rankingScore: 1, energy: 1, valence: 0.8, familiarity: 0.8 },
            { trackId: "warm", rankingScore: 0.82, energy: 0.35, valence: 0.6, familiarity: 0.7 },
            { trackId: "build", rankingScore: 0.8, energy: 0.6, valence: 0.45, familiarity: 0.5 },
        ];
        const result = optimizeSequence(candidates, {
            startEnergy: 0.2,
            targetEnergy: 1,
            desiredMicroContrast: 0.25,
            length: 3,
        });
        expect(result.trackIds[0]).toBe("warm");
        expect(result.trackIds.at(-1)).toBe("high-ranked-peak");
        expect(result.macroJourneyScore).toBeGreaterThan(0.8);
    });

    test("learns macro journeys and micro contrast from human sequences", () => {
        const pattern = learnHumanSequencePattern([
            { trackId: "a", rankingScore: 1, energy: 0.2, valence: 0.5, familiarity: 1 },
            { trackId: "b", rankingScore: 1, energy: 0.8, valence: 0.5, familiarity: 0.2 },
            { trackId: "c", rankingScore: 1, energy: 0.3, valence: 0.5, familiarity: 0.8 },
        ]);
        expect(pattern.macroDirection).toBe("arc");
        expect(pattern.meanMicroContrast).toBeGreaterThan(0.5);
    });

    test("scales continuation through represent, retrieve, rank and sequence", () => {
        expect(
            scalablePlaylistContinuation({
                catalogSize: 10_000_000,
                retrievalLimit: 10_000,
                rankingLimit: 500,
                sequenceLength: 30,
            }),
        ).toEqual({
            represented: 10_000_000,
            retrieved: 10_000,
            ranked: 500,
            sequenced: 30,
            stages: ["represent", "retrieve", "rank", "sequence"],
        });
    });
});
