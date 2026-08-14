import type { TasteVector } from "./recommendation-intelligence";

export interface GenreAffinity {
    genre: string;
    affinity: number;
}

export interface CrowdMemberState {
    userId: string;
    taste: TasteVector;
    satisfaction: number;
    fairnessDebt: number;
    active: boolean;
}

export interface CrowdTaste {
    consensus: TasteVector;
    diversity: number;
    members: CrowdMemberState[];
    sharedGenres: GenreAffinity[];
    contestedGenres: GenreAffinity[];
    fairnessDebt: Record<string, number>;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

/** Consensus and disagreement are retained separately; a crowd is never reduced to one average. */
export function buildCrowdTaste(members: readonly CrowdMemberState[]): CrowdTaste {
    const active = members.filter((member) => member.active);
    const genres = [...new Set(active.flatMap((member) => Object.keys(member.taste)))];
    const consensus: TasteVector = {};
    const sharedGenres: GenreAffinity[] = [];
    const contestedGenres: GenreAffinity[] = [];
    let totalVariance = 0;
    for (const genre of genres) {
        const values = active.map((member) => clamp01(member.taste[genre] ?? 0));
        const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
        const minimum = Math.min(...values);
        const maximum = Math.max(...values);
        const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, values.length);
        totalVariance += variance;
        consensus[genre] = round(mean * 0.55 + minimum * 0.45);
        if (minimum >= 0.55) sharedGenres.push({ genre, affinity: round(mean) });
        if (maximum - minimum >= 0.5) contestedGenres.push({ genre, affinity: round(maximum - minimum) });
    }
    return {
        consensus,
        diversity: round(clamp01(Math.sqrt(totalVariance / Math.max(1, genres.length)) * 2)),
        members: active.map((member) => ({ ...member, taste: { ...member.taste } })),
        sharedGenres: sharedGenres.sort((a, b) => b.affinity - a.affinity),
        contestedGenres: contestedGenres.sort((a, b) => b.affinity - a.affinity),
        fairnessDebt: Object.fromEntries(
            active.map((member) => [
                member.userId,
                round(clamp01(member.fairnessDebt + Math.max(0, 0.55 - member.satisfaction) * 0.2)),
            ]),
        ),
    };
}

export function scoreTrackForCrowd(
    crowd: CrowdTaste,
    affinities: Record<string, number>,
): { score: number; minimum: number; fairnessBoost: number; contestedPenalty: number } {
    const memberScores = crowd.members.map((member) => {
        const genres = Object.keys(member.taste);
        const total = genres.reduce((sum, genre) => sum + (affinities[genre] ?? 0) * member.taste[genre]!, 0);
        const weight = genres.reduce((sum, genre) => sum + member.taste[genre]!, 0) || 1;
        return clamp01(total / weight);
    });
    const average = memberScores.reduce((sum, value) => sum + value, 0) / Math.max(1, memberScores.length);
    const minimum = memberScores.length ? Math.min(...memberScores) : 0;
    const fairnessBoost =
        crowd.members.reduce(
            (sum, member, index) => sum + (crowd.fairnessDebt[member.userId] ?? 0) * (memberScores[index] ?? 0),
            0,
        ) / Math.max(1, crowd.members.length);
    const contestedPenalty =
        crowd.contestedGenres.reduce((sum, genre) => sum + (affinities[genre.genre] ?? 0) * genre.affinity, 0) /
        Math.max(1, crowd.contestedGenres.length);
    return {
        score: round(clamp01(average * 0.45 + minimum * 0.35 + fairnessBoost * 0.25 - contestedPenalty * 0.15)),
        minimum: round(minimum),
        fairnessBoost: round(fairnessBoost),
        contestedPenalty: round(contestedPenalty),
    };
}
