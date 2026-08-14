const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
export type HierarchicalStemRole =
    | "vocals"
    | "drums"
    | "kick"
    | "snare"
    | "hats"
    | "toms"
    | "cymbals"
    | "bass"
    | "other"
    | "guitar"
    | "piano"
    | "synth"
    | "strings";
export interface StemDemand {
    required: HierarchicalStemRole[];
    optional: HierarchicalStemRole[];
    qualityTarget: number;
    deadline: number;
}
const CHILDREN: Partial<Record<HierarchicalStemRole, HierarchicalStemRole[]>> = {
    drums: ["kick", "snare", "hats", "toms", "cymbals"],
    other: ["guitar", "piano", "synth", "strings"],
};
export function planStemDemand(
    intent: "vocal-removal" | "kick-handoff" | "classic-mix",
    qualityTarget: number,
    deadline: number,
): StemDemand {
    if (intent === "vocal-removal")
        return { required: ["vocals"], optional: [], qualityTarget: clamp01(qualityTarget), deadline };
    if (intent === "kick-handoff")
        return {
            required: ["drums", ...(CHILDREN.drums ?? [])],
            optional: ["bass"],
            qualityTarget: clamp01(qualityTarget),
            deadline,
        };
    return {
        required: [],
        optional: ["vocals", "drums", "bass", "other"],
        qualityTarget: clamp01(qualityTarget),
        deadline,
    };
}
export function openVocabularyStemQuery(
    query: string,
    fixedStemSufficient: boolean,
): { route: "fixed-stem" | "experimental-open-vocabulary"; realtimePrimary: boolean; query: string } {
    return {
        route: fixedStemSufficient ? "fixed-stem" : "experimental-open-vocabulary",
        realtimePrimary: fixedStemSufficient,
        query,
    };
}

export interface StemRegionQuality {
    model: string;
    role: HierarchicalStemRole;
    start: number;
    end: number;
    leakage: number;
    artifacts: number;
    transientIntegrity: number;
    tonalIntegrity: number;
    reconstructionConsistency: number;
}
export function stemRegionScore(region: StemRegionQuality): number {
    return round(
        (1 - clamp01(region.leakage)) * 0.2 +
            (1 - clamp01(region.artifacts)) * 0.25 +
            clamp01(region.transientIntegrity) * 0.2 +
            clamp01(region.tonalIntegrity) * 0.2 +
            clamp01(region.reconstructionConsistency) * 0.15,
    );
}
export function stemMosaic(regions: readonly StemRegionQuality[]): StemRegionQuality[] {
    const groups = new Map<string, StemRegionQuality[]>();
    for (const region of regions) {
        const key = `${region.role}:${region.start}:${region.end}`;
        groups.set(key, [...(groups.get(key) ?? []), region]);
    }
    return [...groups.values()]
        .map((group) => [...group].sort((a, b) => stemRegionScore(b) - stemRegionScore(a))[0]!)
        .sort((a, b) => a.start - b.start);
}

export interface StemPipelineDecision {
    separate: true;
    roleQualityGate: true;
    restore: boolean;
    utilityTest: true;
    use: boolean;
    localWindowOnly: boolean;
}
export function stemPipeline(input: {
    baseQuality: number;
    restorationBenefit: number;
    restorationRisk: number;
    transitionUtility: number;
    windowSeconds: number;
}): StemPipelineDecision {
    const restore = input.restorationBenefit > input.restorationRisk && input.baseQuality < 0.8;
    return {
        separate: true,
        roleQualityGate: true,
        restore,
        utilityTest: true,
        use: input.transitionUtility >= 0.6,
        localWindowOnly: input.windowSeconds <= 32,
    };
}
export function stemTransitionUtility(input: {
    perceptualMasking: number;
    roleIsolation: number;
    artifactSalience: number;
    requiredExposure: number;
    transitionDuration: number;
}): number {
    return round(
        clamp01(input.perceptualMasking) * 0.2 +
            clamp01(input.roleIsolation) * 0.3 +
            (1 - clamp01(input.artifactSalience)) * 0.25 +
            (1 - clamp01(input.requiredExposure)) * 0.15 +
            (1 - clamp01(input.transitionDuration)) * 0.1,
    );
}

export type ReconstructionMode = "original-preserving-delta" | "full-stem-reconstruction" | "classic-eq";
export function hybridReconstruction(input: { residualCoherence: number; fullReconstructionQuality: number }): {
    mode: ReconstructionMode;
    originalMasterPreserved: boolean;
} {
    if (input.residualCoherence >= 0.8) return { mode: "original-preserving-delta", originalMasterPreserved: true };
    if (input.fullReconstructionQuality >= 0.8)
        return { mode: "full-stem-reconstruction", originalMasterPreserved: false };
    return { mode: "classic-eq", originalMasterPreserved: true };
}
export interface SpatialStemQuality {
    interChannelPhase: number;
    stereoImagePreservation: number;
    localizationStability: number;
    monoCompatibility: number;
}
export function spatialStemGate(
    quality: SpatialStemQuality,
    output: "party-speaker" | "spatial-headphones",
): { allowed: boolean; threshold: number } {
    const score =
        (quality.interChannelPhase +
            quality.stereoImagePreservation +
            quality.localizationStability +
            quality.monoCompatibility) /
        4;
    const threshold = output === "spatial-headphones" ? 0.85 : 0.65;
    return { allowed: score >= threshold, threshold };
}

export function beatSourceRouter(
    style: "house" | "funk" | "ballad" | "classical" | "live-rock",
    learnedWinner?: string,
): string[] {
    if (learnedWinner) return [learnedWinner, "telemetry-learned"];
    return {
        house: ["kick", "drums"],
        funk: ["drums", "bass"],
        ballad: ["piano", "vocal-phrasing"],
        classical: ["multi-onset", "harmonic-change"],
        "live-rock": ["drums", "ensemble-consensus"],
    }[style];
}
export function repairBeatFromDrums(input: { fullMixConfidence: number; kick: number; snare: number; hats: number }): {
    repaired: boolean;
    confidence: number;
    meterEvidence: true;
} {
    const roleConfidence = input.kick * 0.4 + input.snare * 0.35 + input.hats * 0.25;
    return {
        repaired: input.fullMixConfidence < 0.5 && roleConfidence >= 0.7,
        confidence: round(Math.max(input.fullMixConfidence, roleConfidence)),
        meterEvidence: true,
    };
}
export type DiverseMeter = "2/4" | "3/4" | "4/4" | "6/8" | "compound" | "changing" | "unknown";
export function meterAlignment(
    a: DiverseMeter,
    b: DiverseMeter,
    confidence: number,
): { strategy: "bar-beatmix" | "structural-cut" | "ambient-tail" | "phrase-bridge"; fakeDownbeats: false } {
    if (a === "unknown" || b === "unknown" || confidence < 0.5)
        return { strategy: "phrase-bridge", fakeDownbeats: false };
    if (a === b) return { strategy: "bar-beatmix", fakeDownbeats: false };
    return { strategy: a === "changing" || b === "changing" ? "ambient-tail" : "structural-cut", fakeDownbeats: false };
}

export interface HarmonicSegment {
    start: number;
    end: number;
    tonalCenter: string;
    confidence: number;
    activity: number;
}
export function harmonicOverlapWindow(
    a: readonly HarmonicSegment[],
    b: readonly HarmonicSegment[],
): { a: HarmonicSegment; b: HarmonicSegment; risk: number } | null {
    const pairs = a.flatMap((left) =>
        b.map((right) => ({
            a: left,
            b: right,
            risk: round((left.tonalCenter === right.tonalCenter ? 0 : 0.6) + (left.activity + right.activity) * 0.2),
        })),
    );
    return pairs.sort((x, y) => x.risk - y.risk)[0] ?? null;
}
export function harmonicOwnership(conflict: number): {
    corridor: "shared-harmony" | "neutral-percussion";
    simultaneousOwnership: boolean;
} {
    return conflict >= 0.6
        ? { corridor: "neutral-percussion", simultaneousOwnership: false }
        : { corridor: "shared-harmony", simultaneousOwnership: true };
}
export interface TimbreVector {
    centroid: number;
    lowMidDensity: number;
    brightness: number;
    stereoWidth: number;
    transientSharpness: number;
}
export function timbreBridge(
    a: TimbreVector,
    b: TimbreVector,
    manipulationBudget: number,
): { outgoing: TimbreVector; incoming: TimbreVector; returnsToOriginalMaster: true } {
    const weight = Math.min(0.25, clamp01(manipulationBudget));
    const midpoint = Object.fromEntries(
        (Object.keys(a) as (keyof TimbreVector)[]).map((key) => [key, (a[key] + b[key]) / 2]),
    ) as unknown as TimbreVector;
    const adapt = (source: TimbreVector) =>
        Object.fromEntries(
            (Object.keys(source) as (keyof TimbreVector)[]).map((key) => [
                key,
                source[key] + (midpoint[key] - source[key]) * weight,
            ]),
        ) as unknown as TimbreVector;
    return { outgoing: adapt(a), incoming: adapt(b), returnsToOriginalMaster: true };
}

export interface ForegroundOccupancy {
    time: number;
    vocal: number;
    melodicLead: number;
    signatureHook: number;
    frequencyOverlap: number;
}
export function roleCollisionMap(a: ForegroundOccupancy, b: ForegroundOccupancy): number {
    return round(
        clamp01((a.vocal + a.melodicLead + a.signatureHook) / 3) *
            clamp01((b.vocal + b.melodicLead + b.signatureHook) / 3) *
            clamp01((a.frequencyOverlap + b.frequencyOverlap) / 2),
    );
}
export interface PerceptualRoleHandoff {
    role: HierarchicalStemRole;
    outgoingGainCurve: number[];
    incomingGainCurve: number[];
    startBar: number;
    endBar: number;
}
export function sequentialRoleHandoffs(
    handoffs: readonly PerceptualRoleHandoff[],
    desiredUtility: number,
    utilities: readonly number[],
): PerceptualRoleHandoff[] {
    const selected: PerceptualRoleHandoff[] = [];
    for (const [index, handoff] of handoffs.entries()) {
        selected.push(handoff);
        if ((utilities[index] ?? 0) >= desiredUtility) break;
    }
    return selected;
}
export function manipulationCost(input: {
    tempoWarp: number;
    pitchShift: number;
    stemExposure: number;
    eqChange: number;
    fxIntensity: number;
    structuralEditing: number;
}): number {
    return round(Object.values(input).reduce((sum, value) => sum + clamp01(value), 0) / 6);
}
