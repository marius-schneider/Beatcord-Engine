import type { BeatGrid } from "./beatgrid";
import type { TransitionType } from "./transition-planner";

export type CueGridKind = "phrase" | "bar" | "beat" | "target" | "start";

export interface TransitionCueOptions {
    currentGrid: BeatGrid | null | undefined;
    nextGrid: BeatGrid | null | undefined;
    currentDurationSec: number;
    transitionType: TransitionType;
    fadeSec: number;
    outgoingTempoRatio?: number;
    preRollSec?: number;
    preferPhrase?: boolean;
    lookbackBeats?: number;
    maxPhraseSacrificeBeats?: number;
    maxNextDropDelayBeats?: number;
}

export interface TransitionCue {
    /** Outgoing track transition start, in the current track's original timeline. */
    aStartSec: number;
    /** Outgoing track transition start, in heard/emitted playback time. */
    aStartPlaySec: number;
    /** Incoming file start, including pre-roll before the selected B drop/downbeat. */
    bStartSec: number;
    /** Incoming musical entry/downbeat, without pre-roll. */
    bDropSec: number;
    score: number;
    aGrid: CueGridKind;
    bGrid: CueGridKind;
    reason: string;
}

interface Boundary {
    sec: number;
    kind: CueGridKind;
}

const BEATS_PER_BAR = 4;
const BEATS_PER_PHRASE = 16;
const DEFAULT_LOOKBACK_BEATS = 32;
const DEFAULT_MAX_PHRASE_SACRIFICE_BEATS = 8;
const DEFAULT_MAX_NEXT_DROP_DELAY_BEATS = 12;

const PHRASE_TRANSITIONS = new Set<TransitionType>(["blend", "bassdrop", "riser", "filter", "gate", "acapella"]);
const DROP_TRANSITIONS = new Set<TransitionType>(["bassdrop", "riser", "cut", "spinback", "roll"]);

function clamp(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, n));
}

function round(n: number, digits = 3): number {
    const f = 10 ** digits;
    return Math.round(n * f) / f;
}

function validGrid(grid: BeatGrid | null | undefined): grid is BeatGrid {
    return !!grid && grid.beatInterval > 0 && grid.beats.length > 0;
}

function downbeatOrigin(grid: BeatGrid): number {
    return (grid.beats[0] ?? 0) + grid.downbeatPhase * grid.beatInterval;
}

function uniqueBoundaries(boundaries: Boundary[]): Boundary[] {
    const bySec = new Map<number, Boundary>();
    const weight: Record<CueGridKind, number> = { phrase: 5, bar: 4, beat: 3, target: 2, start: 1 };
    for (const b of boundaries) {
        const key = round(b.sec, 4);
        const prev = bySec.get(key);
        if (!prev || weight[b.kind] > weight[prev.kind]) bySec.set(key, b);
    }
    return [...bySec.values()].sort((a, b) => a.sec - b.sec);
}

function boundariesAtOrBefore(
    grid: BeatGrid,
    targetSec: number,
    maxSec: number,
    beatsPerUnit: number,
    kind: CueGridKind,
    lookbackBeats: number,
): Boundary[] {
    const interval = grid.beatInterval;
    const origin = downbeatOrigin(grid);
    const unit = interval * beatsPerUnit;
    const latest = Math.min(targetSec, maxSec);
    const earliest = Math.max(0, latest - interval * lookbackBeats);
    const latestN = Math.floor((latest - origin) / unit);
    const out: Boundary[] = [];
    for (let n = latestN; n >= latestN - Math.ceil(lookbackBeats / beatsPerUnit) - 1; n--) {
        const sec = origin + n * unit;
        if (sec < earliest) break;
        if (sec >= 0 && sec <= maxSec) out.push({ sec, kind });
    }
    return out;
}

function boundariesAtOrAfter(
    grid: BeatGrid,
    fromSec: number,
    beatsPerUnit: number,
    kind: CueGridKind,
    maxDelayBeats: number,
): Boundary[] {
    const interval = grid.beatInterval;
    const origin = downbeatOrigin(grid);
    const unit = interval * beatsPerUnit;
    const maxSec = fromSec + interval * maxDelayBeats;
    const startN = Math.ceil((fromSec - origin) / unit);
    const out: Boundary[] = [];
    for (let n = Math.max(0, startN); ; n++) {
        const sec = origin + n * unit;
        if (sec > maxSec) break;
        if (sec >= 0 && sec >= fromSec) out.push({ sec, kind });
    }
    return out;
}

function aCandidates(
    grid: BeatGrid | null | undefined,
    targetSec: number,
    maxSec: number,
    preferPhrase: boolean,
    lookbackBeats: number,
): Boundary[] {
    if (!validGrid(grid)) return [{ sec: clamp(targetSec, 0, maxSec), kind: "target" }];
    const out: Boundary[] = [];
    if (preferPhrase) {
        out.push(...boundariesAtOrBefore(grid, targetSec, maxSec, BEATS_PER_PHRASE, "phrase", lookbackBeats));
    }
    out.push(...boundariesAtOrBefore(grid, targetSec, maxSec, BEATS_PER_BAR, "bar", lookbackBeats));
    out.push(...boundariesAtOrBefore(grid, targetSec, maxSec, 1, "beat", Math.min(lookbackBeats, 8)));
    out.push({ sec: clamp(targetSec, 0, maxSec), kind: "target" });
    return uniqueBoundaries(out);
}

function bCandidates(
    grid: BeatGrid | null | undefined,
    preRollSec: number,
    preferPhrase: boolean,
    maxDropDelayBeats: number,
): Boundary[] {
    if (!validGrid(grid)) return [{ sec: Math.max(0, preRollSec), kind: "start" }];
    const from = Math.max(grid.introSec > 1 ? grid.introSec : 0, 0);
    const out: Boundary[] = [];
    if (preferPhrase) {
        out.push(...boundariesAtOrAfter(grid, from, BEATS_PER_PHRASE, "phrase", maxDropDelayBeats));
    }
    out.push(...boundariesAtOrAfter(grid, from, BEATS_PER_BAR, "bar", maxDropDelayBeats));
    out.push(...boundariesAtOrAfter(grid, from, 1, "beat", Math.min(maxDropDelayBeats, 4)));
    out.push({ sec: from, kind: "target" });
    return uniqueBoundaries(out);
}

function scoreA(
    boundary: Boundary,
    targetSec: number,
    endSec: number,
    fadeSec: number,
    rate: number,
    interval: number,
    preferPhrase: boolean,
    maxPhraseSacrificeBeats: number,
): number {
    const kindScore =
        boundary.kind === "phrase"
            ? preferPhrase
                ? 42
                : 28
            : boundary.kind === "bar"
              ? 34
              : boundary.kind === "beat"
                ? 18
                : 14;
    const sacrificeBeats = Math.max(0, (targetSec - boundary.sec) / interval);
    const endErrorBeats = Math.abs(endSec - (boundary.sec + fadeSec * rate)) / interval;
    let score =
        kindScore - sacrificeBeats * (boundary.kind === "phrase" && preferPhrase ? 1.5 : 2.6) - endErrorBeats * 1.2;
    if (boundary.kind === "phrase" && sacrificeBeats > maxPhraseSacrificeBeats) score -= 28;
    return score;
}

function scoreB(
    boundary: Boundary,
    grid: BeatGrid | null | undefined,
    transitionType: TransitionType,
    preferPhrase: boolean,
    maxDropDelayBeats: number,
): number {
    if (!validGrid(grid)) return 12;
    const from = Math.max(grid.introSec > 1 ? grid.introSec : 0, 0);
    const delayBeats = Math.max(0, (boundary.sec - from) / grid.beatInterval);
    const dropMove = DROP_TRANSITIONS.has(transitionType);
    const kindScore =
        boundary.kind === "phrase"
            ? preferPhrase || dropMove
                ? 34
                : 22
            : boundary.kind === "bar"
              ? 30
              : boundary.kind === "beat"
                ? 16
                : 12;
    let score = kindScore - delayBeats * (boundary.kind === "phrase" && (preferPhrase || dropMove) ? 0.9 : 1.8);
    if (delayBeats > maxDropDelayBeats) score -= 30;
    return score;
}

export function chooseTransitionCue(options: TransitionCueOptions): TransitionCue {
    const rate = clamp(options.outgoingTempoRatio ?? 1, 0.25, 4);
    const preRollSec = Math.max(0, options.preRollSec ?? 0.02);
    const preferPhrase = options.preferPhrase ?? PHRASE_TRANSITIONS.has(options.transitionType);
    const lookbackBeats = options.lookbackBeats ?? DEFAULT_LOOKBACK_BEATS;
    const maxPhraseSacrificeBeats = options.maxPhraseSacrificeBeats ?? DEFAULT_MAX_PHRASE_SACRIFICE_BEATS;
    const maxDropDelayBeats = options.maxNextDropDelayBeats ?? DEFAULT_MAX_NEXT_DROP_DELAY_BEATS;
    const detectedEndSec = options.currentGrid?.musicalEndSec;
    const endSec = Math.max(
        0,
        detectedEndSec && Number.isFinite(detectedEndSec) && detectedEndSec > 0
            ? detectedEndSec
            : options.currentDurationSec,
    );
    const targetSec = Math.max(0, endSec - options.fadeSec * rate);
    const maxSec = Math.max(0, endSec - 0.1);
    const currentInterval = validGrid(options.currentGrid) ? options.currentGrid.beatInterval : 0.5;

    let best: TransitionCue | null = null;
    for (const a of aCandidates(options.currentGrid, targetSec, maxSec, preferPhrase, lookbackBeats)) {
        for (const b of bCandidates(options.nextGrid, preRollSec, preferPhrase, maxDropDelayBeats)) {
            const aScore = scoreA(
                a,
                targetSec,
                endSec,
                options.fadeSec,
                rate,
                currentInterval,
                preferPhrase,
                maxPhraseSacrificeBeats,
            );
            const bScore = scoreB(b, options.nextGrid, options.transitionType, preferPhrase, maxDropDelayBeats);
            const score = round(50 + aScore + bScore);
            const cue: TransitionCue = {
                aStartSec: round(a.sec),
                aStartPlaySec: round(a.sec / rate),
                bDropSec: round(b.sec),
                bStartSec: round(Math.max(0, b.sec - preRollSec)),
                score,
                aGrid: a.kind,
                bGrid: b.kind,
                reason: `${a.kind} out -> ${b.kind} in`,
            };
            if (!best || cue.score > best.score || (cue.score === best.score && cue.aStartSec > best.aStartSec)) {
                best = cue;
            }
        }
    }

    return (
        best ?? {
            aStartSec: round(targetSec),
            aStartPlaySec: round(targetSec / rate),
            bStartSec: 0,
            bDropSec: 0,
            score: 0,
            aGrid: "target",
            bGrid: "start",
            reason: "fallback cue",
        }
    );
}
