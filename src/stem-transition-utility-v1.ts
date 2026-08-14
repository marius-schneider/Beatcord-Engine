const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export type StemTransitionRoleV1 =
    | "vocal-overlay"
    | "vocal-attenuation"
    | "bass-handoff"
    | "drum-handoff"
    | "atmosphere-bed";
export interface StemUtilityProfileV1 {
    isolation: number;
    artifactSalience: number;
    transientIntegrity: number;
    tonalIntegrity: number;
    spatialIntegrity?: number;
    transitionUtilityByRole: Partial<Record<StemTransitionRoleV1, number>>;
}
export interface StemExposureV1 {
    relativeGainDb: number;
    soloFraction: number;
    durationSeconds: number;
    foregroundProbability: number;
    maskingLevel: number;
}

export function stemExposureRisk(exposure: StemExposureV1): number {
    const gainExposure = clamp01((exposure.relativeGainDb + 18) / 18);
    const durationExposure = clamp01(exposure.durationSeconds / 32);
    return round(
        gainExposure * 0.2 +
            clamp01(exposure.soloFraction) * 0.25 +
            durationExposure * 0.15 +
            clamp01(exposure.foregroundProbability) * 0.25 +
            (1 - clamp01(exposure.maskingLevel)) * 0.15,
    );
}

export function transitionStemUtility(input: {
    profile: StemUtilityProfileV1;
    role: StemTransitionRoleV1;
    exposure: StemExposureV1;
    maskingBenefit: number;
    spatialDamage: number;
    reconstructionRisk: number;
}): number {
    const integrity = (clamp01(input.profile.transientIntegrity) + clamp01(input.profile.tonalIntegrity)) / 2;
    const roleIsolation = clamp01(input.profile.transitionUtilityByRole[input.role] ?? input.profile.isolation);
    const exposureRisk = stemExposureRisk(input.exposure);
    return round(
        clamp01(
            integrity * 0.25 +
                clamp01(input.maskingBenefit) * 0.2 +
                roleIsolation * 0.25 -
                clamp01(input.profile.artifactSalience) * exposureRisk * 0.2 -
                clamp01(input.spatialDamage) * 0.05 -
                clamp01(input.reconstructionRisk) * 0.05,
        ),
    );
}

export function selectStemPortfolioRoute<
    T extends { model: string; role: StemTransitionRoleV1; section: string; exposureClass: string; utility: number },
>(candidates: readonly T[], target: { role: StemTransitionRoleV1; section: string; exposureClass: string }): T | null {
    return (
        candidates
            .filter(
                (candidate) =>
                    candidate.role === target.role &&
                    candidate.section === target.section &&
                    candidate.exposureClass === target.exposureClass,
            )
            .sort((a, b) => b.utility - a.utility || a.model.localeCompare(b.model))[0] ?? null
    );
}

export function originalPreservingStrategy(input: {
    task: "vocal-attenuation" | "bass-handoff";
    reconstructionUtility: number;
    subtractionUtility: number;
    classicEqUtility: number;
}): "full-reconstruction" | "original-minus-target" | "classic-eq" {
    const candidates = [
        ["full-reconstruction", input.reconstructionUtility],
        ["original-minus-target", input.subtractionUtility],
        ["classic-eq", input.classicEqUtility],
    ] as const;
    return [...candidates].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "classic-eq";
}

export function restorationDecision(input: {
    transitionGain: number;
    artisticChange: number;
    exposedInTransition: boolean;
}): { restore: boolean; evaluatedInTransition: true } {
    return {
        restore: input.exposedInTransition && input.transitionGain > input.artisticChange,
        evaluatedInTransition: true,
    };
}

export function stemDemandPlan(input: {
    requiredRoles: readonly StemTransitionRoleV1[];
    cachedRoles: readonly StemTransitionRoleV1[];
    deadlineMs: number;
    estimatedRoleMs: number;
}): { computeRoles: StemTransitionRoleV1[]; fallbackRoles: StemTransitionRoleV1[]; precomputeAll: false } {
    const cached = new Set(input.cachedRoles);
    const missing = [...new Set(input.requiredRoles)].filter((role) => !cached.has(role));
    const capacity = Math.max(0, Math.floor(input.deadlineMs / Math.max(1, input.estimatedRoleMs)));
    return { computeRoles: missing.slice(0, capacity), fallbackRoles: missing.slice(capacity), precomputeAll: false };
}

export const STEM_UTILITY_BENCHMARK_V1 = {
    objective: ["sdr-where-meaningful", "si-sar-where-meaningful", "leakage", "transients", "phase-spatial"],
    perceptual: ["artifact-noticeability", "naturalness"],
    task: ["transition-preference", "successful-handoff", "required-fallback-rate"],
    listeningConditions: ["stem-solo", "inside-actual-transition"],
    exposureGainsDb: [-18, -12, -6, 0, "solo"],
    exposureBars: [1, 4, 16],
    optimizeFor: "musical-task-utility",
} as const;
