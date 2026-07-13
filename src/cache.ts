import { readdir, stat, unlink, utimes } from "node:fs/promises";
import { join, resolve } from "node:path";

import { config } from "./config";
import { createLogger } from "./logger";

const log = createLogger("Cache");

const cacheDir = resolve(process.cwd(), config.CACHE_DIR);
const maxBytes = config.CACHE_MAX_MB * 1024 * 1024;

/** Mark a file as just-used so LRU eviction keeps it longer (touch mtime). */
export async function touch(filePath: string): Promise<void> {
    const now = new Date();
    await utimes(filePath, now, now).catch(() => {});
}

/**
 * Evict least-recently-used cache files until the directory is back under
 * `CACHE_MAX_MB`. Files in `keep` (currently playing/queued) are never deleted.
 * Runs after each download; cheap because it only stats the cache dir.
 */
export async function enforceCacheLimit(keep: ReadonlySet<string> = new Set()): Promise<void> {
    let entries: { path: string; size: number; atimeMs: number }[];
    try {
        const names = await readdir(cacheDir);
        entries = [];
        for (const name of names) {
            const path = join(cacheDir, name);
            const s = await stat(path).catch(() => null);
            if (s?.isFile()) entries.push({ path, size: s.size, atimeMs: s.mtimeMs });
        }
    } catch {
        return; // cache dir missing → nothing to do
    }

    let total = entries.reduce((sum, e) => sum + e.size, 0);
    if (total <= maxBytes) return;

    // Oldest first (least-recently-used by mtime).
    entries.sort((a, b) => a.atimeMs - b.atimeMs);

    let freed = 0;
    for (const entry of entries) {
        if (total <= maxBytes) break;
        if (keep.has(entry.path)) continue;
        if (
            await unlink(entry.path)
                .then(() => true)
                .catch(() => false)
        ) {
            total -= entry.size;
            freed += entry.size;
        }
    }
    if (freed > 0) {
        log.info(`Evicted ${(freed / 1024 / 1024).toFixed(1)} MB from cache (limit ${config.CACHE_MAX_MB} MB).`);
    }
}
