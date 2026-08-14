import { describe, expect, test } from "bun:test";
import {
    anonymizeResearchSession,
    attributeTasteChange,
    BEATCORD_RESEARCH_QUESTIONS,
    DEEP_RESEARCH_SOURCE_GROUPS,
    decayTrendSignal,
    downstreamUtility,
    EVALUATION_SEGMENTS,
    evaluateCalibration,
    evaluateSessionCurve,
    explainAutoReorder,
    FINAL_RESEARCH_PIPELINE,
    HUMAN_AI_CONTROL_MODES,
    journeyRegret,
    PathDependentTasteHistory,
    PersonalSatisfactionFloor,
    RESEARCH_BACKED_ARCHITECTURE,
    RESEARCH_EXPERIMENTS,
    recordCorrection,
    riskSensitiveScore,
    totalRecommendationUncertainty,
} from "./temporal-recommendation-research";

describe("temporal recommendation and research architecture", () => {
    test("decays viral signals faster than evergreen popularity", () => {
        expect(decayTrendSignal(1, "viral", 24)).toBeLessThan(0.2);
        expect(decayTrendSignal(1, "evergreen", 24)).toBeGreaterThan(0.99);
    });

    test("stores path-dependent taste states without making causal claims", () => {
        const history = new PathDependentTasteHistory();
        history.append({ atMs: 2, vector: { dnb: 0.8 }, source: "observed" });
        history.append({ atMs: 1, vector: { dnb: 0.2 }, source: "imported" });
        expect(history.history().map((item) => item.atMs)).toEqual([1, 2]);
        expect(history.change("dnb")).toBe(0.6);
        expect(attributeTasteChange(0.8).causalClaim).toBe(false);
    });

    test("keeps uncertainty dimensions separate and applies context-sensitive risk", () => {
        const uncertainty = { personalFit: 0.2, sessionFit: 0.4, crowdFit: 0.8, moodFit: 0.6, transitionFit: 0.1 };
        expect(totalRecommendationUncertainty(uncertainty)).toBeGreaterThan(0.4);
        expect(riskSensitiveScore(0.9, uncertainty, "party")).toBeGreaterThan(
            riskSensitiveScore(0.9, uncertainty, "background"),
        );
    });

    test("reports ECE, Brier score and reliability by subsystem", () => {
        const reports = evaluateCalibration(
            [
                { subsystem: "crowd", predicted: 0.9, outcome: 1 },
                { subsystem: "crowd", predicted: 0.8, outcome: 1 },
                { subsystem: "mood", predicted: 0.9, outcome: 0 },
            ],
            5,
        );
        expect(reports).toHaveLength(2);
        expect(reports.find((item) => item.subsystem === "crowd")!.brierScore).toBeLessThan(
            reports.find((item) => item.subsystem === "mood")!.brierScore,
        );
    });

    test("makes control mode and truthful reorder reasons visible", () => {
        expect(HUMAN_AI_CONTROL_MODES.director.visibleLabel).toContain("Director");
        expect(explainAutoReorder({ movedTrackId: "x", from: 1, to: 4, actualReason: "mixes-better-later" })).toContain(
            "mixes better",
        );
        expect(recordCorrection("bad-transition").scope).toBe("transition");
    });

    test("anonymizes consented research sessions without member identifiers", () => {
        const row = anonymizeResearchSession({
            sessionId: "secret-session",
            memberIds: ["alice", "bob"],
            tracks: ["a"],
            features: [],
            transitions: [],
            experience: "party",
            crowdDistribution: [],
            reactions: [],
            requests: [],
            corrections: [],
            consented: true,
        });
        expect(row.exportable).toBe(true);
        expect(row.anonymousMemberCount).toBe(2);
        expect(JSON.stringify(row)).not.toContain("alice");
    });

    test("publishes evaluation cuts by experience, genre, group shape and duration", () => {
        expect(EVALUATION_SEGMENTS.experience).toHaveLength(5);
        expect(EVALUATION_SEGMENTS.genreFamily).toHaveLength(10);
        expect(EVALUATION_SEGMENTS.groupShape).toHaveLength(7);
        expect(EVALUATION_SEGMENTS.sessionLengthMinutes).toEqual([10, 30, 60, 180, 360]);
    });

    test("caps downstream utility and measures journey regret", () => {
        expect(downstreamUtility(0.4, 1, 1)).toBe(0.9);
        expect(journeyRegret(0.6, [0.5, 0.9])).toEqual({ regret: 0.3, betterRouteLikely: true });
    });

    test("evaluates diversity and fairness as curves over session phases", () => {
        const curve = evaluateSessionCurve([
            { phase: "warmup", target: 0.8, observed: 0.7 },
            { phase: "peak", target: 0.3, observed: 0.6 },
        ]);
        expect(curve.worstPhase).toBe("peak");
        expect(curve.trajectory).toHaveLength(2);
    });

    test("accrues personal fairness debt only after repeated floor violations", () => {
        const floor = new PersonalSatisfactionFloor();
        expect(floor.observe("a", 0.2, 0.5)).toBe(0);
        expect(floor.observe("a", 0.2, 0.5)).toBe(0);
        expect(floor.observe("a", 0.2, 0.5)).toBe(0.3);
    });

    test("publishes the research-backed architecture, questions, experiments and pipeline", () => {
        expect(RESEARCH_BACKED_ARCHITECTURE).toHaveLength(11);
        expect(BEATCORD_RESEARCH_QUESTIONS).toHaveLength(10);
        expect(RESEARCH_EXPERIMENTS).toHaveLength(4);
        expect(FINAL_RESEARCH_PIPELINE).toHaveLength(7);
        expect(Object.values(DEEP_RESEARCH_SOURCE_GROUPS).reduce((sum, count) => sum + count, 0)).toBe(29);
    });
});
