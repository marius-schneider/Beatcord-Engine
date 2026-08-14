export type ArchitectureLayerId =
    | "experience"
    | "context"
    | "music-director"
    | "queue-route-planner"
    | "musical-intelligence"
    | "transition-intelligence"
    | "rescue-engine"
    | "audio-engine"
    | "quality-guardian"
    | "compute-scheduler";

export type CapabilityStatus = "ready" | "degraded" | "unavailable";
export type CapabilityEvidence = boolean | number | CapabilityStatus;
export type ArchitectureEvidence = Partial<Record<ArchitectureLayerId, Record<string, CapabilityEvidence>>>;

export interface ArchitectureComponentStatus {
    id: string;
    label: string;
    status: CapabilityStatus;
    score: number;
}

export interface ArchitectureLayerStatus {
    id: ArchitectureLayerId;
    label: string;
    status: CapabilityStatus;
    score: number;
    components: ArchitectureComponentStatus[];
    reasons: string[];
}

export interface BeatcordArchitectureStatus {
    version: 1;
    overall: number;
    status: CapabilityStatus;
    readyLayers: number;
    degradedLayers: number;
    unavailableLayers: number;
    layers: ArchitectureLayerStatus[];
}

interface LayerDefinition {
    id: ArchitectureLayerId;
    label: string;
    components: readonly { id: string; label: string }[];
}

export const BEATCORD_ARCHITECTURE: readonly LayerDefinition[] = [
    {
        id: "experience",
        label: "Experience",
        components: [
            { id: "selection", label: "Chill / Love / Energy / Party / Auto" },
            { id: "blend", label: "Continuous Experience Blend" },
        ],
    },
    {
        id: "context",
        label: "Context Engine",
        components: [
            { id: "activity", label: "Activity" },
            { id: "session", label: "Session" },
            { id: "crowd", label: "Crowd" },
            { id: "user-intent", label: "User Intent" },
        ],
    },
    {
        id: "music-director",
        label: "Music Director",
        components: [
            { id: "journey", label: "Journey" },
            { id: "memory", label: "Memory" },
            { id: "moments", label: "Moments" },
            { id: "diversity", label: "Diversity" },
        ],
    },
    {
        id: "queue-route-planner",
        label: "Queue / Route Planner",
        components: [
            { id: "compatibility-graph", label: "Compatibility Graph" },
            { id: "bridges", label: "Bridges" },
            { id: "energy-curve", label: "Energy Curve" },
            { id: "lookahead", label: "Multi-track Lookahead" },
        ],
    },
    {
        id: "musical-intelligence",
        label: "Musical Intelligence",
        components: [
            { id: "beat", label: "Beat / Downbeat" },
            { id: "key", label: "Key" },
            { id: "structure", label: "Structure / Sections" },
            { id: "vocals", label: "Vocals" },
            { id: "timbre", label: "Genre / Timbre / Energy / Mood" },
        ],
    },
    {
        id: "transition-intelligence",
        label: "Transition Intelligence",
        components: [
            { id: "candidates", label: "Candidates" },
            { id: "scoring", label: "Score" },
            { id: "reasoning", label: "Reason" },
            { id: "simulation", label: "Simulate / Preview" },
        ],
    },
    {
        id: "rescue-engine",
        label: "Rescue Engine",
        components: [
            { id: "validation", label: "Validation" },
            { id: "fallback", label: "Fallback" },
            { id: "deadline", label: "Deadline Awareness" },
        ],
    },
    {
        id: "audio-engine",
        label: "Audio Engine",
        components: [
            { id: "mixer", label: "Mixer" },
            { id: "stems", label: "Stems" },
            { id: "eq-fx", label: "EQ / FX" },
            { id: "stretch", label: "Stretch" },
            { id: "pitch", label: "Pitch" },
        ],
    },
    {
        id: "quality-guardian",
        label: "Quality Guardian",
        components: [
            { id: "loudness-peak", label: "Loudness / Peak" },
            { id: "phase", label: "Phase" },
            { id: "artifacts", label: "Artifacts" },
            { id: "stem-quality", label: "Stem Quality" },
        ],
    },
    {
        id: "compute-scheduler",
        label: "Compute Scheduler",
        components: [
            { id: "cache", label: "Cache" },
            { id: "lookahead", label: "Lookahead" },
            { id: "cpu", label: "CPU Budget" },
            { id: "gpu", label: "GPU" },
            { id: "battery", label: "Battery Mode" },
        ],
    },
] as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const round = (value: number, digits = 3) => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};
const statusFor = (score: number): CapabilityStatus =>
    score >= 0.72 ? "ready" : score >= 0.25 ? "degraded" : "unavailable";

function scoreEvidence(evidence: CapabilityEvidence | undefined): number {
    if (typeof evidence === "boolean") return evidence ? 1 : 0;
    if (typeof evidence === "number") return clamp01(evidence);
    if (evidence === "ready") return 1;
    if (evidence === "degraded") return 0.5;
    return 0;
}

/** Build the canonical ten-layer runtime architecture status. */
export function assessArchitectureStatus(evidence: ArchitectureEvidence = {}): BeatcordArchitectureStatus {
    const layers = BEATCORD_ARCHITECTURE.map((definition): ArchitectureLayerStatus => {
        const components = definition.components.map((component): ArchitectureComponentStatus => {
            const score = round(scoreEvidence(evidence[definition.id]?.[component.id]));
            return { ...component, score, status: statusFor(score) };
        });
        const score = round(components.reduce((sum, component) => sum + component.score, 0) / components.length);
        const unavailable = components
            .filter((component) => component.status === "unavailable")
            .map((item) => item.label);
        const degraded = components.filter((component) => component.status === "degraded").map((item) => item.label);
        return {
            id: definition.id,
            label: definition.label,
            score,
            status: statusFor(score),
            components,
            reasons: [
                ...(degraded.length ? [`degraded: ${degraded.join(", ")}`] : []),
                ...(unavailable.length ? [`unavailable: ${unavailable.join(", ")}`] : []),
                ...(!degraded.length && !unavailable.length ? ["all declared capabilities ready"] : []),
            ],
        };
    });
    const overall = round(layers.reduce((sum, layer) => sum + layer.score, 0) / layers.length);
    return {
        version: 1,
        overall,
        status: statusFor(overall),
        readyLayers: layers.filter((layer) => layer.status === "ready").length,
        degradedLayers: layers.filter((layer) => layer.status === "degraded").length,
        unavailableLayers: layers.filter((layer) => layer.status === "unavailable").length,
        layers,
    };
}

/** Reassess selected components when later runtime layers gain better evidence. */
export function updateArchitectureStatus(
    current: BeatcordArchitectureStatus,
    updates: ArchitectureEvidence,
): BeatcordArchitectureStatus {
    const evidence: ArchitectureEvidence = Object.fromEntries(
        current.layers.map((layer) => [
            layer.id,
            Object.fromEntries(layer.components.map((component) => [component.id, component.score])),
        ]),
    );
    for (const [layer, components] of Object.entries(updates)) {
        evidence[layer as ArchitectureLayerId] = { ...evidence[layer as ArchitectureLayerId], ...components };
    }
    return assessArchitectureStatus(evidence);
}
