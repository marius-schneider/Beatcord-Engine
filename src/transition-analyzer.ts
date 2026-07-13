import type { TransitionTelemetryRecord } from "./transition-telemetry";

export interface TransitionTelemetryParseResult {
    records: TransitionTelemetryRecord[];
    skipped: number;
    errors: string[];
}

export interface TransitionStats {
    count: number;
    avgScore: number;
    minScore: number;
    maxScore: number;
    gradeCounts: Record<"A" | "B" | "C" | "D" | "F", number>;
    avgTimingErrorMs: number | null;
    p50AbsTimingErrorMs: number | null;
    p95AbsTimingErrorMs: number | null;
    fallbackRate: number | null;
    negativeFeedbackRate: number | null;
    cacheHitRate: number | null;
    avgRenderMs: number | null;
    p95RenderMs: number | null;
}

export interface TransitionBucketStats extends TransitionStats {
    key: string;
    label: string;
}

export interface TransitionPatternFinding {
    key: string;
    label: string;
    count: number;
    avgScore: number;
    reason: string;
}

export interface TransitionTelemetryAnalysis {
    generatedAt: string;
    totalRecords: number;
    skippedRecords: number;
    parseErrors: string[];
    timeframe: { firstMs: number; lastMs: number } | null;
    overall: TransitionStats;
    byType: TransitionBucketStats[];
    byMode: TransitionBucketStats[];
    byTempoGap: TransitionBucketStats[];
    byKeyScore: TransitionBucketStats[];
    byStretch: TransitionBucketStats[];
    fallbackReasons: TransitionBucketStats[];
    worstPatterns: TransitionPatternFinding[];
    recommendations: string[];
}

export interface TransitionTelemetryAnalysisOptions {
    minPatternRecords?: number;
}

const DEFAULT_MIN_PATTERN_RECORDS = 3;

function round(n: number, digits = 1): number {
    const f = 10 ** digits;
    return Math.round(n * f) / f;
}

function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}

function isFiniteNumber(v: unknown): v is number {
    return typeof v === "number" && Number.isFinite(v);
}

function isTelemetryRecord(v: unknown): v is TransitionTelemetryRecord {
    if (!isObject(v)) return false;
    if (v.schemaVersion !== 1) return false;
    if (typeof v.transitionType !== "string") return false;
    if (!isObject(v.current) || !isObject(v.next) || !isObject(v.execution) || !isObject(v.quality)) return false;
    return isFiniteNumber(v.atMs) && isFiniteNumber(v.timingErrorMs) && isFiniteNumber(v.quality.score);
}

function percentile(values: number[], p: number): number | null {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return round(sorted[i]!);
}

function avg(values: number[]): number | null {
    if (!values.length) return null;
    return round(values.reduce((sum, n) => sum + n, 0) / values.length);
}

function ratio(part: number, total: number): number | null {
    if (total <= 0) return null;
    return round(part / total, 3);
}

function emptyGradeCounts(): TransitionStats["gradeCounts"] {
    return { A: 0, B: 0, C: 0, D: 0, F: 0 };
}

function stats(records: TransitionTelemetryRecord[]): TransitionStats {
    if (!records.length) {
        return {
            count: 0,
            avgScore: 0,
            minScore: 0,
            maxScore: 0,
            gradeCounts: emptyGradeCounts(),
            avgTimingErrorMs: null,
            p50AbsTimingErrorMs: null,
            p95AbsTimingErrorMs: null,
            fallbackRate: null,
            negativeFeedbackRate: null,
            cacheHitRate: null,
            avgRenderMs: null,
            p95RenderMs: null,
        };
    }
    const scores = records.map((r) => r.quality.score);
    const gradeCounts = emptyGradeCounts();
    for (const r of records) gradeCounts[r.quality.grade]++;
    const cacheKnown = records.filter((r) => typeof r.execution.cacheHit === "boolean");
    const renderMs = records
        .map((r) => r.execution.renderMs)
        .filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0);
    return {
        count: records.length,
        avgScore: avg(scores) ?? 0,
        minScore: round(Math.min(...scores)),
        maxScore: round(Math.max(...scores)),
        gradeCounts,
        avgTimingErrorMs: avg(records.map((r) => r.timingErrorMs)),
        p50AbsTimingErrorMs: percentile(
            records.map((r) => Math.abs(r.timingErrorMs)),
            50,
        ),
        p95AbsTimingErrorMs: percentile(
            records.map((r) => Math.abs(r.timingErrorMs)),
            95,
        ),
        fallbackRate: ratio(records.filter((r) => r.execution.mode === "fallback").length, records.length),
        negativeFeedbackRate: ratio(
            records.filter((r) => r.userFeedback?.kind === "early-skip").length,
            records.length,
        ),
        cacheHitRate: ratio(cacheKnown.filter((r) => r.execution.cacheHit === true).length, cacheKnown.length),
        avgRenderMs: avg(renderMs),
        p95RenderMs: percentile(renderMs, 95),
    };
}

function bucket(
    records: TransitionTelemetryRecord[],
    keyFn: (record: TransitionTelemetryRecord) => { key: string; label: string },
): TransitionBucketStats[] {
    const groups = new Map<string, { label: string; records: TransitionTelemetryRecord[] }>();
    for (const record of records) {
        const { key, label } = keyFn(record);
        const group = groups.get(key) ?? { label, records: [] };
        group.records.push(record);
        groups.set(key, group);
    }
    return [...groups.entries()]
        .map(([key, group]) => ({ key, label: group.label, ...stats(group.records) }))
        .sort((a, b) => b.count - a.count || a.avgScore - b.avgScore || a.label.localeCompare(b.label));
}

function tempoBucket(gap: number | null): { key: string; label: string } {
    if (gap === null) return { key: "tempo:unknown", label: "tempo unknown" };
    if (gap <= 2) return { key: "tempo:0-2", label: "tempo gap 0-2%" };
    if (gap <= 6) return { key: "tempo:2-6", label: "tempo gap 2-6%" };
    if (gap <= 8) return { key: "tempo:6-8", label: "tempo gap 6-8%" };
    if (gap <= 12) return { key: "tempo:8-12", label: "tempo gap 8-12%" };
    if (gap <= 18) return { key: "tempo:12-18", label: "tempo gap 12-18%" };
    return { key: "tempo:18+", label: "tempo gap 18%+" };
}

function keyBucket(score: number | null): { key: string; label: string } {
    if (score === null) return { key: "key:unknown", label: "key unknown/unreliable" };
    if (score >= 0.7) return { key: "key:compatible", label: "key compatible" };
    if (score >= 0.4) return { key: "key:borderline", label: "key borderline" };
    return { key: "key:clash", label: "key clash" };
}

function stretchBucket(record: TransitionTelemetryRecord): { key: string; label: string } {
    const pct = Math.max(Math.abs(record.tempoRatio - 1), Math.abs(record.outgoingTempoRatio - 1)) * 100;
    if (pct <= 2) return { key: "stretch:0-2", label: "stretch 0-2%" };
    if (pct <= 5) return { key: "stretch:2-5", label: "stretch 2-5%" };
    if (pct <= 8) return { key: "stretch:5-8", label: "stretch 5-8%" };
    if (pct <= 12) return { key: "stretch:8-12", label: "stretch 8-12%" };
    return { key: "stretch:12+", label: "stretch 12%+" };
}

function patternBuckets(records: TransitionTelemetryRecord[]): TransitionBucketStats[] {
    return [
        ...bucket(records, (r) => {
            const tempo = tempoBucket(r.tempoGapPct);
            return {
                key: `type-tempo:${r.transitionType}:${tempo.key}`,
                label: `${r.transitionType} + ${tempo.label}`,
            };
        }),
        ...bucket(records, (r) => {
            const key = keyBucket(r.keyScore);
            return { key: `type-key:${r.transitionType}:${key.key}`, label: `${r.transitionType} + ${key.label}` };
        }),
        ...bucket(records, (r) => {
            const stretch = stretchBucket(r);
            return {
                key: `type-stretch:${r.transitionType}:${stretch.key}`,
                label: `${r.transitionType} + ${stretch.label}`,
            };
        }),
    ];
}

function reasonForPattern(bucketStats: TransitionBucketStats): string {
    if (bucketStats.p95AbsTimingErrorMs !== null && bucketStats.p95AbsTimingErrorMs > 150) {
        return `p95 timing error ${bucketStats.p95AbsTimingErrorMs}ms`;
    }
    if ((bucketStats.fallbackRate ?? 0) >= 0.25)
        return `fallback rate ${Math.round((bucketStats.fallbackRate ?? 0) * 100)}%`;
    return `average score ${bucketStats.avgScore}`;
}

function findings(records: TransitionTelemetryRecord[], minRecords: number): TransitionPatternFinding[] {
    return patternBuckets(records)
        .filter((b) => b.count >= minRecords && b.avgScore < 78)
        .sort((a, b) => a.avgScore - b.avgScore || b.count - a.count)
        .slice(0, 8)
        .map((b) => ({
            key: b.key,
            label: b.label,
            count: b.count,
            avgScore: b.avgScore,
            reason: reasonForPattern(b),
        }));
}

function recommendations(analysis: Omit<TransitionTelemetryAnalysis, "recommendations">): string[] {
    if (!analysis.totalRecords) {
        return [
            "No transition telemetry yet. Let Automix run with at least 10-20 transitions, then re-run this report.",
        ];
    }
    const out: string[] = [];
    const overall = analysis.overall;
    if ((overall.fallbackRate ?? 0) > 0.2) {
        const reason = analysis.fallbackReasons[0]?.label;
        out.push(
            reason
                ? `Offline fallback rate is high (${Math.round((overall.fallbackRate ?? 0) * 100)}%); inspect ${reason} first.`
                : `Offline fallback rate is high (${Math.round((overall.fallbackRate ?? 0) * 100)}%); inspect render deadlines and cache warmup.`,
        );
    }
    if ((overall.p95AbsTimingErrorMs ?? 0) > 150) {
        out.push(`Transition timing p95 is ${overall.p95AbsTimingErrorMs}ms; tighten scheduler lead/handoff timing.`);
    }
    if ((overall.negativeFeedbackRate ?? 0) > 0.12) {
        out.push(
            `Early-skip feedback is ${Math.round((overall.negativeFeedbackRate ?? 0) * 100)}%; down-rank the affected transition patterns and inspect source quality.`,
        );
    }
    if (overall.cacheHitRate !== null && overall.cacheHitRate < 0.35) {
        out.push(
            `Offline cache hit rate is ${Math.round(overall.cacheHitRate * 100)}%; keep warming renders even after timeout and consider a longer lead.`,
        );
    }
    const weakType = analysis.byType.find((b) => b.count >= 3 && b.avgScore < 75);
    if (weakType)
        out.push(
            `${weakType.label} is underperforming (avg ${weakType.avgScore}); down-rank it until more data improves.`,
        );
    const weakTempo = analysis.byTempoGap.find((b) => b.count >= 3 && b.avgScore < 75 && b.key !== "tempo:unknown");
    if (weakTempo)
        out.push(
            `${weakTempo.label} is weak (avg ${weakTempo.avgScore}); prefer cuts/spinbacks or shorter fades in that bucket.`,
        );
    const weakKey = analysis.byKeyScore.find((b) => b.count >= 3 && b.avgScore < 75 && b.key === "key:clash");
    if (weakKey)
        out.push("Key-clash transitions are weak; prefer filter/gate/echo masks or avoid long harmonic blends.");
    const fallback = analysis.fallbackReasons[0];
    if (fallback && fallback.count >= 2)
        out.push(`Most common fallback reason: ${fallback.label} (${fallback.count}x).`);
    if (!out.length)
        out.push(
            "Telemetry looks healthy. Next step: add user feedback signals (skip/downvote/replay) to bias candidate scoring.",
        );
    return out;
}

export function parseTransitionTelemetryJsonl(text: string): TransitionTelemetryParseResult {
    const records: TransitionTelemetryRecord[] = [];
    const errors: string[] = [];
    let skipped = 0;
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!.trim();
        if (!line) continue;
        try {
            const parsed = JSON.parse(line) as unknown;
            if (isTelemetryRecord(parsed)) records.push(parsed);
            else {
                skipped++;
                errors.push(`line ${i + 1}: not a transition telemetry v1 record`);
            }
        } catch (err) {
            skipped++;
            errors.push(`line ${i + 1}: ${(err as Error).message}`);
        }
    }
    return { records, skipped, errors };
}

export function analyzeTransitionTelemetry(
    records: TransitionTelemetryRecord[],
    parse: Pick<TransitionTelemetryParseResult, "skipped" | "errors"> = { skipped: 0, errors: [] },
    options: TransitionTelemetryAnalysisOptions = {},
): TransitionTelemetryAnalysis {
    const sorted = [...records].sort((a, b) => a.atMs - b.atMs);
    const minPatternRecords = options.minPatternRecords ?? (records.length < 10 ? 1 : DEFAULT_MIN_PATTERN_RECORDS);
    const base = {
        generatedAt: new Date().toISOString(),
        totalRecords: records.length,
        skippedRecords: parse.skipped,
        parseErrors: parse.errors.slice(0, 20),
        timeframe: sorted.length ? { firstMs: sorted[0]!.atMs, lastMs: sorted[sorted.length - 1]!.atMs } : null,
        overall: stats(records),
        byType: bucket(records, (r) => ({ key: `type:${r.transitionType}`, label: r.transitionType })),
        byMode: bucket(records, (r) => ({ key: `mode:${r.execution.mode}`, label: r.execution.mode })),
        byTempoGap: bucket(records, (r) => tempoBucket(r.tempoGapPct)),
        byKeyScore: bucket(records, (r) => keyBucket(r.keyScore)),
        byStretch: bucket(records, stretchBucket),
        fallbackReasons: bucket(
            records.filter((r) => !!r.execution.fallbackReason),
            (r) => ({
                key: `fallback:${r.execution.fallbackReason}`,
                label: r.execution.fallbackReason ?? "unknown",
            }),
        ),
        worstPatterns: findings(records, minPatternRecords),
    };
    return { ...base, recommendations: recommendations(base) };
}

function pct(rate: number | null): string {
    return rate === null ? "n/a" : `${Math.round(rate * 100)}%`;
}

function ms(n: number | null): string {
    return n === null ? "n/a" : `${Math.round(n)}ms`;
}

function lineForBucket(b: TransitionBucketStats): string {
    return `- ${b.label}: ${b.count}x, avg ${b.avgScore}, p95 timing ${ms(b.p95AbsTimingErrorMs)}, fallback ${pct(
        b.fallbackRate,
    )}`;
}

export function formatTransitionTelemetryAnalysis(a: TransitionTelemetryAnalysis): string {
    const lines = [
        "Beatcord Transition Telemetry Report",
        "",
        `Records: ${a.totalRecords}${a.skippedRecords ? ` (${a.skippedRecords} skipped)` : ""}`,
    ];
    if (a.timeframe) {
        lines.push(
            `Window: ${new Date(a.timeframe.firstMs).toISOString()} -> ${new Date(a.timeframe.lastMs).toISOString()}`,
        );
    }
    lines.push(
        "",
        "Overall:",
        `- avg score: ${a.overall.avgScore} (${a.overall.gradeCounts.A} A / ${a.overall.gradeCounts.B} B / ${a.overall.gradeCounts.C} C / ${a.overall.gradeCounts.D} D / ${a.overall.gradeCounts.F} F)`,
        `- timing: p50 ${ms(a.overall.p50AbsTimingErrorMs)}, p95 ${ms(a.overall.p95AbsTimingErrorMs)}`,
        `- fallback: ${pct(a.overall.fallbackRate)}, early skip: ${pct(a.overall.negativeFeedbackRate)}, cache hit: ${pct(a.overall.cacheHitRate)}`,
        `- render: avg ${ms(a.overall.avgRenderMs)}, p95 ${ms(a.overall.p95RenderMs)}`,
        "",
        "By Transition Type:",
    );
    lines.push(...(a.byType.length ? a.byType.map(lineForBucket) : ["- none"]));
    lines.push("", "By Execution Mode:");
    lines.push(...(a.byMode.length ? a.byMode.map(lineForBucket) : ["- none"]));
    lines.push("", "Weak Patterns:");
    lines.push(
        ...(a.worstPatterns.length
            ? a.worstPatterns.map((p) => `- ${p.label}: ${p.count}x, avg ${p.avgScore} (${p.reason})`)
            : ["- none yet"]),
    );
    lines.push("", "Recommendations:");
    lines.push(...a.recommendations.map((r) => `- ${r}`));
    if (a.parseErrors.length) {
        lines.push("", "Parse Notes:");
        lines.push(...a.parseErrors.slice(0, 5).map((e) => `- ${e}`));
    }
    return lines.join("\n");
}
