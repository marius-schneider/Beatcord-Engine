const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
export type StemBackendKind = "fast-realtime" | "high-quality" | "low-power" | "cloud-hq";
export interface StemCapabilities {
    realtime: boolean;
    mobile: boolean;
    cloud: boolean;
    ensemble: boolean;
    restoration: boolean;
}
export interface StemBackendDescriptor {
    id: string;
    kind: StemBackendKind;
    capabilities: StemCapabilities;
    latencyMs: number;
    quality: number;
}
export function routeStemBackend(
    backends: readonly StemBackendDescriptor[],
    context: { live: boolean; mobile: boolean; cloudAllowed: boolean; qualityPriority: number },
): StemBackendDescriptor | null {
    return (
        [...backends]
            .filter(
                (backend) =>
                    (!context.live || backend.capabilities.realtime) &&
                    (!context.mobile || backend.capabilities.mobile) &&
                    (context.cloudAllowed || !backend.capabilities.cloud),
            )
            .sort(
                (a, b) =>
                    context.qualityPriority * (b.quality - a.quality) +
                    (1 - context.qualityPriority) * (a.latencyMs - b.latencyMs),
            )[0] ?? null
    );
}
export interface StemQualityVector {
    separation: number;
    perceptualQuality: number;
    leakage: number;
    transientIntegrity: number;
    tonalIntegrity: number;
    temporalStability: number;
}
export function stemQualityScore(quality: StemQualityVector): number {
    return clamp01(
        quality.separation * 0.2 +
            quality.perceptualQuality * 0.22 +
            (1 - quality.leakage) * 0.18 +
            quality.transientIntegrity * 0.15 +
            quality.tonalIntegrity * 0.12 +
            quality.temporalStability * 0.13,
    );
}
export function selectStemEnsemble(
    candidates: readonly { backendId: string; quality: StemQualityVector }[],
    computeAllowed: boolean,
): { selected: string | null; ensemble: string[]; offlineOnly: true } {
    const ranked = [...candidates].sort((a, b) => stemQualityScore(b.quality) - stemQualityScore(a.quality));
    return {
        selected: ranked[0]?.backendId ?? null,
        ensemble: computeAllowed
            ? ranked.slice(0, 2).map((candidate) => candidate.backendId)
            : ranked.slice(0, 1).map((candidate) => candidate.backendId),
        offlineOnly: true,
    };
}
export interface RestorationRequest {
    bars: number;
    stemQuality: number;
    hqMode: boolean;
    computeAvailable: boolean;
    artisticProductionRisk: number;
}
export function transitionLocalRestoration(input: RestorationRequest): {
    apply: boolean;
    bars: number;
    usage: "internal-transition-tool";
    outsideTransitionUsesOriginalMaster: true;
    reason: string;
} {
    const bars = Math.max(8, Math.min(32, input.bars));
    const apply =
        input.stemQuality < 0.65 && input.hqMode && input.computeAvailable && input.artisticProductionRisk < 0.5;
    return {
        apply,
        bars,
        usage: "internal-transition-tool",
        outsideTransitionUsesOriginalMaster: true,
        reason: apply ? "bounded-restoration" : "preserve-original-production",
    };
}
export function generativeStemPolicy(
    mode: "adaptive-playback" | "creative-remix",
    artifactRepair: boolean,
): { allowGeneratedContent: boolean; allowArtifactRepair: boolean; replacementForbidden: boolean } {
    return mode === "creative-remix"
        ? { allowGeneratedContent: true, allowArtifactRepair: true, replacementForbidden: false }
        : { allowGeneratedContent: false, allowArtifactRepair: artifactRepair, replacementForbidden: true };
}
export type MixRole = "drums" | "bass" | "harmony" | "foreground";
export interface RoleHandoff {
    mode: "gradual" | "hard" | "outgoing-only" | "incoming-only";
    bar: number;
    confidence: number;
}
export type RoleTransitionPlan = Record<MixRole, RoleHandoff>;
export interface SequentialStage {
    role: MixRole;
    submix: MixRole[];
    criticScore: number;
    accepted: boolean;
}
export function constructSequentialTransition(
    plan: RoleTransitionPlan,
    critic: (roles: readonly MixRole[]) => number,
): { stages: SequentialStage[]; committed: boolean } {
    const order: MixRole[] = ["drums", "bass", "harmony", "foreground"];
    const stages: SequentialStage[] = [];
    const submix: MixRole[] = [];
    for (const role of order) {
        submix.push(role);
        const criticScore = critic(submix);
        stages.push({
            role,
            submix: [...submix],
            criticScore,
            accepted: criticScore >= 0.65 && plan[role].confidence >= 0.55,
        });
        if (criticScore < 0.65) break;
    }
    return { stages, committed: stages.length === 4 && stages.every((stage) => stage.accepted) };
}
export type RolePreset = "bass-swap" | "eq-blend" | "vocal-handoff";
export function rolePreset(preset: RolePreset): RoleTransitionPlan {
    if (preset === "bass-swap")
        return {
            drums: { mode: "gradual", bar: 1, confidence: 0.9 },
            bass: { mode: "hard", bar: 9, confidence: 0.9 },
            harmony: { mode: "gradual", bar: 5, confidence: 0.8 },
            foreground: { mode: "outgoing-only", bar: 16, confidence: 0.8 },
        };
    if (preset === "vocal-handoff")
        return {
            drums: { mode: "gradual", bar: 1, confidence: 0.8 },
            bass: { mode: "gradual", bar: 5, confidence: 0.8 },
            harmony: { mode: "gradual", bar: 5, confidence: 0.8 },
            foreground: { mode: "hard", bar: 9, confidence: 0.85 },
        };
    return {
        drums: { mode: "gradual", bar: 1, confidence: 0.8 },
        bass: { mode: "gradual", bar: 5, confidence: 0.8 },
        harmony: { mode: "gradual", bar: 5, confidence: 0.8 },
        foreground: { mode: "gradual", bar: 9, confidence: 0.8 },
    };
}
export const MSST_PLATFORM_CAPABILITIES = [
    "multiple-model-families",
    "augmentations",
    "multiple-losses",
    "ensembling",
    "sliding-window-crossfade",
    "test-time-augmentation",
    "lora-finetuning",
] as const;
export const MSR_RESEARCH = {
    rawStemsSongs: 578,
    rawSourceHours: 354.13,
    evaluatesObjectivePerceptualAndSubjective: true,
    sdrAloneSufficient: false,
} as const;
