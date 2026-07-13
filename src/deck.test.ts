import { expect, test } from "bun:test";

import { PCM_MAX } from "./constants";
import { scaleFloatToS16 } from "./deck";
import { finalizeFloatSample } from "./mixer";

// Regression guard for the f32→s16 scale boundary. ffmpeg decodes decks to f32le in the
// normalized ±1.0 range, but the MixDeck math works in s16 scale (±32767). The deck must
// scale on read; otherwise mixed frames are ~±0.3 and quantize to silence.

test("scaleFloatToS16 lifts normalized ±1.0 samples into the s16 mix scale", () => {
    const v = new Float32Array([0, 0.5, -0.5, 1, -1]);
    scaleFloatToS16(v);
    expect(Array.from(v)).toEqual([0, PCM_MAX * 0.5, -PCM_MAX * 0.5, PCM_MAX, -PCM_MAX]);
});

test("without the scale, a normal-level sample would quantize to silence", () => {
    // A typical playback level (~0.3 full-scale) in raw f32 rounds to 0 at the s16 output…
    expect(finalizeFloatSample(0.3)).toBe(0);
    // …but after scaling it lands at a real, audible s16 value.
    const v = new Float32Array([0.3]);
    scaleFloatToS16(v);
    expect(finalizeFloatSample(v[0]!)).toBe(Math.round(0.3 * PCM_MAX));
});
