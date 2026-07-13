import { expect, test } from "bun:test";

import { BoundedCache } from "./bounded-cache";

test("stores and retrieves values", () => {
    const c = new BoundedCache<string, number>(3);
    c.set("a", 1);
    expect(c.get("a")).toBe(1);
    expect(c.get("missing")).toBeNull();
});

test("evicts the least-recently-used when over capacity", () => {
    const c = new BoundedCache<string, number>(2);
    c.set("a", 1);
    c.set("b", 2);
    c.set("c", 3); // exceeds cap → "a" (LRU) evicted
    expect(c.get("a")).toBeNull();
    expect(c.get("b")).toBe(2);
    expect(c.get("c")).toBe(3);
    expect(c.size).toBe(2);
});

test("a read refreshes recency, protecting it from eviction", () => {
    const c = new BoundedCache<string, number>(2);
    c.set("a", 1);
    c.set("b", 2);
    expect(c.get("a")).toBe(1); // "a" now most-recent
    c.set("c", 3); // "b" is LRU now → evicted, "a" survives
    expect(c.get("b")).toBeNull();
    expect(c.get("a")).toBe(1);
    expect(c.get("c")).toBe(3);
});

test("expires entries past their TTL", async () => {
    const c = new BoundedCache<string, number>(5, 20); // 20ms TTL
    c.set("a", 1);
    expect(c.get("a")).toBe(1);
    await Bun.sleep(30);
    expect(c.get("a")).toBeNull();
    expect(c.size).toBe(0); // expired read purges it
});

test("ttl = 0 means entries never expire", async () => {
    const c = new BoundedCache<string, number>(5, 0);
    c.set("a", 1);
    await Bun.sleep(15);
    expect(c.get("a")).toBe(1);
});

test("re-setting an existing key updates value and recency", () => {
    const c = new BoundedCache<string, number>(2);
    c.set("a", 1);
    c.set("b", 2);
    c.set("a", 99); // update + becomes most-recent
    c.set("c", 3); // "b" is LRU → evicted
    expect(c.get("a")).toBe(99);
    expect(c.get("b")).toBeNull();
});

test("rejects an invalid capacity", () => {
    expect(() => new BoundedCache(0)).toThrow();
});
