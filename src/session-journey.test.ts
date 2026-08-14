import { describe, expect, test } from "bun:test";

import { planSessionJourney, scoreJourneyAlignment } from "./session-journey";

const base = () => ({
    phase: "build" as const,
    currentEnergy: 0.45,
    targetEnergy: 0.72,
    recentEnergies: [0.34, 0.39, 0.45],
    sessionAgeMinutes: 18,
    peakReached: false,
    userSkips: 0,
    userLikes: 1,
    fatigue: { total: 0.2, energyFlatness: 0.1, vocalFatigue: 0.2 },
});

describe("session journey", () => {
    test("build plans several bounded steps instead of one isolated jump", () => {
        const journey = planSessionJourney(base());
        expect(journey.intent).toBe("build");
        expect(journey.direction).toBe("up");
        expect(journey.nextTargetEnergy).toBeGreaterThan(0.45);
        expect(journey.nextTargetEnergy).toBeLessThanOrEqual(0.58);
        expect(journey.horizon).toHaveLength(4);
        expect(journey.horizon.at(-1)?.targetEnergy).toBeCloseTo(0.72, 2);
    });

    test("reset deliberately releases energy", () => {
        const journey = planSessionJourney({ ...base(), phase: "reset", currentEnergy: 0.82, targetEnergy: 0.58 });
        expect(journey.intent).toBe("breathe");
        expect(journey.direction).toBe("down");
        expect(journey.horizon.at(-1)?.role).toBe("landing");
    });

    test("listener friction limits how aggressively the next track moves", () => {
        const calm = planSessionJourney(base());
        const friction = planSessionJourney({ ...base(), userSkips: 5, userLikes: 0 });
        expect(friction.nextTargetEnergy - friction.currentEnergy).toBeLessThan(
            calm.nextTargetEnergy - calm.currentEnergy,
        );
        expect(friction.reasons.join(" ")).toContain("listener friction");
    });

    test("flat sessions request controlled contrast without leaving 0..1", () => {
        const journey = planSessionJourney({
            ...base(),
            currentEnergy: 0.6,
            targetEnergy: 0.61,
            fatigue: { total: 0.7, energyFlatness: 0.9, vocalFatigue: 0.6 },
        });
        expect(journey.nextTargetEnergy).toBeGreaterThan(0.64);
        expect(journey.horizon[0]?.role).toBe("contrast");
        expect(journey.horizon.every((step) => step.targetEnergy >= 0 && step.targetEnergy <= 1)).toBe(true);
    });

    test("candidate alignment rewards the session path and future route health", () => {
        const journey = planSessionJourney(base());
        const aligned = scoreJourneyAlignment(journey, journey.nextTargetEnergy, 0.85);
        const wrongWay = scoreJourneyAlignment(journey, 0.25, 0.2);
        expect(aligned.score).toBeGreaterThan(wrongWay.score);
        expect(aligned.reason).toContain("journey fit");
    });
});
