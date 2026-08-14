export interface MusicalTime {
    bar: number;
    beat: number;
    tick: number;
    phrase: number;
}

export interface BeatEvent {
    index: number;
    atSec: number;
}

export interface DownbeatEvent extends BeatEvent {
    bar: number;
}

export interface TempoEvent {
    atBeatIndex: number;
    atSec: number;
    bpm: number;
    confidence: number;
}

export interface MeterEvent {
    atBeatIndex: number;
    numerator: number;
    denominator: number;
    confidence: number;
}

export interface TempoMap {
    version: 1;
    ticksPerBeat: number;
    beats: BeatEvent[];
    downbeats: DownbeatEvent[];
    tempoChanges: TempoEvent[];
    meterChanges: MeterEvent[];
}

const round = (value: number, digits = 6) => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

export function createTempoMap(input: {
    beats: readonly number[];
    downbeatPhase?: number;
    tempoChanges?: readonly TempoEvent[];
    meterChanges?: readonly MeterEvent[];
    ticksPerBeat?: number;
}): TempoMap {
    const beats = input.beats
        .filter((beat) => Number.isFinite(beat) && beat >= 0)
        .filter((beat, index, values) => index === 0 || beat > values[index - 1]!)
        .map((atSec, index) => ({ index, atSec: round(atSec) }));
    const meterChanges = input.meterChanges?.length
        ? [...input.meterChanges].sort((a, b) => a.atBeatIndex - b.atBeatIndex)
        : [{ atBeatIndex: 0, numerator: 4, denominator: 4, confidence: 0.5 }];
    const numerator = meterChanges[0]?.numerator ?? 4;
    const phase = Math.max(0, Math.min(numerator - 1, Math.floor(input.downbeatPhase ?? 0)));
    const downbeats = beats
        .filter((beat) => (beat.index - phase) % numerator === 0)
        .map((beat, index) => ({ ...beat, bar: index + 1 }));
    return {
        version: 1,
        ticksPerBeat: Math.max(24, Math.floor(input.ticksPerBeat ?? 960)),
        beats,
        downbeats,
        tempoChanges: [...(input.tempoChanges ?? [])].sort((a, b) => a.atBeatIndex - b.atBeatIndex),
        meterChanges,
    };
}

function beatAtOrBefore(beats: readonly BeatEvent[], seconds: number): number {
    let low = 0;
    let high = beats.length - 1;
    let result = 0;
    while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        if (beats[middle]!.atSec <= seconds) {
            result = middle;
            low = middle + 1;
        } else {
            high = middle - 1;
        }
    }
    return result;
}

function meterAt(map: TempoMap, beatIndex: number): MeterEvent {
    return (
        [...map.meterChanges].reverse().find((event) => event.atBeatIndex <= beatIndex) ?? {
            atBeatIndex: 0,
            numerator: 4,
            denominator: 4,
            confidence: 0,
        }
    );
}

function musicalPositionAtBeat(map: TempoMap, beatIndex: number): Omit<MusicalTime, "tick"> {
    let bar = 1;
    let beat = 1;
    for (let index = 0; index < beatIndex; index++) {
        const meter = meterAt(map, index);
        beat++;
        if (beat > meter.numerator) {
            bar++;
            beat = 1;
        }
    }
    return { bar, beat, phrase: Math.floor((bar - 1) / 4) + 1 };
}

/** Convert wall-clock audio time into the shared bar/beat/tick timeline. */
export function secondsToMusicalTime(map: TempoMap, seconds: number): MusicalTime {
    if (!map.beats.length) return { bar: 1, beat: 1, tick: 0, phrase: 1 };
    const clamped = Math.max(map.beats[0]!.atSec, seconds);
    const index = beatAtOrBefore(map.beats, clamped);
    const current = map.beats[index]!;
    const next = map.beats[index + 1];
    const interval = Math.max(0.001, (next?.atSec ?? current.atSec + 0.5) - current.atSec);
    const tick = Math.min(
        map.ticksPerBeat - 1,
        Math.max(0, Math.floor(((clamped - current.atSec) / interval) * map.ticksPerBeat)),
    );
    return { ...musicalPositionAtBeat(map, index), tick };
}

/** Resolve musical time only at the rendering boundary. */
export function musicalTimeToSeconds(map: TempoMap, time: Pick<MusicalTime, "bar" | "beat" | "tick">): number {
    if (!map.beats.length) return 0;
    const targetBar = Math.max(1, Math.floor(time.bar));
    const targetBeat = Math.max(1, Math.floor(time.beat));
    let index = map.beats.findIndex((event) => {
        const position = musicalPositionAtBeat(map, event.index);
        return position.bar === targetBar && position.beat === targetBeat;
    });
    if (index < 0) index = map.beats.length - 1;
    const current = map.beats[index]!;
    const next = map.beats[index + 1];
    const interval = Math.max(0.001, (next?.atSec ?? current.atSec + 0.5) - current.atSec);
    const tick = Math.min(map.ticksPerBeat - 1, Math.max(0, Math.floor(time.tick)));
    return round(current.atSec + (tick / map.ticksPerBeat) * interval);
}

export function musicalTimeToSample(
    map: TempoMap,
    time: Pick<MusicalTime, "bar" | "beat" | "tick">,
    sampleRate: number,
): number {
    return Math.round(musicalTimeToSeconds(map, time) * Math.max(1, sampleRate));
}
