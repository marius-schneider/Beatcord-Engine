import { describe, expect, test } from "bun:test";
import {
    aggregateCrowdIntent,
    CROWD_MOOD_RESEARCH_STATUS,
    CROWD_STUDY_PROPOSAL,
    choosePolarizationResponse,
    PRODUCT_OPTIMIZATION_OBJECTIVE,
    resolveDesiredVsPerceived,
    resolveStakeholderConflict,
    STAKEHOLDER_PRIORITY,
    validateSessionContract,
} from "./crowd-intent-contract";

const affect = (valence: number, arousal: number) => ({ valence, arousal, valenceConfidence: 1, arousalConfidence: 1 });

describe("crowd research and session intent contract", () => {
    test("marks real-time crowd mood as exploratory research", () => {
        expect(CROWD_MOOD_RESEARCH_STATUS.maturity).toBe("exploratory");
        expect(CROWD_MOOD_RESEARCH_STATUS.requiresOwnUserStudies).toBe(true);
    });

    test("defines the four-condition crowd study and all outcome measures", () => {
        expect(CROWD_STUDY_PROPOSAL.groupSize).toEqual([3, 8]);
        expect(CROWD_STUDY_PROPOSAL.conditions).toHaveLength(4);
        expect(CROWD_STUDY_PROPOSAL.measures).toHaveLength(8);
    });

    test("aggregates individual desired states into a distribution, not a misleading average", () => {
        const distribution = aggregateCrowdIntent([
            { memberId: "a", desired: affect(0.8, 0.9), confidence: 1 },
            { memberId: "b", desired: affect(0.7, 0.8), confidence: 1 },
            { memberId: "c", desired: affect(-0.7, 0.2), confidence: 1 },
        ]);
        expect(distribution.clusters).toHaveLength(2);
        expect(distribution.source).toBe("individual-desired-states");
        expect(distribution.polarization).toBeGreaterThan(0.5);
    });

    test("responds to polarization with bridges, rotation or the host", () => {
        const distribution = aggregateCrowdIntent([
            { memberId: "a", desired: affect(1, 1), confidence: 1 },
            { memberId: "b", desired: affect(-1, 0), confidence: 1 },
        ]);
        expect(choosePolarizationResponse(distribution, true)).toBe("ask-host");
        expect(choosePolarizationResponse(distribution, false)).toBe("find-bridge");
    });

    test("optimizes desired mood while retaining perceived mood separately", () => {
        const result = resolveDesiredVsPerceived({ perceived: affect(-0.5, 0.2), desired: affect(0.5, 0.8) });
        expect(result.primary).toBe("desired");
        expect(result.optimizationTarget.arousal).toBe(0.8);
        expect(result.perceived.arousal).toBe(0.2);
    });

    test("uses the explicit multi-stakeholder priority order", () => {
        expect(STAKEHOLDER_PRIORITY).toHaveLength(6);
        expect(resolveStakeholderConflict(["platform", "crowd-safety", "discovery-creators"])).toBe("crowd-safety");
    });

    test("never hides engagement maximization as the product objective", () => {
        expect(PRODUCT_OPTIMIZATION_OBJECTIVE.primary).toBe("user-selected-experience-quality");
        expect(PRODUCT_OPTIMIZATION_OBJECTIVE.engagementRole).toBe("diagnostic-only");
        expect(PRODUCT_OPTIMIZATION_OBJECTIVE.hiddenSessionDurationMaximization).toBe(false);
    });

    test("validates the user intent optimization contract", () => {
        const valid = validateSessionContract({
            experience: "party",
            familiarityTarget: 0.6,
            discoveryTarget: 0.4,
            groupMode: "fair-share",
            hostPriority: 0.8,
        });
        expect(valid.valid).toBe(true);
        const invalid = validateSessionContract({ experience: "auto", familiarityTarget: 1.2, discoveryTarget: 0.8 });
        expect(invalid.valid).toBe(false);
        expect(invalid.violations).toContain("familiarity-target-out-of-range");
    });
});
