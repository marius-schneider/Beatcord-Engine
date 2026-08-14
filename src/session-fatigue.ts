export interface SessionFatigueInput {
    recentArtists: readonly string[];
    recentGenres: readonly string[];
    recentKeys: readonly string[];
    recentBpms: readonly number[];
    vocalDensityHistory: readonly number[];
    energyHistory: readonly number[];
    transitionHistory: readonly { type: string }[];
}

export interface FatigueState {
    artistRepetition: number;
    genreRepetition: number;
    transitionRepetition: number;
    vocalFatigue: number;
    energyFlatness: number;
    effectFatigue: number;
    tempoFlatness: number;
    keyRepetition: number;
    total: number;
    dominant: keyof Omit<FatigueState, "total" | "dominant" | "recommendations">;
    recommendations: string[];
}

export interface TransitionNoveltyBudget {
    transitionType: string;
    recentCount: number;
    consecutiveCount: number;
    used: number;
    remaining: number;
    penalty: number;
    reasons: string[];
}

const EFFECT_WEIGHT: Record<string, number> = {
    fade: 0.1,
    blend: 0.18,
    cut: 0.35,
    echo: 0.42,
    filter: 0.55,
    bassdrop: 0.78,
    gate: 0.8,
    riser: 0.82,
    spinback: 0.92,
    roll: 0.92,
    acapella: 1,
};

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
}

function round(value: number, digits = 3): number {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function repetition(values: readonly string[], window = 8): number {
    const recent = values.filter(Boolean).slice(-window);
    if (recent.length < 2) return 0;
    const counts = new Map<string, number>();
    for (const value of recent) counts.set(value, (counts.get(value) ?? 0) + 1);
    const max = Math.max(...counts.values());
    return clamp01((max - 1) / Math.max(1, recent.length - 1));
}

function numericFlatness(values: readonly number[], tolerance: number, window = 8): number {
    const recent = values.filter(Number.isFinite).slice(-window);
    if (recent.length < 3) return 0;
    const range = Math.max(...recent) - Math.min(...recent);
    const sampleConfidence = clamp01((recent.length - 2) / 4);
    return clamp01((1 - range / tolerance) * sampleConfidence);
}

function consecutiveCount(types: readonly string[], target: string): number {
    let count = 0;
    for (let index = types.length - 1; index >= 0 && types[index] === target; index--) count++;
    return count;
}

/** Convert bounded musical memory into an explicit, inspectable fatigue state. */
export function assessSessionFatigue(input: SessionFatigueInput): FatigueState {
    const transitionTypes = input.transitionHistory.map((entry) => entry.type);
    const recentVocals = input.vocalDensityHistory.slice(-6);
    const averageVocals = recentVocals.length
        ? recentVocals.reduce((sum, value) => sum + value, 0) / recentVocals.length
        : 0;
    const vocalStreak = [...recentVocals].reverse().findIndex((value) => value < 0.6);
    const vocalFatigue = clamp01(
        Math.max(0, (averageVocals - 0.48) / 0.42) * 0.7 +
            ((vocalStreak === -1 ? recentVocals.length : vocalStreak) / 6) * 0.3,
    );
    const recentEffects = transitionTypes.slice(-6);
    const averageEffect = recentEffects.length
        ? recentEffects.reduce((sum, type) => sum + (EFFECT_WEIGHT[type] ?? 0.5), 0) / recentEffects.length
        : 0;
    const state = {
        artistRepetition: repetition(input.recentArtists),
        genreRepetition: repetition(input.recentGenres),
        transitionRepetition: repetition(transitionTypes, 6),
        vocalFatigue,
        energyFlatness: numericFlatness(input.energyHistory, 0.28),
        effectFatigue: clamp01(averageEffect * 0.7 + repetition(recentEffects, 6) * 0.3),
        tempoFlatness: numericFlatness(input.recentBpms, 14),
        keyRepetition: repetition(input.recentKeys),
    };
    const weighted =
        state.artistRepetition * 0.13 +
        state.genreRepetition * 0.14 +
        state.transitionRepetition * 0.17 +
        state.vocalFatigue * 0.15 +
        state.energyFlatness * 0.14 +
        state.effectFatigue * 0.13 +
        state.tempoFlatness * 0.08 +
        state.keyRepetition * 0.06;
    const entries = Object.entries(state) as [keyof typeof state, number][];
    const dominant = entries.sort((a, b) => b[1] - a[1])[0]?.[0] ?? "transitionRepetition";
    const recommendations: string[] = [];
    if (state.artistRepetition >= 0.45) recommendations.push("rotate artist");
    if (state.genreRepetition >= 0.55) recommendations.push("introduce compatible genre contrast");
    if (state.transitionRepetition >= 0.5) recommendations.push("rotate transition strategy");
    if (state.vocalFatigue >= 0.55) recommendations.push("prefer instrumental or low-vocal track");
    if (state.energyFlatness >= 0.55) recommendations.push("create a controlled energy contour");
    if (state.effectFatigue >= 0.55) recommendations.push("reduce effect complexity");
    if (state.tempoFlatness >= 0.65) recommendations.push("allow a modest tempo contrast");
    if (state.keyRepetition >= 0.65) recommendations.push("move around the harmonic wheel");
    return {
        artistRepetition: round(state.artistRepetition),
        genreRepetition: round(state.genreRepetition),
        transitionRepetition: round(state.transitionRepetition),
        vocalFatigue: round(state.vocalFatigue),
        energyFlatness: round(state.energyFlatness),
        effectFatigue: round(state.effectFatigue),
        tempoFlatness: round(state.tempoFlatness),
        keyRepetition: round(state.keyRepetition),
        total: round(weighted),
        dominant,
        recommendations,
    };
}

/** Recency-weighted budget: repeated show-off moves decay naturally as they leave the window. */
export function transitionNoveltyBudget(
    transitionType: string,
    history: readonly { type: string }[],
): TransitionNoveltyBudget {
    const recent = history.slice(-8).map((entry) => entry.type);
    let weightedHits = 0;
    for (let index = 0; index < recent.length; index++) {
        if (recent[index] === transitionType) weightedHits += (index + 1) / recent.length;
    }
    const recentCount = recent.filter((type) => type === transitionType).length;
    const consecutive = consecutiveCount(recent, transitionType);
    const effectWeight = EFFECT_WEIGHT[transitionType] ?? 0.5;
    const used = clamp01(weightedHits / 2.4 + Math.max(0, consecutive - 1) * 0.22);
    const penalty = clamp01(used * effectWeight);
    const reasons: string[] = [];
    if (recentCount >= 2) reasons.push(`${transitionType} used ${recentCount}× in recent window`);
    if (consecutive >= 2) reasons.push(`${consecutive} consecutive ${transitionType} transitions`);
    if (penalty >= 0.5) reasons.push("novelty budget depleted");
    return {
        transitionType,
        recentCount,
        consecutiveCount: consecutive,
        used: round(used),
        remaining: round(1 - penalty),
        penalty: round(penalty),
        reasons,
    };
}
