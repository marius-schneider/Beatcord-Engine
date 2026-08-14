import { describe, expect, test } from "bun:test";
import {
    applyDelayedAiPlan,
    experienceScorecard,
    FINAL_EXPERIENCE_BRAINS,
    failureBudgetStatus,
    INTELLIGENCE_MILESTONES,
    integrationQoe,
    intentExecutionPath,
    qoeGuardian,
    responsivenessReleaseGate,
    socialQoeScore,
    ULTIMATE_CONTEXT_BRAIN,
    ULTIMATE_EXPERIENCE_PRINCIPLE,
    ULTIMATE_QOE_BRAIN,
    ULTIMATE_SERENDIPITY_BRAIN,
    ULTIMATE_TRUST_LAYER,
} from "./experience-qoe-governance";

describe("experience QoE governance", () => {
    test("executes common intents locally and offline", () => {
        expect(intentExecutionPath("more-energy")).toEqual({
            route: "local-fast-path",
            targetLatencyMs: 100,
            worksOffline: true,
        });
        expect(intentExecutionPath("nostalgic rooftop journey")).toMatchObject({
            route: "semantic-planner",
            worksOffline: false,
        });
    });
    test("keeps committed plans intact when AI arrives late", () => {
        expect(
            applyDelayedAiPlan({ committed: ["a"], speculative: ["b", "c"], commitHorizon: 1 }, ["x", "y", "z"]),
        ).toEqual({ committed: ["a"], speculative: ["y", "z"], commitHorizon: 1 });
    });
    test("makes search, library and queue responsiveness release-critical", () => {
        expect(responsivenessReleaseGate({ searchP95Ms: 700, libraryP95Ms: 400, queueP95Ms: 200 }).pass).toBeTrue();
        expect(responsivenessReleaseGate({ searchP95Ms: 900, libraryP95Ms: 400, queueP95Ms: 300 }).failures).toEqual([
            "searchP95Ms",
            "queueP95Ms",
        ]);
    });
    test("tracks social QoE separately", () => {
        expect(
            socialQoeScore({ joinLatency: 0, stateDesync: 0, reactionDelay: 0, requestLost: 0, hostConflict: 0 }),
        ).toBe(1);
        expect(
            socialQoeScore({ joinLatency: 1, stateDesync: 1, reactionDelay: 1, requestLost: 1, hostConflict: 1 }),
        ).toBe(0);
    });
    test("isolates integration degradation from playback", () => {
        expect(integrationQoe(true)).toEqual({ playbackAffected: false, status: "degraded", visible: true });
    });
    test("maps multisystem QoE into explicit severity actions", () => {
        const healthy = { network: 1, cpu: 1, buffer: 1, device: 1, search: 1, ai: 1, social: 1, integrations: 1 };
        expect(qoeGuardian(healthy)).toMatchObject({ severity: "info", actions: ["continue"] });
        expect(qoeGuardian({ ...healthy, buffer: 0.2 })).toMatchObject({
            severity: "critical",
            weakestSignal: "buffer",
            actions: ["fallback", "notify"],
        });
    });
    test("enforces operational failure budgets", () => {
        expect(
            failureBudgetStatus({
                audioInterruptionsPer100Hours: 0,
                transitionFailuresPer1000: 2,
                sessionDesyncPer100Sessions: 1,
                searchTimeoutRate: 0.005,
                aiCommandFailureRate: 0.01,
            }).withinBudget,
        ).toBeTrue();
        expect(
            failureBudgetStatus({
                audioInterruptionsPer100Hours: 2,
                transitionFailuresPer1000: 2,
                sessionDesyncPer100Sessions: 1,
                searchTimeoutRate: 0.02,
                aiCommandFailureRate: 0.01,
            }).exhausted,
        ).toEqual(["audioInterruptionsPer100Hours", "searchTimeoutRate"]);
    });
    test("uses a balanced satisfaction scorecard", () => {
        const score = experienceScorecard({
            audioReliability: 1,
            sessionSatisfaction: 1,
            recommendationAcceptance: 1,
            trust: 1,
            discovery: 1,
            socialEnjoyment: 1,
            wouldUseAgain: 1,
        });
        expect(score).toMatchObject({ balancedScore: 1, minutesListenedIsNorthStar: false });
    });
    test("composes context, serendipity, trust and QoE brains", () => {
        expect(ULTIMATE_CONTEXT_BRAIN).toHaveLength(6);
        expect(ULTIMATE_SERENDIPITY_BRAIN).toContain("surprise-budget");
        expect(ULTIMATE_TRUST_LAYER).toContain("dont-learn");
        expect(ULTIMATE_QOE_BRAIN).toContain("integrations");
        expect(FINAL_EXPERIENCE_BRAINS.at(-1)).toBe("experience-director");
    });
    test("defines milestones 33 through 36 and the final principle", () => {
        expect(Object.keys(INTELLIGENCE_MILESTONES)).toEqual(["33", "34", "35", "36"]);
        expect(ULTIMATE_EXPERIENCE_PRINCIPLE).toContain("reversibly");
    });
});
