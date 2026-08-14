import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { analyzeVocalActivityProfile, type VocalActivityProfile } from "@beatcord/engine";
import { type BeatGrid, detectBeatGrid, type EnergyInfo } from "./beatgrid";
import { recordWarmGate, timePlaybackGate } from "./cold-start";
import { config } from "./config";
import { classifyGenre, type GenreHint, inferGenre } from "./genre";
import { harmonicScore } from "./key";
import { createLogger } from "./logger";
import { loudnormFilter, measureLoudness } from "./loudness";
import { masteringFilters } from "./mastering";
import { MixDeck } from "./mixer";
import type { DjNarrator } from "./narrator";
import type { PhraseContext } from "./narrator-phrases";
import { OfflineAudioValidationError, validateOfflineAudioFile } from "./offline-audio-validator";
import {
    OFFLINE_TRANSITIONS,
    type OfflineRenderFormat,
    type OfflineTransitionType,
    renderOfflineTransition,
} from "./offline-renderer";
import { sourceDownloadTrack } from "./source";
import { analyzeStemQuality, isStemQualityUsable, type StemQuality } from "./stem-quality";
import { getStems, type Stems, stemsAvailable } from "./stems";
import { assessGridTempoRelationship } from "./tempo-awareness";
import { displayMeta } from "./trackmeta";
import { decideTransition } from "./transition-decision";
import { TransitionFeedbackStore } from "./transition-feedback";
import type { TrackTraits, TransitionPlan } from "./transition-planner";
import type {
    TransitionExecutionMode,
    TransitionFallbackReason,
    TransitionTelemetryInput,
    TransitionTrackSnapshot,
    TransitionUserFeedback,
} from "./transition-telemetry";
import { TransitionTelemetrySink } from "./transition-telemetry-sink";
import type { TrackInfo } from "./ytdlp";

const log = createLogger("Beatmatch");
const ffmpegPath = resolve(process.cwd(), config.FFMPEG_PATH);
const OFFLINE_RENDERABLE = new Set<string>(OFFLINE_TRANSITIONS);

interface OfflineRenderOptions {
    enabled: boolean;
    cacheDir: string;
    preSec: number;
    postSec: number;
    format: OfflineRenderFormat;
    useLv2Limiter: boolean;
    useLadspaTrim: boolean;
}

interface TransitionTelemetryOptions {
    enabled: boolean;
    path: string;
    guildId: string | null;
}

interface TransitionFeedbackOptions {
    enabled: boolean;
    path: string;
    minRecords: number;
    refreshMs: number;
}

interface TransitionUserFeedbackOptions {
    enabled: boolean;
    skipWindowMs: number;
    skipDislikeThreshold: number;
}

interface FireTelemetryContext {
    mode: TransitionExecutionMode;
    fallbackReason?: TransitionFallbackReason;
    cacheHit?: boolean;
    renderMs?: number | null;
    renderDeadlineMs?: number | null;
    segmentSec?: number | null;
}

interface LastTransitionFeedbackTarget {
    input: TransitionTelemetryInput;
    nextTrackId: string;
    transitionAtMs: number;
    recorded: boolean;
}

/**
 * A single 0–1 "set energy" value for the energy-arc flow scoring, blending the RMS
 * loudness/percussiveness with essentia's danceability (rhythmic groove). Loudness and
 * danceability are complementary — a quiet track can still be danceable — so folding
 * both in gives a truer sense of where a track sits in a set.
 *
 * Crucially the SAME blend is applied to every track so two tracks are always compared
 * on one scale: when danceability is unavailable (essentia off, or a track analysed
 * before this feature) we substitute loudness as its own proxy, so the result degrades
 * to plain loudness without shifting onto a different scale. (Mixing a danceability-
 * blended value against a loudness-only value would skew the energy-arc delta.)
 */
function flowEnergy(e: EnergyInfo): number {
    const loudness = e.energy * 0.5 + e.percussiveness * 0.5;
    // Danceability is ~0–3 → map to 0–1; fall back to loudness when it's unset so the
    // 50/50 blend below stays on a single scale for every track.
    const dance = e.danceability == null ? loudness : Math.min(1, e.danceability / 3);
    return loudness * 0.5 + dance * 0.5;
}

/**
 * Where the finished mix goes. The controller produces ONE continuous PCM stream
 * for the whole set and hands it over exactly once — everything platform-specific
 * about playing it (Discord's AudioResource + Opus encoder, a WS sender, a file)
 * lives behind this.
 *
 * Volume is deliberately NOT here: it's applied inside the mix loop via
 * `MixDeck.setGain`, which soft-knees instead of hard-clipping above 1.
 */
export interface MixOutput {
    /**
     * Start playing `deck`. Called once per controller, right after the first track
     * is loaded. The stream never goes idle between tracks, so implementations must
     * not inject trailing silence or treat a gap as the end.
     */
    play(deck: MixDeck): void;
}

export interface BeatmatchItem {
    track: TrackInfo;
    requesterId: string;
    filePath?: string;
    grid?: BeatGrid | null;
    /** Cached pass-2 loudnorm filter string (equal-loudness gain), or null if none. */
    loudnorm?: string | null;
    /** The transition the DJ chose to mix INTO this track (set when it's scheduled). */
    transition?: TransitionPlan;
    /** Separated vocal/instrumental stems (for acapella moves), or null if N/A. */
    stems?: Stems | null;
    /** Heuristic quality score for the separated vocal stem, or null if unusable/unanalysed. */
    stemQuality?: StemQuality | null;
    /** Segment-level vocal activity for cue-aware acapella conflict checks. */
    vocalActivity?: VocalActivityProfile | null;
}

/**
 * The item's genre family. Prefers the reliable audio classification off the beat
 * grid; falls back to the title/artist hint before the track has been analysed.
 */
function genreOf(item: BeatmatchItem): GenreHint {
    return item.grid
        ? classifyGenre(
              {
                  spectral: item.grid.spectral,
                  percussiveness: item.grid.energy.percussiveness,
                  bpm: item.grid.bpm,
              },
              item.track.title,
              item.track.uploader,
          )
        : inferGenre(item.track.title, item.track.uploader);
}

/** Adapt a queue item to the planner's input shape. */
function traits(item: BeatmatchItem): TrackTraits {
    const out: TrackTraits = {
        title: item.track.title,
        uploader: item.track.uploader,
        grid: item.grid ?? null,
        durationMs: item.track.durationMs,
    };
    if (item.stemQuality !== undefined) out.stemQuality = item.stemQuality;
    if (item.vocalActivity !== undefined) out.vocalActivity = item.vocalActivity;
    return out;
}

/** Build the placeholder context (clean title/artist, BPM, key) the DJ speaks about. */
function narrationCtx(item: BeatmatchItem): PhraseContext {
    const { artist, title } = displayMeta(item.track);
    return { title, artist, bpm: item.grid?.bpm, key: item.grid?.key.camelot };
}

function telemetryTrack(item: BeatmatchItem): TransitionTrackSnapshot {
    const grid = item.grid ?? null;
    return {
        id: item.track.id,
        title: item.track.title,
        uploader: item.track.uploader ?? null,
        bpm: grid?.bpm ?? null,
        key: grid?.key.camelot ?? null,
        keyConfidence: grid?.key.confidence ?? null,
        energy: grid?.energy.energy ?? null,
        percussiveness: grid?.energy.percussiveness ?? null,
        danceability: grid?.energy.danceability ?? null,
        introSec: grid?.introSec ?? null,
        musicalEndSec: grid?.musicalEndSec ?? null,
    };
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolveSleep) => setTimeout(resolveSleep, Math.max(0, ms)));
}

function inputFilters(loudnorm?: string | null): string[] {
    return loudnorm ? [loudnorm] : [];
}

function offlineExtension(format: OfflineRenderFormat): string {
    return format === "flac" ? "flac" : "wav";
}

function offlineType(type: TransitionPlan["type"]): OfflineTransitionType | null {
    return OFFLINE_RENDERABLE.has(type) ? (type as OfflineTransitionType) : null;
}

function offlineRenderPath(
    opts: OfflineRenderOptions,
    current: BeatmatchItem,
    next: BeatmatchItem,
    plan: TransitionPlan,
    params: { aStartSec: number; bStartSec: number; aTempoRatio: number; eqSweep: boolean },
): string {
    const hash = createHash("sha256")
        .update(
            JSON.stringify({
                v: 1,
                a: current.track.id,
                b: next.track.id,
                aFile: current.filePath,
                bFile: next.filePath,
                type: plan.type,
                fadeSec: plan.fadeSec,
                preSec: opts.preSec,
                postSec: opts.postSec,
                aStartSec: Number(params.aStartSec.toFixed(3)),
                bStartSec: Number(params.bStartSec.toFixed(3)),
                aTempoRatio: Number(params.aTempoRatio.toFixed(4)),
                tempoRatio: Number(plan.tempoRatio.toFixed(4)),
                eqSweep: params.eqSweep,
                aFilters: current.loudnorm ?? null,
                bFilters: next.loudnorm ?? null,
                format: opts.format,
                lv2: opts.useLv2Limiter,
                ladspa: opts.useLadspaTrim,
            }),
        )
        .digest("hex")
        .slice(0, 24);
    return resolve(
        opts.cacheDir,
        `${current.track.id}-${next.track.id}-${plan.type}-${hash}.${offlineExtension(opts.format)}`,
    );
}

export interface BeatmatchOptions {
    /** Crossfade length in seconds. */
    fadeSec: number;
    /** Apply the 3-band EQ transition (highs→mids→lows) during the blend. */
    eqSweep: boolean;
    /** Tempo-match the incoming track to the current BPM (within ±8%). */
    tempoSync: boolean;
    /** Reorder upcoming tracks to mix in key (Camelot harmonic compatibility). */
    harmonicMix: boolean;
    /**
     * Extend a plain blend to a bar-quantized club-length ride (16 bars for
     * four-to-the-floor, 8 otherwise) instead of the planner's short seamless fade.
     * Audibly longer transitions — off unless the guild asks for it.
     */
    clubBlend?: boolean;
    /** Best-effort offline transition rendering, then fall back to live mixing. */
    offlineRender?: OfflineRenderOptions;
    /** Append scored transition telemetry to JSONL for offline analysis/tuning. */
    transitionTelemetry?: TransitionTelemetryOptions;
    /** Read transition telemetry back into the candidate scorer. */
    transitionFeedback?: TransitionFeedbackOptions;
    /** Append subjective listener signals such as early skips after a transition. */
    transitionUserFeedback?: TransitionUserFeedbackOptions;
    /** Voice channel Opus bitrate (bps) — boost-level dependent. */
    bitrate?: number;
    /** Called when the whole queue is exhausted. */
    onEmpty: () => void;
    /** Called when a new track becomes the "current" one (for now-playing UI). */
    onTrackChange: (item: BeatmatchItem) => void;
}

/**
 * Beatmatched automix controller. Plays a continuous {@link MixDeck} PCM stream
 * through one long-lived AudioResource and schedules beat-aligned crossfades into
 * upcoming tracks, so playback never gaps and transitions land on the beat.
 *
 * Tracks (and their beat grids) are prefetched while the current one plays.
 */
export class BeatmatchController {
    #output: MixOutput;
    #opts: BeatmatchOptions;
    #deck: MixDeck;
    #telemetry: TransitionTelemetrySink | null = null;
    #feedback: TransitionFeedbackStore | null = null;
    #lastTransitionFeedback: LastTransitionFeedbackTarget | null = null;

    /** Currently playing item + the queue ahead of it. */
    current: BeatmatchItem | null = null;
    queue: BeatmatchItem[] = [];

    #ticker: ReturnType<typeof setInterval> | null = null;
    #transitionScheduled = false;
    #stopped = false;
    /** DJ Narrator (optional) — speaks at big moments over this controller's deck. */
    #narrator: DjNarrator | null = null;
    /** Track whether we've already nudged about a low/empty queue (one-shot each). */
    #queueLowAnnounced = false;

    constructor(output: MixOutput, opts: BeatmatchOptions) {
        this.#output = output;
        this.#opts = opts;
        if (opts.transitionTelemetry) {
            this.#telemetry = new TransitionTelemetrySink(opts.transitionTelemetry);
        }
        if (opts.transitionFeedback) {
            this.#feedback = new TransitionFeedbackStore(opts.transitionFeedback);
        }
        this.#deck = new MixDeck({
            onEmpty: () => {
                // The deck drained and pushed null: the stream is finished for good,
                // so this controller can never play again. Mark it stopped BEFORE
                // notifying, or a listener that reacts by enqueueing (auto-radio)
                // would fill a queue whose deck is already closed — silently silent.
                this.#stopped = true;
                this.#stopTicker();
                this.#opts.onEmpty();
            },
            onTransitionEnd: () => this.#onTransitionEnd(),
        });
    }

    /** The continuous mix stream — exposed so the DJ Narrator can speak over it. */
    get deck(): MixDeck {
        return this.#deck;
    }

    /**
     * Update the mixing knobs on a RUNNING mix. Every transition re-reads these when
     * it plans, so a change lands on the next one — no need to tear the mix down and
     * rebuild it just to shorten a crossfade.
     *
     * Only the musical parameters are settable; the callbacks and sinks are wiring
     * and stay fixed for the controller's lifetime.
     */
    setOptions(
        next: Partial<Pick<BeatmatchOptions, "fadeSec" | "eqSweep" | "tempoSync" | "harmonicMix" | "clubBlend">>,
    ): void {
        Object.assign(this.#opts, next);
    }

    /** Attach (or detach with null) the DJ Narrator for big-moment announcements. */
    setNarrator(narrator: DjNarrator | null): void {
        this.#narrator = narrator;
    }

    /** Begin playback with `first` as the current track. `startVolume` is the inline
     * volume the resource starts at (pass 0 to let the caller fade it in). `startSec`
     * seeks into `first` (used by auto-resume to continue mid-track, not from 0). */
    async start(first: BeatmatchItem, queue: BeatmatchItem[], startVolume = 1, startSec = 0): Promise<void> {
        this.queue = queue;
        this.current = first;

        // Start playing as soon as the file is on disk — do NOT wait on beat-grid or
        // loudness analysis here. Those take a few seconds, and blocking on them was
        // the cause of the long silence when toggling automix mid-playback. The first
        // track's grid is only needed later (to schedule the fade OUT of it), so it's
        // analysed in the background; its loudnorm is applied if already measured.
        if (first.filePath) recordWarmGate(first.track, "start");
        else first.filePath = await timePlaybackGate(first.track, "start", () => sourceDownloadTrack(first.track));

        // loadPrimary advances the deck's internal frame counter to startSec, so the
        // fade-out scheduling stays correct when we resume mid-track.
        this.#deck.loadPrimary(first.filePath, startSec, first.loudnorm ?? undefined);
        this.#deck.setGain(startVolume);
        this.#output.play(this.#deck);
        this.#opts.onTrackChange(first);

        // DJ greets the set as it starts (force past the cooldown — it's the opener).
        this.#narrator?.announce("start", narrationCtx(first), true);

        this.#startTicker();
        // Analyse the now-playing track (grid/loudness) and prefetch upcoming ones in
        // the background, so the fade out of this track is ready well before it's due.
        void this.#ensureFile(first);
        void this.#prefetchNext();
    }

    add(item: BeatmatchItem): void {
        this.queue.push(item);
        this.#queueLowAnnounced = false; // fresh tracks → allow the next low-queue nudge
        void this.#prefetchNext();
    }

    setVolume(v: number): void {
        this.#deck.setGain(v);
    }

    /** Current output volume of the mix stream (the deck's gain). */
    get volume(): number {
        return this.#deck.gain;
    }

    /** Elapsed time of the current track in ms (from the mix deck's frame counter). */
    get positionMs(): number {
        return Math.round(this.#deck.playedSec * 1000);
    }

    /** Skip immediately to the next track (hard cut within the mix stream). */
    async skip(): Promise<boolean> {
        const next = this.queue.shift();
        if (!next) {
            // Nothing left to cut to: the mix is over. Say so instead of returning
            // silently — the caller can't otherwise tell "skipped" from "mix ended",
            // and would go on treating the (now closed) deck as playing.
            this.stop();
            this.#opts.onEmpty();
            return false;
        }
        // Only the file is needed to start playing. Grid/loudness are usually already
        // prefetched; if not, analyse in the background rather than holding the cut
        // (waiting here is what left the mix silent for seconds).
        if (next.filePath) recordWarmGate(next.track, "advance");
        else next.filePath = await timePlaybackGate(next.track, "advance", () => sourceDownloadTrack(next.track));
        this.current = next;
        this.#transitionScheduled = false;
        this.#deck.skipTo(next.filePath, 0, next.loudnorm ?? undefined); // resets position counter

        this.#opts.onTrackChange(next);
        void this.#ensureFile(next); // fill in grid/loudness for this track if missing
        void this.#prefetchNext();
        return true;
    }

    stop(): void {
        this.#stopped = true;
        this.#stopTicker();
        this.#deck.close();
    }

    /**
     * True once {@link stop} has run — the deck is closed and this controller can
     * never play again. Callers holding a reference must check before enqueueing:
     * adding to a stopped controller's queue silently goes nowhere.
     */
    get stopped(): boolean {
        return this.#stopped;
    }

    // ── internals ──

    #startTicker(): void {
        this.#stopTicker();
        // Poll 4×/s; the actual position comes from the deck's emitted-frame count,
        // not a wall-clock estimate, so transition timing can't drift.
        this.#ticker = setInterval(() => {
            if (this.#stopped) return;
            void this.#maybeScheduleTransition();
        }, 250);
    }

    #stopTicker(): void {
        if (this.#ticker) clearInterval(this.#ticker);
        this.#ticker = null;
    }

    #recordTransition(
        firingFrom: BeatmatchItem,
        next: BeatmatchItem,
        plan: TransitionPlan,
        startAt: number,
        startPlay: number,
        actualFirePlaySec: number,
        preRoll: number,
        rate: number,
        context: FireTelemetryContext,
    ): void {
        const input: TransitionTelemetryInput = {
            atMs: Date.now(),
            guildId: this.#opts.transitionTelemetry?.guildId ?? null,
            current: telemetryTrack(firingFrom),
            next: telemetryTrack(next),
            transitionType: plan.type,
            planReason: plan.reason,
            fadeSec: plan.fadeSec,
            eqSweep: this.#opts.eqSweep && plan.eqSweep,
            tempoRatio: plan.tempoRatio,
            outgoingTempoRatio: rate,
            scheduledTrackSec: startAt,
            scheduledPlaySec: startPlay,
            actualFirePlaySec,
            preRollSec: preRoll,
            execution: {
                mode: context.mode,
                fallbackReason: context.fallbackReason ?? null,
                cacheHit: context.cacheHit ?? null,
                renderMs: context.renderMs ?? null,
                renderDeadlineMs: context.renderDeadlineMs ?? null,
                segmentSec: context.segmentSec ?? null,
            },
        };
        if (this.#telemetry && this.#opts.transitionUserFeedback?.enabled) {
            this.#lastTransitionFeedback = {
                input,
                nextTrackId: next.track.id,
                transitionAtMs: input.atMs,
                recorded: false,
            };
        }
        if (!this.#telemetry) return;
        void this.#telemetry.record(input);
    }

    noteSkipFeedback(positionMs: number): void {
        const target = this.#lastTransitionFeedback;
        const opts = this.#opts.transitionUserFeedback;
        if (!this.#telemetry || !opts?.enabled || !target || target.recorded || !this.current) return;
        if (this.current.track.id !== target.nextTrackId) return;

        const now = Date.now();
        const afterTransitionMs = now - target.transitionAtMs;
        if (afterTransitionMs > opts.skipWindowMs) return;

        const durationMs = this.current.track.durationMs;
        const skippedPositionRatio = durationMs > 0 ? positionMs / durationMs : null;
        if (skippedPositionRatio !== null && skippedPositionRatio >= opts.skipDislikeThreshold) return;

        const weight =
            skippedPositionRatio === null
                ? 0.7
                : Math.max(0.25, Math.min(1, 1 - skippedPositionRatio / opts.skipDislikeThreshold));
        const userFeedback: TransitionUserFeedback = {
            kind: "early-skip",
            atMs: now,
            afterTransitionMs,
            skippedTrackId: this.current.track.id,
            skippedPositionMs: positionMs,
            skippedPositionRatio,
            weight,
            source: "skip",
        };
        target.recorded = true;
        void this.#telemetry.record({
            ...target.input,
            atMs: now,
            actualFirePlaySec: target.input.actualFirePlaySec,
            userFeedback,
        });
    }

    async #fireLiveTransition(
        firingFrom: BeatmatchItem,
        next: BeatmatchItem,
        plan: TransitionPlan,
        startAt: number,
        startPlay: number,
        preRoll: number,
        rate: number,
        startB: number,
        telemetry: FireTelemetryContext = { mode: "live" },
    ): Promise<void> {
        await this.#ensureFile(next); // usually instant (prefetched) — before the precise wait
        const wait = (startPlay - this.#deck.playedSec) * 1000;
        if (wait > 5) await sleep(wait);
        // A skip/stop may have raced us during the waits — don't fire a stale plan.
        if (this.#stopped || this.current !== firingFrom || !this.#deck.canTransition) {
            this.#deck.discardPrepared();
            return;
        }

        const fade = plan.fadeSec;
        const actualFirePlaySec = this.#deck.playedSec;

        if (plan.type === "spinback") {
            // Spinback isn't a crossfade — it brakes the current track then cuts in.
            this.#deck.spinback(next.filePath!, startB, next.loudnorm ?? undefined);
            this.#onTransitionEnd(); // hard swap doesn't fire onTransitionEnd
        } else if (plan.type === "roll") {
            // Beat-repeat roll on the current track, then cut into the next. The loop
            // length must match the HEARD beat (the deck may be tempo-stretched).
            const beatSec = (firingFrom.grid?.beatInterval ?? 0.5) / rate;
            this.#deck.roll(next.filePath!, beatSec, startB, next.loudnorm ?? undefined);
            this.#onTransitionEnd();
        } else {
            // Respect the option toggle for EQ; the plan decides per-transition otherwise.
            const eqSweep = this.#opts.eqSweep && plan.eqSweep;
            // Gate/echo lock to the HEARD beat of the outgoing deck (÷ its stretch).
            const beatSec = (firingFrom.grid?.beatInterval ?? 0.5) / rate;
            this.#deck.startCrossfade(
                next.filePath!,
                fade,
                startB,
                eqSweep,
                plan.tempoRatio,
                next.loudnorm ?? undefined,
                plan.type,
                beatSec,
                startPlay, // bar line in playback time → sample-accurate bar alignment
                plan.stretch?.tuning,
            );
            // Acapella: layer the OUTGOING track's vocal stem over the new beat. A's
            // current file position = playedSec × its stretch ratio; the stem shares
            // A's timeline, so it picks up exactly where A's vocal is now.
            if (plan.type === "acapella" && firingFrom.stems) {
                const aPos = this.#deck.playedSec * rate;
                this.#deck.acapella(firingFrom.stems.vocals, aPos, fade, firingFrom.loudnorm ?? undefined);
            }
        }
        next.transition = plan; // expose for the now-playing card
        this.#recordTransition(firingFrom, next, plan, startAt, startPlay, actualFirePlaySec, preRoll, rate, telemetry);

        // The DJ only speaks on the "big" moves — drops and bold cuts. Ordinary
        // blends/fades/filters stay silent (max ~0-1 announcement per song).
        if (this.#narrator) {
            const ctx = narrationCtx(next);
            if (plan.type === "bassdrop" || plan.type === "riser") this.#narrator.announce("drop", ctx);
            else if (plan.type === "spinback" || plan.type === "cut") this.#narrator.announce("bigTransition", ctx);
        }

        log.debug(`DJ → ${next.track.id} [${plan.type}] at ${startAt.toFixed(1)}s, fade ${fade}s — ${plan.reason}`);
    }

    async #fireOfflineOrLiveTransition(
        firingFrom: BeatmatchItem,
        next: BeatmatchItem,
        plan: TransitionPlan,
        startAt: number,
        startPlay: number,
        preRoll: number,
        rate: number,
        startB: number,
    ): Promise<void> {
        const offline = this.#opts.offlineRender;
        const type = offlineType(plan.type);
        if (!offline?.enabled) {
            await this.#fireLiveTransition(firingFrom, next, plan, startAt, startPlay, preRoll, rate, startB, {
                mode: "live",
                fallbackReason: "disabled",
            });
            return;
        }
        if (!type) {
            await this.#fireLiveTransition(firingFrom, next, plan, startAt, startPlay, preRoll, rate, startB, {
                mode: "live",
                fallbackReason: "unsupported",
            });
            return;
        }

        await this.#ensureFile(next);
        if (!next.filePath || !firingFrom.filePath) {
            await this.#fireLiveTransition(firingFrom, next, plan, startAt, startPlay, preRoll, rate, startB, {
                mode: "fallback",
                fallbackReason: "missing-file",
            });
            return;
        }

        const segmentStartPlay = startPlay - offline.preSec;
        if (segmentStartPlay < 0) {
            await this.#fireLiveTransition(firingFrom, next, plan, startAt, startPlay, preRoll, rate, startB, {
                mode: "fallback",
                fallbackReason: "segment-before-start",
            });
            return;
        }

        const eqSweep = this.#opts.eqSweep && plan.eqSweep;
        const out = offlineRenderPath(offline, firingFrom, next, plan, {
            aStartSec: segmentStartPlay * rate,
            bStartSec: startB,
            aTempoRatio: rate,
            eqSweep,
        });
        mkdirSync(dirname(out), { recursive: true });

        const cacheHit = existsSync(out);
        let renderMs: number | null = cacheHit ? 0 : null;
        let renderFailed = false;
        let validationFailed = false;
        const render = (async () => {
            if (cacheHit) {
                const validation = await validateOfflineAudioFile({
                    ffmpegPath,
                    filePath: out,
                    expectedDurationSec: offline.preSec + plan.fadeSec + offline.postSec,
                });
                if (!validation.usable) throw new OfflineAudioValidationError(validation);
                return out;
            }
            const t0 = performance.now();
            await renderOfflineTransition({
                ffmpegPath,
                aPath: firingFrom.filePath!,
                bPath: next.filePath!,
                outputPath: out,
                aStartSec: segmentStartPlay * rate,
                bStartSec: startB,
                preSec: offline.preSec,
                fadeSec: plan.fadeSec,
                postSec: offline.postSec,
                aTempoRatio: rate,
                tempoRatio: plan.tempoRatio,
                ...(firingFrom.transition?.stretch?.tuning
                    ? { aStretchTuning: firingFrom.transition.stretch.tuning }
                    : {}),
                ...(plan.stretch?.tuning ? { bStretchTuning: plan.stretch.tuning } : {}),
                aInputFilters: inputFilters(firingFrom.loudnorm),
                bInputFilters: inputFilters(next.loudnorm),
                transition: type,
                eqSweep,
                resampler: config.FFMPEG_RESAMPLER,
                stretcher: config.FFMPEG_TEMPO_STRETCHER,
                format: offline.format,
                finalLimiter: true,
                useLv2Limiter: offline.useLv2Limiter,
                lv2Path: process.env.LV2_PATH || "/opt/homebrew/lib/lv2:/usr/local/lib/lv2",
                useLadspaTrim: offline.useLadspaTrim,
                ladspaAmpPath: resolve(process.cwd(), "vendor/audio-plugins/ladspa/amp.so"),
                ladspaTrimGain: 0.98,
            });
            renderMs = performance.now() - t0;
            return out;
        })().catch((err) => {
            renderFailed = true;
            validationFailed = err instanceof OfflineAudioValidationError;
            log.warn(`Offline transition render failed for ${next.track.id}:`, (err as Error).message);
            return null;
        });

        const renderDeadlineMs = Math.max(0, (segmentStartPlay - this.#deck.playedSec) * 1000 - 20);
        const renderedPath = await Promise.race([render, sleep(renderDeadlineMs).then(() => null)]);
        if (!renderedPath) {
            void render; // keep warming the cache, but do not hold this transition.
            await this.#fireLiveTransition(firingFrom, next, plan, startAt, startPlay, preRoll, rate, startB, {
                mode: "fallback",
                fallbackReason: validationFailed
                    ? "audio-validation"
                    : renderFailed
                      ? "render-error"
                      : "render-timeout",
                cacheHit,
                renderMs,
                renderDeadlineMs,
            });
            return;
        }

        const wait = (segmentStartPlay - this.#deck.playedSec) * 1000;
        if (wait > 5) await sleep(wait);
        if (this.#stopped || this.current !== firingFrom || !this.#deck.canTransition) {
            this.#deck.discardPrepared();
            return;
        }
        if (this.#deck.playedSec > segmentStartPlay + 0.05) {
            await this.#fireLiveTransition(firingFrom, next, plan, startAt, startPlay, preRoll, rate, startB, {
                mode: "fallback",
                fallbackReason: "late-handoff",
                cacheHit,
                renderMs,
                renderDeadlineMs,
            });
            return;
        }

        const resumeStartSec = startB + (plan.fadeSec + offline.postSec) * plan.tempoRatio;
        const actualFirePlaySec = this.#deck.playedSec + offline.preSec;
        this.#deck.startRenderedTransition(
            renderedPath,
            next.filePath,
            resumeStartSec,
            plan.tempoRatio,
            next.loudnorm ?? undefined,
            plan.stretch?.tuning,
        );
        next.transition = plan;
        this.#recordTransition(firingFrom, next, plan, startAt, startPlay, actualFirePlaySec, preRoll, rate, {
            mode: cacheHit ? "offline-cache" : "offline-render",
            cacheHit,
            renderMs,
            renderDeadlineMs,
            segmentSec: offline.preSec + plan.fadeSec + offline.postSec,
        });
        log.debug(
            `DJ offline → ${next.track.id} [${plan.type}] at ${startAt.toFixed(1)}s, segment ${(
                offline.preSec + plan.fadeSec + offline.postSec
            ).toFixed(1)}s — ${plan.reason}`,
        );
    }

    /** Decide whether it's time to begin the crossfade into the next track. */
    async #maybeScheduleTransition(): Promise<void> {
        if (this.#transitionScheduled || !this.current?.filePath) return;
        if (!this.queue.length) return; // nothing to mix into

        // Harmonic mixing: among the next few prefetched tracks, move the one that
        // mixes best (key + tempo) to the front. Falls back to play order.
        if (this.#opts.harmonicMix) this.#promoteBestNext();
        const next = this.queue[0];
        if (!next) return;

        const durationSec = this.current.track.durationMs / 1000;
        if (durationSec <= 0) return; // unknown length / stream

        // Acapella needs the CURRENT track's vocal stem (it sings over the next beat)
        // and that stem must be clean enough to expose without instrumental bleed.
        // The CURRENT deck may be tempo-stretched (it was mixed in with tempo scale r,
        // the ratio stored on its transition plan). Its grid times live in the ORIGINAL
        // timeline, but `playedSec` counts emitted (stretched) audio: original time T
        // is heard at T/r. The decision converts once — otherwise transitions fire up
        // to ±10s off whenever tempo-sync engaged on the previous blend.
        const rate = this.current.transition?.tempoRatio ?? 1;

        // The DJ brain: decide HOW to mix these two tracks (type + fade + tempo) and
        // WHERE to cut. Shared with the server so both make the same call. We can plan
        // now because the next track is already prefetched + analysed while the current
        // one plays. The plan's fade length drives the timing below.
        const feedback = (await this.#feedback?.profile()) ?? null;
        const {
            plan,
            cue,
            preRollSec: preRoll,
        } = decideTransition(traits(this.current), traits(next), {
            fadeSec: this.#opts.fadeSec,
            tempoSync: this.#opts.tempoSync,
            eqSweep: this.#opts.eqSweep,
            harmonic: this.#opts.harmonicMix,
            // Acapella needs the CURRENT track's vocal stem (it sings over the next
            // beat) and that stem must be clean enough to expose without bleed.
            stemsReady: !!this.current.stems && isStemQualityUsable(this.current.stemQuality),
            outgoingTempoRatio: rate,
            feedback,
            clubBlend: this.#opts.clubBlend ?? false,
            currentGenre: genreOf(this.current),
            nextGenre: genreOf(next),
        });
        const startAt = cue.aStartSec;
        const startPlay = cue.aStartPlaySec;

        // True position from the deck (emitted audio), not a wall-clock guess. Fire
        // PRECISELY: the 250ms poll only gets us close — landing up to a quarter beat
        // late is audible on a beat-matched blend. Once we're within a poll window,
        // prepare everything, then wait out the exact remainder.
        const lead = startPlay - this.#deck.playedSec;
        if (lead > 3) return;

        // Approaching the bar line: pre-warm the incoming deck so its ffmpeg is
        // primed when we fire — otherwise B's first ~30-50ms of the fade are silence
        // (spawn latency) and its beats land late by that much: an audible kick flam.
        // Only once the track is fully analysed, so the prepared deck's filter chain
        // matches the one the fire path will ask for (else it's discarded + respawned).
        if (next.filePath && next.grid !== undefined && next.loudnorm !== undefined) {
            this.#deck.prepareNext(
                next.filePath,
                cue.bStartSec,
                plan.tempoRatio,
                next.loudnorm ?? undefined,
                plan.stretch?.tuning,
            );
        }
        const offlineLeadSec = this.#opts.offlineRender?.enabled && offlineType(plan.type) ? 3 : 0.3;
        if (lead > offlineLeadSec) return;

        this.#transitionScheduled = true;
        const firingFrom = this.current;
        await this.#fireOfflineOrLiveTransition(
            firingFrom,
            next,
            plan,
            startAt,
            startPlay,
            preRoll,
            rate,
            cue.bStartSec,
        );
    }

    /**
     * Reorder the next ~4 prefetched tracks for the best *set flow*: harmonic key,
     * close tempo, AND a smooth energy arc — a DJ keeps the dancefloor moving by
     * building energy gradually rather than slamming a peak track after a mellow one
     * (or vice-versa). Only analysed tracks are scored, so we never stall.
     */
    #promoteBestNext(): void {
        const cur = this.current?.grid;
        if (!cur) return;
        // Don't reorder on an unreliable key read — wrong harmonic matching is worse
        // than none. Below this confidence we keep the play order (tempo still helps).
        const KEY_CONF_MIN = 0.6;
        const curKeyReliable = cur.key.confidence >= KEY_CONF_MIN;
        const curEnergy = flowEnergy(cur.energy);
        const window = Math.min(4, this.queue.length);

        let bestIdx = 0;
        let bestScore = -1;
        for (let i = 0; i < window; i++) {
            const cand = this.queue[i]!;
            if (!cand.grid) continue; // not analysed yet → skip from scoring
            // Only trust the key match when both reads are confident.
            const useKey = curKeyReliable && cand.grid.key.confidence >= KEY_CONF_MIN;
            const harmonic = useKey ? harmonicScore(cur.key.camelot, cand.grid.key.camelot) : 0;
            // Prefer a small tempo gap too (so tempo-sync can engage).
            const tempoRelationship = assessGridTempoRelationship(cur, cand.grid);
            const tempoScore = tempoRelationship.compatible
                ? tempoRelationship.plausibility
                : tempoRelationship.effectiveGap <= 0.16
                  ? 0.5
                  : 0;
            // Energy flow: reward a gentle step (same or a touch higher); penalise a
            // big jump or drop. `delta` in roughly [-1,1]; ideal is a small rise.
            const candEnergy = flowEnergy(cand.grid.energy);
            const delta = candEnergy - curEnergy;
            // Peak around a small upward step (+0.1); falls off for big swings either way.
            const energyScore = Math.max(0, 1 - Math.abs(delta - 0.1) * 2.5);

            const score = harmonic * 0.5 + tempoScore * 0.25 + energyScore * 0.25;
            if (score > bestScore) {
                bestScore = score;
                bestIdx = i;
            }
        }
        if (bestIdx > 0) {
            const [picked] = this.queue.splice(bestIdx, 1);
            this.queue.unshift(picked!);
            log.debug(`Set-flow pick: moved ${picked!.track.id} to next (score ${bestScore.toFixed(2)}).`);
        }
    }

    /** After a crossfade completes: promote next, prefetch. Position is tracked by the deck. */
    #onTransitionEnd(): void {
        const next = this.queue.shift();
        if (next) {
            this.current = next;
            this.#opts.onTrackChange(next);
        }
        this.#transitionScheduled = false;
        // Nudge once when the set runs low (the current track is the last one) so the
        // DJ asks for more before it goes quiet. Reset by add() when tracks come in.
        if (this.#narrator && this.queue.length === 0 && !this.#queueLowAnnounced) {
            this.#queueLowAnnounced = true;
            this.#narrator.announce("queueLow", this.current ? narrationCtx(this.current) : {});
        }
        void this.#prefetchNext();
    }

    /** Download + beat-analyse the next 1–2 upcoming tracks ahead of time. */
    async #prefetchNext(): Promise<void> {
        for (const item of this.queue.slice(0, 2)) {
            if (this.#stopped) return;
            try {
                await this.#ensureFile(item);
            } catch (err) {
                log.warn(`Prefetch failed for ${item.track.id}:`, (err as Error).message);
            }
        }
    }

    /** Ensure a queue item is downloaded, beat-analysed, and loudness-measured. */
    async #ensureFile(item: BeatmatchItem): Promise<void> {
        if (!item.filePath) item.filePath = await sourceDownloadTrack(item.track);
        if (item.grid === undefined) {
            item.grid = await detectBeatGrid(item.filePath, item.track.durationMs);
        }
        if (item.loudnorm === undefined) {
            // Build the deck's pre-resample filter chain: equal-loudness gain first,
            // then the genre-aware mastering polish. The grid (just analysed above)
            // gives the reliable audio genre; title is the override hint.
            const stats = await measureLoudness(item.filePath);
            const pre: string[] = [];
            if (stats) pre.push(loudnormFilter(stats));
            pre.push(...masteringFilters(genreOf(item)));
            item.loudnorm = pre.length ? pre.join(",") : null;
        }
        // Stem separation for acapella moves — only when enabled. Heavy + slow, so
        // it runs LAST (after the track's already playable) and best-effort: a null
        // result just means no acapella transition for this track.
        if (item.stems === undefined && stemsAvailable()) {
            item.stems = await getStems(item.track.id, item.filePath).catch(() => null);
        }
        if (item.stemQuality === undefined) {
            if (!item.stems) {
                item.stemQuality = null;
            } else {
                item.stemQuality = await analyzeStemQuality({
                    vocalsPath: item.stems.vocals,
                    instrumentalPath: item.stems.instrumental,
                    ffmpegPath,
                    ...(item.stems.drums && item.stems.bass && item.stems.other
                        ? {
                              drumsPath: item.stems.drums,
                              bassPath: item.stems.bass,
                              otherPath: item.stems.other,
                          }
                        : {}),
                }).catch((err) => {
                    log.debug(`Stem quality analysis failed for ${item.track.id}: ${(err as Error).message}`);
                    return null;
                });
            }
        }
        if (item.vocalActivity === undefined) {
            if (!item.stems) {
                item.vocalActivity = null;
            } else {
                const durationSec = Math.max(20, Math.min(240, item.track.durationMs / 1000 || 180));
                item.vocalActivity = await analyzeVocalActivityProfile({
                    vocalsPath: item.stems.vocals,
                    ffmpegPath,
                    durationSec,
                }).catch((err) => {
                    log.debug(`Vocal activity analysis failed for ${item.track.id}: ${(err as Error).message}`);
                    return null;
                });
            }
        }
    }
}
