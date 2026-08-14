import { describe, expect, test } from "bun:test";
import {
    activeEvaluationPairs,
    decideIntervention,
    explanationImportance,
    FIVE_LAB_ARCHITECTURE_V1,
    HUMAN_EVALUATION_PROGRAM_V1,
    interventionThreshold,
    interventionUtility,
    musicalSwitchingCost,
    sessionRegret,
    temporalOpportunityDecision,
    updateInterventionTrust,
} from "./human-intervention-lab-v1";

describe("human intervention lab v1", () => {
    test("subtracts disruption, artistic and control costs from expected benefit", () => {
        expect(
            interventionUtility({
                expectedExperienceImprovement: 0.8,
                decisionConfidence: 0.9,
                disruptionCost: 0.1,
                artisticCost: 0.1,
                userControlCost: 0.1,
            }),
        ).toBe(0.42);
    });
    test("raises thresholds for intrusive levels and album-pure autonomy", () => {
        expect(interventionThreshold({ mode: "album-pure", level: 5, trust: 0 })).toBeGreaterThan(
            interventionThreshold({ mode: "director-first", level: 1, trust: 0 }),
        );
    });
    test("requires utility and hysteresis before acting", () => {
        const assessment = {
            expectedExperienceImprovement: 1,
            decisionConfidence: 1,
            disruptionCost: 0,
            artisticCost: 0,
            userControlCost: 0,
        };
        expect(
            decideIntervention({
                assessment,
                mode: "hybrid",
                level: 3,
                trust: 0.5,
                persistenceMs: 500,
                minimumPersistenceMs: 1000,
            }).action,
        ).toBe("preserve");
        expect(
            decideIntervention({
                assessment,
                mode: "hybrid",
                level: 3,
                trust: 0.5,
                persistenceMs: 2000,
                minimumPersistenceMs: 1000,
            }).action,
        ).toBe("act");
    });
    test("accounts for the value of the current musical state", () => {
        expect(
            musicalSwitchingCost({
                currentSongValue: 1,
                upcomingPayoff: 1,
                userSelected: true,
                albumIntegrity: 1,
                artistPreservation: 1,
                currentFlow: 1,
                cognitiveDisruption: 1,
                queueSurprise: 1,
            }),
        ).toBe(1);
        expect(
            temporalOpportunityDecision({
                immediateBenefit: 0.8,
                immediateSwitchingCost: 0.7,
                futureBenefit: 0.7,
                waitSeconds: 15,
            }),
        ).toBe("wait-for-section");
    });
    test("changes trust only after a sufficiently long evidence window", () => {
        expect(updateInterventionTrust({ currentTrust: 0.5, accepted: 1, undone: 0, evidenceWindow: 1 })).toBe(0.5);
        expect(updateInterventionTrust({ currentTrust: 0.5, accepted: 10, undone: 0, evidenceWindow: 10 })).toBe(0.55);
    });
    test("connects explanations with actionable agency", () => {
        expect(explanationImportance("normal-choice")).toBe("none");
        expect(explanationImportance("queue-move")).toBe("proactive");
        expect(HUMAN_EVALUATION_PROGRAM_V1.agencyControls).toEqual(["why", "undo", "correct", "dont-learn"]);
    });
    test("tracks both intervention and preservation regret", () => {
        const regret = sessionRegret({
            skip: 1,
            queue: 1,
            transition: 1,
            discovery: 1,
            intervention: 1,
            preservation: 1,
        });
        expect(regret.total).toBe(6);
        expect(HUMAN_EVALUATION_PROGRAM_V1.northStar).toBe("session-regret");
    });
    test("samples model disagreements and protects evaluation splits", () => {
        expect(
            activeEvaluationPairs(
                [
                    { id: "easy", modelScores: [0.5, 0.51] },
                    { id: "hard", modelScores: [0.1, 0.9] },
                ],
                1,
            )[0]?.id,
        ).toBe("hard");
        expect(HUMAN_EVALUATION_PROGRAM_V1.splitBy).toContain("listener");
    });
    test("ends with five connected labs and earned intervention", () => {
        expect(FIVE_LAB_ARCHITECTURE_V1.labs).toHaveLength(5);
        expect(FIVE_LAB_ARCHITECTURE_V1.complexityIsSuccessMetric).toBeFalse();
        expect(HUMAN_EVALUATION_PROGRAM_V1.finalPrinciple).toBe("earn-every-intervention");
    });
});
