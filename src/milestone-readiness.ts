import type { ArchitectureLayerId, BeatcordArchitectureStatus, CapabilityStatus } from "./architecture-status";

export type MilestoneImplementationStatus = "complete" | "partial" | "missing";
export type MilestoneRuntimeStatus = CapabilityStatus | "not-assessed";

export interface MilestoneCapability {
    id: string;
    label: string;
    implementation: MilestoneImplementationStatus;
    runtime: MilestoneRuntimeStatus;
    evidence: string[];
    next?: string;
    architecture?: { layer: ArchitectureLayerId; component: string };
}

export interface MilestoneReadiness {
    id: 8 | 9 | 10 | 11 | 12 | 13;
    label: string;
    completion: number;
    runtimeReadiness: number | null;
    complete: number;
    partial: number;
    missing: number;
    capabilities: MilestoneCapability[];
}

export interface BeatcordMilestoneReport {
    version: 1;
    totalCapabilities: number;
    implementationCompletion: number;
    runtimeReadiness: number | null;
    milestones: MilestoneReadiness[];
    blockers: { milestone: number; capability: string; next: string }[];
}

type Definition = Omit<MilestoneCapability, "runtime">;
interface MilestoneDefinition {
    id: MilestoneReadiness["id"];
    label: string;
    capabilities: readonly Definition[];
}

const complete = (
    id: string,
    label: string,
    evidence: string[],
    architecture?: Definition["architecture"],
): Definition => ({ id, label, implementation: "complete", evidence, ...(architecture ? { architecture } : {}) });
const partial = (
    id: string,
    label: string,
    evidence: string[],
    next: string,
    architecture?: Definition["architecture"],
): Definition => ({ id, label, implementation: "partial", evidence, next, ...(architecture ? { architecture } : {}) });
const missing = (id: string, label: string, next: string): Definition => ({
    id,
    label,
    implementation: "missing",
    evidence: [],
    next,
});

/** Honest implementation map for the six roadmap milestones. */
export const MILESTONE_DEFINITIONS: readonly MilestoneDefinition[] = [
    {
        id: 8,
        label: "Musical Understanding 2.0",
        capabilities: [
            complete(
                "song-structure-graph",
                "Song Structure Graph",
                ["track-profile.ts", "mix-regions.ts", "structural-dependencies.ts"],
                { layer: "musical-intelligence", component: "structure" },
            ),
            complete("downbeat-detection", "Downbeat Detection", ["beatgrid.ts", "phrase-cues.ts"], {
                layer: "musical-intelligence",
                component: "beat",
            }),
            missing(
                "meter-confidence",
                "Meter / Time Signature Confidence",
                "Add meter hypotheses and confidence fusion beyond the current fixed four-beat bar.",
            ),
            complete(
                "moments-detection",
                "Moments Detection",
                ["track-profile.ts", "section-importance.ts", "musical-tension.ts", "community-priorities.ts"],
                { layer: "music-director", component: "moments" },
            ),
            complete("manipulation-budget", "Manipulation Budget", ["music-director.ts"], {
                layer: "music-director",
                component: "journey",
            }),
            complete("intro-outro-regions", "Intro / Outro Regions", ["mix-regions.ts", "track-profile.ts"], {
                layer: "musical-intelligence",
                component: "structure",
            }),
            complete("half-double-time", "Half-/Double-Time Detection", ["tempo-awareness.ts"], {
                layer: "musical-intelligence",
                component: "beat",
            }),
            complete("confidence-fusion", "Confidence Fusion", ["confidence-fusion.ts"], {
                layer: "musical-intelligence",
                component: "beat",
            }),
        ],
    },
    {
        id: 9,
        label: "Planning & Memory",
        capabilities: [
            complete("musical-memory", "Musical Memory", ["music-director.ts"], {
                layer: "music-director",
                component: "memory",
            }),
            complete("compatibility-graph", "Track Compatibility Graph", ["track-compatibility.ts"], {
                layer: "queue-route-planner",
                component: "compatibility-graph",
            }),
            complete("tempo-bridges", "Tempo Bridges", ["track-compatibility.ts", "tempo-awareness.ts"], {
                layer: "queue-route-planner",
                component: "bridges",
            }),
            complete("harmonic-bridges", "Harmonic Bridges", ["track-compatibility.ts"], {
                layer: "queue-route-planner",
                component: "bridges",
            }),
            complete("energy-bridges", "Energy Bridges", ["track-compatibility.ts", "session-journey.ts"], {
                layer: "queue-route-planner",
                component: "bridges",
            }),
            complete("diversity-model", "Diversity Model", ["music-director.ts"], {
                layer: "music-director",
                component: "diversity",
            }),
            complete("fatigue-model", "Fatigue Model", ["session-fatigue.ts", "strategy-fatigue.ts"], {
                layer: "music-director",
                component: "diversity",
            }),
            complete("novelty-budget", "Transition Novelty Budget", ["session-fatigue.ts", "surprise-budget.ts"], {
                layer: "transition-intelligence",
                component: "scoring",
            }),
            complete(
                "multi-track-lookahead",
                "Multi-track Lookahead",
                ["track-compatibility.ts", "music-director.ts"],
                { layer: "queue-route-planner", component: "lookahead" },
            ),
        ],
    },
    {
        id: 10,
        label: "Transition Reliability",
        capabilities: [
            complete("transition-reasoning", "Transition Reasoning", ["music-director.ts", "community-priorities.ts"], {
                layer: "transition-intelligence",
                component: "reasoning",
            }),
            complete("preview-rendering", "Preview Rendering", ["transition-preview.ts", "offline-renderer.ts"], {
                layer: "transition-intelligence",
                component: "simulation",
            }),
            partial(
                "transition-simulation",
                "Transition Simulation",
                ["transition-preview.ts", "perceptual-masking.ts"],
                "Run rendered candidates through objective audio validation before selection.",
                { layer: "transition-intelligence", component: "simulation" },
            ),
            complete("audio-validation", "Audio Validation", ["offline-audio-validator.ts"], {
                layer: "rescue-engine",
                component: "validation",
            }),
            complete(
                "rescue-engine",
                "Rescue Engine",
                ["quality-guardian.ts", "latency-aware-planning.ts", "emergency-continuity.ts", "loopability.ts"],
                {
                    layer: "rescue-engine",
                    component: "fallback",
                },
            ),
            complete("deadline-fallback", "Deadline-aware Fallback", ["latency-aware-planning.ts"], {
                layer: "rescue-engine",
                component: "deadline",
            }),
            complete("quality-guardian", "Quality Guardian", ["quality-guardian.ts"], {
                layer: "quality-guardian",
                component: "artifacts",
            }),
            complete("stem-quality-gate", "Stem Quality Gate", ["stem-quality.ts"], {
                layer: "quality-guardian",
                component: "stem-quality",
            }),
        ],
    },
    {
        id: 11,
        label: "Production Hardening",
        capabilities: [
            complete("analysis-cache", "Analysis Cache", ["analysis-cache.ts"], {
                layer: "compute-scheduler",
                component: "cache",
            }),
            complete("analyzer-versioning", "Analyzer Versioning", ["analysis-cache.ts", "music-director.ts"], {
                layer: "compute-scheduler",
                component: "cache",
            }),
            complete("compute-budget", "CPU/GPU Budget Scheduler", ["compute-budget.ts"], {
                layer: "compute-scheduler",
                component: "cpu",
            }),
            complete("offline-first", "Offline-first Director", ["offline-director.ts"], {
                layer: "music-director",
                component: "journey",
            }),
            complete("buffer-awareness", "Streaming Buffer Awareness", ["latency-aware-planning.ts", "prefetch.ts"], {
                layer: "rescue-engine",
                component: "deadline",
            }),
            complete(
                "deterministic-plans",
                "Deterministic Transition Plans",
                ["music-director.ts", "transition-planner.ts"],
                { layer: "transition-intelligence", component: "scoring" },
            ),
            partial(
                "debug-overlay",
                "Developer Debug Overlay",
                ["ws/protocol.ts", "architecture-status.ts"],
                "Build the visual client overlay over the existing audit payload.",
                { layer: "transition-intelligence", component: "reasoning" },
            ),
            complete(
                "reproducible-logs",
                "Reproducible Mix Logs",
                ["director-decisions.ts", "transition-telemetry.ts"],
                { layer: "transition-intelligence", component: "reasoning" },
            ),
        ],
    },
    {
        id: 12,
        label: "Evaluation",
        capabilities: [
            complete("golden-mix", "Golden Mix Benchmark", ["golden-mix-benchmark.ts"]),
            complete("regression-library", "Regression Test Library", ["tests/mixes", "golden-mix-benchmark.test.ts"]),
            complete(
                "objective-metrics",
                "Objective Audio Metrics",
                ["offline-audio-validator.ts", "quality-guardian.ts"],
                { layer: "quality-guardian", component: "loudness-peak" },
            ),
            complete("perceptual-ab", "Perceptual A/B Tests", ["perceptual-evaluation.ts"]),
            partial(
                "experience-fit-rating",
                "Experience Fit Rating",
                ["perceptual-evaluation.ts", "experience-engine.ts"],
                "Add an explicit experience-fit dimension to blind listening trials.",
            ),
            complete("naturalness-rating", "Transition Naturalness Rating", [
                "transition-preview.ts",
                "perceptual-evaluation.ts",
            ]),
            partial(
                "energy-journey-rating",
                "Energy Journey Rating",
                ["session-journey.ts", "perceptual-evaluation.ts"],
                "Evaluate a multi-track session arc rather than pair-level energy flow.",
            ),
        ],
    },
    {
        id: 13,
        label: "Social Intelligence",
        capabilities: [
            complete("live-queue-reaction", "Live Queue Reaction", ["music-director.ts", "feedback-attribution.ts"], {
                layer: "context",
                component: "activity",
            }),
            missing("crowd-mode", "Crowd Mode", "Add privacy-safe crowd state and an explicit session policy."),
            partial(
                "shared-session-context",
                "Shared Session Context",
                ["music-director.ts", "session-recovery.ts"],
                "Merge multiple listener contexts instead of one session owner.",
                { layer: "context", component: "session" },
            ),
            missing(
                "group-taste",
                "Group Taste Aggregation",
                "Aggregate bounded per-listener taste without letting one user dominate.",
            ),
            missing(
                "fair-queue",
                "Fair Queue Influence",
                "Add requester attribution and fairness constraints to route ranking.",
            ),
            complete("priority-rules", "Explicit User Priority Rules", ["transition-override.ts"], {
                layer: "context",
                component: "user-intent",
            }),
        ],
    },
] as const;

const implementationScore = (status: MilestoneImplementationStatus) =>
    status === "complete" ? 1 : status === "partial" ? 0.5 : 0;
const runtimeScore = (status: MilestoneRuntimeStatus): number | null =>
    status === "ready" ? 1 : status === "degraded" ? 0.5 : status === "unavailable" ? 0 : null;
const round = (value: number, digits = 3) => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

function runtimeFor(definition: Definition, architecture?: BeatcordArchitectureStatus): MilestoneRuntimeStatus {
    if (definition.implementation === "missing") return "unavailable";
    if (!architecture || !definition.architecture) return "not-assessed";
    const layer = architecture.layers.find((item) => item.id === definition.architecture!.layer);
    return layer?.components.find((item) => item.id === definition.architecture!.component)?.status ?? "not-assessed";
}

export function assessMilestoneReadiness(architecture?: BeatcordArchitectureStatus): BeatcordMilestoneReport {
    const milestones = MILESTONE_DEFINITIONS.map((definition): MilestoneReadiness => {
        const capabilities = definition.capabilities.map((capability) => ({
            ...capability,
            runtime: runtimeFor(capability, architecture),
        }));
        const runtimeValues = capabilities
            .map((item) => runtimeScore(item.runtime))
            .filter((value): value is number => value !== null);
        return {
            id: definition.id,
            label: definition.label,
            completion: round(
                capabilities.reduce((sum, item) => sum + implementationScore(item.implementation), 0) /
                    capabilities.length,
            ),
            runtimeReadiness: runtimeValues.length
                ? round(runtimeValues.reduce((sum, value) => sum + value, 0) / runtimeValues.length)
                : null,
            complete: capabilities.filter((item) => item.implementation === "complete").length,
            partial: capabilities.filter((item) => item.implementation === "partial").length,
            missing: capabilities.filter((item) => item.implementation === "missing").length,
            capabilities,
        };
    });
    const capabilities = milestones.flatMap((milestone) => milestone.capabilities);
    const runtimeValues = capabilities
        .map((item) => runtimeScore(item.runtime))
        .filter((value): value is number => value !== null);
    return {
        version: 1,
        totalCapabilities: capabilities.length,
        implementationCompletion: round(
            capabilities.reduce((sum, item) => sum + implementationScore(item.implementation), 0) / capabilities.length,
        ),
        runtimeReadiness: runtimeValues.length
            ? round(runtimeValues.reduce((sum, value) => sum + value, 0) / runtimeValues.length)
            : null,
        milestones,
        blockers: milestones.flatMap((milestone) =>
            milestone.capabilities.flatMap((capability) =>
                capability.next
                    ? [{ milestone: milestone.id, capability: capability.label, next: capability.next }]
                    : [],
            ),
        ),
    };
}
