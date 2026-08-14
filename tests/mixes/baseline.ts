import type { GoldenMixBenchmarkThresholds } from "../../src/golden-mix-benchmark";

/** Review-gated floor: algorithm changes must not silently weaken these scores. */
export const goldenMixBaseline = {
    version: 1,
    updatedAt: "2026-08-12",
    thresholds: {
        minPassRate: 1,
        maxForbiddenOfferRate: 0,
        minMeanNaturalness: 85,
        maxMeanArtifactRisk: 15,
    } satisfies GoldenMixBenchmarkThresholds,
};
