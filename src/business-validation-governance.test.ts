import { describe, expect, test } from "bun:test";
import {
    CREDIBLE_CLOSED_LOOP,
    GO_NO_GO,
    innovationLane,
    productIntrusiveness,
    selectCatalogAccess,
    V3_RESEARCH_PACKAGE,
} from "./business-validation-governance";

describe("business validation governance", () => {
    test("keeps v3 in the research package", () => {
        expect(V3_RESEARCH_PACKAGE).toContain("world-model-mpc");
        expect(V3_RESEARCH_PACKAGE).toContain("partner-cross-provider-dj");
    });
    test("selects only catalog paths with legal and technical transform access", () => {
        const result = selectCatalogAccess([
            {
                path: "strategic-provider-partnership",
                legalTransformAccess: false,
                rawAudioAccess: true,
                catalogBreadth: 1,
                dependencyRisk: 0.4,
            },
            {
                path: "local-user-owned",
                legalTransformAccess: true,
                rawAudioAccess: true,
                catalogBreadth: 0.4,
                dependencyRisk: 0.05,
            },
        ]);
        expect(result?.path).toBe("local-user-owned");
    });
    test("defines the credible closed loop", () => {
        expect(CREDIBLE_CLOSED_LOOP).toEqual([
            "intent-context",
            "short-journey",
            "tracks-moments",
            "transition-strategy",
            "validation",
            "response",
            "replan",
            "user-control",
        ]);
    });
    test("routes features through go, prototype, partner and research lanes", () => {
        expect(innovationLane("experience-dna")).toBe("go-now");
        expect(innovationLane("four-stem-role-mixing")).toBe("prototype");
        expect(innovationLane("provider-stem-access")).toBe("partner-dependent");
        expect(innovationLane("automatic-crowd-mood")).toBe("watch-research");
        expect(GO_NO_GO["go-now"]).toContain("no-action");
    });
    test("fails the product test when intelligence becomes intrusive", () => {
        expect(
            productIntrusiveness({
                visibleAiDecisions: 0.1,
                modeChanges: 0.1,
                effectSalience: 0.1,
                reorderSurprises: 0.1,
            }),
        ).toMatchObject({ passes: true, outcome: "intentional-not-intrusive" });
        expect(
            productIntrusiveness({ visibleAiDecisions: 1, modeChanges: 1, effectSalience: 1, reorderSurprises: 1 })
                .outcome,
        ).toBe("overacting");
    });
});
