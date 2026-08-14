const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export interface BeatMeshFailureMetricsV3 {
    octaveErrorRate: number;
    continuityFailureRate: number;
    catastrophicFailureRate: number;
    downbeatPhaseError: number;
    meterError: number;
    tempoDrift: number;
    highConfidenceWrongRate: number;
}

export function transitionSafetyGain(input: {
    badTransitionsAvoided: number;
    badTransitionsIntroduced: number;
}): number {
    return input.badTransitionsAvoided - input.badTransitionsIntroduced;
}

export function beatMeshComplexityRoi(input: {
    transitionQualityImprovement: number;
    additionalCompute: number;
    additionalComplexity: number;
}): number {
    const cost = Math.max(0.000001, input.additionalCompute + input.additionalComplexity);
    return round(input.transitionQualityImprovement / cost);
}

export function beatMeshDeploymentDecision(input: {
    affectedCatalogRate: number;
    safetyGain: number;
    roi: number;
    failures: BeatMeshFailureMetricsV3;
}): { route: "default" | "escalation" | "classic-grid"; reason: string; aggregateF1Sufficient: false } {
    if (input.safetyGain <= 0 || input.failures.highConfidenceWrongRate > 0.02)
        return { route: "classic-grid", reason: "net-safety-not-proven", aggregateF1Sufficient: false };
    if (input.affectedCatalogRate < 0.01 || input.roi < 0.5)
        return { route: "escalation", reason: "complexity-roi-limited", aggregateF1Sufficient: false };
    return { route: "default", reason: "measurable-transition-safety-gain", aggregateF1Sufficient: false };
}

export const BEAT_MESH_FAILURE_CLASSES_V3: readonly (keyof BeatMeshFailureMetricsV3)[] = [
    "octaveErrorRate",
    "continuityFailureRate",
    "catastrophicFailureRate",
    "downbeatPhaseError",
    "meterError",
    "tempoDrift",
    "highConfidenceWrongRate",
];

export const BEAT_MESH_VALIDATION_V3 = {
    centralQuestion: "audible-failures-prevented-relative-to-complexity",
    failureModesFromResearch: [
        "octave-errors",
        "continuity-errors",
        "complete-tracking-failures",
        "confident-but-wrong",
    ],
    metrics: ["transition-safety-gain", "complexity-roi"],
    escalationForRareCatalog: true,
} as const;
