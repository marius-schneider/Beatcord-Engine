/**
 * Tiny logger with levels and colourised, timestamped output. Shared by the engine
 * and the services (HTTP/WS) built on top of it. Lifted verbatim from the bot —
 * the engine is the canonical home now; the bot re-exports this.
 */
const COLORS = {
    reset: "\x1b[0m",
    dim: "\x1b[2m",
    underline: "\x1b[4m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
} as const;

/**
 * Manual colour helpers for log messages — wrap a value to accent it inside an
 * otherwise plain string, e.g. ``log.success(`Listening on ${c.url(addr)}`)``.
 * A string that already carries a `c.*` accent is skipped by the auto-highlighter
 * below, so the two never double-wrap.
 */
export const c = {
    /** A URL or address — cyan + underlined (the screenshot's link style). */
    url: (s: string) => `${COLORS.cyan}${COLORS.underline}${s}${COLORS.reset}`,
    /** A number / metric (port, duration, size) — green. */
    num: (s: string | number) => `${COLORS.green}${s}${COLORS.reset}`,
    /** A file/path or config key — dim. */
    path: (s: string) => `${COLORS.dim}${s}${COLORS.reset}`,
    /** A generic salient value — bold-ish via colour (yellow). */
    value: (s: string | number) => `${COLORS.yellow}${s}${COLORS.reset}`,
} as const;

const ESC = "\x1b";

/**
 * Auto-accent the salient bits of a plain log string so they stand out: URLs
 * (cyan + underline), numbers with a unit or bare ports (green), and ./relative
 * paths (dim). Strings that already contain an escape code — i.e. a manual `c.*`
 * accent — are returned untouched so the two approaches never collide.
 */
/**
 * One combined pattern, scanned in a SINGLE pass so each span is accented exactly
 * once — a multi-stage replace would let a later rule re-match a span an earlier
 * rule already wrapped in ANSI. Order of the alternation = precedence: URL first
 * (so the dots/numbers inside it aren't grabbed by the path/number rules), then
 * relative paths, then numbers-with-unit.
 */
const HIGHLIGHT =
    /(?<url>(?:https?|wss?):\/\/[^\s)]+)|(?<path>(?<![\w./])\.{1,2}\/[\w./-]+)|(?<num>\b\d+(?:\.\d+)?(?:ms|s|m|h|[kKmMgG]?[bB]ps|[kKmMgG]?[bB]|%|x)\b)/g;

function highlight(text: string): string {
    if (text.includes(ESC)) return text; // already styled by a c.* helper
    return text.replace(HIGHLIGHT, (m, ...rest) => {
        // Named groups are the last callback arg; tells us which alternative matched.
        const groups = rest[rest.length - 1] as Record<string, string | undefined>;
        if (groups.url) return c.url(m);
        if (groups.path) return c.path(m);
        return c.num(m);
    });
}

type Level = "debug" | "info" | "success" | "warn" | "error";

/**
 * Each level renders as a coloured glyph prefix (à la `[12:41:37] ✓ message`)
 * rather than a word label: `›` running/info, `✓` success, `⚠` warning, `✗` error,
 * `·` debug. `order` gates output against LOG_LEVEL (success sits at info level).
 */
const LEVEL_META: Record<Level, { color: string; symbol: string; order: number }> = {
    debug: { color: COLORS.dim, symbol: "·", order: 0 },
    info: { color: COLORS.cyan, symbol: "›", order: 1 },
    success: { color: COLORS.green, symbol: "✓", order: 1 },
    warn: { color: COLORS.yellow, symbol: "⚠", order: 2 },
    error: { color: COLORS.red, symbol: "✗", order: 3 },
};

/** Min level read from LOG_LEVEL once at module load (engine has no bot config). */
const minOrder =
    LEVEL_META[(process.env.LOG_LEVEL as Level) in LEVEL_META ? (process.env.LOG_LEVEL as Level) : "info"].order;

function write(level: Level, _scope: string, args: unknown[]) {
    const meta = LEVEL_META[level];
    if (meta.order < minOrder) return;
    // Time only (HH:MM:SS), dim + bracketed, then the coloured level glyph.
    const ts = new Date().toTimeString().slice(0, 8);
    const prefix = `${COLORS.dim}[${ts}]${COLORS.reset} ${meta.color}${meta.symbol}${COLORS.reset}`;
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    // Accent salient bits of STRING args only — objects/Errors pass through so
    // their inspection/stack output stays intact.
    fn(prefix, ...args.map((a) => (typeof a === "string" ? highlight(a) : a)));
}

export function createLogger(scope: string) {
    return {
        debug: (...args: unknown[]) => write("debug", scope, args),
        info: (...args: unknown[]) => write("info", scope, args),
        success: (...args: unknown[]) => write("success", scope, args),
        warn: (...args: unknown[]) => write("warn", scope, args),
        error: (...args: unknown[]) => write("error", scope, args),
    };
}

export type Logger = ReturnType<typeof createLogger>;
export const logger = createLogger("Beatcord");
