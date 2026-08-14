const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
export type Vector = readonly number[];
export interface WeightedSemanticTag {
    tag: string;
    weight: number;
    source: "audio" | "lyrics" | "metadata" | "community" | "playlist";
}
export interface SemanticMusicProfile {
    descriptions: Vector[];
    situations: WeightedSemanticTag[];
    themes: WeightedSemanticTag[];
    emotionalDescriptors: WeightedSemanticTag[];
    socialContexts: WeightedSemanticTag[];
    confidence: number;
}
export interface SemanticTrackRepresentation {
    audioEmbedding: Vector;
    lyricEmbedding?: Vector;
    semanticEmbedding: Vector;
    collaborativeEmbedding?: Vector;
    graphEmbedding?: Vector;
}

const cosine = (a: Vector, b: Vector): number => {
    const length = Math.max(a.length, b.length);
    let dot = 0;
    let aa = 0;
    let bb = 0;
    for (let index = 0; index < length; index += 1) {
        const left = a[index] ?? 0;
        const right = b[index] ?? 0;
        dot += left * right;
        aa += left * left;
        bb += right * right;
    }
    return aa && bb ? clamp01((dot / Math.sqrt(aa * bb) + 1) / 2) : 0;
};

export function semanticSearch(
    query: Vector,
    tracks: readonly { id: string; representation: SemanticTrackRepresentation; profile: SemanticMusicProfile }[],
): Array<{ id: string; semanticFit: number; confidence: number }> {
    return tracks
        .map((track) => ({
            id: track.id,
            semanticFit: cosine(query, track.representation.semanticEmbedding),
            confidence: clamp01(track.profile.confidence),
        }))
        .sort((a, b) => b.semanticFit * b.confidence - a.semanticFit * a.confidence);
}

export function contextualFit(input: { audioFit: number; semanticFit: number; semanticImportance: number }): {
    audioFit: number;
    semanticFit: number;
    combined: number;
    separateSignals: true;
} {
    const weight = clamp01(input.semanticImportance);
    return {
        audioFit: clamp01(input.audioFit),
        semanticFit: clamp01(input.semanticFit),
        combined: clamp01(input.audioFit * (1 - weight) + input.semanticFit * weight),
        separateSignals: true,
    };
}

export type SemanticModality = "audio" | "lyrics" | "semantic" | "collaborative" | "graph";
export function modalityWeights(
    context: "instrumental" | "lyric-focused" | "discovery" | "crowd",
): Record<SemanticModality, number> {
    if (context === "instrumental") return { audio: 0.4, lyrics: 0, semantic: 0.4, collaborative: 0.1, graph: 0.1 };
    if (context === "lyric-focused")
        return { audio: 0.15, lyrics: 0.35, semantic: 0.35, collaborative: 0.05, graph: 0.1 };
    if (context === "crowd") return { audio: 0.2, lyrics: 0.1, semantic: 0.2, collaborative: 0.4, graph: 0.1 };
    return { audio: 0.2, lyrics: 0.1, semantic: 0.3, collaborative: 0.2, graph: 0.2 };
}

export function culturalGeneralization(
    confidence: number,
    domainKnown: boolean,
): { confidence: number; aggressiveAssumptionsAllowed: boolean; warning?: string } {
    return domainKnown
        ? { confidence: clamp01(confidence), aggressiveAssumptionsAllowed: confidence >= 0.75 }
        : {
              confidence: clamp01(confidence * 0.45),
              aggressiveAssumptionsAllowed: false,
              warning: "unknown-cultural-musical-domain",
          };
}

export const SEMANTIC_TAXONOMY = {
    activity: ["driving", "gaming", "working", "workout", "dinner", "sleeping"],
    social: ["alone", "couple", "friends", "family", "party"],
    environment: ["night", "rain", "summer", "beach", "city"],
    function: ["background", "singalong", "dance", "focus", "emotional"],
} as const;
export type SemanticTaxonomyCategory = keyof typeof SEMANTIC_TAXONOMY;
export function mapSemanticTerms(text: string): Array<{ category: SemanticTaxonomyCategory; tag: string }> {
    const normalized = text.toLowerCase();
    return (Object.entries(SEMANTIC_TAXONOMY) as [SemanticTaxonomyCategory, readonly string[]][]).flatMap(
        ([category, tags]) => tags.filter((tag) => normalized.includes(tag)).map((tag) => ({ category, tag })),
    );
}

export function semanticBridgeScore(input: {
    sourceSemantic: Vector;
    bridgeSemantic: Vector;
    targetSemantic: Vector;
    musicalFit: number;
}): number {
    return clamp01(
        (cosine(input.sourceSemantic, input.bridgeSemantic) + cosine(input.bridgeSemantic, input.targetSemantic)) *
            0.35 +
            input.musicalFit * 0.3,
    );
}
export interface SemanticJourneyPoint {
    position: number;
    energy: number;
    emotion: string;
    semantic: string;
}
export function semanticJourney(points: readonly SemanticJourneyPoint[]): {
    points: SemanticJourneyPoint[];
    trajectories: readonly ["energy", "emotion", "semantics"];
    valid: boolean;
} {
    const sorted = [...points].sort((a, b) => a.position - b.position);
    return {
        points: sorted,
        trajectories: ["energy", "emotion", "semantics"],
        valid: sorted.every((point, index) => index === 0 || point.position > (sorted[index - 1]?.position ?? -1)),
    };
}

export type DiscoveryExplanationMode = "none" | "short" | "story" | "radio";
export function discoveryIntroduction(
    mode: DiscoveryExplanationMode,
    evidence: readonly string[],
): { spoken: boolean; text: string; grounded: true } {
    if (mode === "none") return { spoken: false, text: "", grounded: true };
    const text =
        mode === "short"
            ? `New for you • ${evidence[0] ?? "fits this vibe"}`
            : `A new track for you: ${evidence.join("; ")}.`;
    return { spoken: mode === "radio", text, grounded: true };
}

export interface ExplorationState {
    curiosity: number;
    noveltyTolerance: number;
    currentDiscoveryFatigue: number;
}
export function discoveryBudget(state: ExplorationState): { budget: number; stopPushingNovelty: boolean } {
    const budget = clamp01(
        state.curiosity * 0.45 + state.noveltyTolerance * 0.45 - state.currentDiscoveryFatigue * 0.6,
    );
    return { budget, stopPushingNovelty: budget < 0.2 };
}

export interface SemanticAssociation {
    arousal: number;
    warmth: number;
    acousticness: number;
    transientSoftness: number;
    familiarity: number;
}
export const ORGANIC_MUSIC_VOCABULARY = [
    "floaty",
    "punchy",
    "cozy",
    "late-night",
    "festival-like",
    "dreamy",
    "warm",
] as const;
export function learnSemanticVocabulary(
    term: string,
    observations: readonly SemanticAssociation[],
    explicitCorrection?: SemanticAssociation,
): SemanticAssociation {
    if (explicitCorrection) return { ...explicitCorrection };
    const count = Math.max(1, observations.length);
    const sum = observations.reduce(
        (total, item) => ({
            arousal: total.arousal + item.arousal,
            warmth: total.warmth + item.warmth,
            acousticness: total.acousticness + item.acousticness,
            transientSoftness: total.transientSoftness + item.transientSoftness,
            familiarity: total.familiarity + item.familiarity,
        }),
        { arousal: 0, warmth: 0, acousticness: 0, transientSoftness: 0, familiarity: 0 },
    );
    void term;
    return Object.fromEntries(
        Object.entries(sum).map(([key, value]) => [key, value / count]),
    ) as unknown as SemanticAssociation;
}
export interface PersonalSemanticMeaning {
    userId: string;
    term: string;
    genres: string[];
    association: SemanticAssociation;
    sources: readonly ["explicit-corrections", "session-history", "chosen-tracks"];
}
export function personalizedIntentMeaning(
    userId: string,
    term: string,
    genres: readonly string[],
    association: SemanticAssociation,
): PersonalSemanticMeaning {
    return {
        userId,
        term: term.toLowerCase(),
        genres: [...genres],
        association: { ...association },
        sources: ["explicit-corrections", "session-history", "chosen-tracks"],
    };
}

export interface Evidence {
    score: number;
    confidence: number;
    reason: string;
    grounded: boolean;
}
export interface SemanticCandidateEvidence {
    personal: Evidence;
    crowd: Evidence;
    semantic: Evidence;
    musical: Evidence;
    trend: Evidence;
    familiarity: Evidence;
    transition: Evidence;
    futureRoute: Evidence;
    uncertainty: Evidence;
}
export function solveSemanticMusicalConstraints(
    evidence: SemanticCandidateEvidence,
    hardConstraintsMet: boolean,
): { eligible: boolean; score: number; evidence: SemanticCandidateEvidence } {
    const positive = [
        evidence.personal,
        evidence.crowd,
        evidence.semantic,
        evidence.musical,
        evidence.trend,
        evidence.familiarity,
        evidence.transition,
        evidence.futureRoute,
    ];
    const score =
        (positive.reduce((sum, item) => sum + item.score * item.confidence, 0) / positive.length) *
        (1 - evidence.uncertainty.score);
    return { eligible: hardConstraintsMet && positive.every((item) => item.grounded), score: clamp01(score), evidence };
}
export function explainCandidate(evidence: SemanticCandidateEvidence): string[] {
    return Object.values(evidence)
        .filter((item) => item.grounded && item.confidence >= 0.6 && item.score >= 0.6 && item.reason)
        .sort((a, b) => b.score * b.confidence - a.score * a.confidence)
        .map((item) => item.reason);
}

export type ContentSafety = "family-safe" | "clean-only" | "explicit-allowed";
export interface SemanticTrackVersion {
    id: string;
    explicit: boolean;
    versionIdentityConfidence: number;
    providerConfidence: number;
}
export function selectContentSafeVersion(
    contract: ContentSafety,
    versions: readonly SemanticTrackVersion[],
): { selected: string | null; blocked: boolean; reason: string } {
    const reliable = versions.filter(
        (version) => version.versionIdentityConfidence >= 0.8 && version.providerConfidence >= 0.75,
    );
    const allowed = contract === "explicit-allowed" ? reliable : reliable.filter((version) => !version.explicit);
    return {
        selected: allowed[0]?.id ?? null,
        blocked: allowed.length === 0,
        reason: allowed.length
            ? contract === "explicit-allowed"
                ? "verified-version"
                : "verified-clean-version"
            : "no-reliably-identified-allowed-version",
    };
}

export interface SemanticTimelineSegment {
    start: number;
    end: number;
    section: string;
    narrative: string;
    importance: number;
    lyricForeground: number;
}
export function lyricCollision(
    a: SemanticTimelineSegment,
    b: SemanticTimelineSegment,
): { collision: number; avoidOverlap: boolean } {
    const overlap =
        Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start)) /
        Math.max(0.001, Math.min(a.end - a.start, b.end - b.start));
    const collision = clamp01(overlap * a.importance * b.importance * a.lyricForeground * b.lyricForeground);
    return { collision, avoidOverlap: collision >= 0.35 };
}

export function languageCrowdFit(
    language: string | null,
    preferences: Readonly<Record<string, number>>,
    instrumental: boolean,
): number {
    return clamp01(preferences[instrumental ? "instrumental" : (language?.toLowerCase() ?? "unknown")] ?? 0.5);
}
export interface SingalongPotential {
    crowdFamiliarity: number;
    chorusRepetition: number;
    vocalClarity: number;
    hookStrength: number;
}
export function singalongPotential(input: SingalongPotential): { score: number; experimental: true } {
    return {
        score: clamp01(
            input.crowdFamiliarity * 0.35 +
                input.chorusRepetition * 0.2 +
                input.vocalClarity * 0.2 +
                input.hookStrength * 0.25,
        ),
        experimental: true,
    };
}
export interface MomentFamiliarity {
    trackId: string;
    section: string;
    trackFamiliarity: number;
    momentFamiliarity: number;
    reactionEvidence: number;
}
export function updateMomentRecognition(input: MomentFamiliarity, reaction: number): MomentFamiliarity {
    return {
        ...input,
        momentFamiliarity: clamp01(input.momentFamiliarity * 0.8 + reaction * 0.2),
        reactionEvidence: input.reactionEvidence + 1,
    };
}

export const SEMANTIC_RESEARCH = {
    musicSemPairs: 32_493,
    lyricsAreOneModality: true,
    culturalBiasWarning: true,
    llmJudgeSufficient: false,
    evaluationSources: ["signal-metrics", "specialized-models", "human-tests"],
} as const;
