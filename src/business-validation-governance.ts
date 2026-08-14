export const V3_RESEARCH_PACKAGE = [
    "learned-transition-naturalness",
    "crowd-mood-inference",
    "world-model-mpc",
    "personalized-transition-generation",
    "sample-synced-multiroom",
    "partner-cross-provider-dj",
] as const;
export type CatalogAccessPath =
    | "local-user-owned"
    | "royalty-cleared-direct-license"
    | "dj-provider-integration"
    | "strategic-provider-partnership"
    | "multiple-capability-tiers";
export interface CatalogAccessAssessment {
    path: CatalogAccessPath;
    legalTransformAccess: boolean;
    rawAudioAccess: boolean;
    catalogBreadth: number;
    dependencyRisk: number;
}
export function selectCatalogAccess(paths: readonly CatalogAccessAssessment[]): CatalogAccessAssessment | null {
    return (
        [...paths]
            .filter((path) => path.legalTransformAccess && path.rawAudioAccess)
            .sort((a, b) => b.catalogBreadth - b.dependencyRisk - (a.catalogBreadth - a.dependencyRisk))[0] ?? null
    );
}

export const CREDIBLE_CLOSED_LOOP = [
    "intent-context",
    "short-journey",
    "tracks-moments",
    "transition-strategy",
    "validation",
    "response",
    "replan",
    "user-control",
] as const;
export type GoNoGoLane = "go-now" | "prototype" | "partner-dependent" | "watch-research";
export const GO_NO_GO: Record<GoNoGoLane, readonly string[]> = {
    "go-now": [
        "experience-dna",
        "session-contract",
        "music-copilot",
        "short-horizon-planning",
        "replay-vibe",
        "trust-controls",
        "no-action",
        "critic-foundation",
        "event-bus",
    ],
    prototype: [
        "moment-level-recommendation",
        "crowd-co-director",
        "four-stem-role-mixing",
        "rendered-transition-critic",
    ],
    "partner-dependent": ["provider-catalog-custom-dsp", "cross-provider-professional-dj", "provider-stem-access"],
    "watch-research": [
        "automatic-crowd-mood",
        "learned-naturalness",
        "generative-repair",
        "long-horizon-world-model",
        "sample-synced-multiroom",
    ],
};
export function innovationLane(feature: string): GoNoGoLane | "unclassified" {
    return (
        (Object.entries(GO_NO_GO) as [GoNoGoLane, readonly string[]][]).find(([, features]) =>
            features.includes(feature),
        )?.[0] ?? "unclassified"
    );
}

export function productIntrusiveness(input: {
    visibleAiDecisions: number;
    modeChanges: number;
    effectSalience: number;
    reorderSurprises: number;
}): { score: number; passes: boolean; outcome: "intentional-not-intrusive" | "overacting" } {
    const score = Math.min(
        1,
        Math.max(0, (input.visibleAiDecisions + input.modeChanges + input.effectSalience + input.reorderSurprises) / 4),
    );
    return { score, passes: score <= 0.35, outcome: score <= 0.35 ? "intentional-not-intrusive" : "overacting" };
}
