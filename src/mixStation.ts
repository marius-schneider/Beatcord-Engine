// Server-side mix station — the app-facing equivalent of the bot's Discord-voice
// output. Drives a continuous MixDeck PCM stream from a room's queue and muxes it
// to a live HLS playlist (AAC) that AVPlayer can stream. One station per active
// party room.
//
// The MixDeck gives gapless, limiter-protected output across tracks; this wraps it
// with track download + advancement and an ffmpeg HLS sink. Beat-aligned crossfade
// scheduling (the transition-planner) layers on top later — the deck already keeps
// playback continuous.

import { type ChildProcess, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { config } from "./config";
import { SAMPLE_RATE } from "./constants";
import { createLogger } from "./logger";
import { loudnormFilter, measureLoudness } from "./loudness";
import { MixDeck } from "./mixer";
import { downloadTrack, type TrackInfo } from "./ytdlp";

const log = createLogger("mix-station");
const ffmpegPath = resolve(process.cwd(), config.FFMPEG_PATH);

/** HLS tuning. 2s segments balance start latency against request overhead. */
const HLS_SEGMENT_SEC = 2;
const HLS_LIST_SIZE = 6;

export interface MixStationItem {
    track: TrackInfo;
    filePath?: string;
    loudnorm?: string;
}

export interface MixStationEvents {
    /** The current track changed (advanced/skipped). */
    onTrackChange?: (track: TrackInfo) => void;
    /** The queue ran dry and nothing is playing. */
    onEmpty?: () => void;
}

/**
 * One room's live mix → HLS. Call {@link start} with the initial queue, then
 * {@link skip}/{@link add} as the room's controls fire. The playlist + segments
 * live under {@link dir}; the HTTP layer serves files from there.
 */
export class MixStation {
    readonly roomId: string;
    #events: MixStationEvents;
    #deck = new MixDeck({ onEmpty: () => this.#onDeckEmpty() });
    #ffmpeg: ChildProcess | null = null;
    #dir: string | null = null;
    #ready: Promise<void> | null = null;

    current: MixStationItem | null = null;
    queue: MixStationItem[] = [];
    #stopped = false;

    constructor(roomId: string, events: MixStationEvents = {}) {
        this.roomId = roomId;
        this.#events = events;
    }

    /** The directory holding stream.m3u8 + segments once started, else null. */
    get dir(): string | null {
        return this.#dir;
    }

    /** Resolves once the playlist file exists (so the first request won't 404). */
    get ready(): Promise<void> {
        return this.#ready ?? Promise.resolve();
    }

    get playing(): boolean {
        return this.current != null && !this.#stopped;
    }

    /** Elapsed time of the current track in ms (from the deck's frame counter). */
    get positionMs(): number {
        return Math.round(this.#deck.playedSec * 1000);
    }

    /** Begin the mix with `first` current and `rest` queued. */
    async start(first: MixStationItem, rest: MixStationItem[]): Promise<void> {
        this.queue = rest;
        this.current = first;
        this.#stopped = false;

        this.#dir = await mkdtemp(join(tmpdir(), `beatcord-hls-${this.roomId}-`));
        if (!first.filePath) first.filePath = await this.#download(first);
        this.#deck.loadPrimary(first.filePath, 0, first.loudnorm ?? undefined);
        this.#ready = this.#startFfmpeg();
        await this.#ready;

        this.#events.onTrackChange?.(first.track);
        void this.#ensureLoudness(first);
        void this.#prefetchNext();
    }

    add(item: MixStationItem): void {
        this.queue.push(item);
        void this.#prefetchNext();
    }

    /** Skip immediately to the next track (hard cut within the continuous stream). */
    async skip(): Promise<void> {
        const next = this.queue.shift();
        if (!next) {
            await this.stop();
            this.#events.onEmpty?.();
            return;
        }
        try {
            if (!next.filePath) next.filePath = await this.#download(next);
        } catch (err) {
            // A track we can't fetch must not crash the station — drop it and try
            // the next one rather than wedging the whole room.
            log.warn(`skip: download failed for ${next.track.id}, skipping: ${(err as Error).message}`);
            return this.skip();
        }
        if (this.#stopped) return;
        this.current = next;
        this.#deck.skipTo(next.filePath!, 0, next.loudnorm ?? undefined);
        this.#events.onTrackChange?.(next.track);
        void this.#ensureLoudness(next);
        void this.#prefetchNext();
    }

    setVolume(v: number): void {
        this.#deck.setGain(v);
    }

    async stop(): Promise<void> {
        if (this.#stopped) return;
        this.#stopped = true;
        this.#deck.close();
        this.#ffmpeg?.kill("SIGKILL");
        this.#ffmpeg = null;
        if (this.#dir) {
            const dir = this.#dir;
            this.#dir = null;
            await rm(dir, { recursive: true, force: true }).catch(() => {});
        }
    }

    // ── internals ──

    /** Spawn ffmpeg reading the deck's PCM on stdin → HLS in #dir. */
    #startFfmpeg(): Promise<void> {
        const dir = this.#dir!;
        const args = [
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "s16le",
            "-ar",
            String(SAMPLE_RATE),
            "-ac",
            "2",
            "-i",
            "pipe:0",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-f",
            "hls",
            "-hls_time",
            String(HLS_SEGMENT_SEC),
            "-hls_list_size",
            String(HLS_LIST_SIZE),
            // Live window: drop old segments, keep appending, never write ENDLIST
            // (the stream is open-ended like a radio station).
            "-hls_flags",
            "delete_segments+append_list+omit_endlist+independent_segments",
            "-hls_segment_filename",
            join(dir, "seg_%05d.aac"),
            join(dir, "stream.m3u8"),
        ];
        const ff = spawn(ffmpegPath, args, { stdio: ["pipe", "ignore", "pipe"] });
        ff.stderr?.on("data", (d: Buffer) => {
            const m = d.toString().trim();
            if (m) log.debug(`ffmpeg[${this.roomId}]: ${m}`);
        });
        ff.on("error", (err) => log.error(`ffmpeg spawn error [${this.roomId}]:`, err));
        this.#deck.pipe(ff.stdin!);
        this.#ffmpeg = ff;

        // Resolve once the playlist file appears (first segment flushed).
        const playlist = join(dir, "stream.m3u8");
        return new Promise<void>((resolveReady) => {
            const t0 = Date.now();
            const poll = setInterval(async () => {
                if (this.#stopped || (await Bun.file(playlist).exists()) || Date.now() - t0 > 15_000) {
                    clearInterval(poll);
                    resolveReady();
                }
            }, 100);
        });
    }

    #onDeckEmpty(): void {
        if (this.#stopped) return;
        // Deck drained the current track → advance. skip() handles its own errors;
        // the catch here is a final guard so nothing can become an unhandled
        // rejection that crashes the process.
        this.skip().catch((err) => log.warn(`auto-advance failed [${this.roomId}]: ${(err as Error).message}`));
    }

    /**
     * Download a track, de-duplicating concurrent requests for the same id. The
     * prefetch and a racing skip both ask for the next track; without this they
     * launch two yt-dlp processes that fight over the same cache .part file.
     */
    #inFlight = new Map<string, Promise<string>>();
    #download(item: MixStationItem): Promise<string> {
        if (item.filePath) return Promise.resolve(item.filePath);
        const id = item.track.id;
        let p = this.#inFlight.get(id);
        if (!p) {
            p = downloadTrack(item.track).finally(() => this.#inFlight.delete(id));
            this.#inFlight.set(id, p);
        }
        return p;
    }

    /** Measure + cache loudnorm for an item so the next load is level-matched. */
    async #ensureLoudness(item: MixStationItem): Promise<void> {
        if (item.loudnorm || !item.filePath) return;
        const stats = await measureLoudness(item.filePath).catch(() => null);
        if (stats) item.loudnorm = loudnormFilter(stats);
    }

    /** Download the next queued track ahead of time so skips are instant. */
    async #prefetchNext(): Promise<void> {
        const next = this.queue[0];
        if (!next || next.filePath) return;
        try {
            next.filePath = await this.#download(next);
            void this.#ensureLoudness(next);
        } catch (err) {
            log.debug(`prefetch failed for ${next.track.id}: ${(err as Error).message}`);
        }
    }
}
