const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export type LongitudinalCohortV1 = "active-explorer" | "hybrid-listener" | "algorithm-led" | "album-artist-listener";
export interface TasteEvidenceCountsV1 {
    algorithmGenerated: number;
    voluntary: number;
    editorial: number;
    organic: number;
}
export interface DiscoverySignalsV1 {
    saved: boolean;
    replayAfterWeek: boolean;
    replayAfterMonth: boolean;
    voluntaryArtistExploration: boolean;
    playlistAdd: boolean;
}

export function longitudinalSelfInfluence(evidence: TasteEvidenceCountsV1): {
    ratio: number;
    certaintyMultiplier: number;
    automaticallyBad: false;
} {
    const total = evidence.algorithmGenerated + evidence.voluntary + evidence.editorial + evidence.organic;
    const ratio = total ? evidence.algorithmGenerated / total : 0;
    return { ratio: round(ratio), certaintyMultiplier: round(1 - clamp01(ratio) * 0.5), automaticallyBad: false };
}

export function meaningfulDiscoveryScore(signals: DiscoverySignalsV1): number {
    return round(
        Number(signals.saved) * 0.15 +
            Number(signals.replayAfterWeek) * 0.2 +
            Number(signals.replayAfterMonth) * 0.3 +
            Number(signals.voluntaryArtistExploration) * 0.2 +
            Number(signals.playlistAdd) * 0.15,
    );
}

export function discoveryHalfLife(signals: DiscoverySignalsV1): "none" | "session" | "week" | "month" {
    if (signals.replayAfterMonth) return "month";
    if (signals.replayAfterWeek) return "week";
    if (signals.saved || signals.playlistAdd || signals.voluntaryArtistExploration) return "session";
    return "none";
}

export function tasteEvolutionAssessment(input: {
    profileDrift: number;
    userConfirmedChange: number;
    profileIdentification: number;
}): { state: "stable" | "confirmed-evolution" | "possible-contamination"; correctionRequired: boolean } {
    if (input.profileDrift <= 0.15 && input.profileIdentification >= 0.7)
        return { state: "stable", correctionRequired: false };
    if (input.userConfirmedChange >= input.profileDrift * 0.7)
        return { state: "confirmed-evolution", correctionRequired: false };
    return { state: "possible-contamination", correctionRequired: true };
}

export function autonomyPolicyForCohort(cohort: LongitudinalCohortV1): {
    algorithmicShareTarget: number;
    voluntaryDiscoveryWeight: number;
} {
    if (cohort === "active-explorer") return { algorithmicShareTarget: 0.25, voluntaryDiscoveryWeight: 1 };
    if (cohort === "algorithm-led") return { algorithmicShareTarget: 0.7, voluntaryDiscoveryWeight: 0.6 };
    if (cohort === "album-artist-listener") return { algorithmicShareTarget: 0.2, voluntaryDiscoveryWeight: 0.9 };
    return { algorithmicShareTarget: 0.5, voluntaryDiscoveryWeight: 0.8 };
}

export function longitudinalLabSuccess(input: {
    satisfactionGain: number;
    discoveryGain: number;
    profileAccuracyGain: number;
    agencyChange: number;
}): { success: boolean; agencyProtected: boolean } {
    const agencyProtected = input.agencyChange >= -0.02;
    return {
        success:
            input.satisfactionGain > 0 && input.discoveryGain > 0 && input.profileAccuracyGain > 0 && agencyProtected,
        agencyProtected,
    };
}

export const LONGITUDINAL_TASTE_LAB_V1 = {
    minimumWeeks: 12,
    outcomes: ["satisfaction", "identity", "discovery", "autonomy"],
    antiMetrics: [
        "repetition-fatigue",
        "artist-concentration",
        "genre-narrowing",
        "passive-consumption-dominance",
        "recommendation-self-influence",
        "reduced-voluntary-search",
        "profile-contamination",
        "context-leakage",
    ],
    voluntarySignals: [
        "user-search",
        "manual-queue-add",
        "artist-page-exploration",
        "album-open",
        "user-initiated-replay",
    ],
    studyGroups: ["behavioral-recommender", "causal-taste-memory", "causal-taste-adaptive-discovery"],
    weeklyQuestions: 4,
    monthlyProfileActions: ["confirm", "remove", "correct"],
} as const;
