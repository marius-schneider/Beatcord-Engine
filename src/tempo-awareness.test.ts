import { describe, expect, test } from "bun:test";

import { assessTempoRelationship } from "./tempo-awareness";

describe("half/double-time awareness", () => {
    test("70 and 140 BPM are the same pulse at different metrical levels", () => {
        const result = assessTempoRelationship(70, 140);
        expect(result.relation).toBe("double-time");
        expect(result.compatible).toBe(true);
        expect(result.stretchRatio).toBe(1);
        expect(result.effectiveGap).toBe(0);
    });

    test("the inverse direction is explicitly half-time", () => {
        const result = assessTempoRelationship(140, 70);
        expect(result.relation).toBe("half-time");
        expect(result.nextMultiplier).toBe(2);
    });

    test("3:2 and 2:3 hypotheses cover 100/150 in both directions", () => {
        expect(assessTempoRelationship(100, 150).relation).toBe("three-over-two");
        expect(assessTempoRelationship(150, 100).relation).toBe("two-over-three");
    });

    test("small residual differences become only a safe physical stretch", () => {
        const result = assessTempoRelationship(70, 142);
        expect(result.relation).toBe("double-time");
        expect(result.stretchRatio).toBeCloseTo(70 / 71, 4);
        expect(result.stretchRatio).toBeGreaterThan(0.98);
    });

    test("128 and 100 BPM stay unrelated instead of forcing a heroic fold", () => {
        const result = assessTempoRelationship(128, 100);
        expect(result.relation).toBe("unrelated");
        expect(result.compatible).toBe(false);
        expect(result.stretchRatio).toBe(1);
        expect(result.effectiveGap).toBeCloseTo(0.28, 3);
    });

    test("weak contradictory evidence rejects the less obvious 3:2 hypothesis", () => {
        const result = assessTempoRelationship(100, 150, {
            current: { confidence: 0.1, agreement: 0.1, percussiveness: 0.1 },
            next: { confidence: 0.1, agreement: 0.1, percussiveness: 0.1 },
        });
        expect(result.relation).toBe("unrelated");
        expect(result.plausibility).toBeLessThan(0.62);
    });
});
