const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

export interface NormalizedGenre {
    canonical: string;
    aliases: string[];
    sourceTags: { tag: string; source: string; language?: string }[];
}

function slug(value: string): string {
    return value
        .normalize("NFKD")
        .toLowerCase()
        .replace(/['’]/g, "")
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

export function normalizeGenre(input: {
    preferredCanonical: string;
    tags: readonly { tag: string; source: string; language?: string }[];
    knownAliases?: readonly string[];
}): NormalizedGenre {
    return {
        canonical: slug(input.preferredCanonical),
        aliases: [
            ...new Set([
                input.preferredCanonical,
                ...(input.knownAliases ?? []),
                ...input.tags.map((item) => item.tag),
            ]),
        ],
        sourceTags: input.tags.map((tag) => ({ ...tag })),
    };
}

export type GenreEdgeType = "is-a" | "similar-to" | "often-tagged-with" | "co-listened" | "mixes-well-with";
export interface GenreGraphEdge {
    from: string;
    to: string;
    type: GenreEdgeType;
    weight: number;
    provenance: string;
}

export class GenreGraph {
    readonly #edges: GenreGraphEdge[] = [];

    add(edge: GenreGraphEdge): void {
        this.#edges.push({ ...edge, weight: clamp01(edge.weight) });
    }

    neighbors(genre: string, types?: readonly GenreEdgeType[]): GenreGraphEdge[] {
        return this.#edges
            .filter((edge) => (edge.from === genre || edge.to === genre) && (!types || types.includes(edge.type)))
            .map((edge) => ({ ...edge }));
    }
}

export interface MixabilityEdge {
    fromTrackId: string;
    toTrackId: string;
    score: number;
    tempoFit: number;
    harmonicFit: number;
    phraseFit: number;
}

export class MixabilityGraph {
    readonly kind = "track-mixability" as const;
    readonly #edges: MixabilityEdge[] = [];

    add(edge: MixabilityEdge): void {
        this.#edges.push({ ...edge, score: clamp01(edge.score) });
    }

    between(fromTrackId: string, toTrackId: string): MixabilityEdge | null {
        const edge = this.#edges.find((item) => item.fromTrackId === fromTrackId && item.toTrackId === toTrackId);
        return edge ? { ...edge } : null;
    }
}

export interface BehavioralGenreEvidence {
    plays: number;
    skips: number;
    saves: number;
    completionRate: number;
    contextualUsage: Record<string, number>;
}

export function behavioralGenrePreference(
    evidence: BehavioralGenreEvidence,
    context?: string,
): {
    affinity: number;
    confidence: number;
    signals: Record<string, number>;
} {
    const acceptance = evidence.plays > 0 ? 1 - evidence.skips / evidence.plays : 0.5;
    const saveRate = evidence.saves / Math.max(1, evidence.plays);
    const contextUsage = context ? clamp01(evidence.contextualUsage[context] ?? 0) : 0.5;
    const affinity =
        acceptance * 0.3 + clamp01(saveRate * 3) * 0.2 + clamp01(evidence.completionRate) * 0.3 + contextUsage * 0.2;
    return {
        affinity: round(clamp01(affinity)),
        confidence: round(clamp01(1 - Math.exp(-Math.max(0, evidence.plays) / 12))),
        signals: {
            acceptance: round(clamp01(acceptance)),
            saveRate: round(clamp01(saveRate)),
            completion: round(clamp01(evidence.completionRate)),
            contextUsage: round(contextUsage),
        },
    };
}

export interface GenreMoodEvaluation {
    genre: string;
    sampleSize: number;
    valenceError: number;
    arousalError: number;
}

export function assessMoodGenreBias(
    evaluations: readonly GenreMoodEvaluation[],
    targetGenre: string,
): { confidenceMultiplier: number; genreDominanceRisk: number; requiresCrossGenreValidation: boolean } {
    const total = evaluations.reduce((sum, evaluation) => sum + evaluation.sampleSize, 0);
    const largestShare = total ? Math.max(...evaluations.map((evaluation) => evaluation.sampleSize / total)) : 1;
    const target = evaluations.find((evaluation) => evaluation.genre === targetGenre);
    const error = target ? (target.valenceError + target.arousalError) / 2 : 1;
    return {
        confidenceMultiplier: round(clamp01((target ? 1 - error : 0.25) * (1 - Math.max(0, largestShare - 0.5) * 0.6))),
        genreDominanceRisk: round(clamp01(largestShare)),
        requiresCrossGenreValidation: !target || largestShare > 0.65 || error > 0.3,
    };
}

export interface PopularityPerception {
    catalogPopularity: number;
    perceivedFamiliarity: number;
}

export function sessionPlanningPopularity(
    input: PopularityPerception,
    goal: "singalong" | "discovery" | "neutral",
): {
    score: number;
    familiarityWeight: number;
    popularityWeight: number;
} {
    const familiarityWeight = goal === "singalong" ? 0.85 : goal === "discovery" ? 0.55 : 0.7;
    const popularityWeight = 1 - familiarityWeight;
    return {
        score: round(
            clamp01(input.perceivedFamiliarity) * familiarityWeight +
                clamp01(input.catalogPopularity) * popularityWeight,
        ),
        familiarityWeight,
        popularityWeight,
    };
}

export interface ChartRetrievalPrior {
    source: "chart";
    retrievalBoost: number;
    finalRankingAuthority: false;
    requiresPersonalAndSessionScoring: true;
}

export function chartAsWeakPrior(chartConfidence: number): ChartRetrievalPrior {
    return {
        source: "chart",
        retrievalBoost: round(clamp01(chartConfidence) * 0.2),
        finalRankingAuthority: false,
        requiresPersonalAndSessionScoring: true,
    };
}

export interface TrendObservation {
    atMs: number;
    listeners: number;
}

export interface TrendState {
    momentum: number;
    acceleration: number;
    sampleSize: number;
    confidence: number;
}

export function estimateTrendState(observations: readonly TrendObservation[]): TrendState {
    const sorted = [...observations].sort((a, b) => a.atMs - b.atMs);
    if (sorted.length < 2)
        return {
            momentum: 0,
            acceleration: 0,
            sampleSize: sorted.reduce((sum, item) => sum + item.listeners, 0),
            confidence: 0,
        };
    const changes = sorted
        .slice(1)
        .map((item, index) => (item.listeners - sorted[index]!.listeners) / Math.max(1, sorted[index]!.listeners));
    const momentum = changes.reduce((sum, change) => sum + change, 0) / changes.length;
    const acceleration =
        changes.length > 1
            ? changes.slice(1).reduce((sum, change, index) => sum + change - changes[index]!, 0) / (changes.length - 1)
            : 0;
    const sampleSize = sorted.reduce((sum, item) => sum + Math.max(0, item.listeners), 0);
    return {
        momentum: round(momentum),
        acceleration: round(acceleration),
        sampleSize,
        confidence: round(clamp01(1 - Math.exp(-sampleSize / 100))),
    };
}

export interface BayesianTrendEstimate {
    posteriorGrowth: number;
    credibleInterval: [number, number];
    confidence: number;
    rawGrowth: number;
    priorStrength: number;
}

export function bayesianTrendModel(
    previousListeners: number,
    currentListeners: number,
    priorStrength = 50,
): BayesianTrendEstimate {
    const previous = Math.max(0, previousListeners);
    const current = Math.max(0, currentListeners);
    const rawGrowth = (current - previous) / Math.max(1, previous);
    const sampleSize = previous + current;
    const reliability = sampleSize / Math.max(1, sampleSize + priorStrength);
    const posteriorGrowth = rawGrowth * reliability;
    const standardError = Math.sqrt(1 / (current + 1) + 1 / (previous + 1)) * reliability;
    return {
        posteriorGrowth: round(posteriorGrowth),
        credibleInterval: [
            round(posteriorGrowth - 1.96 * standardError),
            round(posteriorGrowth + 1.96 * standardError),
        ],
        confidence: round(clamp01(reliability * (1 - Math.min(1, standardError)))),
        rawGrowth: round(rawGrowth),
        priorStrength,
    };
}
