import { describe, expect, test } from "bun:test";
import { buildCrowdTaste, scoreTrackForCrowd } from "./crowd-taste";
import {
    ArtistKnowledgeGraph,
    embeddingAffinity,
    fuseGenreEvidence,
    GenreIntelligenceGraph,
    hyperbolicGenreDistance,
    resolveUserEmbedding,
    selectTrackVersion,
    semanticTrackSimilarity,
} from "./music-knowledge";

describe("music knowledge and crowd taste", () => {
    test("models genre hierarchy, related edges, multilabels and provenance", () => {
        const graph = new GenreIntelligenceGraph();
        graph.addNode({ id: "electronic", label: "Electronic" });
        graph.addNode({ id: "house", label: "House", parent: "electronic" });
        graph.addNode({ id: "deep-house", label: "Deep House", parent: "house" });
        graph.addNode({ id: "disco", label: "Disco" });
        graph.addRelation({ from: "house", to: "disco", type: "related", weight: 0.8 });
        expect(graph.ancestors("deep-house")).toEqual(["house", "electronic"]);
        expect(graph.similarity("house", "disco")).toBeGreaterThan(0.7);
        const labels = fuseGenreEvidence([
            { genre: "house", source: "audio-classifier", confidence: 0.9 },
            { genre: "house", source: "editorial", confidence: 0.8 },
            { genre: "deep-house", source: "community-tag", confidence: 0.7 },
        ]);
        expect(labels[0]?.genre).toBe("house");
        expect(labels[0]?.provenance).toHaveLength(2);
    });

    test("supports hierarchical embeddings and artist relationship provenance", () => {
        expect(hyperbolicGenreDistance(new Float32Array([0.1, 0.1]), new Float32Array([0.11, 0.1]))).toBeLessThan(
            hyperbolicGenreDistance(new Float32Array([0.1, 0.1]), new Float32Array([0.7, 0.5])),
        );
        const graph = new ArtistKnowledgeGraph();
        graph.add({
            fromArtistId: "a",
            toArtistId: "b",
            type: "collaborated-with",
            confidence: 0.9,
            source: "musicbrainz",
        });
        expect(graph.affinity("a", "b")).toBe(0.9);
        expect(graph.connections("a")[0]?.source).toBe("musicbrainz");
    });

    test("selects track versions by experience but preserves explicit choice", () => {
        const original = {
            trackId: "original",
            recordingId: "r",
            relations: [{ targetTrackId: "r", type: "original-version" as const, confidence: 1 }],
        };
        const remix = {
            trackId: "remix",
            recordingId: "r",
            relations: [{ targetTrackId: "r", type: "remix" as const, confidence: 1 }],
        };
        expect(selectTrackVersion([original, remix], "party")?.trackId).toBe("remix");
        expect(selectTrackVersion([original, remix], "party", "original")?.trackId).toBe("original");
    });

    test("combines semantic evidence beyond genre tags", () => {
        const result = semanticTrackSimilarity({
            audioEmbedding: 0.9,
            genreGraph: 0.4,
            artistGraph: 0.8,
            lyrics: 0.7,
            mood: 0.8,
            tempo: 0.6,
            key: 0.7,
            structure: 0.8,
            userCoListening: 0.9,
            playlistCoOccurrence: 0.85,
        });
        expect(result.total).toBeGreaterThan(0.7);
        expect(result.strongest).toContain("audioEmbedding");
    });

    test("blends global, recent, session and contextual user embeddings", () => {
        const resolved = resolveUserEmbedding(
            {
                global: new Float32Array([1, 0]),
                recent: new Float32Array([0.8, 0.2]),
                session: new Float32Array([0.2, 0.8]),
                party: new Float32Array([0, 1]),
            },
            "party",
        );
        expect(resolved[1]!).toBeGreaterThan(resolved[0]!);
        expect(embeddingAffinity(resolved, new Float32Array([0, 1]), new Float32Array([0, 1]))).toBeGreaterThan(0.9);
    });

    test("retains crowd consensus, diversity, contested genres and fairness debt", () => {
        const crowd = buildCrowdTaste([
            { userId: "a", taste: { house: 0.9, jazz: 0.1 }, satisfaction: 0.9, fairnessDebt: 0, active: true },
            { userId: "b", taste: { house: 0.8, jazz: 0.9 }, satisfaction: 0.2, fairnessDebt: 0.7, active: true },
        ]);
        expect(crowd.sharedGenres.map((item) => item.genre)).toContain("house");
        expect(crowd.contestedGenres.map((item) => item.genre)).toContain("jazz");
        expect(crowd.fairnessDebt.b).toBeGreaterThan(crowd.fairnessDebt.a ?? 0);
        expect(scoreTrackForCrowd(crowd, { house: 0.9, jazz: 0.7 }).fairnessBoost).toBeGreaterThan(0);
    });
});
