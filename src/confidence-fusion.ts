/** One analyzer's opinion about a musical property. */
export interface ConfidenceEvidence<T> {
    /** Stable analyzer/metadata identifier used in diagnostics. */
    source: string;
    value: T;
    /** Calibrated probability in [0, 1]. */
    confidence: number;
    /** Optional trust multiplier for sources with different validation quality. */
    weight?: number;
    /** Correlated analyzers share a family and therefore do not double-count certainty. */
    family?: string;
}

export interface ConfidenceAlternative<T> {
    value: T;
    support: number;
    sources: string[];
}

/** Serializable audit result retained alongside the selected analyzer value. */
export interface ConfidenceFusion<T> {
    value: T | null;
    confidence: number;
    /** Share of weighted evidence supporting the winning cluster. */
    agreement: number;
    conflicted: boolean;
    sources: string[];
    evidence: ConfidenceEvidence<T>[];
    alternatives: ConfidenceAlternative<T>[];
}

export interface NumericFusionOptions {
    /** Maximum distance at which two values count as agreement. */
    tolerance: number;
    /** Makes tolerance relative to the compared values (useful for BPM). */
    relative?: boolean;
    /** Quantisation for stable serialized results. */
    precision?: number;
}

interface Cluster<T> {
    members: ConfidenceEvidence<T>[];
    support: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

function normaliseEvidence<T>(evidence: readonly ConfidenceEvidence<T>[]): ConfidenceEvidence<T>[] {
    return evidence
        .filter((item) => item.value !== null && item.value !== undefined && item.source.trim().length > 0)
        .map((item) => ({
            source: item.source,
            value: item.value,
            confidence: clamp01(item.confidence),
            ...(item.weight === undefined ? {} : { weight: Math.max(0, item.weight) }),
            ...(item.family ? { family: item.family } : {}),
        }))
        .filter((item) => item.confidence > 0 && (item.weight ?? 1) > 0);
}

function weightedSupport<T>(members: readonly ConfidenceEvidence<T>[]): number {
    return members.reduce((sum, item) => sum + item.confidence * (item.weight ?? 1), 0);
}

/**
 * Combine independent confirmations without pretending correlated analyzers are
 * separate votes. Within a family only its strongest result contributes.
 */
function independentUnion<T>(members: readonly ConfidenceEvidence<T>[]): number {
    const families = new Map<string, number>();
    for (const item of members) {
        const family = item.family ?? item.source;
        const calibrated = clamp01(item.confidence * Math.min(1, item.weight ?? 1));
        families.set(family, Math.max(families.get(family) ?? 0, calibrated));
    }
    let miss = 1;
    for (const confidence of families.values()) miss *= 1 - confidence;
    return clamp01(1 - miss);
}

function finish<T>(clusters: Cluster<T>[], evidence: ConfidenceEvidence<T>[], value: T | null): ConfidenceFusion<T> {
    const ordered = [...clusters].sort((a, b) => b.support - a.support);
    const winner = ordered[0];
    if (!winner || value === null) {
        return { value: null, confidence: 0, agreement: 0, conflicted: false, sources: [], evidence, alternatives: [] };
    }
    const total = ordered.reduce((sum, cluster) => sum + cluster.support, 0);
    const agreement = total > 0 ? winner.support / total : 0;
    // Disagreement is deliberately quadratic: two strong contradictory analyzers
    // must be reported as uncertainty, not as a narrow win for one of them.
    const confidence = independentUnion(winner.members) * agreement ** 2;
    const alternatives = ordered.map((cluster) => ({
        value: cluster.members[0]!.value,
        support: round(cluster.support / Math.max(total, 1e-9), 4),
        sources: cluster.members.map((item) => item.source),
    }));
    const runnerUp = ordered[1]?.support ?? 0;
    return {
        value,
        confidence: round(confidence, 4),
        agreement: round(agreement, 4),
        conflicted: agreement < 0.67 || runnerUp >= winner.support * 0.5,
        sources: winner.members.map((item) => item.source),
        evidence,
        alternatives,
    };
}

function round(value: number, digits: number): number {
    const scale = 10 ** digits;
    return Math.round(value * scale) / scale;
}

/** Fuse exact/categorical results such as Camelot keys or genres. */
export function fuseCategoricalEvidence<T>(
    input: readonly ConfidenceEvidence<T>[],
    identity: (value: T) => string = String,
): ConfidenceFusion<T> {
    const evidence = normaliseEvidence(input);
    const grouped = new Map<string, ConfidenceEvidence<T>[]>();
    for (const item of evidence) {
        const key = identity(item.value);
        grouped.set(key, [...(grouped.get(key) ?? []), item]);
    }
    const clusters = [...grouped.values()].map((members) => ({ members, support: weightedSupport(members) }));
    const winner = [...clusters].sort((a, b) => b.support - a.support)[0];
    return finish(clusters, evidence, winner?.members[0]?.value ?? null);
}

/** Fuse numeric estimates into the strongest agreement cluster. */
export function fuseNumericEvidence(
    input: readonly ConfidenceEvidence<number>[],
    options: NumericFusionOptions,
): ConfidenceFusion<number> {
    const evidence = normaliseEvidence(input).filter((item) => Number.isFinite(item.value));
    const close = (a: number, b: number) => {
        const distance = Math.abs(a - b);
        return options.relative
            ? distance / Math.max(Math.abs(a), Math.abs(b), 1e-9) <= options.tolerance
            : distance <= options.tolerance;
    };
    // Build a cluster around every estimate, then retain unique memberships. This
    // is stable for the small analyzer ensembles used here and avoids order bias.
    const unique = new Map<string, Cluster<number>>();
    for (const anchor of evidence) {
        const members = evidence.filter((item) => close(anchor.value, item.value));
        const key = members
            .map((item) => item.source)
            .sort()
            .join("\u0000");
        unique.set(key, { members, support: weightedSupport(members) });
    }
    const clusters = [...unique.values()];
    const winner = [...clusters].sort((a, b) => b.support - a.support)[0];
    if (!winner) return finish([], evidence, null);
    const denominator = winner.members.reduce((sum, item) => sum + item.confidence * (item.weight ?? 1), 0);
    const value =
        winner.members.reduce((sum, item) => sum + item.value * item.confidence * (item.weight ?? 1), 0) / denominator;
    return finish(clusters, evidence, round(value, options.precision ?? 3));
}

/** Maximum safe harmonic overlap when key analyzers disagree. */
export function harmonicOverlapLimit(keyConfidence: number, conflicted = false): number {
    if (conflicted || keyConfidence < 0.35) return 4;
    if (keyConfidence < 0.55) return 6;
    return Number.POSITIVE_INFINITY;
}
