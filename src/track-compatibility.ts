import { harmonicScore } from "./key";
import { assessTempoRelationship, type TempoRelation } from "./tempo-awareness";
import type { TrackProfile } from "./track-profile";

export interface CompatibilityTarget {
    energy: number;
    valence?: number;
    danceability?: number;
    acousticness?: number;
}

/** Interpretable directed edge in the library/session compatibility graph. */
export interface TrackCompatibility {
    fromTrackId: string;
    toTrackId: string;
    beat: number;
    tempo: number;
    tempoRelation: TempoRelation;
    tempoPlausibility: number;
    key: number;
    phrase: number;
    energy: number;
    genre: number;
    vocals: number;
    timbre: number;
    experience: number;
    total: number;
    confidence: number;
    reasons: string[];
}

export interface TrackCompatibilityGraph {
    version: 2;
    nodeIds: string[];
    edges: TrackCompatibility[];
}

export interface TrackCompatibilityRoute {
    trackIds: string[];
    edges: TrackCompatibility[];
    directScore: number;
    futureScore: number;
    score: number;
}

export interface CompatibilityRouteOptions {
    depth?: number;
    decay?: number;
    maxBranching?: number;
    target?: CompatibilityTarget;
}

const WEIGHTS = {
    beat: 0.08,
    tempo: 0.14,
    key: 0.14,
    phrase: 0.12,
    energy: 0.12,
    genre: 0.1,
    vocals: 0.12,
    timbre: 0.08,
    experience: 0.1,
} as const;

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
}

function round(value: number, digits = 3): number {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function genreScore(from: TrackProfile, to: TrackProfile): number {
    const a = from.genres.filter((genre) => genre.genre !== "unknown");
    const b = to.genres.filter((genre) => genre.genre !== "unknown");
    if (!a.length || !b.length) return 0.5;
    let shared = 0;
    for (const left of a) {
        for (const right of b) {
            if (left.genre === right.genre) shared = Math.max(shared, Math.min(left.confidence, right.confidence));
        }
    }
    return shared > 0 ? clamp01(0.55 + shared * 0.45) : 0.28;
}

function phraseScore(from: TrackProfile, to: TrackProfile): number {
    const out = from.mixOutRegions?.[0]?.mixOutQuality;
    const incoming = to.mixInRegions?.[0]?.mixInQuality;
    const local = out !== undefined && incoming !== undefined ? (out + incoming) / 2 : 0.5;
    return clamp01(local * 0.65 + ((from.confidence.phrase + to.confidence.phrase) / 2) * 0.35);
}

function timbreScore(from: TrackProfile, to: TrackProfile): number {
    const a = from.beatGrid?.spectral;
    const b = to.beatGrid?.spectral;
    if (!a || !b) return 0.5;
    const centroid = Math.abs(a.centroid - b.centroid) / 5_000;
    const flatness = Math.abs(a.flatness - b.flatness) / 0.35;
    const flux = Math.abs(a.flux - b.flux);
    return clamp01(1 - centroid * 0.5 - flatness * 0.3 - flux * 0.2);
}

function experienceScore(profile: TrackProfile, target?: CompatibilityTarget): number {
    if (!target) return 0.5;
    const values = [1 - Math.abs(profile.energy - target.energy)];
    if (target.valence !== undefined) values.push(1 - Math.abs(profile.valence - target.valence));
    if (target.danceability !== undefined) values.push(1 - Math.abs(profile.danceability - target.danceability));
    if (target.acousticness !== undefined) values.push(1 - Math.abs(profile.acousticness - target.acousticness));
    return clamp01(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/** Score one directed hand-off without hiding uncertainty inside a single opaque number. */
export function assessTrackCompatibility(
    from: TrackProfile,
    to: TrackProfile,
    target?: CompatibilityTarget,
): TrackCompatibility {
    const tempoRelationship = assessTempoRelationship(from.bpm, to.bpm, {
        current: {
            confidence: from.bpmConfidence,
            ...(from.beatGrid?.analysisConfidence
                ? { agreement: from.beatGrid.analysisConfidence.tempo.agreement }
                : {}),
            ...(from.beatGrid ? { percussiveness: from.beatGrid.energy.percussiveness } : {}),
        },
        next: {
            confidence: to.bpmConfidence,
            ...(to.beatGrid?.analysisConfidence ? { agreement: to.beatGrid.analysisConfidence.tempo.agreement } : {}),
            ...(to.beatGrid ? { percussiveness: to.beatGrid.energy.percussiveness } : {}),
        },
    });
    const tempo = tempoRelationship.compatible
        ? clamp01(0.55 + tempoRelationship.plausibility * 0.45 - tempoRelationship.effectiveGap * 1.5)
        : clamp01(1 - tempoRelationship.effectiveGap / 0.16);
    const beat = clamp01(
        (1 - Math.abs(from.danceability - to.danceability)) * 0.55 +
            ((from.confidence.beatGrid + to.confidence.beatGrid) / 2) * 0.45,
    );
    const fromKey = from.beatGrid?.key.camelot;
    const toKey = to.beatGrid?.key.camelot;
    const key = fromKey && toKey ? harmonicScore(fromKey, toKey) : 0.5;
    const phrase = phraseScore(from, to);
    const energy = clamp01(1 - Math.abs(from.energy - to.energy));
    const genre = genreScore(from, to);
    const vocals = clamp01(1 - from.vocalness * to.vocalness * 0.85);
    const timbre = timbreScore(from, to);
    const experience = experienceScore(to, target);
    const total =
        beat * WEIGHTS.beat +
        tempo * WEIGHTS.tempo +
        key * WEIGHTS.key +
        phrase * WEIGHTS.phrase +
        energy * WEIGHTS.energy +
        genre * WEIGHTS.genre +
        vocals * WEIGHTS.vocals +
        timbre * WEIGHTS.timbre +
        experience * WEIGHTS.experience;
    const confidence = clamp01(
        (from.confidence.overall + to.confidence.overall + from.confidence.phrase + to.confidence.phrase) / 4,
    );
    const reasons: string[] = [];
    if (tempo >= 0.8) reasons.push(`tempo bridge is close (${tempoRelationship.label})`);
    else if (tempo < 0.35) reasons.push("wide tempo gap");
    if (key >= 0.7) reasons.push("harmonic hand-off");
    else if (key < 0.35) reasons.push("key clash risk");
    if (phrase >= 0.72) reasons.push("strong phrase regions");
    if (vocals < 0.55) reasons.push("vocal collision risk");
    if (experience >= 0.75) reasons.push("experience target fit");
    return {
        fromTrackId: from.trackId,
        toTrackId: to.trackId,
        beat: round(beat),
        tempo: round(tempo),
        tempoRelation: tempoRelationship.relation,
        tempoPlausibility: round(tempoRelationship.plausibility),
        key: round(key),
        phrase: round(phrase),
        energy: round(energy),
        genre: round(genre),
        vocals: round(vocals),
        timbre: round(timbre),
        experience: round(experience),
        total: round(total),
        confidence: round(confidence),
        reasons,
    };
}

export function buildTrackCompatibilityGraph(
    profiles: readonly TrackProfile[],
    target?: CompatibilityTarget,
): TrackCompatibilityGraph {
    const unique = [...new Map(profiles.map((profile) => [profile.trackId, profile])).values()];
    const edges: TrackCompatibility[] = [];
    for (const from of unique) {
        for (const to of unique) {
            if (from.trackId !== to.trackId) edges.push(assessTrackCompatibility(from, to, target));
        }
    }
    return { version: 2, nodeIds: unique.map((profile) => profile.trackId), edges };
}

function summarizeRoute(trackIds: string[], edges: TrackCompatibility[], decay: number): TrackCompatibilityRoute {
    let weighted = 0;
    let weightSum = 0;
    let futureWeighted = 0;
    let futureWeightSum = 0;
    for (let index = 0; index < edges.length; index++) {
        const weight = decay ** index;
        weighted += edges[index]!.total * weight;
        weightSum += weight;
        if (index > 0) {
            futureWeighted += edges[index]!.total * weight;
            futureWeightSum += weight;
        }
    }
    return {
        trackIds,
        edges,
        directScore: edges[0]?.total ?? 0,
        futureScore: round(futureWeightSum ? futureWeighted / futureWeightSum : (edges[0]?.total ?? 0)),
        score: round(weightSum ? weighted / weightSum : 0),
    };
}

/** Score every possible first hop by its best bounded multi-track continuation. */
export function scoreCompatibilityRoutes(
    current: TrackProfile,
    candidates: readonly TrackProfile[],
    options: CompatibilityRouteOptions = {},
): TrackCompatibilityRoute[] {
    const depth = Math.max(1, Math.min(5, Math.floor(options.depth ?? 3)));
    const decay = clamp01(options.decay ?? 0.72);
    const maxBranching = Math.max(1, Math.min(12, Math.floor(options.maxBranching ?? 6)));
    const unique = [
        ...new Map(
            candidates
                .filter((candidate) => candidate.trackId !== current.trackId)
                .map((candidate) => [candidate.trackId, candidate]),
        ).values(),
    ];
    const cache = new Map<string, TrackCompatibility>();
    const edge = (from: TrackProfile, to: TrackProfile): TrackCompatibility => {
        const key = `${from.trackId}\u0000${to.trackId}`;
        const known = cache.get(key);
        if (known) return known;
        const calculated = assessTrackCompatibility(from, to, options.target);
        cache.set(key, calculated);
        return calculated;
    };

    const extend = (
        profile: TrackProfile,
        remaining: readonly TrackProfile[],
        trackIds: string[],
        edges: TrackCompatibility[],
    ): TrackCompatibilityRoute => {
        let best = summarizeRoute(trackIds, edges, decay);
        if (edges.length >= depth || !remaining.length) return best;
        const branches = remaining
            .map((candidate) => ({ candidate, compatibility: edge(profile, candidate) }))
            .sort(
                (a, b) =>
                    b.compatibility.total - a.compatibility.total ||
                    a.candidate.trackId.localeCompare(b.candidate.trackId),
            )
            .slice(0, maxBranching);
        for (const branch of branches) {
            const route = extend(
                branch.candidate,
                remaining.filter((candidate) => candidate.trackId !== branch.candidate.trackId),
                [...trackIds, branch.candidate.trackId],
                [...edges, branch.compatibility],
            );
            if (
                route.score > best.score ||
                (route.score === best.score && route.trackIds.join("\u0000") < best.trackIds.join("\u0000"))
            ) {
                best = route;
            }
        }
        return best;
    };

    return unique
        .map((first) =>
            extend(
                first,
                unique.filter((candidate) => candidate.trackId !== first.trackId),
                [current.trackId, first.trackId],
                [edge(current, first)],
            ),
        )
        .sort((a, b) => b.score - a.score || a.trackIds[1]!.localeCompare(b.trackIds[1]!));
}
