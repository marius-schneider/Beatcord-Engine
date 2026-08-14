import { describe, expect, test } from "bun:test";
import {
    adaptiveTransitionBars,
    bassSwapState,
    buildTransitionWindow,
    CLUB_TRANSITION_TAXONOMY,
    humanTransitionPrior,
    learnAutomationIntent,
    loopabilityScore,
    manipulationGate,
    nextBeatSyncState,
    planTempoTransition,
    predictPhaseDrift,
    rescueBeatmatching,
    roleCollision,
    smartLoopExtension,
    solveTransitionConstraints,
    stemCapability,
    tempoCorridorDecision,
    transitionCommitPolicy,
} from "./club-transition-planner-v2";

describe("club transition planner v2", () => {
    test("predicts drift and applies tiny human-like nudges", () => {
        const result = predictPhaseDrift([0, 2, 4], 4);
        expect(result.predictedErrorMs).toBe(12);
        expect(Math.abs(result.microNudgePercent)).toBeLessThanOrEqual(0.25);
        expect(result.hardWarp).toBe(false);
    });
    test("selects tempo masters, convergence and optional no-sync", () => {
        const budget = { maxInstantPercent: 2, maxGradualPercent: 8, maxCentsPitchError: 10, preserveKey: true };
        expect(
            planTempoTransition(124, 126, {
                sourceStability: 1,
                targetStability: 0.5,
                budget,
                beatmatchRisk: 0.2,
                alternativeRisk: 0.8,
            }).strategy,
        ).toBe("incoming-follows");
        expect(
            planTempoTransition(128, 174, {
                sourceStability: 1,
                targetStability: 1,
                budget,
                beatmatchRisk: 0.9,
                alternativeRisk: 0.2,
            }).strategy,
        ).toBe("no-sync");
    });
    test("allows justified corridor escapes with musical strategies", () => {
        const result = tempoCorridorDecision(
            174,
            { minBpm: 124, maxBpm: 128 },
            { journey: false, request: true, genreChange: false, crowd: false },
        );
        expect(result.mayEscape).toBe(true);
        expect(result.strategies).toContain("half-double-time");
    });
    test("publishes seven transition families and solves constraints", () => {
        expect(Object.keys(CLUB_TRANSITION_TAXONOMY)).toHaveLength(7);
        const result = solveTransitionConstraints([
            {
                id: "bad",
                family: "continuous",
                hardConstraints: false,
                beatPhraseFeasibility: 1,
                harmonicRisk: 0,
                arrangementRisk: 0,
                stretchRisk: 0,
                experienceFit: 1,
                simulationQuality: 1,
            },
            {
                id: "safe",
                family: "structural",
                hardConstraints: true,
                beatPhraseFeasibility: 0.9,
                harmonicRisk: 0.1,
                arrangementRisk: 0.1,
                stretchRisk: 0.1,
                experienceFit: 0.9,
                simulationQuality: 0.9,
            },
        ]);
        expect(result.selected?.id).toBe("safe");
    });
    test("uses human priors and learned controls only as validated intent", () => {
        expect(humanTransitionPrior("continuous", 0.8).decidesMix).toBe(false);
        const learned = learnAutomationIntent([{ parameter: "low-a", points: [{ progress: 1.2, value: -1 }] }]);
        expect(learned.curves[0]?.points[0]).toEqual({ progress: 1, value: 0 });
        expect(learned.generatesWaveform).toBe(false);
    });
    test("detects bass, vocal and lead collisions", () => {
        expect(bassSwapState(1, 1, 1, 1).overlapRisk).toBe(1);
        expect(roleCollision("vocal", 1, 1, 1).intelligibilityRisk).toBe(1);
        expect(roleCollision("lead", 1, 1, 1).mitigations).toContain("different-phrase");
    });
    test("falls back from unsafe stems and scores phrase-aware loops", () => {
        expect(stemCapability(0.6, true).mode).toBe("classic-eq");
        const loop = { rhythmic: 1, harmonic: 0.9, semantic: 0.8, transientBoundary: 1, repetitionNoticeability: 0.1 };
        expect(loopabilityScore(loop)).toBeGreaterThan(0.8);
        expect(smartLoopExtension(8, 16, loop)).toMatchObject({ enabled: true, repeats: 1, preservesStructure: true });
    });
    test("adapts duration and flexible transition windows musically", () => {
        expect(
            adaptiveTransitionBars({
                harmonic: 1,
                arrangementCollision: 0,
                beatStability: 1,
                tempoGap: 0,
                gridConfidence: 1,
                popStructure: 0,
            }),
        ).toBe(32);
        expect(
            adaptiveTransitionBars({
                harmonic: 0,
                arrangementCollision: 1,
                beatStability: 0,
                tempoGap: 1,
                gridConfidence: 0,
                popStructure: 1,
            }),
        ).toBe(4);
        expect(buildTransitionWindow([{ time: 64.02, probability: 0.91, type: "chorus" }], "entry")?.ideal).toBe(64.02);
    });
    test("enforces commit horizons and sync state confidence", () => {
        expect(transitionCommitPolicy("committed", false)).toEqual({ replaceable: false, changes: "emergency-only" });
        expect(nextBeatSyncState("bar-aligned", 0.9)).toBe("phrase-armed");
        expect(nextBeatSyncState("locked", 0.2)).toBe("release");
    });
    test("rescues failures and never fights the track", () => {
        expect(rescueBeatmatching("phase-drift", 0.8)).toContain("micro-nudge");
        expect(manipulationGate(0.9, 0.5)).toEqual({ allowed: false, action: "choose-different-transition-or-track" });
    });
});
