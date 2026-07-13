import { type ChildProcessByStdio, spawn } from "node:child_process";
import { resolve } from "node:path";
import type { Readable } from "node:stream";

import { config } from "./config";
import { HQ_RESAMPLE, SAFETY_LIMITER, SAMPLE_RATE } from "./constants";
import { createLogger } from "./logger";

/**
 * Platform-neutral PCM source builder — the generic half of what was the bot's
 * `createFileResource`. It decodes a local file through ffmpeg into clean,
 * limiter-protected 48kHz/stereo/s16le PCM and hands back the raw `Readable`.
 *
 * Both sinks build on this identical PCM:
 *  - the bot wraps it in `@discordjs/voice`'s `createAudioResource` (voice output),
 *  - the server segments it through ffmpeg into HLS for the app.
 *
 * Anti-crackle measures baked in (see also constants.ts):
 *  - high-quality resampling + dithering to a clean 48kHz (no aliasing grit),
 *  - a gentle safety limiter so loud masters never hit the hard s16 clamp,
 *  - an optional short fade-in so playback never starts on a non-zero sample.
 */

const log = createLogger("pcm");
const ffmpegPath = resolve(process.cwd(), config.FFMPEG_PATH);

export interface PcmStreamOptions {
    /** Start position in seconds (for seeking / resume). */
    seekSeconds?: number;
    /** Extra ffmpeg audio filters (e.g. "bass=g=10", "atempo=1.25"). */
    filters?: string[];
    /**
     * Fade the first `fadeInSec` seconds up from silence. Avoids the click that a
     * hard start (or a mid-track seek into a non-zero-crossing) produces.
     */
    fadeInSec?: number;
}

/**
 * Decode `filePath` to a 48kHz/stereo/s16le PCM `Readable` via ffmpeg. Returns the
 * stream plus the ffmpeg child so the caller can kill it on stop.
 *
 * `-re` paces decoding to ~real-time so ffmpeg streams the track as it's played
 * instead of decoding it all up front and holding ~33 MB of PCM in the pipe per
 * active source. Consumers read at their own cadence, so real-time decode is plenty.
 */
export function buildPcmStream(
    filePath: string,
    opts: PcmStreamOptions = {},
): { pcm: Readable; ffmpeg: ChildProcessByStdio<null, Readable, Readable> } {
    // Order matters: user filters → resample → fade → limiter (limiter last so it
    // catches the post-everything peak).
    const filters = [...(opts.filters ?? []), HQ_RESAMPLE];
    if (opts.fadeInSec && opts.fadeInSec > 0) {
        filters.push(`afade=t=in:st=0:d=${opts.fadeInSec}:curve=tri`);
    }
    filters.push(SAFETY_LIMITER);

    const args: string[] = ["-hide_banner", "-re"];
    if (opts.seekSeconds && opts.seekSeconds > 0) {
        // Input seeking is fast and accurate enough for music.
        args.push("-ss", String(opts.seekSeconds));
    }
    args.push("-i", filePath);
    args.push("-af", filters.join(","));
    args.push(
        "-analyzeduration",
        "0",
        "-loglevel",
        "error",
        "-f",
        "s16le",
        "-ar",
        String(SAMPLE_RATE),
        "-ac",
        "2",
        // Large output buffer so a scheduling hiccup never starves the pipe
        // (underruns are the #1 cause of audible crackle/dropouts).
        "-flush_packets",
        "0",
        "pipe:1",
    );

    const ffmpeg = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    ffmpeg.stderr.on("data", (d: Buffer) => {
        const msg = d.toString().trim();
        if (msg) log.debug(`ffmpeg: ${msg}`);
    });
    ffmpeg.on("error", (err) => log.error("ffmpeg spawn error:", err));

    return { pcm: ffmpeg.stdout, ffmpeg };
}
