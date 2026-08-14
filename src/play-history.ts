/**
 * The "previously played" stack behind a Previous button.
 *
 * The one rule that's easy to get wrong: a track change caused by going BACK must
 * not push the track being left onto the stack. Otherwise going back from B to A
 * re-pushes B, the next Previous returns to B, and the listener ping-pongs between
 * two tracks — never reaching A's predecessor.
 *
 * That rule is enforced here rather than by callers remembering a flag: {@link back}
 * suppresses pushes for the duration of the playback change it drives, so any
 * `push()` triggered from inside a track-change callback is correctly ignored.
 */
export class PlayHistory<T> {
    #items: T[] = [];
    #max: number;
    #rewinding = false;

    constructor(max = 25) {
        this.#max = Math.max(1, max);
    }

    /** Oldest first; the last entry is where {@link back} would go. */
    get items(): readonly T[] {
        return this.#items;
    }

    get size(): number {
        return this.#items.length;
    }

    /** Is there anything to go back to? */
    get canGoBack(): boolean {
        return this.#items.length > 0;
    }

    /** The most recently played track, without removing it. */
    get last(): T | undefined {
        return this.#items.at(-1);
    }

    /**
     * Record a track we've moved on FROM. Ignored while {@link back} is running —
     * that's backward motion, and the track being left belongs in the queue instead.
     */
    push(item: T): void {
        if (this.#rewinding) return;
        this.#items.push(item);
        if (this.#items.length > this.#max) this.#items.shift();
    }

    /**
     * Step back one track: pops the previous entry and hands it to `play`, which
     * performs the actual playback change. Pushes are suppressed until `play`
     * settles, so the track being left doesn't land back on the stack.
     *
     * Returns false (without calling `play`) when there's no history. If `play`
     * throws, the entry is restored so the stack isn't silently eaten.
     */
    async back(play: (previous: T) => Promise<void> | void): Promise<boolean> {
        const previous = this.#items.pop();
        if (previous === undefined) return false;
        this.#rewinding = true;
        try {
            await play(previous);
            return true;
        } catch (err) {
            this.#items.push(previous); // failed to go back — keep it reachable
            throw err;
        } finally {
            this.#rewinding = false;
        }
    }

    /**
     * Drop everything. Empties the existing array rather than replacing it, so a
     * consumer that captured {@link items} keeps observing this history instead of
     * silently reading a detached snapshot.
     */
    clear(): void {
        this.#items.length = 0;
    }
}
