import type { BeatGrid } from "./beatgrid";
import { createTempoMap, type TempoEvent, type TempoMap } from "./musical-timeline";

export interface DynamicBeatgridAnalysis {
    version: 1;
    tempoMap: TempoMap;
    variableTempo: boolean;
    medianBpm: number;
    minBpm: number;
    maxBpm: number;
    driftBpm: number;
    confidence: number;
}

const round = (value: number, digits = 3) => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

function median(values: readonly number[]): number {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/** Preserve local beat motion instead of collapsing a performance into one average BPM. */
export function analyzeDynamicBeatgrid(
    grid: Pick<BeatGrid, "beats" | "bpm" | "downbeatPhase">,
): DynamicBeatgridAnalysis {
    const intervals = grid.beats
        .slice(1)
        .map((beat, index) => beat - grid.beats[index]!)
        .filter((value) => value > 0.15 && value < 2);
    const localBpms = intervals.map((interval) => 60 / interval);
    const medianBpm = median(localBpms) || grid.bpm;
    const sorted = [...localBpms].sort((a, b) => a - b);
    const low = sorted[Math.floor(sorted.length * 0.1)] ?? medianBpm;
    const high = sorted[Math.floor(sorted.length * 0.9)] ?? medianBpm;
    const tempoChanges: TempoEvent[] = [];
    const firstLocalBpm = median(localBpms.slice(0, 7)) || medianBpm;
    if (grid.beats.length) {
        tempoChanges.push({ atBeatIndex: 0, atSec: grid.beats[0]!, bpm: round(firstLocalBpm), confidence: 0.7 });
    }
    let lastBpm = firstLocalBpm;
    for (let index = 4; index < localBpms.length - 3; index += 4) {
        const local = median(localBpms.slice(index - 3, index + 4));
        if (Math.abs(local - lastBpm) < Math.max(0.8, lastBpm * 0.012)) continue;
        tempoChanges.push({
            atBeatIndex: index,
            atSec: grid.beats[index] ?? 0,
            bpm: round(local),
            confidence: 0.68,
        });
        lastBpm = local;
    }
    const driftBpm = Math.max(0, high - low);
    const deviation = localBpms.length
        ? localBpms.reduce((sum, bpm) => sum + Math.abs(bpm - medianBpm), 0) / localBpms.length
        : 0;
    return {
        version: 1,
        tempoMap: createTempoMap({ beats: grid.beats, downbeatPhase: grid.downbeatPhase, tempoChanges }),
        variableTempo: driftBpm >= Math.max(1.5, medianBpm * 0.015),
        medianBpm: round(medianBpm),
        minBpm: round(low),
        maxBpm: round(high),
        driftBpm: round(driftBpm),
        confidence: round(
            Math.min(1, grid.beats.length / 48) * Math.max(0.35, 1 - deviation / Math.max(1, medianBpm * 0.08)),
        ),
    };
}
