import { cosineSimilarity } from "./capability-selection";
import type { ConcreteExperienceId } from "./experience-engine";

export interface GenreNode {
    id: string;
    label: string;
    parent?: string;
    embedding?: Float32Array;
}

export interface GenreRelation {
    from: string;
    to: string;
    type: "is-a" | "related";
    weight: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

export class GenreIntelligenceGraph {
    readonly #nodes = new Map<string, GenreNode>();
    readonly #relations: GenreRelation[] = [];

    addNode(node: GenreNode): void {
        this.#nodes.set(node.id, { ...node, ...(node.embedding ? { embedding: node.embedding.slice() } : {}) });
        if (node.parent) this.addRelation({ from: node.id, to: node.parent, type: "is-a", weight: 1 });
    }

    addRelation(relation: GenreRelation): void {
        if (!this.#nodes.has(relation.from) && !this.#nodes.has(relation.to)) return;
        if (
            this.#relations.some(
                (item) => item.from === relation.from && item.to === relation.to && item.type === relation.type,
            )
        )
            return;
        this.#relations.push({ ...relation, weight: clamp01(relation.weight) });
    }

    ancestors(id: string): string[] {
        const result: string[] = [];
        let current = this.#nodes.get(id);
        const seen = new Set<string>();
        while (current?.parent && !seen.has(current.parent)) {
            result.push(current.parent);
            seen.add(current.parent);
            current = this.#nodes.get(current.parent);
        }
        return result;
    }

    similarity(leftId: string, rightId: string): number {
        if (leftId === rightId) return 1;
        const left = this.#nodes.get(leftId);
        const right = this.#nodes.get(rightId);
        if (!left || !right) return 0;
        const leftPath = [leftId, ...this.ancestors(leftId)];
        const rightPath = [rightId, ...this.ancestors(rightId)];
        const shared = leftPath.findIndex((id) => rightPath.includes(id));
        const rightDepth = shared >= 0 ? rightPath.indexOf(leftPath[shared]!) : -1;
        const hierarchy = shared >= 0 ? 1 / (1 + shared + rightDepth) : 0;
        const relation =
            this.#relations.find(
                (item) =>
                    item.type === "related" &&
                    ((item.from === leftId && item.to === rightId) || (item.from === rightId && item.to === leftId)),
            )?.weight ?? 0;
        const embedding = left.embedding && right.embedding ? cosineSimilarity(left.embedding, right.embedding) : 0;
        return round(Math.max(hierarchy, relation * 0.9, embedding * 0.75));
    }
}

export type GenreEvidenceSource =
    | "audio-classifier"
    | "artist-metadata"
    | "track-metadata"
    | "user-tag"
    | "community-tag"
    | "editorial";
export interface GenreProvenanceEvidence {
    genre: string;
    source: GenreEvidenceSource;
    confidence: number;
}

export interface WeightedGenre {
    genre: string;
    weight: number;
    provenance: GenreProvenanceEvidence[];
}

/** Fuse multi-label genre evidence while retaining every contributing source. */
export function fuseGenreEvidence(evidence: readonly GenreProvenanceEvidence[]): WeightedGenre[] {
    const sourceReliability: Record<GenreEvidenceSource, number> = {
        "audio-classifier": 0.72,
        "artist-metadata": 0.58,
        "track-metadata": 0.75,
        "user-tag": 0.62,
        "community-tag": 0.55,
        editorial: 0.9,
    };
    const genres = [...new Set(evidence.map((item) => item.genre.trim().toLowerCase()).filter(Boolean))];
    return genres
        .map((genre) => {
            const provenance = evidence
                .filter((item) => item.genre.trim().toLowerCase() === genre)
                .map((item) => ({ ...item, genre }));
            const misses = provenance.reduce(
                (product, item) => product * (1 - clamp01(item.confidence) * sourceReliability[item.source]),
                1,
            );
            return { genre, weight: round(1 - misses), provenance };
        })
        .sort((a, b) => b.weight - a.weight || a.genre.localeCompare(b.genre));
}

/** Poincaré-ball distance for hierarchical taxonomy embeddings. */
export function hyperbolicGenreDistance(left: Float32Array, right: Float32Array): number {
    const length = Math.min(left.length, right.length);
    let difference = 0;
    let normLeft = 0;
    let normRight = 0;
    for (let index = 0; index < length; index++) {
        difference += (left[index]! - right[index]!) ** 2;
        normLeft += left[index]! ** 2;
        normRight += right[index]! ** 2;
    }
    const denominator = Math.max(1e-6, (1 - Math.min(0.999, normLeft)) * (1 - Math.min(0.999, normRight)));
    return round(Math.acosh(1 + (2 * difference) / denominator));
}

export type ArtistRelationType =
    | "collaborated-with"
    | "member-of"
    | "produced-by"
    | "remixed-by"
    | "sampled"
    | "covered"
    | "influenced"
    | "similar";
export interface ArtistRelation {
    fromArtistId: string;
    toArtistId: string;
    type: ArtistRelationType;
    confidence: number;
    source: string;
}

export class ArtistKnowledgeGraph {
    readonly #relations: ArtistRelation[] = [];

    add(relation: ArtistRelation): void {
        this.#relations.push({ ...relation, confidence: clamp01(relation.confidence) });
    }

    connections(artistId: string, types?: readonly ArtistRelationType[]): ArtistRelation[] {
        return this.#relations
            .filter(
                (item) =>
                    (item.fromArtistId === artistId || item.toArtistId === artistId) &&
                    (!types || types.includes(item.type)),
            )
            .sort((a, b) => b.confidence - a.confidence);
    }

    affinity(leftId: string, rightId: string): number {
        const direct = this.#relations.filter(
            (item) =>
                (item.fromArtistId === leftId && item.toArtistId === rightId) ||
                (item.fromArtistId === rightId && item.toArtistId === leftId),
        );
        return round(direct.reduce((best, item) => Math.max(best, item.confidence), 0));
    }
}

export type TrackRelationType =
    | "original-version"
    | "remix"
    | "acoustic-version"
    | "live-version"
    | "radio-edit"
    | "extended-version"
    | "sample-source"
    | "cover";
export interface TrackKnowledgeNode {
    trackId: string;
    recordingId: string;
    relations: { targetTrackId: string; type: TrackRelationType; confidence: number }[];
}

export function selectTrackVersion(
    candidates: readonly TrackKnowledgeNode[],
    experience: ConcreteExperienceId,
    explicitlySelectedTrackId?: string,
): TrackKnowledgeNode | null {
    if (explicitlySelectedTrackId) return candidates.find((item) => item.trackId === explicitlySelectedTrackId) ?? null;
    const preference: Record<ConcreteExperienceId, TrackRelationType[]> = {
        party: ["extended-version", "remix", "radio-edit"],
        energy: ["remix", "extended-version", "radio-edit"],
        chill: ["acoustic-version", "original-version", "live-version"],
        love: ["original-version", "acoustic-version", "live-version"],
    };
    return (
        [...candidates].sort((a, b) => {
            const kind = (item: TrackKnowledgeNode) => item.relations[0]?.type ?? "original-version";
            const aRank = preference[experience].indexOf(kind(a));
            const bRank = preference[experience].indexOf(kind(b));
            return (aRank < 0 ? 99 : aRank) - (bRank < 0 ? 99 : bRank) || a.trackId.localeCompare(b.trackId);
        })[0] ?? null
    );
}

export interface SemanticSimilaritySignals {
    audioEmbedding: number;
    genreGraph: number;
    artistGraph: number;
    lyrics: number;
    mood: number;
    tempo: number;
    key: number;
    structure: number;
    userCoListening: number;
    playlistCoOccurrence: number;
}

export interface SemanticSimilarity {
    total: number;
    signals: SemanticSimilaritySignals;
    strongest: (keyof SemanticSimilaritySignals)[];
}

export function semanticTrackSimilarity(signals: SemanticSimilaritySignals): SemanticSimilarity {
    const weights: Record<keyof SemanticSimilaritySignals, number> = {
        audioEmbedding: 0.19,
        genreGraph: 0.12,
        artistGraph: 0.08,
        lyrics: 0.07,
        mood: 0.1,
        tempo: 0.08,
        key: 0.08,
        structure: 0.09,
        userCoListening: 0.1,
        playlistCoOccurrence: 0.09,
    };
    const normalized = Object.fromEntries(
        Object.entries(signals).map(([key, value]) => [key, clamp01(value)]),
    ) as unknown as SemanticSimilaritySignals;
    const total = (Object.keys(weights) as (keyof SemanticSimilaritySignals)[]).reduce(
        (sum, key) => sum + normalized[key] * weights[key],
        0,
    );
    const strongest = (Object.keys(weights) as (keyof SemanticSimilaritySignals)[])
        .sort((a, b) => normalized[b] * weights[b] - normalized[a] * weights[a])
        .slice(0, 3);
    return { total: round(total), signals: normalized, strongest };
}

export interface UserEmbeddings {
    global: Float32Array;
    recent: Float32Array;
    session: Float32Array;
    party?: Float32Array;
    chill?: Float32Array;
    drive?: Float32Array;
}

export function resolveUserEmbedding(
    embeddings: UserEmbeddings,
    context?: "party" | "chill" | "drive",
    weights: { global?: number; recent?: number; session?: number; context?: number } = {},
): Float32Array {
    const contextual = context ? embeddings[context] : undefined;
    const layers = [
        { value: embeddings.global, weight: weights.global ?? 1 },
        { value: embeddings.recent, weight: weights.recent ?? 2 },
        { value: embeddings.session, weight: weights.session ?? 3 },
        ...(contextual ? [{ value: contextual, weight: weights.context ?? 3 }] : []),
    ];
    const length = Math.min(...layers.map((layer) => layer.value.length));
    const result = new Float32Array(length);
    const totalWeight = layers.reduce((sum, layer) => sum + Math.max(0, layer.weight), 0) || 1;
    for (let index = 0; index < length; index++)
        result[index] =
            layers.reduce((sum, layer) => sum + layer.value[index]! * Math.max(0, layer.weight), 0) / totalWeight;
    return result;
}

export function embeddingAffinity(user: Float32Array, context: Float32Array, track: Float32Array): number {
    const blended = new Float32Array(Math.min(user.length, context.length));
    for (let index = 0; index < blended.length; index++) blended[index] = user[index]! * 0.6 + context[index]! * 0.4;
    return round(cosineSimilarity(blended, track));
}
