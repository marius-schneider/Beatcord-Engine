import { type ChildProcessByStdio, spawn } from "node:child_process";
import { resolve } from "node:path";
import type { Readable, Writable } from "node:stream";

import { config } from "./config";
import {
    CHANNELS,
    FLOAT_BYTES_PER_SAMPLE,
    FLOAT_FRAME_BYTES,
    FLOAT_SAMPLE_FRAME_BYTES,
    HQ_RESAMPLE,
    PCM_MAX,
    SAMPLE_RATE,
} from "./constants";
import { createLogger } from "./logger";

const log = createLogger("Mixer");

const ffmpegPath = resolve(process.cwd(), config.FFMPEG_PATH);

/**
 * How much audio a deck must buffer before we read from it. ffmpeg's cold start
 * and chunk delivery are bursty, so reading the instant the first byte arrives
 * risks running dry a frame later (→ an audible dropout). Waiting for ~5 frames
 * of lead gives a cushion that absorbs that jitter without a noticeable delay.
 */
const PRIME_FRAMES = 5;
const PRIME_BYTES = FLOAT_FRAME_BYTES * PRIME_FRAMES;

/**
 * Scale decoded f32 samples (ffmpeg's normalized ±1.0) in place into the MixDeck's
 * internal s16 mix scale (±{@link PCM_MAX}). The whole mix/limiter/quantizer chain runs in
 * s16 scale, so this single multiply is the f32→s16 boundary — without it every mixed
 * frame is ~±0.3 and rounds to 0 (silent automix). Exported for a direct regression test.
 */
export function scaleFloatToS16(view: Float32Array): void {
    for (let i = 0; i < view.length; i++) view[i]! *= PCM_MAX;
}

/**
 * A single decoded audio source ("deck") feeding raw PCM.
 *
 * Incoming ffmpeg chunks are kept in a queue with a head offset rather than one
 * growing Buffer: appending is O(1) (no full re-copy), and fully-consumed chunks
 * are dropped so memory tracks only what's buffered ahead — not the whole track.
 */
export class Deck {
    readonly id: string;
    #ffmpeg: ChildProcessByStdio<Writable | null, Readable, Readable> | null;
    /** FIFO of pending PCM chunks; `#head` is the read offset into `#chunks[0]`. */
    #chunks: Buffer[] = [];
    #head = 0;
    #avail = 0;
    /** Total samples decoded so far — used for accurate playback position. */
    samplesProduced = 0;
    ended = false;

    constructor(filePath: string, startSec = 0, filters: string[] = []) {
        this.id = filePath.split("/").at(-1) ?? filePath;
        // `-re` paces decoding to ~real-time so ffmpeg doesn't dump the ENTIRE decoded
        // track (~66 MB of f32 PCM for a 3-min song) into the pipe at once. Without it the
        // deck buffered the whole track in RAM — the dominant per-guild memory cost.
        // (Node/Bun's stdout.pause() doesn't propagate back-pressure to the OS pipe
        // for a spawned process, so throttling ffmpeg itself is the reliable fix.)
        // ffmpeg still reads a little ahead, which — with PRIME_FRAMES — is the jitter
        // cushion. `-ss` (input seek) stays before `-i`; `-re` pairs with it fine.
        const args: string[] = ["-hide_banner", "-re"];
        if (startSec > 0) args.push("-ss", String(startSec));
        args.push("-i", filePath);
        // Always end the chain with high-quality resampling to a clean 48kHz float
        // stream (after any tempo-stretch filter), so decks never feed gritty/aliased
        // s16 PCM into the mixer. The MixDeck is the only final s16 quantizer.
        const af = [...filters, HQ_RESAMPLE];
        args.push("-af", af.join(","));
        args.push("-f", "f32le", "-ar", String(SAMPLE_RATE), "-ac", String(CHANNELS), "-loglevel", "error", "pipe:1");
        const ff = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });
        ff.stdout.on("data", (c: Buffer) => {
            this.#chunks.push(c);
            this.#avail += c.length;
            this.samplesProduced += c.length / FLOAT_SAMPLE_FRAME_BYTES;
        });
        ff.stderr.on("data", (d: Buffer) => {
            const m = d.toString().trim();
            if (m) log.debug(`ffmpeg[${this.id}]: ${m}`);
        });
        ff.on("close", () => {
            this.ended = true;
        });
        ff.on("error", (e) => log.error(`deck ${this.id} ffmpeg error:`, e));
        this.#ffmpeg = ff;
    }

    /** Bytes currently buffered and ready to read. */
    get available(): number {
        return this.#avail;
    }

    /**
     * Ready to be read from without risking an immediate underrun: either enough
     * lead is buffered, or ffmpeg has already finished (so what's there is all
     * there'll be). Used to hold off the first read until there's a cushion.
     */
    get primed(): boolean {
        return this.#avail >= PRIME_BYTES || this.ended;
    }

    /** Bytes still to be silently dropped before output (sample-align trimming). */
    #skipBytes = 0;

    /** Drop up to `bytes` from the front of the buffer; returns how many were dropped. */
    #drop(bytes: number): number {
        let dropped = 0;
        while (dropped < bytes && this.#chunks.length) {
            const chunk = this.#chunks[0]!;
            const take = Math.min(chunk.length - this.#head, bytes - dropped);
            dropped += take;
            this.#head += take;
            this.#avail -= take;
            if (this.#head >= chunk.length) {
                this.#chunks.shift();
                this.#head = 0;
            }
        }
        return dropped;
    }

    /**
     * Silently discard decoded sample-frames from the front of the deck. Used to
     * sample-align the incoming track's bar line with the outgoing one at a
     * crossfade. Frames not yet decoded are dropped as they arrive.
     */
    discardLeadingFrames(frames: number): void {
        const alignedFrames = Math.max(0, Math.floor(frames));
        const bytes = alignedFrames * FLOAT_SAMPLE_FRAME_BYTES;
        if (bytes <= 0) return;
        this.#skipBytes += bytes - this.#drop(bytes);
    }

    /**
     * Copy up to `dest.length` bytes of decoded audio into `dest`; returns the number of
     * bytes written. Reusing the caller's buffer avoids a per-read allocation in the hot
     * path.
     *
     * **Scale boundary:** ffmpeg decodes to `f32le` in the normalized ±1.0 range, but the
     * MixDeck's mix/limiter/quantizer math (and `#recent`/voiceOver) all work in s16 scale
     * (±32767 — see {@link finalizeFloatSample}, `PCM_MAX`). So this is the single point
     * where deck samples are scaled by `PCM_MAX` into that internal scale. Without it,
     * every mixed frame is ~±0.3 and rounds to 0 → total silence on the automix path.
     */
    readFloatInto(dest: Buffer): number {
        if (this.#skipBytes > 0) this.#skipBytes -= this.#drop(this.#skipBytes);
        const targetBytes = Math.min(dest.length, this.#avail);
        const readableBytes = targetBytes - (targetBytes % FLOAT_SAMPLE_FRAME_BYTES);
        if (readableBytes <= 0) {
            if (this.ended && this.#avail > 0) this.#drop(this.#avail);
            return 0;
        }
        let written = 0;
        while (written < readableBytes && this.#chunks.length) {
            const chunk = this.#chunks[0]!;
            const from = this.#head;
            const take = Math.min(chunk.length - from, readableBytes - written);
            chunk.copy(dest, written, from, from + take);
            written += take;
            this.#head += take;
            this.#avail -= take;
            if (this.#head >= chunk.length) {
                this.#chunks.shift(); // drop the spent chunk → memory freed
                this.#head = 0;
            }
        }
        // ── ±1.0 (ffmpeg f32le) → ±32767 (internal s16 mix scale) ──
        // dest is 4-byte (f32) aligned (FLOAT_FRAME_BYTES buffers), so a Float32Array view
        // over the written region is safe. Scale in place; the mixer reads the same buffer.
        if (written > 0) {
            const samples = (written / FLOAT_BYTES_PER_SAMPLE) | 0;
            scaleFloatToS16(new Float32Array(dest.buffer, dest.byteOffset, samples));
        }
        return written;
    }

    /** True when ffmpeg finished AND its buffer is drained. */
    get drained(): boolean {
        return this.ended && this.#avail === 0;
    }

    destroy(): void {
        this.#ffmpeg?.kill("SIGKILL");
        this.#ffmpeg = null;
        this.#chunks = [];
        this.#head = 0;
        this.#avail = 0;
    }
}
