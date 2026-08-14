import type { BeatGrid } from "./beatgrid";

/**
 * Pure beat-grid math for transition timing — where exactly a crossfade should
 * start on the outgoing track and where the incoming track should enter. Kept
 * free of any runtime dependency (type-only import) so it's directly unit-testable.
 *
 * All times here are in the track's ORIGINAL timeline (the grid's frame of
 * reference). The caller converts to playback time when a deck is tempo-stretched.
 */

/** Beats per bar (4/4 — the safe assumption for the genres we beat-match). */
const BEATS_PER_BAR = 4;
/** Beats per phrase: dance music phrases in 16-beat (4-bar) blocks. */
const BEATS_PER_PHRASE = 16;
/**
 * Snapping to the phrase grid may move the start earlier, cutting the outgoing
 * track short. Cap that sacrifice; beyond it, fall back to the bar grid.
 */
const MAX_PHRASE_SACRIFICE_BEATS = 8;

/** Largest point ≤ target on a `beatsPerUnit` grid anchored at the downbeat. */
function snapToGrid(grid: BeatGrid, targetSec: number, max: number, beatsPerUnit: number): number | null {
    const interval = grid.beatInterval;
    if (!(interval > 0)) return null;
    // Origin of the bar/phrase grid = the first detected downbeat. beat[downbeatPhase]
    // is a real bar line; units repeat every `unit` seconds from there.
    const b0 = grid.beats[0] ?? 0;
    const origin = b0 + grid.downbeatPhase * interval;
    const unit = interval * beatsPerUnit;
    let n = Math.floor((targetSec - origin) / unit);
    let pos = origin + n * unit;
    while (pos > max && n > 0) pos = origin + --n * unit;
    return pos >= 0 && pos <= max ? pos : null;
}

/**
 * Where the transition out of a track should start: the best *musical* boundary at
 * or before `targetSec` (clamped to `max`). Professional mixes land on phrase
 * boundaries, so we try the 16-beat phrase grid first — but a phrase snap may move
 * the start up to 16 beats earlier, cutting the track short, so it's only kept when
 * it sacrifices ≤ {@link MAX_PHRASE_SACRIFICE_BEATS} beats. Fallbacks: the 4-beat
 * bar grid, then the plain beat grid, then `targetSec` itself.
 *
 * `preferPhrase` should be true for beat-matched blends (blend/bassdrop/riser/
 * filter/gate); bar-level is right for cuts and non-rhythmic fades.
 */
export function transitionStart(grid: BeatGrid, targetSec: number, max: number, preferPhrase: boolean): number {
    const interval = grid.beatInterval;

    if (preferPhrase) {
        const phrase = snapToGrid(grid, targetSec, max, BEATS_PER_PHRASE);
        if (phrase !== null && targetSec - phrase <= MAX_PHRASE_SACRIFICE_BEATS * interval) {
            return phrase;
        }
    }
    const bar = snapToGrid(grid, targetSec, max, BEATS_PER_BAR);
    if (bar !== null) return bar;

    // Very short tail: even the first bar line is past `max` — land on *a* beat.
    if (interval > 0) {
        const b0 = grid.beats[0] ?? 0;
        const beatPhase = ((b0 % interval) + interval) % interval;
        let bn = Math.floor((targetSec - beatPhase) / interval);
        let beat = beatPhase + bn * interval;
        while (beat > max && bn > 0) beat = beatPhase + --bn * interval;
        if (beat >= 0 && beat <= max) return beat;
    }
    return Math.max(0, Math.min(targetSec, max));
}

/**
 * Where the incoming track should enter: skip its intro, then start on its next
 * DOWNBEAT (bar line) — not just any beat — so when the outgoing track fires on a
 * bar line, the two tracks' bar grids line up, not merely their beats.
 *
 * `preRollSec` (in the FILE's timeline) is how far before the bar line the stream
 * starts. Hard entries (spinback/roll) use a hair (20ms) so the first transient
 * isn't clipped; crossfades use a larger lead that the mixer then trims away
 * sample-accurately so the bar lands exactly on the outgoing track's bar line.
 */
export function beatAlignedIntro(grid: BeatGrid | null | undefined, preRollSec = 0.02): number {
    if (!grid?.beats.length) return 0;
    const interval = grid.beatInterval;
    if (!(interval > 0)) return 0;
    const b0 = grid.beats[0]!;
    // First bar line of the track (downbeat phase counts beats from beats[0]).
    const firstBar = b0 + grid.downbeatPhase * interval;
    const bar = interval * BEATS_PER_BAR;
    const from = Math.max(grid.introSec > 1 ? grid.introSec : 0, 0);
    // Snap FORWARD to the next bar line at/after the intro end.
    const n = Math.max(0, Math.ceil((from - firstBar) / bar));
    return Math.max(0, firstBar + n * bar - preRollSec);
}
