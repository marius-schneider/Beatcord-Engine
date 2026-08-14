import { describe, expect, test } from "bun:test";

import { planFamiliarityBalance, scoreFamiliarityCandidate } from "./familiarity-balance";
import { projectJourneyTemplate } from "./journey-templates";
import { assessStrategyFatigue } from "./strategy-fatigue";
import { assessSurpriseBudget } from "./surprise-budget";

describe("journey templates and variety budgets", () => {
    test("party template moves through build, peak, breather and finale", () => {
        const build = projectJourneyTemplate("party", "build", 20);
        const peak = projectJourneyTemplate("party", "peak", 50);
        const reset = projectJourneyTemplate("party", "reset", 70);
        expect(build.rolling).toBe(true);
        expect(peak.targetEnergy).toBeGreaterThan(build.targetEnergy);
        expect(reset.targetEnergy).toBeLessThan(peak.targetEnergy);
    });

    test("familiarity remains a soft signal and protects the explicit queue", () => {
        const state = planFamiliarityBalance("party", "peak", 0.8, 0.5);
        expect(state.familiarityTarget).toBeGreaterThan(0.8);
        expect(scoreFamiliarityCandidate(state, 0.9, true).adjustment).toBe(0);
        expect(Math.abs(scoreFamiliarityCandidate(state, 0.9, false).adjustment)).toBeLessThanOrEqual(3);
    });

    test("repeated surprises are reserved while normal moves remain available", () => {
        const result = assessSurpriseBudget({
            event: "double-drop",
            phase: "build",
            recentEvents: ["genre-switch", "stem-moment", "mashup", "double-drop"],
        });
        expect(result.allowed).toBe(false);
        expect(assessSurpriseBudget({ event: "normal", phase: "build", recentEvents: [] }).allowed).toBe(true);
    });

    test("third bass swap receives an explicit strategy fatigue penalty", () => {
        const fatigue = assessStrategyFatigue("bassdrop", [
            { type: "bassdrop" },
            { type: "filter" },
            { type: "bassdrop" },
            { type: "bassdrop" },
        ]);
        expect(fatigue.recentUsage).toBe(3);
        expect(fatigue.penalty).toBeGreaterThan(0.2);
    });
});
