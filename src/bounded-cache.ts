/**
 * A small in-memory cache with a size cap (LRU eviction) and optional per-entry
 * TTL. Backed by a Map, which preserves insertion order — re-inserting on read
 * makes the most-recently-used entry last, so the first key is always the LRU one
 * to evict. Keeps long-running caches (search results, album metadata) from
 * growing without bound.
 */
export class BoundedCache<K, V> {
    #map = new Map<K, { value: V; expires: number }>();
    #max: number;
    #ttlMs: number;

    /** `ttlMs = 0` means entries never expire (size cap still applies). */
    constructor(max: number, ttlMs = 0) {
        if (max < 1) throw new Error(`BoundedCache max must be >= 1 (got ${max})`);
        this.#max = max;
        this.#ttlMs = ttlMs;
    }

    get size(): number {
        return this.#map.size;
    }

    /** Get a live entry, or null if missing/expired. A hit becomes most-recent. */
    get(key: K): V | null {
        const hit = this.#map.get(key);
        if (!hit) return null;
        if (hit.expires && hit.expires < Date.now()) {
            this.#map.delete(key);
            return null;
        }
        // Re-insert to mark as most-recently-used (move to the end of the Map).
        this.#map.delete(key);
        this.#map.set(key, hit);
        return hit.value;
    }

    /** Insert/replace, evicting the least-recently-used entry if over capacity. */
    set(key: K, value: V): void {
        // Replacing an existing key: drop it first so the re-insert lands at the end.
        this.#map.delete(key);
        this.#map.set(key, { value, expires: this.#ttlMs ? Date.now() + this.#ttlMs : 0 });
        if (this.#map.size > this.#max) {
            // Oldest = first key in insertion order = least-recently-used.
            const lru = this.#map.keys().next().value as K | undefined;
            if (lru !== undefined) this.#map.delete(lru);
        }
    }

    delete(key: K): void {
        this.#map.delete(key);
    }

    clear(): void {
        this.#map.clear();
    }
}
