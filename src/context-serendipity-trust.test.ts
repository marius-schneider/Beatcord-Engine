import { describe, expect, test } from "bun:test";
import {
    CONTEXT_HIERARCHY,
    consumptionArchetype,
    contextChangeDecision,
    contextConfidenceLabel,
    contextTransition,
    desiredStateTarget,
    discoveryBridge,
    explainContextReasoning,
    explanationRequirement,
    fairnessControls,
    INTENT_LEVEL_CONTROLS,
    isolatedTasteUpdate,
    journeyChangePreview,
    perceivedNovelty,
    RECOMMENDATION_FAILURES,
    recommendationProblemReport,
    recommendationRecovery,
    resetTodaysVibe,
    resolveContext,
    serendipityValue,
    sessionCuriosity,
    surpriseBalance,
    surpriseComposition,
    surpriseCost,
    TRUST_FOUNDATIONS,
    truthfulStateLanguage,
    updateAutonomy,
} from "./context-serendipity-trust";

describe("context, serendipity and trust", () => {
    test("resolves context with explicit intent above routine", () => {
        expect(
            resolveContext({
                explicit: { value: "chill", confidence: 1 },
                routine: { value: "party", confidence: 0.9 },
            }),
        ).toEqual({
            value: "chill",
            source: "explicit-current-intent",
            confidence: 1,
        });
        expect(CONTEXT_HIERARCHY.at(-1)).toBe("historical-routine");
    });

    test("labels context confidence and isolates contextual taste", () => {
        expect(contextConfidenceLabel(0.35)).toBe("low-medium");
        expect(isolatedTasteUpdate(false)).toEqual({ globalWeight: 0.05, contextWeight: 0.65, sessionWeight: 0.3 });
    });

    test("optimizes desired state instead of merely detected state", () => {
        expect(desiredStateTarget(0.2, 0.8, "shift")).toBe(0.8);
        expect(desiredStateTarget(0.2, 0.8, "contrast")).toBe(0.8);
    });

    test("transitions context with hysteresis", () => {
        expect(contextTransition("dinner", "party", 0.4)).toMatchObject({ progress: 0.4, active: true });
        expect(
            contextChangeDecision({ explicit: false, consistentSignals: 1, averageConfidence: 0.9 }).change,
        ).toBeFalse();
        expect(contextChangeDecision({ explicit: true, consistentSignals: 0, averageConfidence: 0 }).change).toBeTrue();
    });

    test("explains only explicit and observable context evidence", () => {
        expect(
            explainContextReasoning({
                explicitSelection: "Chill selected",
                observableSessionFact: "low energy for 20 minutes",
                inferredMood: "sad",
            }),
        ).toEqual({
            explanation: "Chill selected and low energy for 20 minutes",
            unsupportedInferenceExposed: false,
        });
    });

    test("requires valuable and meaningful novelty for serendipity", () => {
        expect(
            serendipityValue({
                unexpected: 0.8,
                valuable: 0.9,
                contextuallyMeaningful: 0.5,
                discoverableConnection: 0.75,
            }),
        ).toBe(0.27);
        expect(
            serendipityValue({ unexpected: 1, valuable: 0, contextuallyMeaningful: 1, discoverableConnection: 1 }),
        ).toBe(0);
    });

    test("lets session curiosity override global tendency", () => {
        expect(
            sessionCuriosity({ explorationDemand: 1, discoveryFatigue: 0, recentAcceptance: 1, confidence: 0.8 }, 0),
        ).toBe(0);
    });

    test("budgets and composes surprise across dimensions", () => {
        const budget = {
            trackNovelty: 0.8,
            artistNovelty: 0.8,
            genreDistance: 0.8,
            semanticDistance: 0.2,
            transitionNovelty: 0.1,
            journeyNovelty: 0.1,
        };
        expect(surpriseCost(budget)).toBeCloseTo(0.466667, 6);
        expect(surpriseComposition(budget, "balanced")).toEqual({ allowed: false, overloadedDimensions: 3 });
        expect(surpriseComposition(budget, "adventure-wild").allowed).toBeTrue();
        expect(surpriseBalance({ itemNovelty: 0.9, transitionNovelty: 0.8 }).balanced).toBeFalse();
    });

    test("uses truthful discovery bridges proportional to surprise", () => {
        expect(
            discoveryBridge({ surprise: 0.8, knownConnection: "the warm synth sound", destination: "the DnB goal" }),
        ).toContain("warm synth sound");
        expect(discoveryBridge({ surprise: 0.2, knownConnection: "x", destination: "y" })).toBeNull();
        expect(explanationRequirement(0.8)).toBe("recommended");
    });

    test("models granular familiarity rather than a novelty boolean", () => {
        const unknownArtist = perceivedNovelty({
            artistPopularity: 0.2,
            trackPopularity: 0.2,
            momentFamiliarity: 0.2,
            communityPopularity: 0.2,
            familiarArtist: false,
        });
        const familiarArtist = perceivedNovelty({
            artistPopularity: 0.2,
            trackPopularity: 0.2,
            momentFamiliarity: 0.2,
            communityPopularity: 0.2,
            familiarArtist: true,
        });
        expect(familiarArtist).toBeLessThan(unknownArtist);
    });

    test("tracks recommendation failures and enters recovery", () => {
        expect(RECOMMENDATION_FAILURES).toContain("overlearned-temporary-behavior");
        expect(recommendationProblemReport("wrong-context")).toMatchObject({ changesLongTermTaste: false });
        expect(recommendationRecovery(3)).toEqual({
            sessionConfidenceMultiplier: 0.4,
            familiarAnchorWeight: 1,
            autonomyMultiplier: 0.3,
            askLightweightIntent: true,
        });
    });

    test("earns autonomy gradually and loses it quickly after correction", () => {
        expect(updateAutonomy({ level: 0.4, trustConfidence: 0.5 }, "accepted", true).level).toBe(0.44);
        expect(updateAutonomy({ level: 0.6, trustConfidence: 0.7 }, "corrected").level).toBe(0.42);
        const taste = { house: 0.8 };
        expect(resetTodaysVibe(taste)).toEqual({ sessionSignals: [], longTermTaste: taste });
    });

    test("keeps power fairness controls optional and intent-level", () => {
        expect(fairnessControls("simple").exposed).toBeFalse();
        expect(fairnessControls("power").exposed).toBeTrue();
        expect(INTENT_LEVEL_CONTROLS).toContain("less-repetitive");
    });

    test("adapts to autonomy archetypes and previews large changes", () => {
        expect(consumptionArchetype({ automationPreference: 0.2, controlDepth: 1, explanationPreference: 0.5 })).toBe(
            "autonomous-user",
        );
        expect(journeyChangePreview("House", "Tech House", "Techno", 25)).toEqual({
            route: ["House", "Tech House", "Techno"],
            etaMinutes: 25,
            previewBeforeCommit: true,
        });
    });

    test("builds trust through controls and avoids fake certainty", () => {
        expect(TRUST_FOUNDATIONS).toContain("reversibility");
        expect(truthfulStateLanguage({ explicitSelection: "Love" })).toBe("Love is currently selected.");
        expect(truthfulStateLanguage({ inferredDirection: "softer tracks" })).toBe(
            "Beatcord is leaning toward softer tracks.",
        );
    });
});
