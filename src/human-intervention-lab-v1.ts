const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export type AutonomyModeV1 = "director-first" | "hybrid" | "album-pure";
export type InterventionLevelV1 = 0 | 1 | 2 | 3 | 4 | 5;
export interface InterventionAssessmentV1 {
    expectedExperienceImprovement: number;
    decisionConfidence: number;
    disruptionCost: number;
    artisticCost: number;
    userControlCost: number;
}

export function interventionUtility(input: InterventionAssessmentV1): number {
    return round(
        clamp01(input.expectedExperienceImprovement) * clamp01(input.decisionConfidence) -
            clamp01(input.disruptionCost) -
            clamp01(input.artisticCost) -
            clamp01(input.userControlCost),
    );
}

export function musicalSwitchingCost(input: {
    currentSongValue: number;
    upcomingPayoff: number;
    userSelected: boolean;
    albumIntegrity: number;
    artistPreservation: number;
    currentFlow: number;
    cognitiveDisruption: number;
    queueSurprise: number;
}): number {
    return round(
        clamp01(input.currentSongValue) * 0.2 +
            clamp01(input.upcomingPayoff) * 0.2 +
            Number(input.userSelected) * 0.15 +
            clamp01(input.albumIntegrity) * 0.1 +
            clamp01(input.artistPreservation) * 0.05 +
            clamp01(input.currentFlow) * 0.15 +
            clamp01(input.cognitiveDisruption) * 0.1 +
            clamp01(input.queueSurprise) * 0.05,
    );
}

export function interventionThreshold(input: {
    mode: AutonomyModeV1;
    level: InterventionLevelV1;
    trust: number;
}): number {
    const modeBase = input.mode === "director-first" ? 0.15 : input.mode === "hybrid" ? 0.3 : 0.5;
    const levelCost = input.level * 0.09;
    const earnedTrustDiscount = clamp01(input.trust) * 0.08;
    return round(modeBase + levelCost - earnedTrustDiscount);
}

export function decideIntervention(input: {
    assessment: InterventionAssessmentV1;
    mode: AutonomyModeV1;
    level: InterventionLevelV1;
    trust: number;
    persistenceMs: number;
    minimumPersistenceMs: number;
}): { action: "act" | "preserve" | "plan-future"; utility: number; threshold: number; precisionOverRecall: true } {
    const utility = interventionUtility(input.assessment);
    const threshold = interventionThreshold(input);
    if (input.persistenceMs < input.minimumPersistenceMs)
        return { action: "preserve", utility, threshold, precisionOverRecall: true };
    if (utility > threshold)
        return { action: input.level <= 1 ? "plan-future" : "act", utility, threshold, precisionOverRecall: true };
    return { action: "preserve", utility, threshold, precisionOverRecall: true };
}

export function temporalOpportunityDecision(input: {
    immediateBenefit: number;
    immediateSwitchingCost: number;
    futureBenefit: number;
    waitSeconds: number;
}): "change-now" | "wait-for-section" {
    const immediate = input.immediateBenefit - input.immediateSwitchingCost;
    const waiting = input.futureBenefit - clamp01(input.waitSeconds / 120) * 0.2;
    return waiting >= immediate ? "wait-for-section" : "change-now";
}

export function updateInterventionTrust(input: {
    currentTrust: number;
    accepted: number;
    undone: number;
    evidenceWindow: number;
}): number {
    if (input.evidenceWindow < 10) return round(clamp01(input.currentTrust));
    const evidence = input.accepted + input.undone;
    if (!evidence) return round(clamp01(input.currentTrust));
    const observed = input.accepted / evidence;
    return round(clamp01(input.currentTrust * 0.9 + observed * 0.1));
}

export function explanationImportance(
    action: "normal-choice" | "genre-jump" | "queue-move" | "dsp-downgrade",
    powerUser = false,
): "none" | "on-demand" | "proactive" {
    if (action === "normal-choice") return "none";
    if (action === "queue-move") return "proactive";
    if (action === "dsp-downgrade") return powerUser ? "proactive" : "on-demand";
    return "on-demand";
}

export function sessionRegret(input: {
    skip: number;
    queue: number;
    transition: number;
    discovery: number;
    intervention: number;
    preservation: number;
}): { total: number; components: typeof input } {
    const total = Object.values(input).reduce((sum, value) => sum + Math.max(0, value), 0);
    return { total: round(total), components: input };
}

export function activeEvaluationPairs<T extends { id: string; modelScores: readonly number[] }>(
    candidates: readonly T[],
    limit: number,
): T[] {
    return [...candidates]
        .map((candidate) => ({
            candidate,
            disagreement: Math.max(...candidate.modelScores) - Math.min(...candidate.modelScores),
        }))
        .sort((a, b) => b.disagreement - a.disagreement || a.candidate.id.localeCompare(b.candidate.id))
        .slice(0, Math.max(0, limit))
        .map(({ candidate }) => candidate);
}

export const HUMAN_EVALUATION_PROGRAM_V1 = {
    agencyControls: ["why", "undo", "correct", "dont-learn"],
    interventionLevels: [
        "do-nothing",
        "plan-future",
        "subtle-playback",
        "reorder-future",
        "change-next",
        "interrupt-current",
    ],
    experiments: [
        "frequency",
        "invisible-intelligence",
        "missed-vs-bad",
        "preserve-current-song",
        "explanation-threshold",
    ],
    methods: ["controlled-listening", "multi-session-field-study", "longitudinal-autonomy"],
    humanBench: [
        "transition-pairs",
        "difficult-rhythms",
        "stem-artifacts",
        "journey-decisions",
        "intervention-decisions",
    ],
    splitBy: ["listener", "track", "artist", "genre", "transition-pair"],
    expertRole: "diagnosis-technical-causality",
    listenerRole: "product-preference",
    priority: [
        "p0-data-infrastructure",
        "p1-transition",
        "p1-beat-mesh",
        "p1-human-experience",
        "p2-stem-utility",
        "p2-p3-longitudinal-taste",
    ],
    northStar: "session-regret",
    finalPrinciple: "earn-every-intervention",
} as const;

export const FIVE_LAB_ARCHITECTURE_V1 = {
    labs: ["transition", "beat-mesh", "stem-utility", "human-experience", "longitudinal-taste"],
    dataInfrastructure: [
        "decision-provenance",
        "undo-reaction-log",
        "exposure-ledger",
        "confidence-calibration",
        "rendered-transition-archive",
        "track-section-identity",
    ],
    complexityIsSuccessMetric: false,
    ideasMayFail: true,
} as const;
