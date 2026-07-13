/**
 * Beatcord engine — the shared, platform-neutral audio core extracted from the
 * Discord bot. yt-dlp sourcing, the beatmatching mixer, beat/key/tempo analysis,
 * stems, TTS/STT, lyrics and the ffmpeg PCM pipeline. No Discord, no HTTP here:
 * the bot wraps this for Discord voice, the server wraps it for HTTP/WS/HLS.
 *
 * Re-exported with explicit member lists where flat names are unambiguous, and as
 * namespaces where modules share generic names (FFT_SIZE, interfaces, etc.).
 */

// ── Analysis (DSP) ──
export * from "./audio-quality-report";
export * as beatMath from "./beat-math";
export * as beatgrid from "./beatgrid";
export * as cache from "./cache";
export type { EngineConfig } from "./config";
// ── Foundation ──
export { config, engineSchema, loadEngineConfig } from "./config";
export * from "./constants";
export * as eq from "./eq";
export * as genre from "./genre";
export * as key from "./key";
export { detectKeyEssentia } from "./key-essentia";
export type { Logger } from "./logger";
export { c, createLogger, logger } from "./logger";
export * as loudness from "./loudness";
// ── Metadata / lyrics / cache ──
export * from "./lyrics";
export { masteringFilters } from "./mastering";
export * from "./mirror";
// ── Mixing / beatmatching ──
export * from "./mixer";
export * from "./mixStation";
export type { NarratorConfig } from "./narrator";
export { DjNarrator } from "./narrator";
export * as narratorPhrases from "./narrator-phrases";
export * from "./offline-renderer";
// ── PCM pipeline + format constants ──
export * from "./pcm";
export * from "./phrase-cues";
export * as spectral from "./spectral";
export * from "./stem-quality";
// ── Stems / voice / narration ──
export * as stems from "./stems";
export * as stt from "./stt";
export * as tempo from "./tempo";
export * from "./trackmeta";
export * from "./transition-analyzer";
export * from "./transition-candidates";
export * from "./transition-planner";
export * from "./transition-telemetry";
export * as tts from "./tts";
export * from "./vocal-activity";
export * from "./vocal-conflict";
export * as voiceCommands from "./voice-commands";
// ── Sourcing (yt-dlp + Spotify/Apple mirror) ──
export * from "./ytdlp";
