/**
 * Pure index math for the upcoming queue, extracted from the player so the
 * off-by-one-prone bits (remove / move / jump bounds, Fisher–Yates) are unit-testable
 * without a live voice connection. Each helper MUTATES the passed array in place — the
 * player owns the array (`this.queue` / the beatmatch queue) and calls `#syncQueue()`
 * after — and returns the affected item (or null on an out-of-range index).
 *
 * All indices are 0-based into the *upcoming* queue (the now-playing track is not in it).
 */

/** Remove the item at `index`. Returns it, or null if `index` is out of range. */
export function removeAt<T>(queue: T[], index: number): T | null {
    if (!Number.isInteger(index) || index < 0 || index >= queue.length) return null;
    const [removed] = queue.splice(index, 1);
    return removed ?? null;
}

/**
 * Move the item at `from` to position `to`. Returns the moved item, or null if either
 * index is out of range. `to` is interpreted against the queue AFTER the item is pulled
 * out, matching `Array.splice` semantics — i.e. moving the same valid indices is stable.
 */
export function moveTrack<T>(queue: T[], from: number, to: number): T | null {
    if (!Number.isInteger(from) || !Number.isInteger(to)) return null;
    if (from < 0 || from >= queue.length || to < 0 || to >= queue.length) return null;
    const [item] = queue.splice(from, 1);
    if (item === undefined) return null;
    queue.splice(to, 0, item);
    return item;
}

/**
 * Drop everything before `index` so the item at `index` is at the front. Returns that
 * target item (still at the front afterwards), or null if `index` is out of range. The
 * player then advances into it. `index === 0` is a no-op that returns the front item.
 */
export function jumpTo<T>(queue: T[], index: number): T | null {
    if (!Number.isInteger(index) || index < 0 || index >= queue.length) return null;
    const target = queue[index] ?? null;
    queue.splice(0, index);
    return target;
}

/** Fisher–Yates shuffle in place. `rng` defaults to Math.random (injectable for tests). */
export function shuffleInPlace<T>(queue: T[], rng: () => number = Math.random): void {
    for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [queue[i], queue[j]] = [queue[j] as T, queue[i] as T];
    }
}
