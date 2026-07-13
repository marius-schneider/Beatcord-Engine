/**
 * A counting semaphore that bounds how many async operations run at once. Used to
 * cap concurrent yt-dlp subprocess spawns so a burst (e.g. resolving a whole page
 * of albums in parallel) can't exhaust CPU/RAM. Callers past the limit queue FIFO
 * and proceed as slots free.
 */
export class Semaphore {
    #max: number;
    #active = 0;
    /** FIFO of waiters; each resolve() hands the waiter a freed slot. */
    #queue: Array<() => void> = [];

    constructor(max: number) {
        if (max < 1) throw new Error(`Semaphore max must be >= 1 (got ${max})`);
        this.#max = max;
    }

    /** Slots currently in use (for tests/introspection). */
    get active(): number {
        return this.#active;
    }

    /** Waiters currently queued for a slot. */
    get pending(): number {
        return this.#queue.length;
    }

    /**
     * Run `fn` once a slot is free, releasing the slot when it settles (even on
     * throw). Returns whatever `fn` returns. The slot is held for the full duration
     * of `fn`, so wrap only the bounded work — not unrelated awaits.
     */
    async run<T>(fn: () => Promise<T>): Promise<T> {
        await this.#acquire();
        try {
            return await fn();
        } finally {
            this.#release();
        }
    }

    #acquire(): Promise<void> {
        if (this.#active < this.#max) {
            this.#active++;
            return Promise.resolve();
        }
        return new Promise<void>((resolve) => this.#queue.push(resolve));
    }

    #release(): void {
        const next = this.#queue.shift();
        if (next) {
            // Hand the slot straight to the next waiter (keeps #active steady).
            next();
        } else {
            this.#active--;
        }
    }
}
