import { expect, test } from "bun:test";

import { alignTrimSec, B_PRE_ROLL_SEC } from "./mixer";

test("fired exactly on the bar line → trim equals the pre-roll (bar lands ON the line)", () => {
    expect(alignTrimSec(100.0, 100.0)).toBeCloseTo(B_PRE_ROLL_SEC, 9);
});

test("fired late by frame quantization → the lateness is trimmed on top of the pre-roll", () => {
    // 17ms past the bar line: trim 50ms pre-roll + 17ms → bar still ON the line.
    expect(alignTrimSec(100.017, 100.0)).toBeCloseTo(B_PRE_ROLL_SEC + 0.017, 9);
});

test("never negative (fired early can't un-trim) and capped to a sane maximum", () => {
    expect(alignTrimSec(99.0, 100.0)).toBe(0); // way early → no trim
    expect(alignTrimSec(101.0, 100.0)).toBe(0.2); // way late → capped
});

test("custom pre-roll is respected", () => {
    expect(alignTrimSec(100.01, 100.0, 0.02)).toBeCloseTo(0.03, 9);
});
