import { describe, expect, test } from "bun:test";

import {
    benchmarkSyncV1,
    determinismAuditV1,
    performanceBudgetStatus,
    performanceDistributionMicros,
} from "./performance-stability-v1";

describe("performance stability v1", () => {
    test("computes stable percentile and throughput statistics", () => {
        expect(performanceDistributionMicros([1, 2, 3, 4, 5])).toEqual({
            samples: 5,
            p50Micros: 3,
            p95Micros: 4,
            p99Micros: 4,
            worstMicros: 5,
            operationsPerSecond: 333333.333,
        });
    });
    test("reports explicit performance-budget violations", () => {
        expect(
            performanceBudgetStatus({
                distribution: performanceDistributionMicros([10, 20, 30]),
                p95BudgetMicros: 15,
                p99BudgetMicros: 15,
            }),
        ).toEqual({ passed: false, violations: ["p95-budget-exceeded", "p99-budget-exceeded"] });
    });
    test("warms and benchmarks synchronous policy paths", () => {
        let value = 0;
        const result = benchmarkSyncV1(() => value++, { warmup: 10, iterations: 50 });
        expect(value).toBe(60);
        expect(result.samples).toBe(50);
    });
    test("detects deterministic and nondeterministic outputs", () => {
        expect(determinismAuditV1(() => ({ value: 1 })).deterministic).toBeTrue();
        let value = 0;
        expect(determinismAuditV1(() => ({ value: value++ })).deterministic).toBeFalse();
    });
});
