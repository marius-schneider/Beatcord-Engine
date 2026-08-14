import { describe, expect, test } from "bun:test";

import { runDirectorSoakV1 } from "./director-soak-v1";

describe("director soak v1", () => {
    test("survives varied decisions with bounded state and deterministic samples", () => {
        const report = runDirectorSoakV1({ iterations: 80, seed: 7, p99BudgetMicros: 200_000 });
        expect(report.passed).toBeTrue();
        expect(report.decisions.deterministicFailures).toBe(0);
        expect(report.boundedState.transitionHistory).toBeLessThanOrEqual(40);
        expect(report.boundedState.recentArtists).toBeLessThanOrEqual(12);
        expect(report.evidence.totalGenerated).toBe(160);
    });

    test("is reproducible at the report decision level", () => {
        const first = runDirectorSoakV1({ iterations: 20, seed: 99, p99BudgetMicros: 1_000_000 });
        const second = runDirectorSoakV1({ iterations: 20, seed: 99, p99BudgetMicros: 1_000_000 });
        expect(first.decisions).toEqual(second.decisions);
        expect(first.boundedState).toEqual(second.boundedState);
    });
});
