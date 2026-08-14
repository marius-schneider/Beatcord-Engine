export type ResearchPrincipleId =
    | "downbeat-and-phrase"
    | "genre-is-context"
    | "understand-before-changing"
    | "confidence-bounds-complexity"
    | "stem-quality-first"
    | "plan-and-validate"
    | "rescue-always"
    | "session-as-journey"
    | "user-over-automation"
    | "listening-tests-matter";

export type PrincipleStatus = "pass" | "warn" | "fail";

export interface ResearchPrincipleDefinition {
    id: ResearchPrincipleId;
    number: number;
    statement: string;
}

export interface ResearchPrincipleInput {
    complexity: number;
    confidence: number;
    musicalBoundary: boolean;
    genreContribution: number;
    hasStructuredRegions: boolean;
    usesStems: boolean;
    stemQualityScore: number | null;
    preplanned: boolean;
    validation: "validated" | "estimated" | "none";
    rescueAvailable: boolean;
    journeyHorizon: number;
    overrideStatus: "inactive" | "applied" | "safety-rejected" | "ignored";
    subjectiveEvaluationAvailable: boolean;
    humanEvidence: number;
}

export interface ResearchPrincipleResult extends ResearchPrincipleDefinition {
    status: PrincipleStatus;
    evidence: string;
}

export interface ResearchPrincipleCompliance {
    version: 1;
    compliant: boolean;
    score: number;
    passed: number;
    warnings: number;
    failed: number;
    results: ResearchPrincipleResult[];
    blockers: string[];
}

export const RESEARCH_PRINCIPLES: readonly ResearchPrincipleDefinition[] = [
    { id: "downbeat-and-phrase", number: 1, statement: "Beat is not enough; downbeat and phrase are decisive." },
    { id: "genre-is-context", number: 2, statement: "Genre is context, not a transition rule." },
    { id: "understand-before-changing", number: 3, statement: "Understand song structure before changing it." },
    { id: "confidence-bounds-complexity", number: 4, statement: "Confidence bounds allowed complexity." },
    { id: "stem-quality-first", number: 5, statement: "Use stems only at sufficient quality." },
    { id: "plan-and-validate", number: 6, statement: "Plan the best transition and validate it when possible." },
    { id: "rescue-always", number: 7, statement: "A rescue path always exists." },
    {
        id: "session-as-journey",
        number: 8,
        statement: "Plan the session as a musical journey, not isolated crossfades.",
    },
    { id: "user-over-automation", number: 9, statement: "User decisions outrank automation within safety limits." },
    {
        id: "listening-tests-matter",
        number: 10,
        statement: "Subjective listening tests matter as much as technical scores.",
    },
] as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const round = (value: number, digits = 3) => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

function definition(id: ResearchPrincipleId): ResearchPrincipleDefinition {
    return RESEARCH_PRINCIPLES.find((principle) => principle.id === id)!;
}

function result(id: ResearchPrincipleId, status: PrincipleStatus, evidence: string): ResearchPrincipleResult {
    return { ...definition(id), status, evidence };
}

/** Evaluate one concrete transition against all ten Beatcord research principles. */
export function assessResearchPrinciples(input: ResearchPrincipleInput): ResearchPrincipleCompliance {
    const complexity = clamp01(input.complexity);
    const confidence = clamp01(input.confidence);
    const complex = complexity >= 0.62;
    const confidenceSupportsComplexity = confidence + (1 - complexity) * 0.25 >= complexity * 0.72;
    const results: ResearchPrincipleResult[] = [
        result(
            "downbeat-and-phrase",
            input.musicalBoundary ? "pass" : complex ? "fail" : "warn",
            input.musicalBoundary ? "phrase/bar/beat boundary selected" : "safe fixed-time fallback used",
        ),
        result(
            "genre-is-context",
            input.genreContribution <= 10 ? "pass" : "fail",
            `genre contributes ${input.genreContribution.toFixed(2)} points (maximum 10)`,
        ),
        result(
            "understand-before-changing",
            input.hasStructuredRegions ? "pass" : complex ? "fail" : "warn",
            input.hasStructuredRegions
                ? "analyzed mix regions selected"
                : "no structured region; simple handoff required",
        ),
        result(
            "confidence-bounds-complexity",
            confidenceSupportsComplexity ? "pass" : complex ? "fail" : "warn",
            `confidence ${confidence.toFixed(2)}, complexity ${complexity.toFixed(2)}`,
        ),
        result(
            "stem-quality-first",
            !input.usesStems ? "pass" : (input.stemQualityScore ?? 0) >= 68 ? "pass" : "fail",
            !input.usesStems
                ? "transition does not depend on separated stems"
                : `stem quality ${(input.stemQualityScore ?? 0).toFixed(1)}/100`,
        ),
        result(
            "plan-and-validate",
            input.preplanned && input.validation === "validated"
                ? "pass"
                : input.preplanned && input.validation === "estimated"
                  ? "warn"
                  : "fail",
            input.preplanned
                ? `transition preplanned; validation ${input.validation}`
                : "transition was not preplanned",
        ),
        result(
            "rescue-always",
            input.rescueAvailable ? "pass" : "fail",
            input.rescueAvailable ? "simple/full-mix fallback available" : "no rescue path declared",
        ),
        result(
            "session-as-journey",
            input.journeyHorizon >= 2 ? "pass" : "fail",
            `${input.journeyHorizon} future journey steps planned`,
        ),
        result(
            "user-over-automation",
            input.overrideStatus === "ignored" ? "fail" : "pass",
            input.overrideStatus === "inactive"
                ? "no explicit override active"
                : input.overrideStatus === "applied"
                  ? "explicit override applied"
                  : input.overrideStatus === "safety-rejected"
                    ? "override rejected with an explicit safety reason"
                    : "override silently ignored",
        ),
        result(
            "listening-tests-matter",
            input.subjectiveEvaluationAvailable ? (input.humanEvidence > 0 ? "pass" : "warn") : "fail",
            input.subjectiveEvaluationAvailable
                ? input.humanEvidence > 0
                    ? `${input.humanEvidence} human observations available`
                    : "blind listening pipeline available; no pair-specific human evidence yet"
                : "subjective evaluation unavailable",
        ),
    ];
    const passed = results.filter((item) => item.status === "pass").length;
    const warnings = results.filter((item) => item.status === "warn").length;
    const failed = results.filter((item) => item.status === "fail").length;
    return {
        version: 1,
        compliant: failed === 0,
        score: round((passed + warnings * 0.5) / results.length),
        passed,
        warnings,
        failed,
        results,
        blockers: results.filter((item) => item.status === "fail").map((item) => `${item.number}. ${item.evidence}`),
    };
}

/** Upgrade or downgrade one rule when a later runtime stage has stronger evidence. */
export function updateResearchPrinciple(
    compliance: ResearchPrincipleCompliance,
    id: ResearchPrincipleId,
    status: PrincipleStatus,
    evidence: string,
): ResearchPrincipleCompliance {
    const results = compliance.results.map((item) => (item.id === id ? { ...item, status, evidence } : item));
    const passed = results.filter((item) => item.status === "pass").length;
    const warnings = results.filter((item) => item.status === "warn").length;
    const failed = results.filter((item) => item.status === "fail").length;
    return {
        ...compliance,
        compliant: failed === 0,
        score: round((passed + warnings * 0.5) / results.length),
        passed,
        warnings,
        failed,
        results,
        blockers: results.filter((item) => item.status === "fail").map((item) => `${item.number}. ${item.evidence}`),
    };
}
