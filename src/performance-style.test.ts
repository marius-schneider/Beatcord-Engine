import { describe, expect, test } from "bun:test";

import { selectExperience } from "./experience-engine";
import { selectPerformanceStyle } from "./performance-style";

describe("performance style", () => {
    test("keeps emotional experience and technical style independent", () => {
        const love = selectExperience("love");
        const result = selectPerformanceStyle(love, [], { id: "club" });
        expect(result.id).toBe("club");
        expect(result.reason).toContain("experience remains love");
        expect(result.style.manipulation).toBeGreaterThan(0.8);
    });

    test("bounds partial expert overrides", () => {
        const result = selectPerformanceStyle(selectExperience("energy"), [], {
            id: "natural",
            style: { effectIntensity: 4, tempoFlexibility: -1 },
        });
        expect(result.style.effectIntensity).toBe(1);
        expect(result.style.tempoFlexibility).toBe(0);
        expect(result.style.structurePreservation).toBeGreaterThan(0.9);
    });
});
