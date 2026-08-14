export interface PerformanceDistributionV1 {
    samples: number;
    p50Micros: number;
    p95Micros: number;
    p99Micros: number;
    worstMicros: number;
    operationsPerSecond: number;
}

const round = (value: number) => Math.round(value * 1_000) / 1_000;

export function performanceDistributionMicros(samples: readonly number[]): PerformanceDistributionV1 {
    const sorted = [...samples].filter(Number.isFinite).sort((a, b) => a - b);
    const percentile = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] ?? 0;
    const totalMicros = sorted.reduce((sum, value) => sum + Math.max(0, value), 0);
    return {
        samples: sorted.length,
        p50Micros: round(percentile(0.5)),
        p95Micros: round(percentile(0.95)),
        p99Micros: round(percentile(0.99)),
        worstMicros: round(sorted.at(-1) ?? 0),
        operationsPerSecond: round(totalMicros ? (sorted.length * 1_000_000) / totalMicros : 0),
    };
}

export function benchmarkSyncV1(
    operation: () => void,
    options: { warmup?: number; iterations?: number } = {},
): PerformanceDistributionV1 {
    const warmup = Math.max(0, Math.floor(options.warmup ?? 100));
    const iterations = Math.max(1, Math.floor(options.iterations ?? 1_000));
    for (let index = 0; index < warmup; index++) operation();
    const samples: number[] = [];
    for (let index = 0; index < iterations; index++) {
        const started = Bun.nanoseconds();
        operation();
        samples.push((Bun.nanoseconds() - started) / 1_000);
    }
    return performanceDistributionMicros(samples);
}

export function performanceBudgetStatus(input: {
    distribution: PerformanceDistributionV1;
    p95BudgetMicros: number;
    p99BudgetMicros: number;
}): { passed: boolean; violations: string[] } {
    const violations: string[] = [];
    if (input.distribution.p95Micros > input.p95BudgetMicros) violations.push("p95-budget-exceeded");
    if (input.distribution.p99Micros > input.p99BudgetMicros) violations.push("p99-budget-exceeded");
    return { passed: violations.length === 0, violations };
}

export function determinismAuditV1<T>(
    operation: () => T,
    serialize: (value: T) => string = JSON.stringify,
): {
    deterministic: boolean;
    first: string;
    second: string;
} {
    const first = serialize(operation());
    const second = serialize(operation());
    return { deterministic: first === second, first, second };
}
