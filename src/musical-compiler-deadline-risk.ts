const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
export type LookaheadTask =
    | "analyze-candidate"
    | "prepare-stems"
    | "render-preview"
    | "compile-transition"
    | "execute-realtime";
export const LOOKAHEAD_SCHEDULE: readonly { secondsBefore: number; task: LookaheadTask }[] = [
    { secondsBefore: 30, task: "analyze-candidate" },
    { secondsBefore: 20, task: "prepare-stems" },
    { secondsBefore: 10, task: "render-preview" },
    { secondsBefore: 5, task: "compile-transition" },
    { secondsBefore: 0, task: "execute-realtime" },
];
export function deadlineTask(
    task: LookaheadTask,
    currentSample: number,
    deadlineSample: number,
    estimatedSamples: number,
): { execute: boolean; fallback: string } {
    const fits = currentSample + estimatedSamples <= deadlineSample;
    const fallback =
        task === "prepare-stems"
            ? "classic-mix"
            : task === "render-preview"
              ? "safest-symbolic-candidate"
              : task === "analyze-candidate"
                ? "keep-current-route"
                : "execute-compiled-safe-plan";
    return { execute: fits, fallback: fits ? "none" : fallback };
}

export interface MusicalRiskBudget {
    gridRisk: number;
    harmonicRisk: number;
    stemRisk: number;
    manipulationRisk: number;
}
export function composedMusicalRisk(risk: MusicalRiskBudget): {
    combined: number;
    stacked: boolean;
    action: "proceed" | "clean-cut" | "bridge-track";
} {
    const values = Object.values(risk).map(clamp01);
    const combined = round(1 - values.reduce((safe, value) => safe * (1 - value), 1));
    const stacked = values.filter((value) => value >= 0.45).length >= 2;
    return {
        combined,
        stacked,
        action: combined >= 0.8 ? "bridge-track" : combined >= 0.55 || stacked ? "clean-cut" : "proceed",
    };
}
export interface ArrangementComplexity {
    density: number;
    foregroundCount: number;
    spectralOccupancy: number;
    rhythmicDensity: number;
}
export function perceptualMixingCanvas(
    outgoing: ArrangementComplexity,
    incoming: ArrangementComplexity,
): { available: number; preferredRoles: string[] } {
    const occupancy =
        (clamp01(outgoing.density) +
            clamp01(outgoing.spectralOccupancy) +
            clamp01(incoming.density) +
            clamp01(incoming.spectralOccupancy)) /
        4;
    const available = round(1 - occupancy);
    return {
        available,
        preferredRoles:
            outgoing.foregroundCount > incoming.foregroundCount
                ? ["drums", "low-end"]
                : available > 0.5
                  ? ["harmony", "foreground", "drums"]
                  : ["drums"],
    };
}

export interface MusicalIR {
    version: 1;
    beatMesh: string;
    tempoMap: string;
    grooveField: string;
    meterMap: string;
    structureGraph: string;
    harmonyTimeline: string;
    roleTimeline: string;
    complexityTimeline: string;
    stemCapabilities: string[];
    confidenceMap: Record<string, number>;
    modelVersions: Record<string, string>;
}
export const MUSICAL_COMPILER_PASSES = [
    "validate-timing",
    "resolve-window",
    "assign-role-ownership",
    "allocate-manipulation",
    "select-dsp",
    "critic-robustness",
    "compile-sample-automation",
] as const;
export function compileMusicalIr(
    ir: MusicalIR,
    failedPass?: (typeof MUSICAL_COMPILER_PASSES)[number],
): {
    compiled: boolean;
    passes: { pass: string; status: "ok" | "fallback" }[];
    deterministicAudioProgram: true;
    stableIrBoundary: true;
} {
    const validIr = ir.version === 1 && Object.keys(ir.confidenceMap).length > 0;
    const passes = MUSICAL_COMPILER_PASSES.map((pass) => ({
        pass,
        status: pass === failedPass ? ("fallback" as const) : ("ok" as const),
    }));
    return { compiled: validIr, passes, deterministicAudioProgram: true, stableIrBoundary: true };
}
export const BUILD_AUDIO_INNOVATIONS = [
    "musical-ir",
    "adaptive-beat-mesh",
    "multi-hypothesis-bpm",
    "section-confidence",
    "transition-refinement",
    "self-healing-grid",
    "stem-demand-api",
    "stem-quality-envelope",
    "mix-difficulty",
    "risk-budget",
    "minimum-intervention",
    "deadline-analysis",
] as const;
export const PROTOTYPE_AUDIO_INNOVATIONS = [
    "cross-stem-consensus",
    "groove-field",
    "groove-preserving-sync",
    "drum-grid-repair",
    "stem-mosaic",
    "residual-preservation",
    "role-handoff",
    "counterfactual-search",
    "monte-carlo-robustness",
    "mixability-graph",
] as const;
export const RESEARCH_AUDIO_INNOVATIONS = [
    "open-vocabulary-realtime-stems",
    "generative-stem-repair",
    "full-msr-consumer",
    "spatial-aware-mss",
    "learned-groove",
    "learned-transition-embeddings",
] as const;
export const BEATGRID_BENCHMARK_CASES = [
    "straight-4-4-edm",
    "half-time-dnb",
    "double-time-ambiguity",
    "live-disco-drift",
    "funk-swing",
    "rock-drummer",
    "ballad-rubato",
    "piano-expressive",
    "3-4",
    "6-8",
    "2-4-samba",
    "meter-change",
    "beatless-intro",
    "breakdown",
    "false-transient",
    "syncopation",
    "polyrhythm",
] as const;
export const STEM_BENCHMARK_DIMENSIONS = [
    "separation",
    "leakage",
    "artifact-salience",
    "transient-integrity",
    "phase-spatial-integrity",
    "transition-usefulness",
] as const;
export const PRECISION_WHERE_IT_MATTERS = {
    refineRelevantRegion: true,
    requestOnlyNeededStems: true,
    preserveGroove: true,
    searchMinimalIntervention: true,
    testFailureModes: true,
    conservativeElsewhere: true,
} as const;
