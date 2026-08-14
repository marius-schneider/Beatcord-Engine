const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export type CoreLocalIntent = "more-energy" | "less-energy" | "more-familiar" | "skip" | "like" | "party" | "chill";
const CORE_LOCAL_INTENTS = new Set<CoreLocalIntent>([
    "more-energy",
    "less-energy",
    "more-familiar",
    "skip",
    "like",
    "party",
    "chill",
]);

export function intentExecutionPath(intent: string): {
    route: "local-fast-path" | "semantic-planner";
    targetLatencyMs: number;
    worksOffline: boolean;
} {
    const local = CORE_LOCAL_INTENTS.has(intent as CoreLocalIntent);
    return {
        route: local ? "local-fast-path" : "semantic-planner",
        targetLatencyMs: local ? 100 : 2_000,
        worksOffline: local,
    };
}

export interface SafeUpcomingPlan<T> {
    committed: T[];
    speculative: T[];
    commitHorizon: number;
}
export function applyDelayedAiPlan<T>(current: SafeUpcomingPlan<T>, replacement: readonly T[]): SafeUpcomingPlan<T> {
    return {
        committed: [...current.committed],
        speculative: [...replacement].slice(current.commitHorizon),
        commitHorizon: current.commitHorizon,
    };
}

export interface ResponsivenessGate {
    searchP95Ms: number;
    libraryP95Ms: number;
    queueP95Ms: number;
}
export function responsivenessReleaseGate(metrics: ResponsivenessGate): {
    pass: boolean;
    failures: (keyof ResponsivenessGate)[];
} {
    const limits: ResponsivenessGate = { searchP95Ms: 800, libraryP95Ms: 500, queueP95Ms: 250 };
    const failures = (Object.keys(limits) as (keyof ResponsivenessGate)[]).filter((key) => metrics[key] > limits[key]);
    return { pass: failures.length === 0, failures };
}

export interface SocialQoe {
    joinLatency: number;
    stateDesync: number;
    reactionDelay: number;
    requestLost: number;
    hostConflict: number;
}
export function socialQoeScore(input: SocialQoe): number {
    return round(
        1 -
            (clamp01(input.joinLatency) * 0.2 +
                clamp01(input.stateDesync) * 0.3 +
                clamp01(input.reactionDelay) * 0.15 +
                clamp01(input.requestLost) * 0.25 +
                clamp01(input.hostConflict) * 0.1),
    );
}

export function integrationQoe(failed: boolean): {
    playbackAffected: false;
    status: "healthy" | "degraded";
    visible: true;
} {
    return { playbackAffected: false, status: failed ? "degraded" : "healthy", visible: true };
}

export type QoeSeverity = "info" | "degraded" | "at-risk" | "critical";
export interface QoeSignals {
    network: number;
    cpu: number;
    buffer: number;
    device: number;
    search: number;
    ai: number;
    social: number;
    integrations: number;
}
export type QoeGuardianAction = "continue" | "prebuffer" | "degrade" | "retry" | "fallback" | "notify";
export function qoeGuardian(signals: QoeSignals): {
    severity: QoeSeverity;
    actions: QoeGuardianAction[];
    weakestSignal: keyof QoeSignals;
} {
    const entries = Object.entries(signals) as [keyof QoeSignals, number][];
    const [weakestSignal, weakest] = entries.reduce((lowest, entry) => (entry[1] < lowest[1] ? entry : lowest));
    const severity: QoeSeverity =
        weakest >= 0.8 ? "info" : weakest >= 0.55 ? "degraded" : weakest >= 0.3 ? "at-risk" : "critical";
    const actions: Record<QoeSeverity, QoeGuardianAction[]> = {
        info: ["continue"],
        degraded: ["degrade", "notify"],
        "at-risk": ["prebuffer", "degrade", "retry", "notify"],
        critical: ["fallback", "notify"],
    };
    return { severity, actions: actions[severity], weakestSignal };
}

export interface FailureBudgetMetrics {
    audioInterruptionsPer100Hours: number;
    transitionFailuresPer1000: number;
    sessionDesyncPer100Sessions: number;
    searchTimeoutRate: number;
    aiCommandFailureRate: number;
}
export function failureBudgetStatus(metrics: FailureBudgetMetrics): {
    withinBudget: boolean;
    exhausted: (keyof FailureBudgetMetrics)[];
} {
    const limits: FailureBudgetMetrics = {
        audioInterruptionsPer100Hours: 1,
        transitionFailuresPer1000: 5,
        sessionDesyncPer100Sessions: 2,
        searchTimeoutRate: 0.01,
        aiCommandFailureRate: 0.02,
    };
    const exhausted = (Object.keys(limits) as (keyof FailureBudgetMetrics)[]).filter(
        (key) => metrics[key] > limits[key],
    );
    return { withinBudget: exhausted.length === 0, exhausted };
}

export interface ExperienceScorecard {
    audioReliability: number;
    sessionSatisfaction: number;
    recommendationAcceptance: number;
    trust: number;
    discovery: number;
    socialEnjoyment: number;
    wouldUseAgain: number;
}
export function experienceScorecard(input: ExperienceScorecard): {
    dimensions: ExperienceScorecard;
    balancedScore: number;
    minutesListenedIsNorthStar: false;
} {
    const values = Object.values(input).map(clamp01);
    return {
        dimensions: input,
        balancedScore: round(values.reduce((sum, value) => sum + value, 0) / values.length),
        minutesListenedIsNorthStar: false,
    };
}

export const ULTIMATE_CONTEXT_BRAIN = ["temporal", "activity", "social", "device", "intent", "confidence"] as const;
export const ULTIMATE_SERENDIPITY_BRAIN = [
    "curiosity",
    "novelty",
    "familiarity",
    "surprise-budget",
    "discovery-fatigue",
    "explanation",
] as const;
export const ULTIMATE_TRUST_LAYER = [
    "explain",
    "undo",
    "correct",
    "inspect",
    "scope",
    "forget",
    "dont-learn",
    "reduce-autonomy",
] as const;
export const ULTIMATE_QOE_BRAIN = [
    "playback",
    "network",
    "buffer",
    "cpu",
    "device",
    "search",
    "navigation",
    "ai",
    "social",
    "integrations",
] as const;

export const INTELLIGENCE_MILESTONES = {
    33: [
        "context-state",
        "confidence",
        "activity-context",
        "temporal-routines",
        "context-taste",
        "regulation-intent",
        "context-transition",
        "hysteresis",
        "ttl",
        "explicit-overrides",
    ],
    34: [
        "curiosity-state",
        "surprise-budget",
        "novelty-vector",
        "discovery-fatigue",
        "familiarity-anchors",
        "composition-rules",
        "explanatory-discovery",
        "serendipity-feedback",
        "adventure-comfort-policy",
    ],
    35: [
        "failure-taxonomy",
        "issue-reporting",
        "autonomy-level",
        "earned-autonomy",
        "undo",
        "session-reset",
        "explanation-levels",
        "learning-scope",
        "forget-correct",
        "preview-large-changes",
    ],
    36: [
        "playback-qoe",
        "startup-qoe",
        "buffer-health",
        "network-quality",
        "cpu-dsp-health",
        "search-qoe",
        "ai-command-qoe",
        "session-sync-qoe",
        "integration-qoe",
        "failure-budgets",
        "graceful-degradation",
        "qoe-route-planning",
    ],
} as const;

export const FINAL_EXPERIENCE_BRAINS = [
    "music",
    "taste",
    "crowd",
    "artist",
    "context",
    "serendipity",
    "trust",
    "qoe",
    "experience-director",
] as const;
export const ULTIMATE_EXPERIENCE_PRINCIPLE =
    "Right decisions at the right moment, naturally, reversibly, and resiliently.";
