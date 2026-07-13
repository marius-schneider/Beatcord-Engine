import { z } from "zod";

/**
 * Engine configuration — the subset of the old bot config that the shared audio
 * engine needs (external tools, cache, automix/mastering/stems/narrator/whisper).
 * The Discord-specific fields (DISCORD_TOKEN, DEV_GUILD_ID, …) stay in the bot's
 * own config, which spreads this in. Bun loads `.env` automatically.
 */

const boolish = z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.enum(["true", "false", "1", "0", "yes", "no"]))
    .transform((v) => v === "true" || v === "1" || v === "yes");

export const engineSchema = z.object({
    // External tools. Default to project-local ./bin copies (no global install
    // needed), but allow overriding with a system path.
    YTDLP_PATH: z.string().default("./bin/yt-dlp"),
    FFMPEG_PATH: z.string().default("./bin/ffmpeg"),
    FFMPEG_RESAMPLER: z.enum(["swr", "soxr"]).default("swr"),
    FFMPEG_TEMPO_STRETCHER: z.enum(["atempo", "rubberband"]).default("atempo"),
    // Rubber Band processing engine. "finer" = the R3 engine (markedly better on
    // vocals, complex mixes and bass-heavy material, ~3× CPU) — requires an
    // ffmpeg whose rubberband filter exposes `engine` (stock ffmpeg ≤8.x does
    // NOT; see the one-line filter patch in the server's deploy/SETUP.md).
    FFMPEG_RUBBERBAND_ENGINE: z.enum(["faster", "finer"]).default("faster"),

    // Where fully-downloaded audio files are cached for playback/mixing.
    CACHE_DIR: z.string().default("./cache"),
    // Max total cache size in MB before the oldest files are evicted.
    CACHE_MAX_MB: z.coerce.number().int().positive().default(2048),

    // Default search/extract platform prefix for bare queries (yt-dlp syntax).
    DEFAULT_SEARCH: z.string().default("ytsearch"),

    // Optional explicit yt-dlp JavaScript runtime, e.g. "deno:/opt/homebrew/bin/deno".
    // Empty = auto-detect a supported runtime.
    YTDLP_JS_RUNTIME: z.string().default(""),

    // Optional Netscape cookies.txt for yt-dlp. With YouTube Music Premium
    // cookies, "bestaudio" unlocks the 256 kbps Opus tier (format 774) on
    // YT Music — the single biggest source-quality upgrade available.
    YTDLP_COOKIES: z.string().default(""),
    // OR read cookies straight from a local browser profile (yt-dlp
    // --cookies-from-browser), e.g. "chrome", "safari", "firefox",
    // "chrome:Profile 1". Takes effect only when YTDLP_COOKIES is unset.
    // Best for a dev machine; servers should use the exported-file variant.
    YTDLP_COOKIES_FROM_BROWSER: z.string().default(""),
    // Extra yt-dlp args appended to every invocation (whitespace-split), e.g.
    // extractor tweaks like: --extractor-args youtube:player_client=web_music
    YTDLP_EXTRA_ARGS: z.string().default(""),

    // Optional YouTube Music catalogue layer (Python ytmusicapi). When available,
    // it gives cleaner song/album/radio metadata than scraping generic YouTube.
    YTMUSICAPI_ENABLED: boolish.default(true),
    YTMUSICAPI_PYTHON: z.string().default(""),
    YTMUSICAPI_LANG: z.string().default("en"),
    YTMUSICAPI_LOCATION: z.string().default(""),
    YTMUSICAPI_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),

    // Max yt-dlp subprocesses running at once. Each spawn is CPU+RAM; without a cap
    // a burst (e.g. resolving a whole page of albums in parallel) can spike the box.
    // Calls past the limit queue and run as slots free up.
    YTDLP_MAX_CONCURRENCY: z.coerce.number().int().positive().default(4),

    // Start every new player in beatmatched automix mode (continuous DJ-style
    // crossfade). Bot/app can still toggle it off per session.
    AUTOMIX_DEFAULT: boolish.default(true),
    AUTOMIX_FADE_SECONDS: z.coerce.number().int().min(1).max(12).default(6),
    AUTOMIX_EQ_SWEEP: boolish.default(true),
    AUTOMIX_TEMPO_SYNC: boolish.default(true),
    AUTOMIX_HARMONIC: boolish.default(true),
    AUTOMIX_OFFLINE_RENDER: boolish.default(false),
    AUTOMIX_OFFLINE_RENDER_CACHE_DIR: z.string().default("./cache/offline-transitions"),
    AUTOMIX_OFFLINE_RENDER_PRE_SECONDS: z.coerce.number().min(0.25).max(3).default(0.35),
    AUTOMIX_OFFLINE_RENDER_POST_SECONDS: z.coerce.number().min(0.25).max(30).default(4),
    AUTOMIX_OFFLINE_RENDER_FORMAT: z.enum(["wav16", "wav32", "flac"]).default("wav32"),
    AUTOMIX_OFFLINE_RENDER_LV2: boolish.default(true),
    AUTOMIX_OFFLINE_RENDER_LADSPA_TRIM: boolish.default(false),
    AUTOMIX_TELEMETRY_ENABLED: boolish.default(true),
    AUTOMIX_TELEMETRY_PATH: z.string().default("./data/transition-telemetry.jsonl"),
    AUTOMIX_FEEDBACK_ENABLED: boolish.default(true),
    AUTOMIX_FEEDBACK_MIN_RECORDS: z.coerce.number().int().positive().default(6),
    AUTOMIX_FEEDBACK_REFRESH_SECONDS: z.coerce.number().int().positive().default(60),
    AUTOMIX_USER_FEEDBACK_ENABLED: boolish.default(true),
    AUTOMIX_TRANSITION_SKIP_FEEDBACK_SECONDS: z.coerce.number().int().positive().default(45),

    // ── Stem separation (Demucs) for acapella transitions ──
    ENABLE_STEMS: boolish.default(false),
    DEMUCS_PYTHON: z.string().default("./vendor/demucs-venv/bin/python"),
    DEMUCS_MODEL: z.string().default("htdemucs"),
    STEM_CACHE_DIR: z.string().default("./cache/stems"),

    // ── Post-processing / mastering (ffmpeg) ──
    MASTERING_ENABLED: boolish.default(true),
    MASTERING_CROSSFEED: z.coerce.number().min(0).max(1).default(0.3),
    MASTERING_BASS: z.coerce.number().min(-6).max(6).default(0),
    MASTERING_TREBLE: z.coerce.number().min(-6).max(6).default(0),

    // ── DJ Narrator (Piper TTS) ──
    PIPER_URL_EN: z.string().default("http://127.0.0.1:5050"),
    PIPER_URL_DE: z.string().default("http://127.0.0.1:5051"),

    // ── Voice commands (whisper.cpp speech-to-text) ──
    WHISPER_PATH: z.string().default("./bin/whisper-cli"),
    WHISPER_MODEL: z.string().default("./models/ggml-large-v3.bin"),
    WHISPER_LANG: z.string().default("en"),
    WHISPER_VAD_MODEL: z.string().default("./models/ggml-silero-v6.2.0.bin"),

    NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type EngineConfig = z.infer<typeof engineSchema>;

/**
 * Parse just the engine fields from `process.env`. Unknown keys (e.g. the bot's
 * DISCORD_*) are ignored — Zod objects strip extras by default — so the bot can
 * share one `.env` while owning its own extra fields.
 */
export function loadEngineConfig(): EngineConfig {
    const parsed = engineSchema.safeParse(process.env);
    if (!parsed.success) {
        console.error("❌ Invalid engine configuration:\n");
        for (const issue of parsed.error.issues) {
            console.error(`   • ${issue.path.join(".")}: ${issue.message}`);
        }
        process.exit(1);
    }
    return parsed.data;
}

export const config = loadEngineConfig();
