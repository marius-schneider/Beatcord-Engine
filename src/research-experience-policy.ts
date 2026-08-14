import type { ConcreteExperienceId, ExperienceSelection } from "./experience-engine";

export type IntelligenceLayer = "ml-understanding" | "deterministic-director" | "deterministic-dsp";
export type IntelligenceAction =
    | "detect-beat"
    | "detect-section"
    | "detect-mood"
    | "detect-genre"
    | "detect-vocals"
    | "create-embedding"
    | "select-track"
    | "select-transition"
    | "set-dsp-parameter"
    | "render-audio";

export interface IntelligenceBoundaryDecision {
    action: IntelligenceAction;
    layer: IntelligenceLayer;
    allowed: boolean;
    reason: string;
}

/** ML interprets music; constrained policy decides; deterministic DSP executes. */
export function enforceIntelligenceBoundary(
    action: IntelligenceAction,
    requestedLayer: IntelligenceLayer,
): IntelligenceBoundaryDecision {
    const understanding = new Set<IntelligenceAction>([
        "detect-beat",
        "detect-section",
        "detect-mood",
        "detect-genre",
        "detect-vocals",
        "create-embedding",
    ]);
    const policy = new Set<IntelligenceAction>(["select-track", "select-transition"]);
    const expected: IntelligenceLayer = understanding.has(action)
        ? "ml-understanding"
        : policy.has(action)
          ? "deterministic-director"
          : "deterministic-dsp";
    return {
        action,
        layer: requestedLayer,
        allowed: requestedLayer === expected,
        reason:
            requestedLayer === expected
                ? `${action} belongs to ${expected}`
                : `${action} must run in ${expected}, not ${requestedLayer}`,
    };
}

export type DatasetTask = "genre-mood" | "structure" | "tempo-key" | "source-separation" | "emotion" | "transition";
export type LicenseReview = "required" | "research-approved" | "commercial-approved";

export interface ResearchDataset {
    id: string;
    tasks: DatasetTask[];
    musicTypes: string[];
    licenseReview: LicenseReview;
    redistributionAllowed: boolean;
}

export const RESEARCH_DATASET_STACK: readonly ResearchDataset[] = [
    {
        id: "mtg-jamendo",
        tasks: ["genre-mood"],
        musicTypes: ["multi-genre"],
        licenseReview: "required",
        redistributionAllowed: false,
    },
    {
        id: "salami-harmonix",
        tasks: ["structure"],
        musicTypes: ["multi-genre"],
        licenseReview: "required",
        redistributionAllowed: false,
    },
    {
        id: "giantsteps",
        tasks: ["tempo-key"],
        musicTypes: ["dance", "edm"],
        licenseReview: "required",
        redistributionAllowed: false,
    },
    {
        id: "musdb18",
        tasks: ["source-separation"],
        musicTypes: ["multi-genre"],
        licenseReview: "required",
        redistributionAllowed: false,
    },
    {
        id: "deam",
        tasks: ["emotion"],
        musicTypes: ["multi-genre"],
        licenseReview: "required",
        redistributionAllowed: false,
    },
    {
        id: "beatcord-synthetic-mixes",
        tasks: ["transition"],
        musicTypes: ["synthetic", "cc-cleared"],
        licenseReview: "commercial-approved",
        redistributionAllowed: true,
    },
] as const;

export function datasetsForTask(
    task: DatasetTask,
    use: "research" | "training" | "redistribution" | "commercial",
): ResearchDataset[] {
    return RESEARCH_DATASET_STACK.filter((dataset) => {
        if (!dataset.tasks.includes(task)) return false;
        if (use === "redistribution") return dataset.redistributionAllowed;
        if (use === "commercial") return dataset.licenseReview === "commercial-approved";
        return dataset.licenseReview !== "required" || use === "research";
    });
}

export type MusicBenchmarkType =
    | "edm"
    | "house"
    | "hip-hop"
    | "pop"
    | "rock"
    | "disco"
    | "jazz"
    | "ambient"
    | "classical"
    | "live"
    | "variable-tempo"
    | "odd-meter";

export interface BenchmarkObservation {
    musicType: MusicBenchmarkType;
    correct: boolean;
    confidence: number;
}

export interface CalibrationBin {
    lower: number;
    upper: number;
    count: number;
    meanConfidence: number;
    accuracy: number;
    calibrationError: number;
}

export interface AnalyzerBenchmarkReport {
    overallAccuracy: number;
    expectedCalibrationError: number;
    brierScore: number;
    byMusicType: Partial<Record<MusicBenchmarkType, { accuracy: number; count: number; reliable: boolean }>>;
    bins: CalibrationBin[];
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

export function evaluateAnalyzerCalibration(
    observations: readonly BenchmarkObservation[],
    binCount = 10,
): AnalyzerBenchmarkReport {
    const bins: CalibrationBin[] = [];
    const safeBinCount = Math.max(2, Math.floor(binCount));
    for (let index = 0; index < safeBinCount; index++) {
        const lower = index / safeBinCount;
        const upper = (index + 1) / safeBinCount;
        const entries = observations.filter((item) => {
            const confidence = clamp01(item.confidence);
            return confidence >= lower && (index === safeBinCount - 1 ? confidence <= upper : confidence < upper);
        });
        const meanConfidence = entries.length
            ? entries.reduce((sum, item) => sum + clamp01(item.confidence), 0) / entries.length
            : 0;
        const accuracy = entries.length ? entries.filter((item) => item.correct).length / entries.length : 0;
        bins.push({
            lower,
            upper,
            count: entries.length,
            meanConfidence: round(meanConfidence),
            accuracy: round(accuracy),
            calibrationError: round(Math.abs(meanConfidence - accuracy)),
        });
    }
    const byMusicType: AnalyzerBenchmarkReport["byMusicType"] = {};
    const musicTypes = [...new Set(observations.map((item) => item.musicType))];
    for (const musicType of musicTypes) {
        const entries = observations.filter((item) => item.musicType === musicType);
        const accuracy = entries.filter((item) => item.correct).length / Math.max(1, entries.length);
        byMusicType[musicType] = {
            accuracy: round(accuracy),
            count: entries.length,
            reliable: entries.length >= 5 && accuracy >= 0.8,
        };
    }
    const overallAccuracy = observations.filter((item) => item.correct).length / Math.max(1, observations.length);
    const expectedCalibrationError =
        bins.reduce((sum, bin) => sum + bin.calibrationError * bin.count, 0) / Math.max(1, observations.length);
    const brierScore =
        observations.reduce((sum, item) => sum + (clamp01(item.confidence) - Number(item.correct)) ** 2, 0) /
        Math.max(1, observations.length);
    return {
        overallAccuracy: round(overallAccuracy),
        expectedCalibrationError: round(expectedCalibrationError),
        brierScore: round(brierScore),
        byMusicType,
        bins,
    };
}

export interface DistributionConfidenceInput {
    embeddingDistance: number;
    classifierEntropy: number;
    nearestTrainingSimilarity: number;
    analyzerAgreement: number;
}

export interface DistributionConfidence {
    inDistribution: number;
    outOfDistribution: boolean;
    manipulationMultiplier: number;
    preserveOriginal: boolean;
    reasons: string[];
}

export function assessDistributionConfidence(input: DistributionConfidenceInput): DistributionConfidence {
    const inDistribution = clamp01(
        (1 - clamp01(input.embeddingDistance)) * 0.3 +
            (1 - clamp01(input.classifierEntropy)) * 0.2 +
            clamp01(input.nearestTrainingSimilarity) * 0.3 +
            clamp01(input.analyzerAgreement) * 0.2,
    );
    const outOfDistribution = inDistribution < 0.48;
    const reasons: string[] = [];
    if (input.embeddingDistance > 0.65) reasons.push("far from training embeddings");
    if (input.classifierEntropy > 0.65) reasons.push("classifier uncertainty high");
    if (input.analyzerAgreement < 0.45) reasons.push("analyzers disagree");
    return {
        inDistribution: round(inDistribution),
        outOfDistribution,
        manipulationMultiplier: round(outOfDistribution ? inDistribution * 0.7 : 0.65 + inDistribution * 0.35),
        preserveOriginal: outOfDistribution,
        reasons,
    };
}

export interface AdvancedExperienceDimensions {
    energy: number;
    valence: number;
    tension: number;
    intimacy: number;
    groove: number;
    density: number;
    familiarity: number;
    novelty: number;
    acousticness: number;
    vocalFocus: number;
}

export const ADVANCED_EXPERIENCE_RECIPES: Record<ConcreteExperienceId, AdvancedExperienceDimensions> = {
    chill: {
        energy: 0.3,
        valence: 0.55,
        tension: 0.18,
        intimacy: 0.65,
        groove: 0.3,
        density: 0.25,
        familiarity: 0.7,
        novelty: 0.28,
        acousticness: 0.68,
        vocalFocus: 0.45,
    },
    love: {
        energy: 0.38,
        valence: 0.62,
        tension: 0.28,
        intimacy: 0.91,
        groove: 0.35,
        density: 0.38,
        familiarity: 0.76,
        novelty: 0.2,
        acousticness: 0.58,
        vocalFocus: 0.78,
    },
    energy: {
        energy: 0.76,
        valence: 0.65,
        tension: 0.62,
        intimacy: 0.25,
        groove: 0.82,
        density: 0.74,
        familiarity: 0.55,
        novelty: 0.45,
        acousticness: 0.2,
        vocalFocus: 0.5,
    },
    party: {
        energy: 0.9,
        valence: 0.72,
        tension: 0.68,
        intimacy: 0.18,
        groove: 0.94,
        density: 0.86,
        familiarity: 0.68,
        novelty: 0.4,
        acousticness: 0.12,
        vocalFocus: 0.42,
    },
};

export interface ExperienceRecipe {
    id: string;
    name: string;
    weights: Partial<Record<ConcreteExperienceId, number>>;
    smoothness: number;
    journey: "rising" | "falling" | "steady" | "wave";
    peakInMinutes?: number;
}

export function resolveExperienceRecipe(recipe: ExperienceRecipe): {
    recipe: ExperienceRecipe;
    dimensions: AdvancedExperienceDimensions;
} {
    const entries = Object.entries(recipe.weights).filter(
        (entry): entry is [ConcreteExperienceId, number] => Number.isFinite(entry[1]) && entry[1] > 0,
    );
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0) || 1;
    const dimensions = Object.fromEntries(
        Object.keys(ADVANCED_EXPERIENCE_RECIPES.chill).map((key) => [
            key,
            round(
                entries.reduce(
                    (sum, [id, weight]) =>
                        sum +
                        (ADVANCED_EXPERIENCE_RECIPES[id][key as keyof AdvancedExperienceDimensions] * weight) / total,
                    0,
                ),
            ),
        ]),
    ) as unknown as AdvancedExperienceDimensions;
    return {
        recipe: {
            ...recipe,
            smoothness: clamp01(recipe.smoothness),
            weights: Object.fromEntries(entries.map(([id, weight]) => [id, round(weight / total)])),
        },
        dimensions,
    };
}

export interface NaturalLanguageExperienceIntent {
    startExperience: ConcreteExperienceId;
    targetExperience: ConcreteExperienceId;
    transitionMinutes: number;
    energyCurve: "rising" | "falling" | "steady";
    confidence: number;
    deterministicPlan: true;
}

/** A bounded optional interpretation layer; execution after parsing stays deterministic. */
export function parseNaturalLanguageIntent(text: string): NaturalLanguageExperienceIntent {
    const normalized = text.toLowerCase();
    const mentions = (id: ConcreteExperienceId) =>
        normalized.includes(id) ||
        (id === "chill" && /entspannt|ruhig|relax/.test(normalized)) ||
        (id === "party" && /party|feier|club/.test(normalized)) ||
        (id === "energy" && /energie|energetic|power/.test(normalized)) ||
        (id === "love" && /romant|liebe|intim/.test(normalized));
    const ids: ConcreteExperienceId[] = ["chill", "love", "energy", "party"];
    const detected = ids.filter(mentions);
    const hours = /stunde|hour/.test(normalized);
    const numericDuration = normalized.match(/(\d+)\s*(?:min|minute|stunde|hour)/)?.[1];
    const number = Number(numericDuration ?? (hours && /\b(?:ein|eine|einer|one|an)\b/.test(normalized) ? 1 : 30));
    const rising = /steig|rising|mehr energie|partytauglich|aufbau/.test(normalized);
    const falling = /runter|falling|ruhiger|cooldown/.test(normalized);
    return {
        startExperience: detected[0] ?? "chill",
        targetExperience: detected.at(-1) ?? detected[0] ?? "chill",
        transitionMinutes: Math.max(1, Math.min(240, number * (hours ? 60 : 1))),
        energyCurve: rising ? "rising" : falling ? "falling" : "steady",
        confidence: round(clamp01(0.35 + detected.length * 0.22 + Number(rising || falling) * 0.15)),
        deterministicPlan: true,
    };
}

export function subjectiveEmotionClaim(experience: ConcreteExperienceId, fit: number): string {
    return `Audio features and tags indicate a ${fit >= 0.75 ? "strong" : fit >= 0.5 ? "moderate" : "weak"} fit for the current ${experience[0]!.toUpperCase()}${experience.slice(1)} experience.`;
}

export interface WhyThisExplanation {
    track: string[];
    transition: string[];
    rejected: string[];
}

export function buildWhyThis(input: {
    trackReasons: readonly string[];
    transitionReasons: readonly string[];
    rejectedReasons?: readonly string[];
    limit?: number;
}): WhyThisExplanation {
    const limit = Math.max(1, input.limit ?? 6);
    return {
        track: [...new Set(input.trackReasons)].slice(0, limit),
        transition: [...new Set(input.transitionReasons)].slice(0, limit),
        rejected: [...new Set(input.rejectedReasons ?? [])].slice(0, limit),
    };
}

export type LearningSignalKind =
    | "explicit-correction"
    | "explicit-rating"
    | "queue-change"
    | "skip"
    | "passive-listening";
export type LearningSessionMode = "personal" | "private" | "guest" | "party";

export interface GovernedLearningSignal {
    kind: LearningSignalKind;
    baseWeight: number;
    effectiveWeight: number;
    persistPersonal: boolean;
    reason: string;
}

export function governLearningSignal(
    kind: LearningSignalKind,
    sessionMode: LearningSessionMode,
): GovernedLearningSignal {
    const baseWeight = {
        "explicit-correction": 1,
        "explicit-rating": 0.75,
        "queue-change": 0.55,
        skip: 0.3,
        "passive-listening": 0.08,
    }[kind];
    const persistPersonal = sessionMode === "personal";
    return {
        kind,
        baseWeight,
        effectiveWeight: persistPersonal ? baseWeight : 0,
        persistPersonal,
        reason: persistPersonal
            ? `${kind} may update personal taste`
            : `${sessionMode} session is isolated from personal taste`,
    };
}

export type ResearchSourceTier = "A" | "B" | "C";
export type ResearchEvidenceKind =
    | "official-docs"
    | "paper"
    | "standard"
    | "official-repository"
    | "professional-tutorial"
    | "engineering-blog"
    | "technical-analysis"
    | "reddit"
    | "forum"
    | "user-report";

export function researchSourceTier(kind: ResearchEvidenceKind): ResearchSourceTier {
    if (["official-docs", "paper", "standard", "official-repository"].includes(kind)) return "A";
    if (["professional-tutorial", "engineering-blog", "technical-analysis"].includes(kind)) return "B";
    return "C";
}

export function validateResearchClaim(
    kinds: readonly ResearchEvidenceKind[],
    technicalClaim: boolean,
): { supported: boolean; tiers: ResearchSourceTier[]; reason: string } {
    const tiers = [...new Set(kinds.map(researchSourceTier))];
    const supported = kinds.length > 0 && (!technicalClaim || tiers.includes("A") || tiers.includes("B"));
    return {
        supported,
        tiers,
        reason: supported
            ? "evidence tier is sufficient"
            : "community evidence alone cannot establish a technical claim",
    };
}

export interface ExpandedResearchSource {
    id: string;
    url: string;
    kind: ResearchEvidenceKind;
    tier: ResearchSourceTier;
    capabilities: string[];
}

export const EXPANDED_RESEARCH_SOURCES: readonly ExpandedResearchSource[] = [
    {
        id: "all-in-one-structure",
        url: "https://github.com/mir-aidj/all-in-one",
        kind: "official-repository",
        tier: "A",
        capabilities: ["multi-task-structure", "tempo", "beats", "downbeats"],
    },
    {
        id: "beatnet",
        url: "https://github.com/mjhydri/BeatNet",
        kind: "official-repository",
        tier: "A",
        capabilities: ["beat", "downbeat", "tempo", "meter", "realtime-confidence"],
    },
    {
        id: "serato-beatgrids",
        url: "https://support.serato.com/hc/en-us/articles/202523390-Introduction-to-Beatgrids",
        kind: "official-docs",
        tier: "A",
        capabilities: ["beat-events", "variable-tempo"],
    },
    {
        id: "spotify-mixed-playlists",
        url: "https://support.spotify.com/us/article/mixed-playlists/",
        kind: "official-docs",
        tier: "A",
        capabilities: ["progressive-disclosure", "transition-controls"],
    },
    {
        id: "spotify-smart-reorder",
        url: "https://newsroom.spotify.com/2026-02-25/smart-reorder-playlist-mixing/",
        kind: "official-docs",
        tier: "A",
        capabilities: ["queue-ordering", "bpm-key"],
    },
    {
        id: "mtg-jamendo",
        url: "https://github.com/MTG/mtg-jamendo-dataset",
        kind: "official-repository",
        tier: "A",
        capabilities: ["multi-label-genre", "instrument", "mood-theme"],
    },
    {
        id: "sequential-skip",
        url: "https://arxiv.org/abs/1901.08203",
        kind: "paper",
        tier: "A",
        capabilities: ["contextual-skips", "session-sequence"],
    },
    {
        id: "wwise-transitions",
        url: "https://www.youtube.com/watch?v=STAdQwgDYHQ",
        kind: "official-docs",
        tier: "A",
        capabilities: ["transition-matrix", "entry-exit-cues"],
    },
    {
        id: "fmod-transition-regions",
        url: "https://www.youtube.com/watch?v=qpooYXU-yA8",
        kind: "professional-tutorial",
        tier: "B",
        capabilities: ["quantized-events", "transition-regions"],
    },
    {
        id: "spotify-mixing-community",
        url: "https://www.reddit.com/r/SpotifyPlaylists/comments/1v56hma/",
        kind: "reddit",
        tier: "C",
        capabilities: ["quality-edge-cases", "vocal-collision"],
    },
    {
        id: "serato-grid-community",
        url: "https://www.reddit.com/r/Serato/comments/1lch0gm",
        kind: "reddit",
        tier: "C",
        capabilities: ["intro-grid-failure", "downbeat-edge-cases"],
    },
] as const;

export const REFINED_CORE_ARCHITECTURE = [
    { id: "user-intent", responsibilities: ["experience", "mix-style", "queue-rules", "context"] },
    { id: "experience-engine", responsibilities: ["mood-vector", "journey-template", "hysteresis"] },
    { id: "music-director", responsibilities: ["memory", "tension", "moments", "requests", "timing"] },
    {
        id: "route-planner",
        responsibilities: ["retrieval", "compatibility-graph", "bridges", "diversity", "fairness", "lookahead"],
    },
    {
        id: "musical-intelligence",
        responsibilities: [
            "beat",
            "downbeat",
            "tempo-map",
            "meter",
            "key",
            "structure",
            "vocals",
            "mood",
            "embeddings",
        ],
    },
    { id: "transition-policy", responsibilities: ["hard-gates", "risk", "candidates", "reasoning"] },
    { id: "transition-planner", responsibilities: ["strategy", "parameters", "timeline", "tail"] },
    { id: "preview-validation", responsibilities: ["render", "quality-guardian", "artifact-detection"] },
    { id: "rescue-engine", responsibilities: ["safe-plan", "emergency-loop", "fallback"] },
    { id: "dsp-core", responsibilities: ["decks", "stems", "stretch", "eq", "fx", "master"] },
    { id: "session-clock", responsibilities: ["samples", "beats", "bars", "phrases", "external-sync"] },
    { id: "experience-event-bus", responsibilities: ["audio", "lighting", "visuals", "haptics", "api"] },
] as const;

export const ULTIMATE_DIRECTOR_QUESTIONS = [
    "What should the user experience?",
    "Where is the session emotionally and energetically?",
    "Which musical expectation has been created?",
    "Which song sections must be respected?",
    "Which track advances the long-term goal?",
    "Which transition is musically suitable?",
    "Which suitable transition is technically safe?",
    "How much manipulation is acceptable?",
    "Which resources will be ready before the deadline?",
    "What is the safe fallback?",
    "What should happen in three tracks?",
    "What should happen in thirty minutes?",
    "Is a requested track or moment deadline-bound?",
    "How are repetition and fatigue prevented?",
    "How can external systems understand the same musical moment?",
] as const;

export const DEVELOPMENT_PRIORITIES = [
    {
        id: "P0",
        goal: "musical-time",
        capabilities: ["beat-events", "downbeats", "tempo-map", "meter", "dynamic-beatgrid", "musical-timeline"],
    },
    {
        id: "P1",
        goal: "song-understanding",
        capabilities: ["structure-graph", "sections", "dependencies", "moments", "tension", "must-play", "loopability"],
    },
    {
        id: "P2",
        goal: "safe-planning",
        capabilities: [
            "manipulation-budget",
            "hard-gates",
            "risk",
            "safe-plan",
            "progressive-planning",
            "commit-horizon",
            "rescue",
        ],
    },
    {
        id: "P3",
        goal: "session-understanding",
        capabilities: ["experience", "performance-style", "journey", "memory", "familiarity", "fatigue", "hysteresis"],
    },
    {
        id: "P4",
        goal: "intelligent-queue",
        capabilities: ["retrieval", "compatibility-graph", "embeddings", "routes", "bridges", "requests", "backtiming"],
    },
    {
        id: "P5",
        goal: "audio-quality",
        capabilities: ["strategies", "optimizer", "preview", "quality-guardian", "stem-gate", "tail-bus"],
    },
    {
        id: "P6",
        goal: "platform-scale",
        capabilities: [
            "provider-capabilities",
            "compute-tiers",
            "multi-fidelity",
            "scheduler",
            "shared-analysis",
            "cache-versioning",
        ],
    },
    {
        id: "P7",
        goal: "experience-platform",
        capabilities: [
            "crowd",
            "group-fairness",
            "event-bus",
            "lighting",
            "haptics",
            "external-api",
            "natural-language",
        ],
    },
] as const;

export function advancedDimensionsForSelection(selection: ExperienceSelection): AdvancedExperienceDimensions {
    return resolveExperienceRecipe({
        id: "active",
        name: "Active Experience",
        weights: selection.weights,
        smoothness: 0.5,
        journey: "steady",
    }).dimensions;
}
