import type { ConcreteExperienceId } from "./experience-engine";
import { harmonicScore } from "./key";
import type { TrackProfile } from "./track-profile";
import type { TransitionPlan, TransitionType } from "./transition-planner";

export interface PlaybackCapabilities {
    rawPcm: boolean;
    dualDeck: boolean;
    preciseSeek: boolean;
    playbackRate: boolean;
    pitchShift: boolean;
    crossfade: boolean;
    eq: boolean;
    effects: boolean;
    stemSeparation: boolean;
    offlineAnalysis: boolean;
}

export const FULL_PLAYBACK_CAPABILITIES: PlaybackCapabilities = {
    rawPcm: true,
    dualDeck: true,
    preciseSeek: true,
    playbackRate: true,
    pitchShift: true,
    crossfade: true,
    eq: true,
    effects: true,
    stemSeparation: true,
    offlineAnalysis: true,
};

export type CapabilityExecutionMode = "full-engine" | "smart-crossfade" | "native-ordering";

export interface CapabilityPlan {
    plan: TransitionPlan;
    mode: CapabilityExecutionMode;
    experiencePreserved: ConcreteExperienceId;
    degraded: boolean;
    disabled: string[];
    reasons: string[];
}

const EFFECT_TYPES = new Set<TransitionType>(["filter", "echo", "bassdrop", "spinback", "gate", "roll", "riser"]);

/** Keep the requested experience while reducing only the unavailable execution technique. */
export function gatePlanByCapabilities(
    requested: TransitionPlan,
    capabilities: PlaybackCapabilities,
    experience: ConcreteExperienceId,
): CapabilityPlan {
    const disabled: string[] = [];
    const reasons: string[] = [];
    let plan = { ...requested };
    let mode: CapabilityExecutionMode = "full-engine";

    if (!capabilities.rawPcm || !capabilities.dualDeck)
        mode = capabilities.crossfade ? "smart-crossfade" : "native-ordering";
    if (!capabilities.crossfade || !capabilities.dualDeck) {
        disabled.push("dual-deck-transition");
        plan = {
            type: "cut",
            fadeSec: 0.05,
            eqSweep: false,
            tempoRatio: 1,
            reason: `${requested.reason}; provider-native handoff`,
        };
        reasons.push("provider cannot render overlapping decks; preserved experience through ordering");
    } else {
        if (EFFECT_TYPES.has(plan.type) && !capabilities.effects) {
            disabled.push(`effect:${plan.type}`);
            plan = { ...plan, type: "blend", reason: `${plan.reason}; effect-free capability fallback` };
            reasons.push("effects unavailable; using smart blend");
        }
        if (plan.type === "acapella" && !capabilities.stemSeparation) {
            disabled.push("stem-mix");
            plan = { ...plan, type: "blend", reason: `${plan.reason}; stem-free capability fallback` };
            reasons.push("stems unavailable; using full-mix blend");
        }
        if (plan.tempoRatio !== 1 && !capabilities.playbackRate) {
            disabled.push("tempo-sync");
            const { stretch: _stretch, ...withoutStretch } = plan;
            plan = { ...withoutStretch, tempoRatio: 1, reason: `${plan.reason}; native tempo` };
            reasons.push("playback-rate control unavailable");
        }
        if (plan.eqSweep && !capabilities.eq) {
            disabled.push("eq-sweep");
            plan = { ...plan, eqSweep: false, reason: `${plan.reason}; flat-EQ fallback` };
            reasons.push("provider EQ unavailable");
        }
    }
    return { plan, mode, experiencePreserved: experience, degraded: disabled.length > 0, disabled, reasons };
}

export interface SemanticEmbedding {
    track: Float32Array;
    sections: Float32Array[];
}

export interface MoodVector {
    relaxed: number;
    romantic: number;
    energetic: number;
    dark: number;
    uplifting: number;
}

export interface RetrievalTrack {
    profile: TrackProfile;
    embedding?: SemanticEmbedding;
    mood?: Partial<MoodVector>;
}

export interface RetrievedCandidate {
    track: RetrievalTrack;
    retrievalScore: number;
    detailedScore: number;
    uncertainty: number;
    utility: number;
}

export interface TwoStageSelection {
    retrieved: RetrievedCandidate[];
    ranked: RetrievedCandidate[];
    planned: RetrievedCandidate[];
    simulated: RetrievedCandidate[];
    selected: RetrievedCandidate | null;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

export function cosineSimilarity(left: Float32Array, right: Float32Array): number {
    const length = Math.min(left.length, right.length);
    if (!length) return 0;
    let dot = 0;
    let a = 0;
    let b = 0;
    for (let index = 0; index < length; index++) {
        dot += left[index]! * right[index]!;
        a += left[index]! ** 2;
        b += right[index]! ** 2;
    }
    return a > 0 && b > 0 ? clamp01((dot / Math.sqrt(a * b) + 1) / 2) : 0;
}

function moodSimilarity(left: Partial<MoodVector> = {}, right: Partial<MoodVector> = {}): number {
    const keys: (keyof MoodVector)[] = ["relaxed", "romantic", "energetic", "dark", "uplifting"];
    const known = keys.filter((key) => left[key] !== undefined && right[key] !== undefined);
    if (!known.length) return 0.5;
    return 1 - known.reduce((sum, key) => sum + Math.abs(left[key]! - right[key]!), 0) / known.length;
}

function metadataSimilarity(left: TrackProfile, right: TrackProfile): number {
    const bpm = left.bpm > 0 && right.bpm > 0 ? 1 - Math.min(1, Math.abs(left.bpm - right.bpm) / 60) : 0.45;
    const key = left.key && right.key ? harmonicScore(left.key, right.key) : 0.5;
    const energy = 1 - Math.abs(left.energy - right.energy);
    const timbre = 1 - Math.abs(left.acousticness - right.acousticness);
    return clamp01(bpm * 0.25 + key * 0.2 + energy * 0.3 + timbre * 0.25);
}

export function riskAwareUtility(expectedQuality: number, uncertainty: number, riskWeight: number): number {
    return round(expectedQuality - clamp01(riskWeight) * Math.max(0, uncertainty));
}

/** Retrieval → detailed ranking → journey shortlist → simulated finalists. */
export function selectTracksTwoStage(
    current: RetrievalTrack,
    candidates: readonly RetrievalTrack[],
    options: {
        riskWeight?: number;
        retrievalLimit?: number;
        rankingLimit?: number;
        planningLimit?: number;
        simulationLimit?: number;
    } = {},
): TwoStageSelection {
    const riskWeight = options.riskWeight ?? 0.45;
    const retrieved = candidates
        .filter((candidate) => candidate.profile.trackId !== current.profile.trackId)
        .map((candidate) => {
            const embedding =
                current.embedding && candidate.embedding
                    ? cosineSimilarity(current.embedding.track, candidate.embedding.track)
                    : 0.5;
            const metadata = metadataSimilarity(current.profile, candidate.profile);
            const mood = moodSimilarity(current.mood, candidate.mood);
            const retrievalScore = clamp01(embedding * 0.5 + metadata * 0.3 + mood * 0.2);
            const confidence = Math.min(current.profile.confidence.overall, candidate.profile.confidence.overall);
            const detailedScore = clamp01(metadata * 0.55 + mood * 0.2 + embedding * 0.25);
            const uncertainty = clamp01(1 - confidence);
            return {
                track: candidate,
                retrievalScore: round(retrievalScore),
                detailedScore: round(detailedScore),
                uncertainty: round(uncertainty),
                utility: riskAwareUtility(detailedScore, uncertainty, riskWeight),
            };
        })
        .sort(
            (a, b) =>
                b.retrievalScore - a.retrievalScore || a.track.profile.trackId.localeCompare(b.track.profile.trackId),
        )
        .slice(0, options.retrievalLimit ?? 100);
    const ranked = [...retrieved]
        .sort((a, b) => b.utility - a.utility || b.detailedScore - a.detailedScore)
        .slice(0, options.rankingLimit ?? 20);
    const planned = ranked.slice(0, options.planningLimit ?? 5);
    const simulated = planned.slice(0, options.simulationLimit ?? 2);
    return { retrieved, ranked, planned, simulated, selected: simulated[0] ?? null };
}

export interface CompatibilityEdge {
    from: string;
    to: string;
    score: number;
}

/** Lazily materialized compatibility graph; only queried pairs create edges. */
export class LazyCompatibilityGraph {
    readonly #profiles = new Map<string, TrackProfile>();
    readonly #edges = new Map<string, CompatibilityEdge>();

    constructor(profiles: readonly TrackProfile[]) {
        for (const profile of profiles) this.#profiles.set(profile.trackId, profile);
    }

    edge(from: string, to: string): CompatibilityEdge | null {
        if (from === to) return { from, to, score: 1 };
        const key = from < to ? `${from}\u0000${to}` : `${to}\u0000${from}`;
        const cached = this.#edges.get(key);
        if (cached) return cached.from === from ? cached : { from, to, score: cached.score };
        const left = this.#profiles.get(from);
        const right = this.#profiles.get(to);
        if (!left || !right) return null;
        const edge = { from, to, score: round(metadataSimilarity(left, right)) };
        this.#edges.set(key, edge);
        return edge;
    }

    get materializedEdgeCount(): number {
        return this.#edges.size;
    }
}

export interface SonicRoute {
    trackIds: string[];
    score: number;
    reachedTarget: boolean;
}

/** Bounded beam search finds a musical bridge without constructing an O(n²) graph. */
export function planSonicRoute(
    startId: string,
    targetId: string,
    profiles: readonly TrackProfile[],
    maxHops = 4,
    beamWidth = 20,
): SonicRoute {
    const graph = new LazyCompatibilityGraph(profiles);
    let frontier = [{ ids: [startId], score: 1 }];
    let best = frontier[0]!;
    for (let depth = 0; depth < Math.max(1, maxHops); depth++) {
        const next: typeof frontier = [];
        for (const route of frontier) {
            for (const profile of profiles) {
                if (route.ids.includes(profile.trackId)) continue;
                const edge = graph.edge(route.ids.at(-1)!, profile.trackId);
                if (!edge) continue;
                const ids = [...route.ids, profile.trackId];
                const score = route.score * edge.score;
                if (profile.trackId === targetId) return { trackIds: ids, score: round(score), reachedTarget: true };
                next.push({ ids, score });
                if (score > best.score || best.ids.length === 1) best = { ids, score };
            }
        }
        frontier = next.sort((a, b) => b.score - a.score).slice(0, beamWidth);
        if (!frontier.length) break;
    }
    return { trackIds: best.ids, score: round(best.score), reachedTarget: best.ids.at(-1) === targetId };
}
