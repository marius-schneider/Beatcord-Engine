import { describe, expect, test } from "bun:test";

import { assessResearchPrinciples, RESEARCH_PRINCIPLES, updateResearchPrinciple } from "./research-principles";

const safe = () => ({
    complexity: 0.5,
    confidence: 0.85,
    musicalBoundary: true,
    genreContribution: 7.5,
    hasStructuredRegions: true,
    usesStems: false,
    stemQualityScore: null,
    preplanned: true,
    validation: "validated" as const,
    rescueAvailable: true,
    journeyHorizon: 4,
    overrideStatus: "inactive" as const,
    subjectiveEvaluationAvailable: true,
    humanEvidence: 3,
});

describe("Beatcord research principles", () => {
    test("contains the ten stable rules in roadmap order", () => {
        expect(RESEARCH_PRINCIPLES).toHaveLength(10);
        expect(RESEARCH_PRINCIPLES.map((principle) => principle.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    test("a fully evidenced transition is compliant", () => {
        const report = assessResearchPrinciples(safe());
        expect(report.compliant).toBe(true);
        expect(report.passed).toBe(10);
        expect(report.score).toBe(1);
    });

    test("complex transitions fail without a musical boundary or structure", () => {
        const report = assessResearchPrinciples({
            ...safe(),
            complexity: 0.8,
            musicalBoundary: false,
            hasStructuredRegions: false,
        });
        expect(report.compliant).toBe(false);
        expect(report.blockers.join(" ")).toContain("fixed-time fallback");
        expect(report.blockers.join(" ")).toContain("no structured region");
    });

    test("stem quality is mandatory only when the transition uses stems", () => {
        expect(assessResearchPrinciples({ ...safe(), stemQualityScore: 20 }).compliant).toBe(true);
        const unsafe = assessResearchPrinciples({ ...safe(), usesStems: true, stemQualityScore: 45 });
        expect(unsafe.compliant).toBe(false);
        expect(unsafe.results.find((item) => item.id === "stem-quality-first")?.status).toBe("fail");
    });

    test("missing pair-specific listening data is visible but does not block playback", () => {
        const report = assessResearchPrinciples({ ...safe(), humanEvidence: 0 });
        expect(report.compliant).toBe(true);
        expect(report.results.find((item) => item.id === "listening-tests-matter")?.status).toBe("warn");
    });

    test("later audio validation upgrades the planning principle immutably", () => {
        const estimated = assessResearchPrinciples({ ...safe(), validation: "estimated" });
        const validated = updateResearchPrinciple(
            estimated,
            "plan-and-validate",
            "pass",
            "realtime Quality Guardian validated the plan",
        );
        expect(estimated.warnings).toBe(1);
        expect(validated.warnings).toBe(0);
        expect(validated.score).toBe(1);
    });
});
