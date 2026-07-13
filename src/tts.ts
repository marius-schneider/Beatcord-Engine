import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { config } from "./config";
import { CHANNELS, SAMPLE_RATE } from "./constants";
import { createLogger } from "./logger";
import type { NarratorLang } from "./narrator-phrases";

/**
 * Text-to-speech for the DJ Narrator, backed by a **local Piper HTTP server** —
 * free, offline, no API key. We POST a sentence and get back a WAV clip, then run
 * it through ffmpeg into the exact 48kHz/stereo/s16le PCM the mixer consumes, so
 * the narration drops straight onto the music stream.
 *
 * Everything here is **best-effort**: if Piper is down, the request times out, or
 * ffmpeg fails, `synth()` returns null and the caller simply stays silent. The
 * music never blocks on or breaks because of narration.
 */

const log = createLogger("TTS");
const ffmpegPath = resolve(process.cwd(), config.FFMPEG_PATH);

/** Per-language Piper server URLs (must match the loaded voice models). */
const PIPER_URL: Record<NarratorLang, string> = {
    de: config.PIPER_URL_DE,
    en: config.PIPER_URL_EN,
};

/**
 * Piper synthesis tuning. The default *-medium voices read flat ("bored"); these
 * shape the delivery into something with a DJ's energy:
 *  - `lengthScale` < 1 speaks faster (more drive),
 *  - `noiseScale` adds expression (pitch/timbre variation),
 *  - `noiseWScale` varies the timing so it's less monotone.
 * Tuned by ear ("energetic" preset). Per-call overrides let styles differ (a chill
 * DJ should speak slower/calmer than a club one).
 */
export interface SpeechParams {
    lengthScale?: number;
    noiseScale?: number;
    noiseWScale?: number;
}

/** Default delivery — energetic, the all-round DJ voice. */
export const DJ_SPEECH: Required<SpeechParams> = {
    lengthScale: 0.82,
    noiseScale: 0.85,
    noiseWScale: 1.0,
};

/** How long to wait on Piper before giving up (synthesis is short text). */
const SYNTH_TIMEOUT_MS = 4000;
/** Cap a single clip's length so a runaway response can't flood the mixer. */
const MAX_CLIP_SEC = 12;

/** Small LRU so identical lines (e.g. the same "start" phrase) aren't re-synthed. */
const CACHE_MAX = 64;
const cache = new Map<string, Buffer>();

function cacheGet(key: string): Buffer | null {
    const hit = cache.get(key);
    if (!hit) return null;
    // Refresh recency (Map preserves insertion order).
    cache.delete(key);
    cache.set(key, hit);
    return hit;
}

function cacheSet(key: string, buf: Buffer): void {
    cache.set(key, buf);
    if (cache.size > CACHE_MAX) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
    }
}

/** Transcode WAV bytes (any rate/channels) into 48kHz/stereo/s16le PCM via ffmpeg. */
function wavToPcm(wav: Buffer): Promise<Buffer | null> {
    return new Promise((res) => {
        const ff = spawn(
            ffmpegPath,
            [
                "-hide_banner",
                "-f",
                "wav",
                "-i",
                "pipe:0",
                "-t",
                String(MAX_CLIP_SEC),
                "-f",
                "s16le",
                "-ar",
                String(SAMPLE_RATE),
                "-ac",
                String(CHANNELS),
                "-loglevel",
                "error",
                "pipe:1",
            ],
            { stdio: ["pipe", "pipe", "pipe"] },
        );
        const chunks: Buffer[] = [];
        ff.stdout.on("data", (c: Buffer) => chunks.push(c));
        ff.stderr.on("data", (d: Buffer) => {
            const m = d.toString().trim();
            if (m) log.debug(`ffmpeg(tts): ${m}`);
        });
        ff.on("error", (e) => {
            log.debug(`tts ffmpeg spawn failed: ${(e as Error).message}`);
            res(null);
        });
        ff.on("close", () => res(chunks.length ? Buffer.concat(chunks) : null));
        ff.stdin.on("error", () => {}); // ignore EPIPE if ffmpeg exits early
        ff.stdin.end(wav);
    });
}

/**
 * Synthesize `text` to 48kHz/stereo/s16le PCM in the given language, or null if
 * anything goes wrong (server down, timeout, transcode failure). Cached by
 * `lang + text` so repeated lines are instant and don't re-hit Piper.
 */
export async function synthSpeech(
    lang: NarratorLang,
    text: string,
    params: SpeechParams = DJ_SPEECH,
): Promise<Buffer | null> {
    const clean = text.trim();
    if (!clean) return null;

    const p = { ...DJ_SPEECH, ...params };
    // Cache by everything that changes the audio (text + delivery), so a chill vs
    // club rendering of the same line don't collide.
    const key = `${lang}:${p.lengthScale}:${p.noiseScale}:${p.noiseWScale}:${clean}`;
    const cached = cacheGet(key);
    if (cached) return cached;

    const url = PIPER_URL[lang];
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), SYNTH_TIMEOUT_MS);
        let wav: Buffer | null = null;
        try {
            // Piper's HTTP server expects a JSON body `{"text": "..."}` (+ optional
            // synthesis params) and returns a WAV clip (22050 Hz mono s16 for *-medium).
            const resp = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: clean,
                    length_scale: p.lengthScale,
                    noise_scale: p.noiseScale,
                    noise_w_scale: p.noiseWScale,
                }),
                signal: ctrl.signal,
            });
            if (!resp.ok) {
                log.debug(`Piper(${lang}) HTTP ${resp.status}`);
                return null;
            }
            wav = Buffer.from(await resp.arrayBuffer());
        } finally {
            clearTimeout(timer);
        }
        if (!wav || wav.length === 0) return null;

        const pcm = await wavToPcm(wav);
        if (!pcm || pcm.length === 0) return null;
        cacheSet(key, pcm);
        return pcm;
    } catch (err) {
        // AbortError (timeout) or network error → degrade to silence.
        log.debug(`Piper(${lang}) synth failed: ${(err as Error).message}`);
        return null;
    }
}
