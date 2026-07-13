import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { config } from "./config";
import { createLogger } from "./logger";

/**
 * Source separation via **Demucs** (Meta's htdemucs) — splits a track into a vocal
 * stem and an instrumental stem, the raw material for acapella transitions (sing
 * track A's vocals over track B's beat).
 *
 * We don't call the `demucs` CLI: torchaudio's file loader is fragile on recent
 * Python (torchcodec/ffmpeg backend issues), so we run our own helper
 * (scripts/demucs_separate.py) with the venv's python. It loads/saves audio via
 * soundfile and only uses Demucs for the math. Input is a WAV we decode from the
 * cached track with our bundled ffmpeg, so format support never depends on Python.
 *
 * Demucs is FAR slower than real time (~5× on CPU here), so separation never happens
 * "live" — the beatmatch controller kicks it off during prefetch, minutes ahead of
 * the transition, and the results are cached on disk keyed by track id. The mixer
 * only ever touches finished stem files.
 *
 * Everything is **best-effort**: if the venv is missing, Demucs errors, or it's
 * still running when the transition fires, {@link getStems} returns null and the
 * planner simply won't choose an acapella move. Nothing here can affect playback.
 */

const log = createLogger("Stems");

const venvPython = resolve(process.cwd(), config.DEMUCS_PYTHON);
const helperScript = resolve(process.cwd(), "scripts/demucs_separate.py");
const stemRoot = resolve(process.cwd(), config.STEM_CACHE_DIR);
const ffmpegPath = resolve(process.cwd(), config.FFMPEG_PATH);

/** Demucs is heavy; never run more than one separation at a time per process. */
const MAX_CONCURRENT = 1;
let active = 0;
/** Give up on a separation that's taking absurdly long (model hang / huge file). */
const SEPARATE_TIMEOUT_MS = 5 * 60_000;

/** A track's separated stems (48kHz/stereo WAV paths the mixer can decode). */
export interface Stems {
    vocals: string;
    instrumental: string;
}

/** In-flight separations, so two prefetch passes don't separate the same id twice. */
const inFlight = new Map<string, Promise<Stems | null>>();

/** Whether stem separation is enabled AND the venv + helper exist (cached). */
let availability: boolean | null = null;
export function stemsAvailable(): boolean {
    if (availability === null) {
        availability = config.ENABLE_STEMS && existsSync(venvPython) && existsSync(helperScript);
        if (config.ENABLE_STEMS && !availability) {
            log.info(
                `Stem separation off: Demucs venv not found (${config.DEMUCS_PYTHON}). ` +
                    `Run scripts/setup-demucs.sh to enable acapella transitions.`,
            );
        }
    }
    return availability;
}

/** Where a track's stems live once separated. */
function stemDir(trackId: string): string {
    return resolve(stemRoot, sanitize(trackId));
}
function sanitize(id: string): string {
    return id.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** Already-separated stems for this track, or null if not cached. */
export function cachedStems(trackId: string): Stems | null {
    const dir = stemDir(trackId);
    const vocals = resolve(dir, "vocals.wav");
    const instrumental = resolve(dir, "no_vocals.wav");
    return existsSync(vocals) && existsSync(instrumental) ? { vocals, instrumental } : null;
}

/**
 * Separate `inputFile` into vocal + instrumental stems for `trackId`, returning the
 * cached paths. Reuses an on-disk or in-flight result. Returns null if Demucs is
 * unavailable, busy (over the concurrency cap), times out, or fails — the caller
 * treats "no stems" as "don't offer an acapella transition".
 */
export async function getStems(trackId: string, inputFile: string): Promise<Stems | null> {
    const cached = cachedStems(trackId);
    if (cached) return cached;

    const pending = inFlight.get(trackId);
    if (pending) return pending;

    if (!stemsAvailable()) return null;
    if (active >= MAX_CONCURRENT) {
        log.debug(`Stem separation busy — skipping ${trackId} for now.`);
        return null;
    }

    const job = separate(trackId, inputFile).finally(() => inFlight.delete(trackId));
    inFlight.set(trackId, job);
    return job;
}

async function separate(trackId: string, inputFile: string): Promise<Stems | null> {
    active++;
    const dir = stemDir(trackId);
    const wav = resolve(dir, "input.wav");
    try {
        await mkdir(dir, { recursive: true });
        const t0 = Date.now();
        // Decode the cached track to WAV with OUR ffmpeg first — so Python never has
        // to deal with opus/format detection (the brittle part on new torchaudio).
        if (!(await decodeToWav(inputFile, wav))) return null;
        const ok = await runHelper(wav, dir);
        await rm(wav, { force: true }); // the 50MB intermediate isn't needed after
        if (!ok) return null;
        const stems = cachedStems(trackId);
        if (stems) log.info(`Separated ${trackId} in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
        return stems;
    } catch (err) {
        log.warn(`Stem separation failed for ${trackId}: ${(err as Error).message}`);
        return null;
    } finally {
        active--;
    }
}

/** Decode any input the bundled ffmpeg understands to 44.1kHz stereo WAV. */
function decodeToWav(input: string, outWav: string): Promise<boolean> {
    return new Promise((res) => {
        const p = spawn(
            ffmpegPath,
            ["-hide_banner", "-loglevel", "error", "-i", input, "-ar", "44100", "-ac", "2", "-y", outWav],
            { stdio: ["ignore", "ignore", "pipe"] },
        );
        p.on("error", () => res(false));
        p.on("close", (code) => res(code === 0));
    });
}

/** Run the Python helper (soundfile I/O + Demucs math) → vocals.wav / no_vocals.wav. */
function runHelper(wav: string, outDir: string): Promise<boolean> {
    return new Promise((res) => {
        log.debug(`demucs separate ${basename(wav)} → ${outDir}`);
        const p = spawn(venvPython, [helperScript, wav, outDir, config.DEMUCS_MODEL], {
            stdio: ["ignore", "ignore", "pipe"],
        });
        const timer = setTimeout(() => {
            log.warn(`Demucs timed out for ${basename(wav)} — killing.`);
            p.kill("SIGKILL");
        }, SEPARATE_TIMEOUT_MS);
        p.stderr.on("data", (d: Buffer) => {
            const m = d.toString().trim();
            if (m) log.debug(`demucs: ${m.split("\n").at(-1)}`);
        });
        p.on("error", (e) => {
            clearTimeout(timer);
            log.warn(`demucs spawn failed: ${(e as Error).message}`);
            res(false);
        });
        p.on("close", (code) => {
            clearTimeout(timer);
            res(code === 0);
        });
    });
}
