const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export function fidelityAwareUtility(input: {
    experience: "pure" | "party" | "spatial";
    experienceQuality: number;
    fidelityPreservation: number;
    manipulationCost: number;
}): { utility: number; fidelityWeight: number; experienceWeight: number; manipulationBudget: number } {
    const weights =
        input.experience === "pure"
            ? { fidelity: 0.65, experience: 0.35, budget: 0.15 }
            : input.experience === "party"
              ? { fidelity: 0.3, experience: 0.7, budget: 0.7 }
              : { fidelity: 0.55, experience: 0.45, budget: 0.35 };
    return {
        utility: round(
            clamp01(input.experienceQuality) * weights.experience +
                clamp01(input.fidelityPreservation) * weights.fidelity -
                clamp01(input.manipulationCost) * 0.25,
        ),
        fidelityWeight: weights.fidelity,
        experienceWeight: weights.experience,
        manipulationBudget: weights.budget,
    };
}

export function spatialArtisticIntegrity(input: {
    nativeScene: boolean;
    creativeMode: boolean;
    transitionBoundary: boolean;
    selectedSafeRole: boolean;
}): { preserveScene: boolean; allowedChanges: string[]; objectRepositioningDefault: false } {
    const allowedChanges = input.transitionBoundary
        ? ["overall-scene-gain", ...(input.selectedSafeRole ? ["selected-safe-role"] : [])]
        : [];
    return {
        preserveScene: input.nativeScene && !input.creativeMode,
        allowedChanges,
        objectRepositioningDefault: false,
    };
}

export function nativeSpatialTransition(input: { outgoingNativeObjects: boolean; incomingNativeObjects: boolean }): {
    mode: "scene-level" | "rendered-audio-fallback";
    binauralMixingPreferred: false;
} {
    return {
        mode: input.outgoingNativeObjects && input.incomingNativeObjects ? "scene-level" : "rendered-audio-fallback",
        binauralMixingPreferred: false,
    };
}

export interface SceneRoleV1 {
    role: "vocal" | "ambience" | "percussion" | "height";
    location: "front" | "wide" | "rear" | "height";
    foreground: boolean;
}
export function matchSceneRoles(
    outgoing: readonly SceneRoleV1[],
    incoming: readonly SceneRoleV1[],
): { handoffOrder: string[]; matches: { role: string; compatible: boolean }[] } {
    const order = ["ambience", "percussion", "height", "vocal"];
    return {
        handoffOrder: order.filter((role) => incoming.some((item) => item.role === role)),
        matches: incoming.map((item) => ({
            role: item.role,
            compatible: outgoing.some(
                (candidate) => candidate.role === item.role && candidate.location === item.location,
            ),
        })),
    };
}

export function spatialSceneCollision(input: {
    foregroundObjects: number;
    sameLocationPairs: number;
    heightClutter: number;
    rearOverload: number;
    centerMasking: number;
}): { risk: number; categories: readonly string[] } {
    const risk = round(
        (clamp01(input.foregroundObjects / 4) +
            clamp01(input.sameLocationPairs / 3) +
            clamp01(input.heightClutter) +
            clamp01(input.rearOverload) +
            clamp01(input.centerMasking)) /
            5,
    );
    return {
        risk,
        categories: ["foreground-overload", "same-location", "height-clutter", "rear-overload", "center-masking"],
    };
}

export function spatialDownmixCritic(input: {
    roleBalance: number;
    foregroundClarity: number;
    bassIntegrity: number;
    transitionIntegrity: number;
}): { stereoSafe: boolean; quality: number; outputFallbackTested: true } {
    const quality = round(
        (input.roleBalance + input.foregroundClarity + input.bassIntegrity + input.transitionIntegrity) / 4,
    );
    return { stereoSafe: quality >= 0.75, quality, outputFallbackTested: true };
}

export const OPEN_IMMERSIVE_PROTOTYPE = [
    "track-stems",
    "beatcord-spatial-ir",
    "iamf-package",
    "oar",
    "binaural-stereo-multichannel",
    "critic",
] as const;
export const AUDIO_RESEARCH_EXPERIMENTS_V2 = {
    spatialVsEq: {
        variants: ["eq", "spatial", "eq-plus-subtle-spatial"],
        metrics: ["clarity", "naturalness", "immersion", "distraction", "transition-quality"],
    },
    codecRoundTrip: {
        formats: ["pcm", "flac", "aac-high", "opus", "platform-target"],
        metrics: ["naturalness", "transient-integrity"],
    },
    workingRate: { rates: [44_100, 48_000, 96_000], blind: true },
    stretch: { engines: ["r2", "r3"], genres: ["edm", "pop-vocals", "acoustic", "dnb", "bass-heavy"] },
    losslessAudibility: { formats: ["aac-high", "16-44.1", "24-48", "24-96"], realisticDevices: true },
} as const;

export type EvidenceAuthorityV1 = "official-spec" | "peer-reviewed" | "community";
export function evidenceUse(
    authority: EvidenceAuthorityV1,
): "architecture-truth" | "evidence" | "hypothesis-and-failure-discovery" {
    return authority === "official-spec"
        ? "architecture-truth"
        : authority === "peer-reviewed"
          ? "evidence"
          : "hypothesis-and-failure-discovery";
}

export const FORMAT_BACKEND_STRATEGY = {
    coreIr: "beatcord-owned",
    openResearch: ["iamf", "oar", "ffmpeg"],
    apple: ["asaf", "apac"],
    dolby: ["official-partner-tools"],
} as const;
