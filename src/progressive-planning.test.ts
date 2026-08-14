import { describe, expect, test } from "bun:test";

import { buildProgressiveTransitionPlan } from "./progressive-planning";
import { advanceTransitionState, classifyTransitionHorizon } from "./transition-lifecycle";

const selected = { type: "bassdrop", fadeSec: 12, eqSweep: true, tempoRatio: 1, reason: "musical plan" } as const;

describe("progressive planning", () => {
    test("always exposes a playable fallback before analysis is ready", () => {
        const plan = buildProgressiveTransitionPlan({
            selectedPlan: selected,
            secondsUntilCue: 30,
            beatPhraseReady: false,
            stemsReady: false,
            previewValidated: false,
        });
        expect(plan.playable).toBe(true);
        expect(plan.plan.type).toBe("fade");
        expect(plan.activeEvidence).toBe("fallback");
    });

    test("upgrades to the validated selected plan and commits inside the horizon", () => {
        const prepared = buildProgressiveTransitionPlan({
            selectedPlan: selected,
            secondsUntilCue: 12,
            beatPhraseReady: true,
            stemsReady: true,
            previewValidated: true,
        });
        expect(prepared.plan.type).toBe("bassdrop");
        expect(prepared.state).toBe("validated");
        const committed = buildProgressiveTransitionPlan({
            selectedPlan: selected,
            secondsUntilCue: 4,
            beatPhraseReady: true,
            stemsReady: true,
            previewValidated: true,
        });
        expect(committed.state).toBe("committed");
        expect(committed.horizon.rescueRequired).toBe(true);
    });

    test("keeps normal replanning outside and rescue inside the commit horizon", () => {
        expect(classifyTransitionHorizon(50).replanningAllowed).toBe(true);
        expect(classifyTransitionHorizon(3).replanningAllowed).toBe(false);
        expect(() => advanceTransitionState("committed", "preparing")).toThrow();
        expect(advanceTransitionState("active", "completed")).toBe("completed");
    });
});
