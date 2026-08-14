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
    // Versioned, content-addressed DSP/ML analysis entries.
    ANALYSIS_CACHE_DIR: z.string().default("./cache/analysis"),
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
    // 0 = derive from the host (see resources.ts). Any explicit value wins, so a
    // deployment that knows better than the heuristic can still pin it.
    YTDLP_MAX_CONCURRENCY: z.coerce.number().int().min(0).default(0),
    // Simultaneous loudness scans. Each decodes a whole file at full speed, so this
    // competes directly with the playback decoders. 0 = derive from the host.
    LOUDNESS_MAX_CONCURRENCY: z.coerce.number().int().min(0).default(0),
    // Beat-grid analysis workers. 0 = derive from the host.
    BEATGRID_WORKERS: z.coerce.number().int().min(0).default(0),
    // Concurrent Demucs stem separations. 0 = derive from the host (memory-bound).
    STEMS_MAX_CONCURRENCY: z.coerce.number().int().min(0).default(0),

    // Cross-platform compute budget. Zero means host-derived; the tier override is
    // -1 for automatic or 0..3 for deterministic device-profile testing/deploys.
    COMPUTE_REALTIME_CPU: z.coerce.number().min(0).default(0),
    COMPUTE_BACKGROUND_CPU: z.coerce.number().min(0).default(0),
    COMPUTE_MEMORY_BUDGET_MB: z.coerce.number().int().min(0).default(0),
    COMPUTE_GPU_AVAILABLE: boolish.default(false),
    COMPUTE_BATTERY_MODE: boolish.default(false),
    COMPUTE_TIER_OVERRIDE: z.coerce.number().int().min(-1).max(3).default(-1),

    // Start every new player in beatmatched automix mode (continuous DJ-style
    // crossfade). Bot/app can still toggle it off per session.
    AUTOMIX_DEFAULT: boolish.default(true),
    AUTOMIX_FADE_SECONDS: z.coerce.number().int().min(1).max(12).default(6),
    // Club-length beatmatched blends: ride both tracks for a full phrase instead
    // of a quick radio crossfade. Bars are quantized to the outgoing beat grid so
    // the blend starts AND ends on a bar line. 16 bars ≈ 30 s at 128 BPM.
    AUTOMIX_BLEND_BARS: z.coerce.number().int().min(2).max(64).default(16),
    // Whether to extend a plain blend to that club length at all. Off gives the
    // planner's short seamless fade — a noticeably different, more radio-like feel.
    AUTOMIX_CLUB_BLEND: boolish.default(true),
    // Hard ceiling on a blend's length (s), regardless of bar math / track length.
    AUTOMIX_MAX_BLEND_SEC: z.coerce.number().min(6).max(90).default(40),
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

    // ── TIDAL source (lossless FLAC via the `tiddl` library) ──
    // Primary source when enabled + logged in (`tiddl auth login`); yt-dlp is the
    // automatic per-track fallback. Off by default so nothing breaks without a
    // TIDAL subscription.
    TIDAL_ENABLED: boolish.default(false),
    TIDAL_PYTHON: z.string().default("./vendor/tidal-venv/bin/python"),
    // LOSSLESS = 16-bit/44.1 FLAC; HI_RES_LOSSLESS = up to 24-bit/192 FLAC.
    // HI_RES_LOSSLESS needs no extra login — the helper derives a hi-res playback
    // token from the existing one — but it does need ffmpeg on PATH (TIDAL serves
    // hi-res as FLAC-in-MP4, which the helper remuxes with `-c copy`). It is not the
    // default because the files are ~3x larger (a 4-min track: 31 MB -> 92 MB), and
    // every downstream analysis pass pays that.
    TIDAL_QUALITY: z.enum(["LOW", "HIGH", "LOSSLESS", "HI_RES_LOSSLESS"]).default("LOSSLESS"),
    // Override the bundled helper path (empty = resolve next to the engine source).
    TIDAL_HELPER: z.string().default(""),
    // Sprache der redaktionellen Seiten (Explore, Genre-Seiten, Home-Shelves).
    // TIDAL übersetzt Gruppen- und Kategorienamen danach: "de_DE" liefert
    // „Genres / Stimmungen & Aktivitäten / Jahrzehnte" statt der englischen.
    TIDAL_LOCALE: z.string().default("en_US"),
    // 0 = derive from the host (see resources.ts).
    TIDAL_MAX_CONCURRENCY: z.coerce.number().int().min(0).default(0),
    // Keep one long-lived `helper serve` process for fast metadata calls (search,
    // album, …) so they skip the python cold-start each spawn otherwise pays. Any
    // transport error falls back to a one-shot spawn; downloads stay one-shot.
    TIDAL_PERSISTENT: boolish.default(false),
    // How many commands that worker runs at once. Requests are id-correlated, so a
    // slow one (home ~600ms) no longer blocks the fast ones queued behind it. Kept
    // low on purpose: these are network-bound and TIDAL rate-limits bursts.
    TIDAL_SERVE_WORKERS: z.coerce.number().int().min(1).default(4),
    // Start a cold TIDAL track from its stream URL instead of waiting for the whole
    // download (~11s → under a second). OFF by default, and that default is a
    // judgement call, not caution for its own sake: the bootstrap window plays before
    // loudness has been measured, and TIDAL's replayGain only partly substitutes
    // (see replayGainFilter — slope -0.42, not -1). So it trades ~10s of silence for
    // a few seconds of imperfectly-levelled audio. Turn it on once the cold-start
    // telemetry (see cold-start.ts) shows cold gates are actually frequent.
    // No effect on hi-res: DASH has no single URL to bootstrap from.
    TIDAL_STREAM_BOOTSTRAP: boolish.default(false),
    // TIDAL-only mode: drop the yt-dlp fallbacks entirely, so every track that plays
    // is lossless and the catalog is exactly TIDAL's. Operations that TIDAL can't
    // serve return empty instead of silently degrading to YouTube. Requires
    // TIDAL_ENABLED — strict without a source would leave nothing to play, so
    // `tidalStrict()` reports false unless both are set.
    TIDAL_STRICT: boolish.default(false),

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
