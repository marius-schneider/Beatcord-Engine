// Cold-start telemetry — how often, and for how long, playback actually waits on a
// file before it can make sound.
//
// This exists to answer one question with data instead of intuition: is a
// stream-while-downloading path worth building? Prefetch is supposed to make every
// cut warm, so the interesting number is not the average wait but how often the
// warm path MISSES. A handful of cold starts per session means the streaming
// machinery would buy a rare ten seconds; a majority means it's the main event.
//
// Only the gates that actually hold up audio report here. A background prefetch
// waiting on the same download is not a cold start — nobody is listening to silence.

import { createLogger } from "./logger";

const log = createLogger("coldstart");

/** Ring size: enough to cover a long session without growing unbounded. */
const HISTORY = 200;

/** A gate resolving faster than this did no real work — the file was on disk and
 *  the call collapsed to a cache lookup. Deliberately generous: a slow disk stat
 *  is still not something a listener perceives. */
const WARM_MS = 50;

export type PlaybackGate = "start" | "advance" | "resume";

export interface ColdStartEvent {
    trackId: string;
    /** Which moment was held up — telling a first-play stall from a mid-set one. */
    gate: PlaybackGate;
    source: string;
    /** How long audio was blocked. 0 when prefetch had already produced the file. */
    waitedMs: number;
    /** The queue item already carried a path, so the gate never even had to ask. */
    prefetched: boolean;
    at: number;
}

export interface ColdStartStats {
    total: number;
    /** Gates that produced no perceptible wait (prefetched, or a cache hit). */
    warm: number;
    cold: number;
    /** 0..1 — the number that decides whether streaming is worth building. */
    coldRatio: number;
    /** Wait percentiles over the COLD events only; averaging in the warm ones
     *  would dilute exactly the signal we're looking for. */
    p50WaitMs: number;
    p95WaitMs: number;
    maxWaitMs: number;
    byGate: Record<PlaybackGate, { total: number; cold: number }>;
    recent: ColdStartEvent[];
}

const events: ColdStartEvent[] = [];

function push(event: ColdStartEvent): void {
    events.push(event);
    if (events.length > HISTORY) events.splice(0, events.length - HISTORY);
    if (event.waitedMs < WARM_MS) return;
    // Warm gates stay silent — a log line per successful cut would be noise. But a
    // bare cold-start line is not actionable either ("is 400ms a lot? how often?"),
    // so each one carries the running ratio. `grep coldstart` then answers the whole
    // question: if this stays at a few percent, streaming buys a rare few seconds.
    const { cold, total, p95WaitMs } = coldStartStats();
    log.info(
        `cold ${event.gate} for ${event.trackId} — audio blocked ${Math.round(event.waitedMs)}ms ` +
            `[${cold}/${total} gates cold, p95 ${p95WaitMs}ms]`,
    );
}

interface GateTrack {
    id: string;
    source?: string | undefined;
}

/**
 * Record a gate that was already satisfied — the item carried a file path, so
 * prefetch won and nothing was awaited. Counting these is the point: the cold
 * ratio is meaningless without the warm denominator.
 */
export function recordWarmGate(track: GateTrack, gate: PlaybackGate): void {
    push({
        trackId: track.id,
        gate,
        source: track.source ?? "youtube",
        waitedMs: 0,
        prefetched: true,
        at: Date.now(),
    });
}

/**
 * Time a gate that has to produce the file itself. Records whether or not it
 * throws — a download that fails after 8 seconds held up audio for 8 seconds, and
 * dropping that from the stats would flatter the warm path.
 */
export async function timePlaybackGate<T>(track: GateTrack, gate: PlaybackGate, produce: () => Promise<T>): Promise<T> {
    const t0 = performance.now();
    try {
        return await produce();
    } finally {
        push({
            trackId: track.id,
            gate,
            source: track.source ?? "youtube",
            waitedMs: performance.now() - t0,
            prefetched: false,
            at: Date.now(),
        });
    }
}

function percentile(sorted: number[], p: number): number {
    if (!sorted.length) return 0;
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return Math.round(sorted[idx]!);
}

export function coldStartStats(): ColdStartStats {
    const byGate: ColdStartStats["byGate"] = {
        start: { total: 0, cold: 0 },
        advance: { total: 0, cold: 0 },
        resume: { total: 0, cold: 0 },
    };
    const coldWaits: number[] = [];
    let warm = 0;
    for (const e of events) {
        const cold = e.waitedMs >= WARM_MS;
        byGate[e.gate].total++;
        if (cold) {
            byGate[e.gate].cold++;
            coldWaits.push(e.waitedMs);
        } else warm++;
    }
    coldWaits.sort((a, b) => a - b);
    const total = events.length;
    return {
        total,
        warm,
        cold: coldWaits.length,
        coldRatio: total ? coldWaits.length / total : 0,
        p50WaitMs: percentile(coldWaits, 50),
        p95WaitMs: percentile(coldWaits, 95),
        maxWaitMs: coldWaits.length ? Math.round(coldWaits[coldWaits.length - 1]!) : 0,
        byGate,
        recent: events.slice(-20),
    };
}

/** Drop all recorded events (tests, and a manual reset between measurements). */
export function resetColdStartStats(): void {
    events.length = 0;
}
