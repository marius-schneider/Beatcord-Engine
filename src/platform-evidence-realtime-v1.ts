const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export type MusicalRoleV1 = "vocal" | "drums" | "bass" | "harmony" | "atmosphere";
export interface CreatorInteractionEnvelopeV1 {
    role: MusicalRoleV1;
    gainRangeDb?: [number, number];
    spatialMoveRange?: [number, number];
    muteAllowed: boolean;
    stemMixAllowed: boolean;
    transitionManipulationAllowed: boolean;
    preferredPreservation: number;
}

export interface MusicalEvidenceV1 {
    provider: "artist" | "beatcord" | "apple" | "provider" | "dj-correction";
    kind: "beats" | "bars" | "phrases" | "sections" | "key" | "pace" | "instrument-activity" | "loudness";
    confidence: number;
    values: readonly number[];
    native: boolean;
}

export interface AnalysisRequestV1 {
    kinds: readonly MusicalEvidenceV1["kind"][];
    timeRange?: [number, number];
}

export interface RealtimeModelProfileV1 {
    worstCaseMicros: number;
    memoryBytes: number;
    modelVersion: string;
    deadlineClass: "audio-callback" | "lookahead" | "offline";
    fallback: string;
    preallocated: boolean;
    boundedShapes: boolean;
    performsIo: boolean;
}

export function creatorPermission(input: {
    envelope: CreatorInteractionEnvelopeV1;
    operation: "gain" | "spatial-move" | "mute" | "stem-mix" | "transition-manipulation";
    gainDb?: number;
}): { allowed: boolean; sourcePriority: "artist-authorized"; inferenceMayOverride: false } {
    const envelope = input.envelope;
    const allowed =
        input.operation === "gain"
            ? input.gainDb !== undefined &&
              !!envelope.gainRangeDb &&
              input.gainDb >= envelope.gainRangeDb[0] &&
              input.gainDb <= envelope.gainRangeDb[1]
            : input.operation === "spatial-move"
              ? !!envelope.spatialMoveRange
              : input.operation === "mute"
                ? envelope.muteAllowed
                : input.operation === "stem-mix"
                  ? envelope.stemMixAllowed
                  : envelope.transitionManipulationAllowed;
    return { allowed, sourcePriority: "artist-authorized", inferenceMayOverride: false };
}

export function appleAnalysisRequest(request: AnalysisRequestV1): {
    requestedOnly: readonly MusicalEvidenceV1["kind"][];
    offlineCapable: true;
    replacementForBeatMesh: false;
} {
    return { requestedOnly: [...new Set(request.kinds)], offlineCapable: true, replacementForBeatMesh: false };
}

export function fuseMusicalEvidence(evidence: readonly MusicalEvidenceV1[]): {
    consensus: number[];
    confidence: number;
    disagreement: number;
    providerCount: number;
} {
    if (!evidence.length) return { consensus: [], confidence: 0, disagreement: 1, providerCount: 0 };
    const length = Math.max(...evidence.map((item) => item.values.length));
    const consensus = Array.from({ length }, (_, index) => {
        let weight = 0;
        let total = 0;
        for (const item of evidence) {
            const value = item.values[index];
            if (value === undefined) continue;
            const authority = item.provider === "artist" ? 1 : item.native ? 0.9 : 0.7;
            const itemWeight = clamp01(item.confidence) * authority;
            total += value * itemWeight;
            weight += itemWeight;
        }
        return round(weight ? total / weight : 0);
    });
    const meanConfidence = evidence.reduce((sum, item) => sum + clamp01(item.confidence), 0) / evidence.length;
    const disagreement =
        evidence.length <= 1
            ? 0
            : Math.max(...evidence.map((item) => Math.abs((item.values[0] ?? 0) - (consensus[0] ?? 0))));
    return {
        consensus,
        confidence: round(clamp01(meanConfidence * (1 - Math.min(1, disagreement)))),
        disagreement: round(disagreement),
        providerCount: evidence.length,
    };
}

export function admitRealtimeModel(input: {
    profile: RealtimeModelProfileV1;
    otherDspMicros: number;
    bufferDeadlineMicros: number;
    safetyMargin: number;
}): { route: "audio-workgroup" | "lookahead-worker"; reason: string; fallback: string } {
    const realtimeSafe = input.profile.preallocated && input.profile.boundedShapes && !input.profile.performsIo;
    const budgetSafe =
        input.profile.worstCaseMicros + input.otherDspMicros < input.bufferDeadlineMicros * clamp01(input.safetyMargin);
    return realtimeSafe && budgetSafe && input.profile.deadlineClass === "audio-callback"
        ? { route: "audio-workgroup", reason: "bounded-profile-within-deadline", fallback: input.profile.fallback }
        : {
              route: "lookahead-worker",
              reason: realtimeSafe ? "deadline-budget-exceeded" : "realtime-contract-violated",
              fallback: input.profile.fallback,
          };
}

export function deadlineTelemetry(
    samplesMicros: readonly number[],
    deadlineMicros: number,
): {
    p50: number;
    p95: number;
    p99: number;
    worstCase: number;
    deadlineMissRate: number;
} {
    const sorted = [...samplesMicros].sort((a, b) => a - b);
    const percentile = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
    return {
        p50: percentile(0.5),
        p95: percentile(0.95),
        p99: percentile(0.99),
        worstCase: sorted.at(-1) ?? 0,
        deadlineMissRate: round(
            sorted.length ? sorted.filter((sample) => sample > deadlineMicros).length / sorted.length : 0,
        ),
    };
}

export const APPLE_REALTIME_TOPOLOGY_V1 = {
    audioWorkgroup: ["io-thread", "mixer", "critical-dsp", "tiny-rt-ml", "spatial-render-support"],
    nonRealtime: ["stem-separation", "journey-planning", "llm", "search", "network-analytics"],
    auxiliaryThreadsAfterProfiling: true,
} as const;

export const MUSIC_UNDERSTANDING_BENCH_V1 = {
    providers: ["apple", "beatcord", "consensus", "human"],
    catalog: ["edm", "dnb", "live-disco", "rock", "jazz", "odd-meter", "rubato"],
    dimensions: ["beats", "bars", "phrases", "sections", "key", "pace", "instrument-activity", "loudness"],
} as const;
