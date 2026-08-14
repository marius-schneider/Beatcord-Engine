import { describe, expect, test } from "bun:test";
import {
    aggregateCrowdIntents,
    ambiguityPolicy,
    auditorySceneSeparability,
    type CriticDatasetItem,
    environmentAdaptation,
    evaluateQualityGuardianV3,
    exampleIntent,
    fadeGains,
    groundedExplanation,
    hearingDiversityMetrics,
    loudnessJourney,
    monoFoldDownSafety,
    pairwiseCriticExample,
    protectIntentionalSilence,
    QUALITY_GUARDIAN_V3_BOUNDARY,
    type QualityGuardianV3Input,
    releaseGate,
    truePeakSafety,
    VALIDATION_ENVIRONMENTS,
} from "./quality-guardian-v3";

const goodInput: QualityGuardianV3Input = {
    referencesAvailable: true,
    abComparisonAvailable: true,
    renderVerified: true,
    stemConfidence: 0.95,
    stretchRisk: 0.1,
    peakDbfs: -1,
    truePeakDbtp: -1,
    phaseCorrelation: 0.8,
    dropoutRate: 0,
    perceptual: {
        masking: 0.1,
        foregroundClarity: 0.9,
        transientPreservation: 0.9,
        loudnessContinuity: 0.9,
        artifactSalience: 0.1,
    },
    beatAlignment: 0.95,
    phraseAlignment: 0.9,
    harmonicCompatibility: 0.85,
    structuralContinuity: 0.9,
    tensionFit: 0.85,
    journeyFit: 0.9,
    mixingFit: 0.9,
    tasteFit: 0.85,
};

describe("quality guardian v3", () => {
    test("applies progressively stricter core, smart and director release gates", () => {
        const evidence = {
            crashFree: true,
            fallbackVerified: true,
            technicalPassRate: 0.995,
            perceptualPassRate: 0.96,
            musicalPassRate: 0.94,
            journeyPassRate: 0.8,
            conversationSafetyPassRate: 1,
        };
        expect(releaseGate("core", evidence).approved).toBe(true);
        expect(releaseGate("smart", evidence).approved).toBe(true);
        expect(releaseGate("director", evidence).failed).toContain("journey");
    });

    test("scores technical, perceptual, musical and experience quality separately", () => {
        const result = evaluateQualityGuardianV3(goodInput);
        expect(result.verdict).toBe("approve");
        expect(result.technical).toBeGreaterThan(0.9);
        expect(result.perceptual).toBeGreaterThan(0.8);
        expect(result.confidence).toBeGreaterThan(0.8);
    });

    test("repairs masking and falls back on dangerous technical failures", () => {
        const repair = evaluateQualityGuardianV3({
            ...goodInput,
            perceptual: { ...goodInput.perceptual, masking: 0.8 },
        });
        expect(repair.repairs).toContain("replan-role-overlap");
        const fallback = evaluateQualityGuardianV3({
            ...goodInput,
            peakDbfs: 1,
            truePeakDbtp: 1,
            dropoutRate: 0.1,
            renderVerified: false,
        });
        expect(fallback.verdict).toBe("fallback");
    });

    test("models auditory scene collisions and hearing diversity", () => {
        const scene = auditorySceneSeparability([
            { id: "v", role: "vocal", foreground: 0.9, band: "mid" },
            { id: "l", role: "lead", foreground: 0.8, band: "mid" },
        ]);
        expect(scene.collisions).toEqual([["v", "l"]]);
        expect(
            hearingDiversityMetrics([
                { highFrequencySensitivity: 0.8, maskingSusceptibility: 0.6, loudnessSensitivity: 0.2 },
                { highFrequencySensitivity: 0.2, maskingSusceptibility: 0.2, loudnessSensitivity: 0.9 },
            ]),
        ).toEqual({ worstCaseClarity: 0.4, loudnessSpread: 0.7, universalAssumption: false });
    });

    test("covers target listening environments without aggressive automatic EQ", () => {
        expect(VALIDATION_ENVIRONMENTS).toEqual(["headphones", "speaker", "phone", "car", "club"]);
        expect(environmentAdaptation("club")).toEqual({ eqDb: -1.5, bassMonoBelowHz: 140, aggressiveAutoEq: false });
    });

    test("guards mono fold-down, low end and true peak", () => {
        expect(monoFoldDownSafety({ stereoCorrelation: -0.2, lowBandSideRatio: 0.5 }).actions).toEqual([
            "reduce-antiphase-content",
            "mono-low-end",
        ]);
        expect(truePeakSafety(-0.2).gainReductionDb).toBeCloseTo(0.8);
    });

    test("controls loudness ownership and supports three fade curves", () => {
        const journey = loudnessJourney([
            { position: 0, shortTermLufs: -12, truePeakDbtp: -2, spectralTiltDb: 0 },
            { position: 0.5, shortTermLufs: -10, truePeakDbtp: -0.5, spectralTiltDb: 1 },
        ]);
        expect(journey).toMatchObject({ controlled: true, owner: "summed", maxRise: 2 });
        expect(fadeGains(0.5, "equal-power").incoming).toBeCloseTo(Math.SQRT1_2);
        expect(fadeGains(0.25, "linear")).toEqual({ outgoing: 0.75, incoming: 0.25 });
    });

    test("recognizes and protects semantically intentional silence", () => {
        expect(
            protectIntentionalSilence({ silenceProbability: 0.9, structuralBoundary: true, userRequestedGap: false }),
        ).toEqual({ protected: true, mayFill: false });
        expect(
            protectIntentionalSilence({ silenceProbability: 0.2, structuralBoundary: false, userRequestedGap: false })
                .mayFill,
        ).toBe(true);
    });

    test("turns canonical language examples into inspectable correctable intent", () => {
        expect(exampleIntent("Rooftop sunset")).toMatchObject({
            moods: ["chill", "love"],
            mixStyle: "smooth",
            energyRoute: "gradual-rise",
            correctable: true,
        });
        expect(exampleIntent("Get us to DnB in 30 minutes")).toMatchObject({
            targetGenre: "drum-and-bass",
            deadlineMinutes: 30,
        });
        expect(exampleIntent("Escalate with songs everyone knows")).toMatchObject({
            familiarity: 0.9,
            energyRoute: "escalate",
        });
    });

    test("handles ambiguity safely while playback continues", () => {
        expect(ambiguityPolicy(0.4)).toEqual({ apply: "low-risk", askOptionalQuestion: true, playbackContinues: true });
        expect(ambiguityPolicy(0.9).askOptionalQuestion).toBe(false);
    });

    test("keeps crowd intents separate, host-weighted and conflict-aware", () => {
        const result = aggregateCrowdIntents([
            { participantId: "host", energy: 1, familiarity: 0.9, genres: ["House"], exclusions: [], host: true },
            {
                participantId: "guest",
                energy: 0,
                familiarity: 0.2,
                genres: ["Rock"],
                exclusions: ["house"],
                host: false,
            },
        ]);
        expect(result.energy).toBeCloseTo(0.6);
        expect(result.conflicts).toEqual(["house"]);
        expect(result.genres).toEqual(["rock"]);
        expect(result.fairAggregation).toBe(true);
    });

    test("only explains actual reasons and fixes the LLM boundary", () => {
        expect(groundedExplanation(["crowd-fit", "smooth-mix"], ["personal-favorite", "smooth-mix"])).toEqual([
            "smooth-mix",
        ]);
        expect(QUALITY_GUARDIAN_V3_BOUNDARY).toMatchObject({
            llmRole: "intent-and-explanation-only",
            deterministicAudioPlanning: true,
            conversationMemoryDefault: "session",
        });
    });

    test("stores original, plan, render and multidimensional pairwise critic labels", () => {
        const item = (renderedTransition: string): CriticDatasetItem => ({
            originalA: "a.wav",
            originalB: "b.wav",
            transitionPlan: "plan.json",
            renderedTransition,
            labels: { technical: 1, perceptual: 0.9, musical: 0.8, experience: 0.9, naturalness: 0.8 },
        });
        expect(pairwiseCriticExample(item("good.wav"), item("bad.wav"))).toEqual({
            chosen: "good.wav",
            rejected: "bad.wav",
            multidimensional: true,
        });
    });
});
