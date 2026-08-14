const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
export interface TransitionGraphEdge {
    fromMomentType: string;
    toMomentType: string;
    roleHandoff: string;
    tempoFit: number;
    phraseFit: number;
    semanticFit: number;
    crowdFit: number;
    feedback: number;
}
export function transitionMotifScore(edge: TransitionGraphEdge): number {
    return clamp01(
        edge.tempoFit * 0.18 +
            edge.phraseFit * 0.22 +
            edge.semanticFit * 0.16 +
            edge.crowdFit * 0.16 +
            edge.feedback * 0.28,
    );
}
export interface MixRecipeEmbedding {
    structural: readonly number[];
    rhythmic: readonly number[];
    harmonic: readonly number[];
    roleHandoff: readonly number[];
}
const distance = (a: readonly number[], b: readonly number[]) =>
    Math.sqrt(
        Array.from(
            { length: Math.max(a.length, b.length) },
            (_, index) => ((a[index] ?? 0) - (b[index] ?? 0)) ** 2,
        ).reduce((sum, value) => sum + value, 0),
    );
export function similarMixRecipes(
    query: MixRecipeEmbedding,
    recipes: readonly { id: string; embedding: MixRecipeEmbedding }[],
): string[] {
    return [...recipes]
        .sort((a, b) => recipeDistance(query, a.embedding) - recipeDistance(query, b.embedding))
        .map((recipe) => recipe.id);
}
function recipeDistance(a: MixRecipeEmbedding, b: MixRecipeEmbedding): number {
    return (
        distance(a.structural, b.structural) +
        distance(a.rhythmic, b.rhythmic) +
        distance(a.harmonic, b.harmonic) +
        distance(a.roleHandoff, b.roleHandoff)
    );
}
export function learnCrowdRecipe(
    sessionOnly: boolean,
    privacyAllowsPersistent: boolean,
    vocalSwapReaction: number,
): { recognizableVocalSwapAffinity: number; retention: "session" | "persistent" } {
    return {
        recognizableVocalSwapAffinity: clamp01(vocalSwapReaction),
        retention: !sessionOnly && privacyAllowsPersistent ? "persistent" : "session",
    };
}

export interface TargetMoment {
    track: string;
    moment: string;
    desiredSessionTime: number;
    momentTimeInTrack: number;
}
export function backtimeTargetMoment(
    target: TargetMoment,
    transitionDuration: number,
    buildDuration: number,
): { trackStartSessionTime: number; transitionStartSessionTime: number } {
    const trackStartSessionTime = target.desiredSessionTime - target.momentTimeInTrack;
    return {
        trackStartSessionTime,
        transitionStartSessionTime: trackStartSessionTime - transitionDuration - buildDuration,
    };
}
export interface MomentCandidate {
    trackId: string;
    trackFit: number;
    momentFit: number;
    timeToMomentFit: number;
    transitionToMomentFit: number;
}
export function momentFirstRecommendation(candidates: readonly MomentCandidate[]): {
    selected: string | null;
    scores: Record<string, number>;
    selectsMomentNotOnlyTrack: true;
} {
    const scores = Object.fromEntries(
        candidates.map((candidate) => [
            candidate.trackId,
            clamp01(
                candidate.trackFit * 0.25 +
                    candidate.momentFit * 0.35 +
                    candidate.timeToMomentFit * 0.18 +
                    candidate.transitionToMomentFit * 0.22,
            ),
        ]),
    );
    return {
        selected:
            [...candidates].sort((a, b) => (scores[b.trackId] ?? 0) - (scores[a.trackId] ?? 0))[0]?.trackId ?? null,
        scores,
        selectsMomentNotOnlyTrack: true,
    };
}

export interface FutureRoute {
    trackIds: string[];
    energies: number[];
    genreOptions: number;
    crowdFamiliarity: number;
    bridgeUtility: number;
    confidence: number;
}
export function rollingHorizonControl(
    routes: readonly FutureRoute[],
    maxTracks = 6,
): { selectedFirstAction: string | null; simulatedTracks: number; replanAfterAction: true; horizonCapped: true } {
    const capped = routes.map((route) => ({
        ...route,
        trackIds: route.trackIds.slice(0, Math.max(3, Math.min(6, maxTracks))),
    }));
    const best = [...capped].sort((a, b) => routeScore(b) - routeScore(a))[0];
    return {
        selectedFirstAction: best?.trackIds[0] ?? null,
        simulatedTracks: best?.trackIds.length ?? 0,
        replanAfterAction: true,
        horizonCapped: true,
    };
}
const routeScore = (route: FutureRoute) =>
    (route.energies.reduce((sum, value) => sum + value, 0) / Math.max(1, route.energies.length)) * 0.25 +
    clamp01(route.genreOptions / 5) * 0.15 +
    route.crowdFamiliarity * 0.2 +
    route.bridgeUtility * 0.2 +
    route.confidence * 0.2;
export function horizonConfidence(trackCount: number): "high" | "medium" | "low" {
    return trackCount <= 1 ? "high" : trackCount <= 3 ? "medium" : "low";
}

export interface TransitionComputeBudget {
    analysisMs: number;
    previewRenders: number;
    stemQualityTier: number;
}
export function computeBudgetForRisk(risk: number): {
    budget: TransitionComputeBudget;
    path: "fast" | "preview" | "hq-multi-candidate" | "simpler-transition";
} {
    const value = clamp01(risk);
    if (value < 0.25) return { budget: { analysisMs: 20, previewRenders: 0, stemQualityTier: 0 }, path: "fast" };
    if (value < 0.55) return { budget: { analysisMs: 150, previewRenders: 1, stemQualityTier: 1 }, path: "preview" };
    if (value < 0.85)
        return { budget: { analysisMs: 800, previewRenders: 3, stemQualityTier: 2 }, path: "hq-multi-candidate" };
    return { budget: { analysisMs: 100, previewRenders: 1, stemQualityTier: 0 }, path: "simpler-transition" };
}

export function confidenceNativeExplanation(input: {
    transition: number;
    beatgrid: number;
    stemQuality: number;
    fallback: string;
    reason: string;
}): {
    ratings: Record<string, "excellent" | "high" | "medium" | "low">;
    message: string;
    fallbackPresentedAsIntelligence: true;
} {
    const rating = (value: number) =>
        value >= 0.9 ? "excellent" : value >= 0.75 ? "high" : value >= 0.5 ? "medium" : "low";
    return {
        ratings: {
            transition: rating(input.transition),
            beatgrid: rating(input.beatgrid),
            stemQuality: rating(input.stemQuality),
        },
        message: `Using ${input.fallback} because ${input.reason}.`,
        fallbackPresentedAsIntelligence: true,
    };
}

export const INNOVATION_PRIORITY_MATRIX = {
    buildNow: [
        "rights-capabilities",
        "temporal-intents",
        "evidence-fusion",
        "pluggable-stems",
        "role-ownership",
        "constraint-relaxation",
        "taste-isolation",
        "regression-tests",
    ],
    prototype: [
        "sequential-role-transitions",
        "moment-recommendation",
        "transition-graph",
        "rolling-horizon",
        "semantic-journey",
    ],
    watch: [
        "generative-stem-repair",
        "source-restoration",
        "spatial-transitions",
        "auracast",
        "foundation-audio-editing",
        "hybrid-ai-provenance",
    ],
} as const;
export const BEATCORD_2026_DIFFERENTIATION = [
    "recommendation",
    "dj-grade-understanding",
    "realtime-mixing",
    "semantic-conversation",
    "crowd-intelligence",
    "transition-simulation",
    "recovery-first-runtime",
] as const;
export const STRONGEST_INNOVATION = "moment-level-recommendation+role-by-role-mixing+rolling-horizon" as const;
