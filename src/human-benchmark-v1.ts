import { hashDirectorInput } from "./music-director";

const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function wilson(successes: number, total: number): { low: number; high: number } {
    if (!total) return { low: 0, high: 1 };
    const z = 1.96;
    const probability = successes / total;
    const denominator = 1 + (z * z) / total;
    const center = (probability + (z * z) / (2 * total)) / denominator;
    const margin =
        (z / denominator) * Math.sqrt((probability * (1 - probability)) / total + (z * z) / (4 * total * total));
    return { low: round(clamp01(center - margin)), high: round(clamp01(center + margin)) };
}

function meanSummary(values: readonly number[]): HumanBenchMeanSummaryV1 {
    if (!values.length) return { mean: 0, interval95: { low: 0, high: 1 }, samples: 0 };
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance =
        values.length > 1 ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1) : 0;
    const margin = values.length > 1 ? 1.96 * Math.sqrt(variance / values.length) : 0.5;
    return {
        mean: round(mean),
        interval95: { low: round(clamp01(mean - margin)), high: round(clamp01(mean + margin)) },
        samples: values.length,
    };
}

export type HumanBenchSplitV1 = "train" | "validation" | "test";
export type HumanBenchExpertiseV1 = "casual-listener" | "music-enthusiast" | "dj" | "mix-engineer";

export interface HumanBenchCaseV1 {
    version: 1;
    id: string;
    createdAtMs: number;
    fromTrackRef: string;
    toTrackRef: string;
    artistRefs: readonly string[];
    genrePair: string;
    transitionPairRef: string;
    context: string;
    device: string;
    variantIds: readonly [string, string];
    /** Non-identifying transition families aligned with variantIds. */
    variantStrategies?: readonly [string, string];
    split?: HumanBenchSplitV1;
}

export interface HumanBenchRatingV1 {
    version: 1;
    id: string;
    atMs: number;
    caseId: string;
    raterHash: string;
    expertise: HumanBenchExpertiseV1;
    preferredVariantId: string | null;
    confidence: number;
    naturalness: number;
    technicalQuality: number;
    journeyFit: number;
}

export interface HumanBenchReportV1 {
    version: 1;
    cases: number;
    ratings: number;
    uniqueRaters: number;
    listenerRatings: number;
    expertRatings: number;
    preferenceByVariant: Record<string, HumanBenchPreferenceSummaryV1>;
    preferenceByStrategy: Record<string, HumanBenchPreferenceSummaryV1>;
    expertListenerAgreement: number | null;
    splitCounts: Record<HumanBenchSplitV1, number>;
    leakageKeys: string[];
    duplicateRatingsRemoved: number;
    invalidRatingsRemoved: number;
    scoreSummary: Record<"naturalness" | "technicalQuality" | "journeyFit", HumanBenchMeanSummaryV1>;
    evidence: HumanBenchEvidenceV1;
}

export interface HumanBenchPreferenceSummaryV1 {
    wins: number;
    ties: number;
    comparisons: number;
    preferenceRate: number;
    preferenceInterval95: { low: number; high: number };
    meanConfidence: number;
}

export interface HumanBenchMeanSummaryV1 {
    mean: number;
    interval95: { low: number; high: number };
    samples: number;
}

export interface HumanBenchEvidenceV1 {
    status: "collecting" | "directional" | "promotion-ready";
    ratedCases: number;
    ratedCaseCoverage: number;
    topStrategy: string | null;
    topStrategyPreferenceRate: number | null;
    topStrategyInterval95: { low: number; high: number } | null;
    preferenceLift: number | null;
    reasons: string[];
}

const EXPERTISE = new Set<HumanBenchExpertiseV1>(["casual-listener", "music-enthusiast", "dj", "mix-engineer"]);

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function validateHumanBenchCase(value: unknown): HumanBenchCaseV1 | null {
    if (typeof value !== "object" || value === null) return null;
    const item = value as Partial<HumanBenchCaseV1>;
    if (
        item.version !== 1 ||
        typeof item.id !== "string" ||
        !/^[a-zA-Z0-9:_-]{1,256}$/.test(item.id) ||
        !isFiniteNumber(item.createdAtMs) ||
        item.createdAtMs < 0 ||
        typeof item.fromTrackRef !== "string" ||
        !item.fromTrackRef ||
        item.fromTrackRef.length > 256 ||
        typeof item.toTrackRef !== "string" ||
        !item.toTrackRef ||
        item.toTrackRef.length > 256 ||
        !Array.isArray(item.artistRefs) ||
        item.artistRefs.length > 8 ||
        !item.artistRefs.every((ref) => typeof ref === "string" && ref.length > 0 && ref.length <= 256) ||
        typeof item.genrePair !== "string" ||
        !item.genrePair.trim() ||
        item.genrePair.length > 128 ||
        typeof item.transitionPairRef !== "string" ||
        !item.transitionPairRef ||
        item.transitionPairRef.length > 256 ||
        typeof item.context !== "string" ||
        !item.context.trim() ||
        item.context.length > 128 ||
        typeof item.device !== "string" ||
        !item.device.trim() ||
        item.device.length > 128 ||
        !Array.isArray(item.variantIds) ||
        item.variantIds.length !== 2 ||
        !item.variantIds.every((id) => typeof id === "string" && id.length > 0) ||
        item.variantIds.some((id) => id.length > 256) ||
        item.variantIds[0] === item.variantIds[1] ||
        (item.variantStrategies !== undefined &&
            (!Array.isArray(item.variantStrategies) ||
                item.variantStrategies.length !== 2 ||
                !item.variantStrategies.every(
                    (strategy) => typeof strategy === "string" && /^[a-z][a-z0-9-]{0,63}$/.test(strategy),
                ))) ||
        (item.split !== undefined && !["train", "validation", "test"].includes(item.split))
    ) {
        return null;
    }
    return item as HumanBenchCaseV1;
}

export function validateHumanBenchRating(value: unknown): HumanBenchRatingV1 | null {
    if (typeof value !== "object" || value === null) return null;
    const item = value as Partial<HumanBenchRatingV1>;
    if (
        item.version !== 1 ||
        typeof item.id !== "string" ||
        !item.id ||
        item.id.length > 256 ||
        typeof item.caseId !== "string" ||
        !item.caseId ||
        item.caseId.length > 256 ||
        typeof item.raterHash !== "string" ||
        !item.raterHash ||
        item.raterHash.length > 256 ||
        typeof item.expertise !== "string" ||
        !EXPERTISE.has(item.expertise as HumanBenchExpertiseV1) ||
        !isFiniteNumber(item.atMs) ||
        item.atMs < 0 ||
        (item.preferredVariantId !== null &&
            (typeof item.preferredVariantId !== "string" ||
                !item.preferredVariantId ||
                item.preferredVariantId.length > 256)) ||
        ![item.confidence, item.naturalness, item.technicalQuality, item.journeyFit].every(
            (score) => isFiniteNumber(score) && score >= 0 && score <= 1,
        )
    ) {
        return null;
    }
    return item as HumanBenchRatingV1;
}

class DisjointSet {
    #parent = new Map<string, string>();
    find(value: string): string {
        const parent = this.#parent.get(value);
        if (!parent) {
            this.#parent.set(value, value);
            return value;
        }
        if (parent === value) return value;
        const root = this.find(parent);
        this.#parent.set(value, root);
        return root;
    }
    union(left: string, right: string): void {
        const a = this.find(left);
        const b = this.find(right);
        if (a !== b) this.#parent.set(b, a);
    }
}

function caseLeakageKeys(item: HumanBenchCaseV1): string[] {
    return [
        `track:${item.fromTrackRef}`,
        `track:${item.toTrackRef}`,
        ...item.artistRefs.map((artist) => `artist:${artist}`),
        `genre:${item.genrePair}`,
        `pair:${item.transitionPairRef}`,
    ];
}

/** Connected entities stay in one split, preventing track/artist/pair leakage. */
export function assignLeakageSafeSplits(cases: readonly HumanBenchCaseV1[]): HumanBenchCaseV1[] {
    const sets = new DisjointSet();
    for (const item of cases) {
        const keys = caseLeakageKeys(item);
        for (const key of keys.slice(1)) sets.union(keys[0]!, key);
    }
    const splitByRoot = new Map<string, HumanBenchSplitV1>();
    const splitFor = (root: string): HumanBenchSplitV1 => {
        const existing = splitByRoot.get(root);
        if (existing) return existing;
        const bucket = Number.parseInt(hashDirectorInput({ humanBenchComponent: root }).slice(-8), 16) % 10;
        const split: HumanBenchSplitV1 = bucket < 7 ? "train" : bucket < 9 ? "validation" : "test";
        splitByRoot.set(root, split);
        return split;
    };
    return cases.map((item) => ({ ...item, split: splitFor(sets.find(caseLeakageKeys(item)[0]!)) }));
}

export function detectHumanBenchLeakage(cases: readonly HumanBenchCaseV1[]): string[] {
    const splitsByKey = new Map<string, Set<HumanBenchSplitV1>>();
    for (const item of cases) {
        if (!item.split) continue;
        for (const key of caseLeakageKeys(item)) {
            const splits = splitsByKey.get(key) ?? new Set<HumanBenchSplitV1>();
            splits.add(item.split);
            splitsByKey.set(key, splits);
        }
    }
    return [...splitsByKey]
        .filter(([, splits]) => splits.size > 1)
        .map(([key]) => key)
        .sort();
}

export function buildHumanBenchReport(
    inputCases: readonly HumanBenchCaseV1[],
    inputRatings: readonly HumanBenchRatingV1[],
): HumanBenchReportV1 {
    const uniqueCases = [...new Map(inputCases.map((item) => [item.id, item])).values()];
    const cases = assignLeakageSafeSplits(uniqueCases);
    const caseById = new Map(cases.map((item) => [item.id, item]));
    const seen = new Set<string>();
    let duplicateRatingsRemoved = 0;
    let invalidRatingsRemoved = 0;
    const ratings = inputRatings.filter((rating) => {
        const item = caseById.get(rating.caseId);
        const duplicateKey = `${rating.caseId}:${rating.raterHash}`;
        if (!item || (rating.preferredVariantId !== null && !item.variantIds.includes(rating.preferredVariantId))) {
            invalidRatingsRemoved++;
            return false;
        }
        if (seen.has(duplicateKey)) {
            duplicateRatingsRemoved++;
            return false;
        }
        seen.add(duplicateKey);
        return true;
    });
    const preferenceByVariant: HumanBenchReportV1["preferenceByVariant"] = {};
    const preferenceByStrategy: HumanBenchReportV1["preferenceByStrategy"] = {};
    const confidenceSums = new Map<string, number>();
    const addComparison = (
        target: Record<string, HumanBenchPreferenceSummaryV1>,
        key: string,
        won: boolean,
        tied: boolean,
        confidence: number,
    ) => {
        target[key] ??= {
            wins: 0,
            ties: 0,
            comparisons: 0,
            preferenceRate: 0,
            preferenceInterval95: { low: 0, high: 1 },
            meanConfidence: 0,
        };
        const summary = target[key];
        summary.comparisons++;
        if (won) summary.wins++;
        if (tied) summary.ties++;
        const confidenceKey = target === preferenceByVariant ? `variant:${key}` : `strategy:${key}`;
        confidenceSums.set(confidenceKey, (confidenceSums.get(confidenceKey) ?? 0) + confidence);
    };
    for (const rating of ratings) {
        const item = caseById.get(rating.caseId)!;
        const distinctStrategies =
            item.variantStrategies !== undefined && item.variantStrategies[0] !== item.variantStrategies[1];
        for (const [index, variant] of item.variantIds.entries()) {
            addComparison(
                preferenceByVariant,
                variant,
                rating.preferredVariantId === variant,
                rating.preferredVariantId === null,
                rating.confidence,
            );
            const strategy = item.variantStrategies?.[index];
            if (strategy && distinctStrategies) {
                addComparison(
                    preferenceByStrategy,
                    strategy,
                    rating.preferredVariantId === variant,
                    rating.preferredVariantId === null,
                    rating.confidence,
                );
            }
        }
    }
    for (const [scope, target] of [
        ["variant", preferenceByVariant],
        ["strategy", preferenceByStrategy],
    ] as const) {
        for (const [key, summary] of Object.entries(target)) {
            const successes = summary.wins + summary.ties * 0.5;
            summary.preferenceRate = round(summary.comparisons ? successes / summary.comparisons : 0);
            summary.preferenceInterval95 = wilson(successes, summary.comparisons);
            summary.meanConfidence = round(
                summary.comparisons ? (confidenceSums.get(`${scope}:${key}`) ?? 0) / summary.comparisons : 0,
            );
        }
    }
    const experts = ratings.filter((rating) => rating.expertise === "dj" || rating.expertise === "mix-engineer");
    const listeners = ratings.filter(
        (rating) => rating.expertise === "casual-listener" || rating.expertise === "music-enthusiast",
    );
    const groupChoice = (group: readonly HumanBenchRatingV1[], caseId: string) => {
        const counts = new Map<string, number>();
        for (const rating of group.filter((item) => item.caseId === caseId && item.preferredVariantId)) {
            counts.set(rating.preferredVariantId!, (counts.get(rating.preferredVariantId!) ?? 0) + rating.confidence);
        }
        return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
    };
    const comparable = cases
        .map((item) => ({ expert: groupChoice(experts, item.id), listener: groupChoice(listeners, item.id) }))
        .filter((item) => item.expert && item.listener);
    const splitCounts = {
        train: cases.filter((item) => item.split === "train").length,
        validation: cases.filter((item) => item.split === "validation").length,
        test: cases.filter((item) => item.split === "test").length,
    };
    const leakageKeys = detectHumanBenchLeakage(cases);
    const scoreSummary = {
        naturalness: meanSummary(ratings.map((rating) => rating.naturalness)),
        technicalQuality: meanSummary(ratings.map((rating) => rating.technicalQuality)),
        journeyFit: meanSummary(ratings.map((rating) => rating.journeyFit)),
    };
    const ratedCases = new Set(ratings.map((rating) => rating.caseId)).size;
    const ratedCaseCoverage = round(cases.length ? ratedCases / cases.length : 0);
    const topStrategyEntry = Object.entries(preferenceByStrategy).sort(
        (a, b) => b[1].preferenceRate - a[1].preferenceRate || b[1].comparisons - a[1].comparisons,
    )[0];
    const reasons: string[] = [];
    if (leakageKeys.length) reasons.push("evaluation-leakage");
    if (ratings.length < 30) reasons.push("need-30-ratings");
    if (new Set(ratings.map((rating) => rating.raterHash)).size < 10) reasons.push("need-10-raters");
    if (ratedCaseCoverage < 0.6) reasons.push("case-coverage-below-60-percent");
    if (splitCounts.test < 1 || splitCounts.validation < 1) reasons.push("missing-held-out-splits");
    if (!topStrategyEntry || topStrategyEntry[1].preferenceInterval95.low <= 0.5)
        reasons.push("preference-confidence-not-proven");
    const enoughDirectionalEvidence =
        ratings.length >= 10 && new Set(ratings.map((rating) => rating.raterHash)).size >= 5;
    const evidence: HumanBenchEvidenceV1 = {
        status: reasons.length === 0 ? "promotion-ready" : enoughDirectionalEvidence ? "directional" : "collecting",
        ratedCases,
        ratedCaseCoverage,
        topStrategy: topStrategyEntry?.[0] ?? null,
        topStrategyPreferenceRate: topStrategyEntry?.[1].preferenceRate ?? null,
        topStrategyInterval95: topStrategyEntry?.[1].preferenceInterval95 ?? null,
        preferenceLift: topStrategyEntry ? round(topStrategyEntry[1].preferenceRate - 0.5) : null,
        reasons,
    };
    return {
        version: 1,
        cases: cases.length,
        ratings: ratings.length,
        uniqueRaters: new Set(ratings.map((rating) => rating.raterHash)).size,
        listenerRatings: listeners.length,
        expertRatings: experts.length,
        preferenceByVariant,
        preferenceByStrategy,
        expertListenerAgreement: comparable.length
            ? round(comparable.filter((item) => item.expert === item.listener).length / comparable.length)
            : null,
        splitCounts,
        leakageKeys,
        duplicateRatingsRemoved,
        invalidRatingsRemoved,
        scoreSummary,
        evidence,
    };
}

export function selectShadowDisagreements<
    T extends { id: string; productionScore: number; shadowScores: readonly number[] },
>(candidates: readonly T[], limit: number): T[] {
    return [...candidates]
        .map((candidate) => ({
            candidate,
            disagreement: Math.max(
                ...candidate.shadowScores.map((score) => Math.abs(score - candidate.productionScore)),
            ),
        }))
        .sort((a, b) => b.disagreement - a.disagreement || a.candidate.id.localeCompare(b.candidate.id))
        .slice(0, Math.max(0, limit))
        .map(({ candidate }) => candidate);
}

export function humanBenchPromotionGate(input: {
    report: HumanBenchReportV1;
    candidateVariantId: string;
    minimumRatings: number;
    minimumRaters: number;
    minimumPreferenceRate: number;
}): { promote: boolean; reasons: string[] } {
    const reasons: string[] = [];
    const candidate = input.report.preferenceByVariant[input.candidateVariantId];
    if (input.report.leakageKeys.length) reasons.push("evaluation-leakage");
    if (input.report.ratings < input.minimumRatings) reasons.push("insufficient-ratings");
    if (input.report.uniqueRaters < input.minimumRaters) reasons.push("insufficient-raters");
    if (!candidate || candidate.preferenceRate < input.minimumPreferenceRate)
        reasons.push("preference-gain-not-proven");
    return { promote: reasons.length === 0, reasons };
}
