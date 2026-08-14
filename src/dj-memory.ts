// DJ Memory — per-user pair affinity. Beyond "was this transition graded well"
// (that's transition telemetry in telemetry.ts), this remembers which SONG and
// GENRE COMBINATIONS actually played through vs got skipped for THIS listener.
// Over a few nights it learns "after A, B lands" and "hip-hop → EDM jars for me".
//
// Deliberately light: a saturating score per (a→b) song pair and per
// (genreA→genreB) pair, persisted as one compact JSON file per user next to
// the telemetry log. Not global — the whole point is that it's personal.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { config } from "./config";
import type { GenreHint } from "./genre";
import { createLogger } from "./logger";

const log = createLogger("dj-memory");

export type PairOutcome = "played" | "skipped";

interface Affinity {
    score: number; // −1 (avoid) … +1 (loves)
    n: number; // evidence count
}
interface UserMemory {
    pairs: Record<string, Affinity>;
    genres: Record<string, Affinity>;
}

const arrow = (a: string, b: string) => `${a}→${b}`;

/** Move a saturating score toward ±1 (diminishing returns near the edges). */
function bump(map: Record<string, Affinity>, key: string, delta: number): void {
    const cur = map[key] ?? { score: 0, n: 0 };
    cur.score = Math.max(-1, Math.min(1, cur.score + delta * (1 - Math.abs(cur.score))));
    cur.n += 1;
    map[key] = cur;
}

export class DjMemory {
    #base = resolve(process.cwd(), config.AUTOMIX_TELEMETRY_PATH).replace(/\.jsonl$/, "");
    #users = new Map<string, UserMemory>();
    #loaded = new Set<string>();
    #writing = new Map<string, Promise<void>>();

    #path(userId: string): string {
        const safe = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
        return `${this.#base}.memory.${safe}.json`;
    }
    #mem(userId: string): UserMemory {
        let m = this.#users.get(userId);
        if (!m) {
            m = { pairs: {}, genres: {} };
            this.#users.set(userId, m);
        }
        return m;
    }

    /** Load a user's memory from disk once (safe to call repeatedly). */
    async load(userId = "solo"): Promise<void> {
        if (this.#loaded.has(userId)) return;
        this.#loaded.add(userId);
        try {
            const txt = await readFile(this.#path(userId), "utf8");
            const parsed = JSON.parse(txt) as UserMemory;
            this.#users.set(userId, { pairs: parsed.pairs ?? {}, genres: parsed.genres ?? {} });
        } catch {
            /* fresh listener — no memory yet */
        }
    }

    /** Record how an A → B pairing turned out for this listener. */
    remember(
        aId: string,
        bId: string,
        aGenre: GenreHint,
        bGenre: GenreHint,
        outcome: PairOutcome,
        userId = "solo",
    ): void {
        const m = this.#mem(userId);
        const delta = outcome === "played" ? 0.25 : -0.35; // skips sting more than plays reward
        bump(m.pairs, arrow(aId, bId), delta);
        bump(m.genres, arrow(aGenre, bGenre), delta * 0.6); // genre generalizes, so weaker
        void this.#persist(userId);
    }

    /** 0..1 affinity for playing B right after A (0.5 = neutral / unknown). */
    pairScore(aId: string, bId: string, aGenre: GenreHint, bGenre: GenreHint, userId = "solo"): number {
        const m = this.#users.get(userId);
        if (!m) return 0.5;
        const pair = m.pairs[arrow(aId, bId)];
        const genre = m.genres[arrow(aGenre, bGenre)];
        // Direct song-pair evidence dominates; otherwise fall back to the genre
        // pairing (weaker). No evidence → neutral.
        const raw = pair ? pair.score : genre ? genre.score * 0.6 : 0;
        return Math.max(0, Math.min(1, 0.5 + raw * 0.5));
    }

    /** Serialize (coalesced so concurrent remembers don't race the file). */
    async #persist(userId: string): Promise<void> {
        if (this.#writing.has(userId)) {
            // A write is already queued; it will flush the latest state.
            return;
        }
        const p = this.#path(userId);
        const task = (async () => {
            try {
                await mkdir(dirname(p), { recursive: true });
                await writeFile(p, JSON.stringify(this.#mem(userId)));
            } catch (err) {
                log.warn(`memory persist failed: ${(err as Error).message}`);
            } finally {
                this.#writing.delete(userId);
            }
        })();
        this.#writing.set(userId, task);
        await task;
    }
}
