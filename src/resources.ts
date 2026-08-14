import { readFileSync } from "node:fs";
import { availableParallelism, totalmem } from "node:os";

import { createLogger } from "./logger";

const log = createLogger("resources");

/**
 * What this process may actually spend, measured from the host it lands on.
 *
 * Every CPU-bound pool in the engine used to carry a hand-picked constant. Those
 * numbers can only be right for one machine: a 2-core VPS thrashes at settings that
 * leave a 10-core box idle, and the project deploys to both (there's a Dockerfile
 * and a systemd unit). So the limits are derived here instead, once at startup.
 *
 * The subtlety that makes hand-tuning fail in containers: `availableParallelism()`
 * reports the HOST's cores, not the cgroup quota. A container limited to 2 CPUs on a
 * 64-core host would otherwise size its pools for 64 and spend its whole quota on
 * context switching. {@link cpuBudget} reads the quota where one exists.
 */

/** Parse a cgroup file to a number, or null when it's absent/unreadable/not a limit. */
function readLimit(path: string): number | null {
    try {
        const raw = readFileSync(path, "utf8").trim();
        if (!raw || raw === "max" || raw === "-1") return null; // explicitly unlimited
        const n = Number(raw);
        return Number.isFinite(n) && n > 0 ? n : null;
    } catch {
        return null; // not this cgroup version, or not Linux
    }
}

/**
 * CPUs available to THIS process: the smaller of the host's parallelism and any
 * cgroup CPU quota. Both cgroup versions are checked because which one is mounted
 * depends on the host, not on us.
 */
export function cpuBudget(): number {
    const host = Math.max(1, availableParallelism());

    // cgroup v2: "<quota> <period>" in microseconds, or "max <period>" when unlimited.
    try {
        const [quota, period] = readFileSync("/sys/fs/cgroup/cpu.max", "utf8").trim().split(/\s+/);
        if (quota && quota !== "max" && period) {
            const cpus = Number(quota) / Number(period);
            if (Number.isFinite(cpus) && cpus > 0) return Math.max(1, Math.min(host, Math.floor(cpus)));
        }
    } catch {
        /* not cgroup v2 */
    }

    // cgroup v1: quota and period in separate files.
    const quota = readLimit("/sys/fs/cgroup/cpu/cpu.cfs_quota_us");
    const period = readLimit("/sys/fs/cgroup/cpu/cpu.cfs_period_us");
    if (quota && period) {
        const cpus = quota / period;
        if (cpus > 0) return Math.max(1, Math.min(host, Math.floor(cpus)));
    }

    return host;
}

/**
 * Memory this process may use, in GB. Same cgroup-before-host reasoning as the CPU
 * budget. Deliberately NOT based on free memory: an OS that uses spare RAM as file
 * cache (macOS always, Linux usually) reports almost nothing free while being
 * perfectly willing to hand it over.
 */
export function memoryBudgetGb(): number {
    const host = totalmem();
    const limit =
        readLimit("/sys/fs/cgroup/memory.max") ?? readLimit("/sys/fs/cgroup/memory/memory.limit_in_bytes") ?? null;
    // A cgroup with no limit reports a sentinel far above real RAM — ignore those.
    const bytes = limit && limit < host ? limit : host;
    return bytes / 1024 ** 3;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/** The derived limits, so callers (and the boot log) see one coherent picture. */
export interface ResourcePlan {
    cpus: number;
    memoryGb: number;
    /** Beat-grid analysis workers (WASM, genuinely CPU-bound). */
    beatgridWorkers: number;
    /** Simultaneous loudness scans (full-speed whole-file decodes). */
    loudnessScans: number;
    /** Concurrent yt-dlp subprocesses. */
    ytdlp: number;
    /** Concurrent TIDAL downloads. */
    tidalDownloads: number;
    /** Concurrent Demucs stem separations (by far the heaviest job). */
    stems: number;
}

/**
 * Derive every pool size from the budget.
 *
 * The shape of these rules matters more than the exact numbers. Playback is the
 * real-time path and must never be starved: a late analysis costs one track its
 * beat-matched transition, while a starved decoder is an audible dropout. So every
 * analysis pool takes a *fraction* of the cores and leaves the rest, and each is
 * capped — past a point, more parallel scans only add contention.
 */
export function planResources(): ResourcePlan {
    const cpus = cpuBudget();
    const memoryGb = memoryBudgetGb();

    return {
        cpus,
        memoryGb,
        // Half the cores: heavy, but each analysis is short and bounded.
        beatgridWorkers: clamp(Math.floor(cpus / 2), 1, 6),
        // A third: these are full-speed decodes competing directly with playback.
        loudnessScans: clamp(Math.floor(cpus / 3), 1, 4),
        // Mostly network-bound, so it may exceed the core count a little.
        ytdlp: clamp(Math.floor(cpus / 2), 2, 8),
        // API-bound and rate-limited upstream; more parallelism buys nothing.
        tidalDownloads: clamp(Math.floor(cpus / 4), 1, 4),
        // Demucs is minutes of CPU AND multiple GB per job — memory decides here,
        // not cores. Below 8 GB a second concurrent job risks the OOM killer.
        stems: memoryGb >= 16 && cpus >= 8 ? 2 : 1,
    };
}

/** Computed once: the values are read all over, and the host doesn't change. */
export const resources: ResourcePlan = planResources();

/**
 * The limit to actually use: an explicit config value, else the derived one.
 *
 * Config fields carry `0` for "auto" rather than a plausible-looking default,
 * because a real default is indistinguishable from a deliberate choice — we could
 * never tell "the operator wants 4" from "nobody touched it".
 */
export function limitFor(configured: number, derived: number): number {
    return configured > 0 ? configured : derived;
}

/** Log the plan at boot, so a wrong-looking limit is diagnosable without guessing. */
export function logResourcePlan(): void {
    const r = resources;
    log.info(
        `host: ${r.cpus} cpu / ${r.memoryGb.toFixed(1)} GB → beatgrid ${r.beatgridWorkers}, ` +
            `loudness ${r.loudnessScans}, yt-dlp ${r.ytdlp}, tidal ${r.tidalDownloads}, stems ${r.stems}`,
    );
}
