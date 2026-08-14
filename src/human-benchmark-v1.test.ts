import { describe, expect, test } from "bun:test";

import {
    assignLeakageSafeSplits,
    buildHumanBenchReport,
    detectHumanBenchLeakage,
    type HumanBenchCaseV1,
    type HumanBenchRatingV1,
    humanBenchPromotionGate,
    selectShadowDisagreements,
    validateHumanBenchCase,
    validateHumanBenchRating,
} from "./human-benchmark-v1";

const benchCase = (id: string, from = `from-${id}`, artist = `artist-${id}`): HumanBenchCaseV1 => ({
    version: 1,
    id,
    createdAtMs: 1,
    fromTrackRef: from,
    toTrackRef: `to-${id}`,
    artistRefs: [artist],
    genrePair: `genre-${id}`,
    transitionPairRef: `pair-${id}`,
    context: "party",
    device: "headphones",
    variantIds: [`old-${id}`, `new-${id}`],
    variantStrategies: ["fade", "blend"],
});
const rating = (
    id: string,
    caseId: string,
    raterHash: string,
    preferredVariantId: string,
    expertise: HumanBenchRatingV1["expertise"] = "casual-listener",
): HumanBenchRatingV1 => ({
    version: 1,
    id,
    atMs: 1,
    caseId,
    raterHash,
    expertise,
    preferredVariantId,
    confidence: 1,
    naturalness: 0.8,
    technicalQuality: 0.8,
    journeyFit: 0.8,
});

describe("human benchmark v1", () => {
    test("strictly validates cases and ratings", () => {
        expect(validateHumanBenchCase(benchCase("case-1"))).not.toBeNull();
        expect(validateHumanBenchRating(rating("r1", "case-1", "judge", "new-case-1"))).not.toBeNull();
        expect(
            validateHumanBenchRating({ ...rating("r1", "case-1", "judge", "new-case-1"), confidence: 2 }),
        ).toBeNull();
    });
    test("keeps connected tracks and artists in one leakage-safe split", () => {
        const assigned = assignLeakageSafeSplits([benchCase("a", "shared-track"), benchCase("b", "shared-track")]);
        expect(assigned[0]?.split).toBe(assigned[1]?.split);
        expect(detectHumanBenchLeakage(assigned)).toEqual([]);
    });
    test("detects manually introduced cross-split leakage", () => {
        expect(
            detectHumanBenchLeakage([
                { ...benchCase("a", "shared"), split: "train" },
                { ...benchCase("b", "shared"), split: "test" },
            ]),
        ).toEqual(["track:shared"]);
    });
    test("deduplicates raters per case and rejects foreign variants", () => {
        const item = benchCase("a");
        const report = buildHumanBenchReport(
            [item],
            [
                rating("1", "a", "same", "new-a"),
                rating("2", "a", "same", "old-a"),
                rating("3", "a", "other", "foreign"),
            ],
        );
        expect(report.ratings).toBe(1);
        expect(report.preferenceByVariant["new-a"]?.wins).toBe(1);
        expect(report.duplicateRatingsRemoved).toBe(1);
        expect(report.invalidRatingsRemoved).toBe(1);
    });
    test("counts an idempotently submitted preview case only once", () => {
        const item = benchCase("a");
        expect(buildHumanBenchReport([item, { ...item, createdAtMs: 2 }], []).cases).toBe(1);
    });
    test("keeps expert diagnosis separate from listener preference", () => {
        const report = buildHumanBenchReport(
            [benchCase("a")],
            [rating("1", "a", "listener", "new-a"), rating("2", "a", "expert", "old-a", "dj")],
        );
        expect(report.listenerRatings).toBe(1);
        expect(report.expertRatings).toBe(1);
        expect(report.expertListenerAgreement).toBe(0);
    });
    test("aggregates pair-specific variants into strategies with uncertainty", () => {
        const cases = Array.from({ length: 30 }, (_, index) => benchCase(`case-${index}`));
        const ratings = cases.map((item, index) =>
            rating(`rating-${index}`, item.id, `listener-${index % 10}`, item.variantIds[1]),
        );
        const report = buildHumanBenchReport(cases, ratings);
        expect(report.preferenceByStrategy.blend).toMatchObject({
            wins: 30,
            ties: 0,
            comparisons: 30,
            preferenceRate: 1,
        });
        expect(report.preferenceByStrategy.blend?.preferenceInterval95.low).toBeGreaterThan(0.8);
        expect(report.evidence.topStrategy).toBe("blend");
        expect(report.evidence.preferenceLift).toBe(0.5);
        expect(report.scoreSummary.naturalness).toMatchObject({ mean: 0.8, samples: 30 });
    });
    test("counts no-preference responses as ties instead of losses", () => {
        const item = benchCase("tie");
        const tied = { ...rating("tie-rating", item.id, "listener", item.variantIds[0]), preferredVariantId: null };
        const report = buildHumanBenchReport([item], [tied]);
        expect(report.preferenceByStrategy.fade).toMatchObject({ ties: 1, preferenceRate: 0.5 });
        expect(report.preferenceByStrategy.blend).toMatchObject({ ties: 1, preferenceRate: 0.5 });
    });
    test("does not fake a strategy preference when both variants use the same strategy", () => {
        const item = { ...benchCase("same"), variantStrategies: ["fade", "fade"] as const };
        const report = buildHumanBenchReport([item], [rating("same-rating", item.id, "listener", item.variantIds[1])]);
        expect(report.preferenceByStrategy).toEqual({});
        expect(report.evidence.topStrategy).toBeNull();
    });
    test("selects shadow disagreements instead of random easy cases", () => {
        expect(
            selectShadowDisagreements(
                [
                    { id: "easy", productionScore: 0.5, shadowScores: [0.51] },
                    { id: "hard", productionScore: 0.1, shadowScores: [0.9] },
                ],
                1,
            )[0]?.id,
        ).toBe("hard");
    });
    test("blocks promotion without sufficient independent evidence", () => {
        const report = buildHumanBenchReport([benchCase("a")], [rating("1", "a", "listener", "new-a")]);
        expect(
            humanBenchPromotionGate({
                report,
                candidateVariantId: "new-a",
                minimumRatings: 10,
                minimumRaters: 5,
                minimumPreferenceRate: 0.6,
            }),
        ).toEqual({ promote: false, reasons: ["insufficient-ratings", "insufficient-raters"] });
    });
});
