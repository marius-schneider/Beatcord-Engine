import { describe, expect, test } from "bun:test";
import { MusicDirector } from "./music-director";
import {
    ADVANCED_EXPERIENCE_RECIPES,
    assessDistributionConfidence,
    buildWhyThis,
    datasetsForTask,
    EXPANDED_RESEARCH_SOURCES,
    enforceIntelligenceBoundary,
    evaluateAnalyzerCalibration,
    governLearningSignal,
    parseNaturalLanguageIntent,
    REFINED_CORE_ARCHITECTURE,
    resolveExperienceRecipe,
    subjectiveEmotionClaim,
    ULTIMATE_DIRECTOR_QUESTIONS,
    validateResearchClaim,
} from "./research-experience-policy";

describe("research and experience policy", () => {
    test("keeps ML understanding away from policy and DSP execution", () => {
        expect(enforceIntelligenceBoundary("detect-mood", "ml-understanding").allowed).toBe(true);
        expect(enforceIntelligenceBoundary("set-dsp-parameter", "ml-understanding")).toMatchObject({ allowed: false });
        expect(enforceIntelligenceBoundary("select-track", "deterministic-director").allowed).toBe(true);
    });

    test("requires explicit dataset licensing and reports per-music-type calibration", () => {
        expect(datasetsForTask("source-separation", "commercial")).toHaveLength(0);
        expect(datasetsForTask("transition", "commercial").map((item) => item.id)).toEqual([
            "beatcord-synthetic-mixes",
        ]);
        const report = evaluateAnalyzerCalibration([
            ...Array.from({ length: 5 }, () => ({ musicType: "edm" as const, correct: true, confidence: 0.9 })),
            ...Array.from({ length: 5 }, (_, index) => ({
                musicType: "jazz" as const,
                correct: index === 0,
                confidence: 0.9,
            })),
        ]);
        expect(report.byMusicType.edm?.reliable).toBe(true);
        expect(report.byMusicType.jazz?.reliable).toBe(false);
        expect(report.expectedCalibrationError).toBeGreaterThan(0);
    });

    test("reduces manipulation for out-of-distribution material", () => {
        const result = assessDistributionConfidence({
            embeddingDistance: 0.9,
            classifierEntropy: 0.8,
            nearestTrainingSimilarity: 0.1,
            analyzerAgreement: 0.2,
        });
        expect(result.outOfDistribution).toBe(true);
        expect(result.preserveOriginal).toBe(true);
        expect(result.manipulationMultiplier).toBeLessThan(0.5);
    });

    test("models Love independently and resolves saved recipes", () => {
        expect(ADVANCED_EXPERIENCE_RECIPES.love.intimacy).toBeGreaterThan(ADVANCED_EXPERIENCE_RECIPES.chill.intimacy);
        const recipe = resolveExperienceRecipe({
            id: "drive",
            name: "Late Night Drive",
            weights: { chill: 0.7, energy: 0.35, love: 0.15 },
            smoothness: 0.65,
            journey: "rising",
        });
        expect(Object.values(recipe.recipe.weights).reduce((sum, value) => sum + (value ?? 0), 0)).toBeCloseTo(1, 2);
        expect(recipe.dimensions.energy).toBeGreaterThan(ADVANCED_EXPERIENCE_RECIPES.chill.energy);
        expect(subjectiveEmotionClaim("love", 0.9)).not.toContain("objectively");
    });

    test("translates optional natural language into a deterministic plan", () => {
        expect(
            parseNaturalLanguageIntent("Mach es erstmal entspannt und in ungefähr einer Stunde partytauglich."),
        ).toMatchObject({
            startExperience: "chill",
            targetExperience: "party",
            transitionMinutes: 60,
            energyCurve: "rising",
            deterministicPlan: true,
        });
    });

    test("governs explanations, strong corrections, private learning and research tiers", () => {
        expect(
            buildWhyThis({
                trackReasons: ["energy fit", "energy fit", "new artist"],
                transitionReasons: ["stable grid"],
            }).track,
        ).toEqual(["energy fit", "new artist"]);
        expect(governLearningSignal("explicit-correction", "personal").effectiveWeight).toBe(1);
        expect(governLearningSignal("explicit-correction", "party").effectiveWeight).toBe(0);
        expect(validateResearchClaim(["reddit", "forum"], true).supported).toBe(false);
        expect(validateResearchClaim(["reddit", "paper"], true).supported).toBe(true);
    });

    test("keeps private, guest and party outcomes out of the persisted personal profile", () => {
        const director = new MusicDirector({ learningSessionMode: "party" });
        const before = director.exportSnapshot();
        director.recordOutcome("skipped");
        const after = director.exportSnapshot();
        expect(after.taste).toEqual(before.taste);
        expect(director.state().session.userSkips).toBe(1);
        director.setLearningSessionMode("personal");
        director.recordOutcome("skipped");
        expect(director.exportSnapshot().taste.samples).toBeGreaterThan(before.taste.samples);
    });

    test("registers the expanded source stack and complete refined architecture", () => {
        expect(EXPANDED_RESEARCH_SOURCES.some((source) => source.id === "beatnet" && source.tier === "A")).toBe(true);
        expect(EXPANDED_RESEARCH_SOURCES.some((source) => source.tier === "C")).toBe(true);
        expect(REFINED_CORE_ARCHITECTURE).toHaveLength(12);
        expect(ULTIMATE_DIRECTOR_QUESTIONS).toHaveLength(15);
    });
});
