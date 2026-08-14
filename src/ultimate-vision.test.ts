import { describe, expect, test } from "bun:test";

import { buildUltimateVisionDecision } from "./ultimate-vision";

describe("ultimate vision decision", () => {
    test("answers all seven director questions in one auditable envelope", () => {
        const result = buildUltimateVisionDecision({
            nextTrackId: "next",
            plan: { type: "blend", fadeSec: 8, eqSweep: false, tempoRatio: 1, reason: "test" },
            cueAtSec: 42,
            intent: {
                style: "blend",
                intensity: 0.5,
                preserveTempo: true,
                preserveVocals: true,
                preserveStructure: true,
                targetEnergyDelta: 0.1,
                confidence: 0.8,
            },
            budget: {
                total: 0.5,
                timeStretch: 0.3,
                pitchShift: 0.1,
                looping: 0.2,
                stemMixing: 0.2,
                structureEditing: 0.1,
                effects: 0.3,
            },
            performanceStyle: {
                id: "dj",
                source: "derived",
                confidence: 0.8,
                reason: "test",
                style: {
                    manipulation: 0.5,
                    transitionIntensity: 0.6,
                    tempoFlexibility: 0.5,
                    structurePreservation: 0.7,
                    effectIntensity: 0.5,
                    stemUsage: 0.4,
                },
            },
            progressivePlan: {
                version: 1,
                state: "validated",
                playable: true,
                activeEvidence: "preview",
                plan: { type: "blend", fadeSec: 8, eqSweep: false, tempoRatio: 1, reason: "test" },
                stages: [],
                horizon: {
                    planHorizonSec: 180,
                    commitHorizonSec: 8,
                    secondsUntilStart: 12,
                    zone: "prepared",
                    replanningAllowed: true,
                    rescueRequired: false,
                },
            },
            intelligence: {
                version: 1,
                current: {
                    trackId: "current",
                    timeline: null,
                    transitionTime: { bar: 22, beat: 1, tick: 0, phrase: 6 },
                    sharedAnalysis: {} as never,
                    sectionImportance: [],
                    structuralDependencies: [],
                    structuralCut: { cutSec: 42, blocked: false, penalty: 0, unresolved: [], reasons: [] },
                },
                next: {} as never,
            },
            journey: {
                version: 1,
                phase: "build",
                intent: "build",
                direction: "up",
                currentEnergy: 0.5,
                targetEnergy: 0.75,
                nextTargetEnergy: 0.6,
                confidence: 0.8,
                stability: 0.8,
                horizon: [
                    { offsetTracks: 1, targetEnergy: 0.6, role: "lift" },
                    { offsetTracks: 2, targetEnergy: 0.7, role: "lift" },
                ],
                reasons: [],
            },
            route: { trackIds: ["current", "next"], edges: [], directScore: 0.8, score: 0.8, futureScore: 0.7 },
            reasons: ["musical boundary selected", "route supports journey"],
        });
        expect(Object.keys(result)).toEqual([
            "version",
            "what",
            "when",
            "how",
            "howMuch",
            "why",
            "whatIf",
            "whereNext",
        ]);
        expect(result.when.musicalTime?.bar).toBe(22);
        expect(result.whereNext.horizonMinutes).toBe(20);
    });
});
