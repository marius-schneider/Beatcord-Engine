import { spawn } from "node:child_process";
import { resolve } from "node:path";

// @ts-expect-error - music-tempo ships no types
import MusicTempo from "music-tempo";

import { config } from "./config";
import { detectDanceability } from "./descriptors";
import { analyseSpectrum, type KeyInfo, type SpectralFeatures } from "./key";
import { detectKeyEssentia } from "./key-essentia";
import { createLogger } from "./logger";
import { spectralFeatures } from "./spectral";
import { detectTempoAubio } from "./tempo";

const log = createLogger("BeatGrid");

const ffmpegPath = resolve(process.cwd(), config.FFMPEG_PATH);

// ── Off-thread analysis pool ─────────────────────────────────────────────────
//
// detectBeatGridSync blocks for ~500ms; running it on the main thread froze the
// audio tick + voice receiver. detectBeatGrid (the public entry) instead hands the
// job to a small worker pool, keeping the main thread free. Falls back to running
// synchronously if Workers aren't available (e.g. the test runner) — correctness is
// identical, only the threading differs.

/** How many analyses can run at once (cap CPU on a busy server). */
const POOL_SIZE = 2;

interface PoolWorker {
    worker: Worker;
    busy: boolean;
}
interface PendingJob {
    filePath: string;
    durationMs: number;
    resolve: (g: BeatGrid | null) => void;
}

let pool: PoolWorker[] | null = null;
let poolDisabled = false;
const jobQueue: PendingJob[] = [];
const inflight = new Map<number, PendingJob>();
let nextJobId = 1;

function initPool(): PoolWorker[] | null {
    if (pool || poolDisabled) return pool;
    try {
        pool = Array.from({ length: POOL_SIZE }, () => {
            const worker = new Worker(new URL("./beatgrid-worker.ts", import.meta.url).href);
            const pw: PoolWorker = { worker, busy: false };
            worker.addEventListener("message", (e: MessageEvent<{ id: number; grid: BeatGrid | null }>) => {
                const job = inflight.get(e.data.id);
                inflight.delete(e.data.id);
                pw.busy = false;
                job?.resolve(e.data.grid);
                pumpQueue();
            });
            worker.addEventListener("error", (e) => {
                log.warn(`beatgrid worker error: ${(e as ErrorEvent).message ?? e}`);
            });
            return pw;
        });
    } catch (err) {
        // No Worker support (or worker file unresolvable) → run inline instead.
        log.warn(`Beatgrid worker pool unavailable, analysing on main thread: ${(err as Error).message}`);
        poolDisabled = true;
        pool = null;
    }
    return pool;
}

/** Assign queued jobs to any idle workers. */
function pumpQueue(): void {
    if (!pool) return;
    for (const pw of pool) {
        if (pw.busy || jobQueue.length === 0) continue;
        const job = jobQueue.shift()!;
        const id = nextJobId++;
        inflight.set(id, job);
        pw.busy = true;
        pw.worker.postMessage({ id, filePath: job.filePath, durationMs: job.durationMs });
    }
}

/**
 * Analyse a track into its {@link BeatGrid}. CPU-heavy work runs in a worker thread
 * so the audio stream + voice commands stay smooth; on a host without Workers it
 * runs synchronously (same result). Returns null when the track can't be analysed.
 */
export function detectBeatGrid(filePath: string, durationMs: number): Promise<BeatGrid | null> {
    const p = initPool();
    if (!p) return detectBeatGridSync(filePath, durationMs); // no workers → inline
    return new Promise((resolve) => {
        jobQueue.push({ filePath, durationMs, resolve });
        pumpQueue();
    });
}

/** Tear down the worker pool (clean shutdown). */
export function closeBeatGridPool(): void {
    if (pool) for (const pw of pool) pw.worker.terminate();
    pool = null;
}

/** Tempo + beat positions for one track, used to align crossfades to the beat. */
export interface BeatGrid {
    /** Detected tempo in beats per minute. */
    bpm: number;
    /** Beat onset times in seconds (within the analysed window). */
    beats: number[];
    /** Median seconds between beats (= 60 / bpm), handy for alignment math. */
    beatInterval: number;
    /** Offset (s) into the track where analysis started, so beat times map back. */
    analysisOffset: number;
    /**
     * The "musical end" in seconds: where the track's energy drops off into an
     * outro / fade-out / silence. The crossfade should start around here rather
     * than at the technical end, so we don't blend into a quiet tail. Equals the
     * track duration when no clear outro is detected.
     */
    musicalEndSec: number;
    /** Detected musical key + Camelot code, for harmonic mixing. */
    key: KeyInfo;
    /** Loudness + percussiveness signals, for choosing the transition style. */
    energy: EnergyInfo;
    /** Spectral timbre features (brightness/noisiness/flux) for genre detection. */
    spectral: SpectralFeatures;
    /**
     * Which beat in the 4-beat bar is the downbeat (0–3): the index, relative to
     * `beats[0]`, that carries the strongest, most consistent bass/kick energy.
     * Transitions snap to this so they land on real bar lines. 0 if undetected.
     */
    downbeatPhase: number;
    /**
     * Seconds of intro before the track reaches full energy (the beat/drop kicks
     * in). Mixing INTO a track from here skips a long quiet intro so the groove
     * lands immediately. 0 when the track starts at full energy.
     */
    introSec: number;
}

/**
 * Loudness/percussiveness signals derived from the analysed window, used by the
 * transition planner to pick a mix style. All in [0,1].
 */
export interface EnergyInfo {
    /** Overall RMS energy (0 = silent, ~1 = very loud/compressed). */
    energy: number;
    /**
     * How "punchy"/beat-driven the track is: ratio of peak transient energy to
     * average energy. High = clear kicks (EDM/hip-hop), low = smooth/sustained
     * (ballad/ambient) — the main cut-vs-fade signal.
     */
    percussiveness: number;
    /**
     * Essentia's danceability estimate (0–3, higher = more danceable), averaged over
     * the analysed segments. Complements `energy` (loudness): a quiet track can still
     * be danceable and a loud one not. Undefined when essentia is unavailable — the
     * smart-autoplay ranking then falls back to genre/runtime only.
     */
    danceability?: number;
}

/**
 * Find which beat of a 4-beat bar is the DOWNBEAT (bar line). A track's kick
 * pattern puts the most low-frequency energy on beat 1, so we measure the bass
 * energy in a short window at each beat onset, fold the beats into 4 phase classes
 * (beat index mod 4), and pick the phase with the highest average bass energy.
 *
 * `beatsRel` are beat times relative to the start of `samples` (seconds). Returns
 * the winning phase 0–3, or 0 if there isn't enough signal to decide.
 */
function detectDownbeatPhase(samples: Float32Array, sr: number, beatsRel: number[], interval: number): number {
    if (beatsRel.length < 8) return 0;
    // One-pole low-pass to isolate bass (~150Hz) — the kick lives here.
    const lpCoeff = 1 - Math.exp((-2 * Math.PI * 150) / sr);
    // Energy window: a fifth of a beat around each onset (captures the kick attack).
    const winSamples = Math.max(1, Math.floor(interval * 0.2 * sr));

    const phaseSum = [0, 0, 0, 0];
    const phaseCount = [0, 0, 0, 0];
    for (let i = 0; i < beatsRel.length; i++) {
        const center = Math.round(beatsRel[i]! * sr);
        const from = Math.max(0, center);
        const to = Math.min(samples.length, center + winSamples);
        if (to - from < 4) continue;
        // Low-pass the window, accumulate bass energy.
        let lp = 0;
        let e = 0;
        for (let j = from; j < to; j++) {
            lp += lpCoeff * (samples[j]! - lp);
            e += lp * lp;
        }
        const phase = i % 4;
        phaseSum[phase]! += Math.sqrt(e / (to - from));
        phaseCount[phase]!++;
    }

    let best = 0;
    let bestAvg = -1;
    for (let p = 0; p < 4; p++) {
        const avg = phaseCount[p] ? phaseSum[p]! / phaseCount[p]! : 0;
        if (avg > bestAvg) {
            bestAvg = avg;
            best = p;
        }
    }
    return best;
}

/**
 * Compute energy + percussiveness from a decoded mono segment. Reuses the samples
 * already decoded for beat detection, so it costs no extra ffmpeg pass.
 */
function computeEnergy(samples: Float32Array, sr: number): EnergyInfo {
    const win = Math.floor(0.05 * sr); // 50ms windows
    if (win <= 0 || samples.length < win) return { energy: 0, percussiveness: 0 };
    const rms: number[] = [];
    for (let i = 0; i + win <= samples.length; i += win) {
        let sumSq = 0;
        for (let j = i; j < i + win; j++) sumSq += samples[j]! * samples[j]!;
        rms.push(Math.sqrt(sumSq / win));
    }
    if (!rms.length) return { energy: 0, percussiveness: 0 };
    const mean = rms.reduce((a, b) => a + b, 0) / rms.length;
    // 95th-percentile window energy ≈ the loud transients (kicks/snares).
    const sorted = [...rms].sort((a, b) => a - b);
    const peak = sorted[Math.floor(sorted.length * 0.95)] ?? mean;
    // energy: map mean RMS to ~[0,1] (0.2 RMS is already a loud master).
    const energy = Math.min(1, mean / 0.2);
    // percussiveness: peak-to-mean (crest) ratio, normalised. ~1 = flat/sustained,
    // 3+ = punchy with clear transients.
    const crest = mean > 1e-6 ? peak / mean : 1;
    const percussiveness = Math.min(1, Math.max(0, (crest - 1) / 2));
    return { energy, percussiveness };
}

/** Analyse a representative slice rather than the whole track (fast + stable). */
const ANALYSIS_OFFSET_SEC = 30;
const ANALYSIS_DURATION_SEC = 60;

/** Decode a mono 44.1kHz f32 PCM segment of a file to a Float32Array. */
function decodeSegment(filePath: string, offset: number, duration: number): Promise<Float32Array> {
    return new Promise((resolvePromise, reject) => {
        const ff = spawn(
            ffmpegPath,
            [
                "-ss",
                String(offset),
                "-t",
                String(duration),
                "-i",
                filePath,
                "-ac",
                "1",
                "-ar",
                "44100",
                "-f",
                "f32le",
                "-loglevel",
                "error",
                "pipe:1",
            ],
            { stdio: ["ignore", "pipe", "pipe"] },
        );
        const chunks: Buffer[] = [];
        ff.stdout.on("data", (c: Buffer) => chunks.push(c));
        ff.stderr.on("data", (d: Buffer) => {
            const m = d.toString().trim();
            if (m) log.debug(`ffmpeg: ${m}`);
        });
        ff.on("error", reject);
        ff.on("close", (code) => {
            if (code !== 0) return reject(new Error(`ffmpeg exited ${code}`));
            const buf = Buffer.concat(chunks);
            resolvePromise(new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4)));
        });
    });
}

/**
 * Detect the beat grid of a fully-downloaded file. Analyses a 60s window from
 * 30s in (short tracks fall back to the whole file). Returns null if detection
 * fails, so callers can degrade to time-based crossfade.
 */
/**
 * The actual analysis — CPU-heavy (MusicTempo ~280ms, FFT key/spectral ~110ms,
 * essentia ~120ms), all synchronous. Runs INSIDE the worker thread (see
 * {@link detectBeatGrid}), never on the main thread, so the audio tick and voice
 * receiver aren't frozen for ~half a second whenever a track is analysed.
 */
export async function detectBeatGridSync(filePath: string, durationMs: number): Promise<BeatGrid | null> {
    // For short tracks, analyse from the start over whatever length exists.
    const trackSec = durationMs / 1000;
    const offset = trackSec > ANALYSIS_OFFSET_SEC + 10 ? ANALYSIS_OFFSET_SEC : 0;
    const duration = Math.min(ANALYSIS_DURATION_SEC, Math.max(15, trackSec - offset));

    try {
        // Kick off all three independent decodes together (beat window + intro + outro
        // scans) so they overlap instead of running back-to-back. The intro/outro
        // scans resolve into seconds; we await them after the heavy compute below.
        const samplesP = decodeSegment(filePath, offset, duration);
        const introP = detectIntro(filePath, trackSec).catch(() => 0);
        const musicalEndP = detectMusicalEnd(filePath, trackSec).catch(() => trackSec);

        const samples = await samplesP;
        if (samples.length < 44100 * 5) {
            log.debug(`Too little audio to analyse (${filePath}).`);
            return null;
        }
        // Pass the Float32Array straight through — MusicTempo does its own
        // Array.from() internally, so pre-copying it here just doubled the work.
        const mt = new MusicTempo(samples);
        const mtBpm = Number(mt.tempo);
        // music-tempo reports beat times RELATIVE to the analysed window; shift them
        // to absolute track time so all downstream alignment math is offset-free.
        const beats = (mt.beats as number[]).map((b) => Number(b) + offset);
        if (!Number.isFinite(mtBpm) || mtBpm <= 0 || beats.length < 4) return null;

        // Beat *positions* come from music-tempo (the interval = their median spacing).
        const interval = medianBeatInterval(beats) || 60 / mtBpm;

        // Tempo *number*: prefer aubio — its onset tracker rarely makes the 2×/half-
        // time error music-tempo (Beatroot) is prone to. When aubio isn't available
        // or isn't confident, fall back to normalising music-tempo's own estimate
        // into the usual musical range. Either way the value is folded to 70–140 so
        // tempo-sync compares like for like; beat positions are untouched.
        const aubio = await detectTempoAubio(samples, 44_100);
        const rawBpm = aubio && aubio.confidence >= 0.1 ? aubio.bpm : 60 / interval;
        const bpm = normaliseBpm(rawBpm);

        // These two scans were kicked off in parallel with the beat-window decode
        // above (outro = where the music ends; intro = until the beat kicks in);
        // await their results now — they've been running during the compute.
        const musicalEndSec = await musicalEndP;
        const introSec = await introP;

        // Key for harmonic mixing: essentia's validated KeyExtractor (benchmark on
        // 43 tracks exposed an A-minor bias in our local Krumhansl detector). When
        // WASM is unavailable, fall back to the local combined pass — with essentia
        // we only need the spectral half (genre timbre) computed locally.
        const essKey = await detectKeyEssentia(samples);
        const { key, spectral } = essKey
            ? { key: essKey, spectral: spectralFeatures(samples, 44_100) }
            : analyseSpectrum(samples, 44_100);
        // Energy + percussiveness for transition-style selection (same samples).
        const energy = computeEnergy(samples, 44_100);
        // Danceability (essentia, same samples — no extra ffmpeg pass). The analysed
        // window is a representative 60s slice from 30s in, which the spike found
        // stable; null when essentia is unavailable (energy.danceability stays unset).
        const dance = await detectDanceability(samples);
        if (dance != null) energy.danceability = dance;
        // Which beat of the bar is the downbeat (strongest bass). Beats are absolute;
        // the detector needs window-relative times (samples start at the offset).
        const downbeatPhase = detectDownbeatPhase(
            samples,
            44_100,
            beats.map((b) => b - offset),
            interval,
        );

        return {
            bpm,
            beats,
            beatInterval: interval,
            analysisOffset: offset,
            key,
            energy,
            spectral,
            downbeatPhase,
            musicalEndSec,
            introSec,
        };
    } catch (err) {
        log.warn(`Beat detection failed for ${filePath}:`, (err as Error).message);
        return null;
    }
}

/**
 * Fold a possibly doubled/halved tempo into the range most popular music sits in
 * (≈70–140 BPM). music-tempo (Beatroot) frequently reports 2× the real tempo on
 * tracks with busy hi-hats, which would make tempo-matching compare a 164 against
 * an 82 and refuse to sync. Halving/doubling keeps the beat grid valid (every
 * other beat coincides) while giving a comparable number.
 */
function normaliseBpm(bpm: number): number {
    let b = bpm;
    while (b > 140) b /= 2;
    while (b < 70) b *= 2;
    return Math.round(b * 10) / 10;
}

/** Median gap between consecutive beats — robust tempo basis (ignores outliers). */
function medianBeatInterval(beats: number[]): number {
    if (beats.length < 2) return 0;
    const gaps: number[] = [];
    for (let i = 1; i < beats.length; i++) gaps.push(beats[i]! - beats[i - 1]!);
    gaps.sort((a, b) => a - b);
    return gaps[Math.floor(gaps.length / 2)]!;
}

/** How much of the track tail to scan for an outro. */
const OUTRO_SCAN_SEC = 45;
/** RMS window size for the energy envelope. */
const ENERGY_WINDOW_SEC = 0.5;

/**
 * Find the "musical end": the last point where the track is still at full energy
 * before it drops into an outro / fade-out / silence. We compute an RMS energy
 * envelope over the tail, take a reference level from its loud part, then walk
 * backwards from the end to find where energy last exceeded a fraction of that
 * reference. The crossfade should begin around there.
 *
 * Returns the full duration if no clear drop-off is found (e.g. a hard ending).
 */
async function detectMusicalEnd(filePath: string, trackSec: number): Promise<number> {
    const scan = Math.min(OUTRO_SCAN_SEC, trackSec);
    const startSec = trackSec - scan;
    const samples = await decodeSegment(filePath, startSec, scan);
    if (samples.length < 44100) return trackSec;

    const sr = 44100;
    const win = Math.floor(ENERGY_WINDOW_SEC * sr);
    const envelope: number[] = [];
    for (let i = 0; i + win <= samples.length; i += win) {
        let sumSq = 0;
        for (let j = i; j < i + win; j++) sumSq += samples[j]! * samples[j]!;
        envelope.push(Math.sqrt(sumSq / win));
    }
    if (envelope.length < 4) return trackSec;

    // Reference loudness = 80th percentile of the envelope (robust to spikes).
    const sorted = [...envelope].sort((a, b) => a - b);
    const reference = sorted[Math.floor(sorted.length * 0.8)] || sorted[sorted.length - 1]!;
    if (reference <= 1e-4) return trackSec; // essentially silent tail; leave as-is

    // Energy is "present" while above this fraction of the reference.
    const threshold = reference * 0.45;

    // Walk backwards: find the last window that's still energetic.
    let lastLoud = envelope.length - 1;
    while (lastLoud > 0 && envelope[lastLoud]! < threshold) lastLoud--;

    // If the loud part already runs to the very end, there's no real outro.
    if (lastLoud >= envelope.length - 2) return trackSec;

    // Map the window index back to an absolute time (end of that window).
    const musicalEnd = startSec + (lastLoud + 1) * ENERGY_WINDOW_SEC;
    log.debug(
        `Musical end for ${filePath.split("/").at(-1)}: ${musicalEnd.toFixed(1)}s (track ${trackSec.toFixed(1)}s)`,
    );
    return Math.min(musicalEnd, trackSec);
}

/** How much of the head to scan for an intro. */
const INTRO_SCAN_SEC = 45;

/**
 * Detect the intro length: seconds from the start until the track first reaches
 * full energy (the beat/drop kicks in). Mirrors {@link detectMusicalEnd} but walks
 * FORWARD from the start. Returns 0 when the track is already energetic at t=0
 * (no real intro) — so a normal mix-in still works. Capped so we never skip half
 * the song on a quiet track.
 */
async function detectIntro(filePath: string, trackSec: number): Promise<number> {
    const scan = Math.min(INTRO_SCAN_SEC, trackSec);
    const samples = await decodeSegment(filePath, 0, scan);
    if (samples.length < 44100) return 0;

    const sr = 44100;
    const win = Math.floor(ENERGY_WINDOW_SEC * sr);
    const envelope: number[] = [];
    for (let i = 0; i + win <= samples.length; i += win) {
        let sumSq = 0;
        for (let j = i; j < i + win; j++) sumSq += samples[j]! * samples[j]!;
        envelope.push(Math.sqrt(sumSq / win));
    }
    if (envelope.length < 4) return 0;

    const sorted = [...envelope].sort((a, b) => a - b);
    const reference = sorted[Math.floor(sorted.length * 0.8)] || sorted[sorted.length - 1]!;
    if (reference <= 1e-4) return 0;
    const threshold = reference * 0.5;

    // Walk forward: first window that reaches full energy.
    let firstLoud = 0;
    while (firstLoud < envelope.length - 1 && envelope[firstLoud]! < threshold) firstLoud++;

    // Already loud from the top → no meaningful intro.
    if (firstLoud <= 1) return 0;
    // Don't skip more than a third of the track (guards against quiet/ambient songs).
    const introSec = Math.min(firstLoud * ENERGY_WINDOW_SEC, trackSec / 3);
    log.debug(`Intro for ${filePath.split("/").at(-1)}: ${introSec.toFixed(1)}s`);
    return introSec;
}

/**
 * Given a beat grid and a desired absolute position (seconds from track start),
 * return the nearest beat time at or before it — so a transition lands on a beat.
 */
export function nearestBeat(grid: BeatGrid, targetSec: number): number {
    // Beats are absolute track times. Project the steady grid outward from the
    // first detected beat's phase to cover positions beyond the analysed window.
    const phase = grid.beats.length ? grid.beats[0]! % grid.beatInterval : 0;
    const n = Math.round((targetSec - phase) / grid.beatInterval);
    return phase + n * grid.beatInterval;
}
