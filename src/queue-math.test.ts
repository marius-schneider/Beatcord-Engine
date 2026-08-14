import { expect, test } from "bun:test";

import { jumpTo, moveTrack, removeAt, shuffleInPlace } from "./queue-math";

const list = () => ["a", "b", "c", "d"];

// ── removeAt ──────────────────────────────────────────────────────────────────

test("removeAt: pulls the item at the index and returns it", () => {
    const q = list();
    expect(removeAt(q, 1)).toBe("b");
    expect(q).toEqual(["a", "c", "d"]);
});

test("removeAt: first and last boundaries", () => {
    const q1 = list();
    expect(removeAt(q1, 0)).toBe("a");
    expect(q1).toEqual(["b", "c", "d"]);
    const q2 = list();
    expect(removeAt(q2, 3)).toBe("d");
    expect(q2).toEqual(["a", "b", "c"]);
});

test("removeAt: out-of-range / negative / non-integer → null, queue untouched", () => {
    const q = list();
    expect(removeAt(q, 4)).toBeNull(); // == length
    expect(removeAt(q, -1)).toBeNull();
    expect(removeAt(q, 1.5)).toBeNull();
    expect(removeAt(q, Number.NaN)).toBeNull();
    expect(q).toEqual(["a", "b", "c", "d"]);
});

test("removeAt: on an empty queue → null", () => {
    expect(removeAt([], 0)).toBeNull();
});

// ── moveTrack ─────────────────────────────────────────────────────────────────

test("moveTrack: forward move re-indexes against the post-removal array", () => {
    const q = list();
    expect(moveTrack(q, 0, 2)).toBe("a"); // pull "a", insert at index 2 of ["b","c","d"]
    expect(q).toEqual(["b", "c", "a", "d"]);
});

test("moveTrack: backward move", () => {
    const q = list();
    expect(moveTrack(q, 3, 0)).toBe("d");
    expect(q).toEqual(["d", "a", "b", "c"]);
});

test("moveTrack: same index is a stable no-op (returns the item)", () => {
    const q = list();
    expect(moveTrack(q, 2, 2)).toBe("c");
    expect(q).toEqual(["a", "b", "c", "d"]);
});

test("moveTrack: any out-of-range / non-integer index → null, queue untouched", () => {
    const q = list();
    expect(moveTrack(q, 4, 0)).toBeNull(); // from == length
    expect(moveTrack(q, 0, 4)).toBeNull(); // to == length
    expect(moveTrack(q, -1, 0)).toBeNull();
    expect(moveTrack(q, 0, 1.5)).toBeNull();
    expect(q).toEqual(["a", "b", "c", "d"]);
});

// ── jumpTo ────────────────────────────────────────────────────────────────────

test("jumpTo: drops everything before the index, target ends up at the front", () => {
    const q = list();
    expect(jumpTo(q, 2)).toBe("c");
    expect(q).toEqual(["c", "d"]);
    expect(q[0]).toBe("c");
});

test("jumpTo: index 0 is a no-op that returns the front item", () => {
    const q = list();
    expect(jumpTo(q, 0)).toBe("a");
    expect(q).toEqual(["a", "b", "c", "d"]);
});

test("jumpTo: out-of-range / negative / non-integer → null, queue untouched", () => {
    const q = list();
    expect(jumpTo(q, 4)).toBeNull();
    expect(jumpTo(q, -1)).toBeNull();
    expect(jumpTo(q, 2.5)).toBeNull();
    expect(q).toEqual(["a", "b", "c", "d"]);
});

// ── shuffleInPlace ────────────────────────────────────────────────────────────

test("shuffleInPlace: keeps exactly the same multiset (a permutation)", () => {
    const q = ["a", "b", "c", "d", "e"];
    shuffleInPlace(q, () => 0.42); // deterministic rng
    expect([...q].sort()).toEqual(["a", "b", "c", "d", "e"]);
    expect(q.length).toBe(5);
});

test("shuffleInPlace: rng → 0 rotates predictably (Fisher–Yates with j=0)", () => {
    // With rng()==0, every j is 0: each i swaps with index 0 in turn.
    const q = ["a", "b", "c"];
    shuffleInPlace(q, () => 0);
    // i=2: swap(2,0) → [c,b,a]; i=1: swap(1,0) → [b,c,a]
    expect(q).toEqual(["b", "c", "a"]);
});

test("shuffleInPlace: empty + single-element queues are untouched", () => {
    const empty: string[] = [];
    shuffleInPlace(empty);
    expect(empty).toEqual([]);
    const one = ["x"];
    shuffleInPlace(one);
    expect(one).toEqual(["x"]);
});
