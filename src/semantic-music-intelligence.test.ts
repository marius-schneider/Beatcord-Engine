import { describe, expect, test } from "bun:test";
import {
    contextualFit,
    culturalGeneralization,
    discoveryBudget,
    discoveryIntroduction,
    explainCandidate,
    languageCrowdFit,
    learnSemanticVocabulary,
    lyricCollision,
    mapSemanticTerms,
    modalityWeights,
    ORGANIC_MUSIC_VOCABULARY,
    personalizedIntentMeaning,
    SEMANTIC_RESEARCH,
    SEMANTIC_TAXONOMY,
    type SemanticCandidateEvidence,
    type SemanticMusicProfile,
    selectContentSafeVersion,
    semanticBridgeScore,
    semanticJourney,
    semanticSearch,
    singalongPotential,
    solveSemanticMusicalConstraints,
    updateMomentRecognition,
} from "./semantic-music-intelligence";

const profile: SemanticMusicProfile = {
    descriptions: [],
    situations: [],
    themes: [],
    emotionalDescriptors: [],
    socialContexts: [],
    confidence: 0.9,
};
const evidence = Object.fromEntries(
    [
        "personal",
        "crowd",
        "semantic",
        "musical",
        "trend",
        "familiarity",
        "transition",
        "futureRoute",
        "uncertainty",
    ].map((key) => [
        key,
        { score: key === "uncertainty" ? 0.1 : 0.8, confidence: 0.9, reason: `${key}-reason`, grounded: true },
    ]),
) as unknown as SemanticCandidateEvidence;

describe("semantic music intelligence", () => {
    test("retrieves semantic language-audio matches independently of audio fit", () => {
        const results = semanticSearch(
            [1, 0],
            [
                { id: "warm", profile, representation: { audioEmbedding: [0, 1], semanticEmbedding: [1, 0] } },
                { id: "cold", profile, representation: { audioEmbedding: [1, 0], semanticEmbedding: [-1, 0] } },
            ],
        );
        expect(results[0]?.id).toBe("warm");
        expect(contextualFit({ audioFit: 0.84, semanticFit: 0.93, semanticImportance: 0.7 })).toMatchObject({
            audioFit: 0.84,
            semanticFit: 0.93,
            separateSignals: true,
        });
    });

    test("weights multimodal representations per context instead of collapsing them", () => {
        expect(modalityWeights("instrumental").lyrics).toBe(0);
        expect(modalityWeights("lyric-focused").lyrics).toBe(0.35);
        expect(modalityWeights("crowd").collaborative).toBe(0.4);
    });

    test("reduces confidence outside known cultural domains", () => {
        expect(culturalGeneralization(0.9, false)).toEqual({
            confidence: 0.405,
            aggressiveAssumptionsAllowed: false,
            warning: "unknown-cultural-musical-domain",
        });
    });

    test("maps free language onto controlled situation taxonomy", () => {
        expect(SEMANTIC_TAXONOMY.activity).toContain("driving");
        expect(mapSemanticTerms("Night driving with friends")).toEqual([
            { category: "activity", tag: "driving" },
            { category: "social", tag: "friends" },
            { category: "environment", tag: "night" },
        ]);
    });

    test("scores semantic bridge tracks and three-track journey trajectories", () => {
        expect(
            semanticBridgeScore({
                sourceSemantic: [1, 0],
                bridgeSemantic: [0.8, 0.2],
                targetSemantic: [0.6, 0.4],
                musicalFit: 0.9,
            }),
        ).toBeGreaterThan(0.8);
        const journey = semanticJourney([
            { position: 1, energy: 0.9, emotion: "celebratory", semantic: "festival" },
            { position: 0, energy: 0.5, emotion: "nostalgic", semantic: "memory" },
        ]);
        expect(journey.points[0]?.emotion).toBe("nostalgic");
        expect(journey.trajectories).toEqual(["energy", "emotion", "semantics"]);
    });

    test("supports none, short, story and radio discovery introductions", () => {
        expect(discoveryIntroduction("none", []).text).toBe("");
        expect(discoveryIntroduction("short", ["fits this vibe"]).spoken).toBe(false);
        expect(discoveryIntroduction("radio", ["warm production"]).spoken).toBe(true);
    });

    test("adapts discovery budget to curiosity and stops forced novelty", () => {
        expect(
            discoveryBudget({ curiosity: 0.9, noveltyTolerance: 0.8, currentDiscoveryFatigue: 0 }).budget,
        ).toBeGreaterThan(0.7);
        expect(
            discoveryBudget({ curiosity: 0.1, noveltyTolerance: 0.1, currentDiscoveryFatigue: 1 }).stopPushingNovelty,
        ).toBe(true);
    });

    test("learns organic and personal vocabulary with explicit correction priority", () => {
        expect(ORGANIC_MUSIC_VOCABULARY).toContain("cozy");
        const correction = { arousal: 0.2, warmth: 0.9, acousticness: 0.6, transientSoftness: 0.8, familiarity: 0.7 };
        expect(learnSemanticVocabulary("cozy", [], correction)).toEqual(correction);
        expect(personalizedIntentMeaning("u", "Chill", ["deep-house"], correction)).toMatchObject({
            userId: "u",
            term: "chill",
            genres: ["deep-house"],
        });
    });

    test("solves semantic and musical constraints from grounded evidence", () => {
        expect(solveSemanticMusicalConstraints(evidence, true).eligible).toBe(true);
        expect(solveSemanticMusicalConstraints(evidence, false).eligible).toBe(false);
        expect(explainCandidate(evidence)).toContain("semantic-reason");
    });

    test("selects verified clean versions for family and clean sessions", () => {
        const versions = [
            { id: "original", explicit: true, versionIdentityConfidence: 1, providerConfidence: 1 },
            { id: "clean", explicit: false, versionIdentityConfidence: 0.95, providerConfidence: 0.9 },
        ];
        expect(selectContentSafeVersion("family-safe", versions).selected).toBe("clean");
        expect(selectContentSafeVersion("explicit-allowed", versions).selected).toBe("original");
    });

    test("detects semantic foreground lyric collisions on timelines", () => {
        const segment = {
            start: 0,
            end: 10,
            section: "chorus",
            narrative: "resolution",
            importance: 1,
            lyricForeground: 1,
        };
        expect(lyricCollision(segment, { ...segment, start: 2 }).avoidOverlap).toBe(true);
        expect(lyricCollision(segment, { ...segment, start: 20 }).collision).toBe(0);
    });

    test("models language preferences and experimental singalong potential", () => {
        expect(languageCrowdFit("German", { german: 0.9 }, false)).toBe(0.9);
        expect(languageCrowdFit(null, { instrumental: 0.8 }, true)).toBe(0.8);
        expect(
            singalongPotential({ crowdFamiliarity: 1, chorusRepetition: 1, vocalClarity: 1, hookStrength: 1 }),
        ).toEqual({ score: 1, experimental: true });
    });

    test("keeps moment recognition separate from whole-track familiarity", () => {
        const result = updateMomentRecognition(
            { trackId: "x", section: "chorus", trackFamiliarity: 0.2, momentFamiliarity: 0.8, reactionEvidence: 2 },
            1,
        );
        expect(result.momentFamiliarity).toBeCloseTo(0.84);
        expect(result.trackFamiliarity).toBe(0.2);
    });

    test("documents MusicSem scale, modality limits and non-LLM evaluation", () => {
        expect(SEMANTIC_RESEARCH.musicSemPairs).toBe(32_493);
        expect(SEMANTIC_RESEARCH.lyricsAreOneModality).toBe(true);
        expect(SEMANTIC_RESEARCH.llmJudgeSufficient).toBe(false);
        expect(SEMANTIC_RESEARCH.evaluationSources).toEqual(["signal-metrics", "specialized-models", "human-tests"]);
    });
});
