import type { DiscoverySignalsV1, TasteEvidenceCountsV1 } from "./longitudinal-taste-lab-v1";
import type { MusicalEvidenceV1 } from "./platform-evidence-realtime-v1";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export type RuntimeEvidenceKindV1 =
    | "algorithm-recommendation"
    | "voluntary-search"
    | "manual-queue-add"
    | "artist-exploration"
    | "album-open"
    | "user-replay"
    | "track-save"
    | "playlist-add"
    | "profile-confirm"
    | "profile-correct"
    | "profile-remove"
    | "transition-completed"
    | "transition-skip"
    | "undo"
    | "intervention-accepted"
    | "network-sync"
    | "provider-analysis";

export interface RuntimeEvidenceEventV1 {
    version: 1;
    id: string;
    atMs: number;
    kind: RuntimeEvidenceKindV1;
    weight: number;
    /** One-way or provider-scoped reference; never a raw participant identifier. */
    subjectRef?: string;
    decisionId?: string;
    network?: {
        clockOffsetMs: number;
        bufferMs: number;
        playoutDriftMs: number;
        lateObjects: number;
        packetLossRate: number;
    };
    providerEvidence?: MusicalEvidenceV1;
}

export interface RuntimeEvidenceSummaryV1 {
    version: 1;
    generatedAtMs: number;
    windowDays: number;
    eventCount: number;
    tasteEvidence: TasteEvidenceCountsV1;
    discoverySignals: DiscoverySignalsV1;
    profile: {
        confirmed: number;
        corrected: number;
        removed: number;
        evidenceWindow: number;
        profileDrift: number;
        userConfirmedChange: number;
        profileIdentification: number;
    };
    intervention: {
        accepted: number;
        undone: number;
        evidenceWindow: number;
        trust: number;
    };
    transition: { completed: number; skipped: number; completionRate: number };
    network: {
        reports: number;
        meanClockOffsetMs: number;
        meanBufferMs: number;
        meanPlayoutDriftMs: number;
        lateObjects: number;
        meanPacketLossRate: number;
    };
    providerEvidence: MusicalEvidenceV1[];
}

const KINDS = new Set<RuntimeEvidenceKindV1>([
    "algorithm-recommendation",
    "voluntary-search",
    "manual-queue-add",
    "artist-exploration",
    "album-open",
    "user-replay",
    "track-save",
    "playlist-add",
    "profile-confirm",
    "profile-correct",
    "profile-remove",
    "transition-completed",
    "transition-skip",
    "undo",
    "intervention-accepted",
    "network-sync",
    "provider-analysis",
]);
const PROVIDERS = new Set<MusicalEvidenceV1["provider"]>(["artist", "beatcord", "apple", "provider", "dj-correction"]);
const PROVIDER_KINDS = new Set<MusicalEvidenceV1["kind"]>([
    "beats",
    "bars",
    "phrases",
    "sections",
    "key",
    "pace",
    "instrument-activity",
    "loudness",
]);

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function validateRuntimeEvidenceEvent(value: unknown): RuntimeEvidenceEventV1 | null {
    if (typeof value !== "object" || value === null) return null;
    const event = value as Partial<RuntimeEvidenceEventV1>;
    if (
        event.version !== 1 ||
        typeof event.id !== "string" ||
        !event.id ||
        !isFiniteNumber(event.atMs) ||
        event.atMs < 0 ||
        typeof event.kind !== "string" ||
        !KINDS.has(event.kind as RuntimeEvidenceKindV1) ||
        !isFiniteNumber(event.weight) ||
        event.weight < 0 ||
        event.weight > 1 ||
        (event.subjectRef !== undefined && (typeof event.subjectRef !== "string" || event.subjectRef.length > 256)) ||
        (event.decisionId !== undefined && (typeof event.decisionId !== "string" || event.decisionId.length > 256))
    ) {
        return null;
    }
    if (event.kind === "network-sync") {
        const network = event.network;
        if (
            !network ||
            ![
                network.clockOffsetMs,
                network.bufferMs,
                network.playoutDriftMs,
                network.lateObjects,
                network.packetLossRate,
            ].every(isFiniteNumber) ||
            network.bufferMs < 0 ||
            network.bufferMs > 600_000 ||
            Math.abs(network.clockOffsetMs) > 86_400_000 ||
            Math.abs(network.playoutDriftMs) > 600_000 ||
            network.lateObjects < 0 ||
            network.lateObjects > 1_000_000 ||
            !Number.isInteger(network.lateObjects) ||
            network.packetLossRate < 0 ||
            network.packetLossRate > 1
        ) {
            return null;
        }
    }
    if (event.kind === "provider-analysis") {
        const evidence = event.providerEvidence;
        if (
            !evidence ||
            !PROVIDERS.has(evidence.provider) ||
            !PROVIDER_KINDS.has(evidence.kind) ||
            !isFiniteNumber(evidence.confidence) ||
            evidence.confidence < 0 ||
            evidence.confidence > 1 ||
            !Array.isArray(evidence.values) ||
            evidence.values.length === 0 ||
            evidence.values.length > 4_096 ||
            !evidence.values.every((value) => isFiniteNumber(value) && Math.abs(value) <= 1_000_000_000) ||
            typeof evidence.native !== "boolean"
        ) {
            return null;
        }
    }
    return {
        ...event,
        kind: event.kind as RuntimeEvidenceKindV1,
        weight: clamp01(event.weight),
    } as RuntimeEvidenceEventV1;
}

export function emptyRuntimeEvidenceSummary(nowMs = Date.now(), windowDays = 90): RuntimeEvidenceSummaryV1 {
    return {
        version: 1,
        generatedAtMs: nowMs,
        windowDays,
        eventCount: 0,
        tasteEvidence: { algorithmGenerated: 0, voluntary: 0, editorial: 0, organic: 0 },
        discoverySignals: {
            saved: false,
            replayAfterWeek: false,
            replayAfterMonth: false,
            voluntaryArtistExploration: false,
            playlistAdd: false,
        },
        profile: {
            confirmed: 0,
            corrected: 0,
            removed: 0,
            evidenceWindow: 0,
            profileDrift: 0,
            userConfirmedChange: 0,
            profileIdentification: 1,
        },
        intervention: { accepted: 0, undone: 0, evidenceWindow: 0, trust: 0.5 },
        transition: { completed: 0, skipped: 0, completionRate: 0 },
        network: {
            reports: 0,
            meanClockOffsetMs: 0,
            meanBufferMs: 0,
            meanPlayoutDriftMs: 0,
            lateObjects: 0,
            meanPacketLossRate: 0,
        },
        providerEvidence: [],
    };
}

export function cloneRuntimeEvidenceSummary(summary: RuntimeEvidenceSummaryV1): RuntimeEvidenceSummaryV1 {
    return {
        ...summary,
        tasteEvidence: { ...summary.tasteEvidence },
        discoverySignals: { ...summary.discoverySignals },
        profile: { ...summary.profile },
        intervention: { ...summary.intervention },
        transition: { ...summary.transition },
        network: { ...summary.network },
        providerEvidence: summary.providerEvidence.map((evidence) => ({ ...evidence, values: [...evidence.values] })),
    };
}

function weightedCount(events: readonly RuntimeEvidenceEventV1[], kinds: readonly RuntimeEvidenceKindV1[]): number {
    const accepted = new Set(kinds);
    return round(events.filter((event) => accepted.has(event.kind)).reduce((sum, event) => sum + event.weight, 0));
}

export function summarizeRuntimeEvidence(
    allEvents: readonly RuntimeEvidenceEventV1[],
    options: { nowMs?: number; windowDays?: number; previousTrust?: number; maxProviderEvidence?: number } = {},
): RuntimeEvidenceSummaryV1 {
    const nowMs = options.nowMs ?? Date.now();
    const windowDays = Math.max(1, Math.min(365, options.windowDays ?? 90));
    const since = nowMs - windowDays * 86_400_000;
    const events = allEvents.filter((event) => event.atMs >= since && event.atMs <= nowMs);
    const algorithmGenerated = weightedCount(events, ["algorithm-recommendation"]);
    const voluntary = weightedCount(events, [
        "voluntary-search",
        "manual-queue-add",
        "artist-exploration",
        "album-open",
        "user-replay",
        "track-save",
        "playlist-add",
    ]);
    const accepted = weightedCount(events, ["intervention-accepted", "transition-completed"]);
    const undone = weightedCount(events, ["undo", "transition-skip"]);
    const evidenceWindow = events.filter((event) =>
        ["intervention-accepted", "transition-completed", "undo", "transition-skip"].includes(event.kind),
    ).length;
    const observedTrust = accepted + undone > 0 ? accepted / (accepted + undone) : (options.previousTrust ?? 0.5);
    const previousTrust = clamp01(options.previousTrust ?? 0.5);
    const trust = evidenceWindow < 10 ? previousTrust : clamp01(previousTrust * 0.9 + observedTrust * 0.1);
    const completed = weightedCount(events, ["transition-completed"]);
    const skipped = weightedCount(events, ["transition-skip"]);
    const profileConfirmed = weightedCount(events, ["profile-confirm"]);
    const profileCorrected = weightedCount(events, ["profile-correct"]);
    const profileRemoved = weightedCount(events, ["profile-remove"]);
    const profileEvidenceWindow = profileConfirmed + profileCorrected + profileRemoved;
    const networkEvents = events.filter((event) => event.kind === "network-sync" && event.network);
    const networkWeight = networkEvents.reduce((sum, event) => sum + Math.max(0.000001, event.weight), 0);
    const networkMean = (select: (event: RuntimeEvidenceEventV1) => number) =>
        round(
            networkWeight
                ? networkEvents.reduce((sum, event) => sum + select(event) * event.weight, 0) / networkWeight
                : 0,
        );
    const newestByProviderKind = new Map<string, MusicalEvidenceV1>();
    for (const event of events) {
        if (!event.providerEvidence) continue;
        newestByProviderKind.set(
            `${event.providerEvidence.provider}:${event.providerEvidence.kind}`,
            event.providerEvidence,
        );
    }
    return {
        version: 1,
        generatedAtMs: nowMs,
        windowDays,
        eventCount: events.length,
        tasteEvidence: { algorithmGenerated, voluntary, editorial: 0, organic: 0 },
        discoverySignals: {
            saved: events.some((event) => event.kind === "track-save"),
            replayAfterWeek: events.some(
                (event) => event.kind === "user-replay" && !!event.subjectRef && nowMs - event.atMs >= 7 * 86_400_000,
            ),
            replayAfterMonth: events.some(
                (event) => event.kind === "user-replay" && !!event.subjectRef && nowMs - event.atMs >= 30 * 86_400_000,
            ),
            voluntaryArtistExploration: events.some((event) => event.kind === "artist-exploration"),
            playlistAdd: events.some((event) => event.kind === "playlist-add"),
        },
        profile: {
            confirmed: profileConfirmed,
            corrected: profileCorrected,
            removed: profileRemoved,
            evidenceWindow: profileEvidenceWindow,
            profileDrift: round(
                profileEvidenceWindow ? (profileCorrected + profileRemoved) / profileEvidenceWindow : 0,
            ),
            userConfirmedChange: round(profileEvidenceWindow ? profileCorrected / profileEvidenceWindow : 0),
            profileIdentification: round(profileEvidenceWindow ? profileConfirmed / profileEvidenceWindow : 1),
        },
        intervention: {
            accepted,
            undone,
            evidenceWindow,
            trust: round(trust),
        },
        transition: {
            completed,
            skipped,
            completionRate: round(completed + skipped ? completed / (completed + skipped) : 0),
        },
        network: {
            reports: networkEvents.length,
            meanClockOffsetMs: networkMean((event) => Math.abs(event.network?.clockOffsetMs ?? 0)),
            meanBufferMs: networkMean((event) => event.network?.bufferMs ?? 0),
            meanPlayoutDriftMs: networkMean((event) => Math.abs(event.network?.playoutDriftMs ?? 0)),
            lateObjects: networkEvents.reduce((sum, event) => sum + (event.network?.lateObjects ?? 0), 0),
            meanPacketLossRate: networkMean((event) => event.network?.packetLossRate ?? 0),
        },
        providerEvidence: [...newestByProviderKind.values()].slice(-(options.maxProviderEvidence ?? 16)),
    };
}

export class RuntimeEvidenceLedgerV1 {
    readonly maxEvents: number;
    #events: RuntimeEvidenceEventV1[] = [];

    constructor(maxEvents = 10_000) {
        this.maxEvents = Math.max(100, Math.min(100_000, Math.floor(maxEvents)));
    }

    append(value: unknown): RuntimeEvidenceEventV1 | null {
        const event = validateRuntimeEvidenceEvent(value);
        if (!event) return null;
        this.#events.push(event);
        if (this.#events.length > this.maxEvents) this.#events.splice(0, this.#events.length - this.maxEvents);
        return event;
    }

    restore(values: readonly unknown[]): number {
        this.#events = [];
        for (const value of values.slice(-this.maxEvents)) this.append(value);
        return this.#events.length;
    }

    events(): RuntimeEvidenceEventV1[] {
        return this.#events.map((event) => ({
            ...event,
            ...(event.network ? { network: { ...event.network } } : {}),
            ...(event.providerEvidence
                ? { providerEvidence: { ...event.providerEvidence, values: [...event.providerEvidence.values] } }
                : {}),
        }));
    }

    summary(options?: Parameters<typeof summarizeRuntimeEvidence>[1]): RuntimeEvidenceSummaryV1 {
        return summarizeRuntimeEvidence(this.#events, options);
    }
}
