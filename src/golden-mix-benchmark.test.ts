import { expect, test } from "bun:test";

import { goldenMixBaseline } from "../tests/mixes/baseline";
import { goldenMixCases } from "../tests/mixes/index";
import { evaluateGoldenMixCase, runGoldenMixBenchmark, validateGoldenMixCase } from "./golden-mix-benchmark";

const EXPECTED_CASES = [
    "bad-stems",
    "ballad-ballad",
    "bpm-half-double",
    "hiphop-house",
    "house-house-easy",
    "live-drums",
    "long-outro",
    "no-intro",
    "pop-house-medium",
    "rock-pop-hard",
    "unstable-tempo",
    "vocal-clash",
    "wrong-downbeat",
];

test("golden mix corpus contains all 13 versioned, valid and unique ground-truth cases", () => {
    expect(goldenMixCases).toHaveLength(13);
    expect([...new Set(goldenMixCases.map((item) => item.id))].sort()).toEqual(EXPECTED_CASES);
    for (const item of goldenMixCases) {
        const validated = validateGoldenMixCase(item);
        expect(validated.ok, validated.ok ? undefined : `${item.id}: ${validated.error}`).toBe(true);
        expect(item.current.downbeats.length).toBeGreaterThan(0);
        expect(item.current.phraseBoundaries.length).toBeGreaterThan(0);
        expect(item.current.sections.length).toBeGreaterThan(0);
        expect(item.subjective.notes.length).toBeGreaterThan(0);
    }
});

test("production transition policy clears the review-gated golden mix baseline", () => {
    const report = runGoldenMixBenchmark(goldenMixCases, goldenMixBaseline.thresholds);
    expect(report.failures).toEqual([]);
    expect(report.passed).toBe(true);
    expect(report.passRate).toBe(1);
    expect(report.forbiddenOfferRate).toBe(0);
    expect(report.meanNaturalness).toBeGreaterThanOrEqual(goldenMixBaseline.thresholds.minMeanNaturalness!);
    expect(report.meanArtifactRisk).toBeLessThanOrEqual(goldenMixBaseline.thresholds.maxMeanArtifactRisk!);
});

test("a newly forbidden production recommendation is reported as a regression", () => {
    const original = goldenMixCases[0]!;
    const current = evaluateGoldenMixCase(original);
    const regressed = {
        ...original,
        expected: {
            ...original.expected,
            acceptableTypes: original.expected.acceptableTypes.filter((type) => type !== current.recommendedType),
            forbiddenTypes: [...original.expected.forbiddenTypes, current.recommendedType],
        },
    };
    const result = evaluateGoldenMixCase(regressed);
    expect(result.passed).toBe(false);
    expect(result.failures.join(" ")).toContain("forbidden");
});

test("manifest validation rejects contradictory strategy labels", () => {
    const original = goldenMixCases[0]!;
    const invalid = {
        ...original,
        expected: {
            ...original.expected,
            forbiddenTypes: [...original.expected.forbiddenTypes, original.expected.acceptableTypes[0]],
        },
    };
    expect(validateGoldenMixCase(invalid)).toEqual({ ok: false, error: "invalid expectations" });
});
