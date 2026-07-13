import { expect, test } from "bun:test";

import { c, createLogger } from "./logger";

// Strip ANSI so assertions read the visible text, not the escape soup.
const RESET = "\x1b[0m";
const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

// `highlight` isn't exported, so exercise it through the public logger by
// capturing console output. The logger applies highlight() to string args.
function captureLog(fn: () => void): string {
    const orig = console.log;
    let out = "";
    console.log = (...args: unknown[]) => {
        out = args.join(" ");
    };
    try {
        fn();
    } finally {
        console.log = orig;
    }
    return out;
}

const log = createLogger("test");

test("highlights a URL with a single clean accent (no double-wrap)", () => {
    const out = captureLog(() => log.info("listening on http://127.0.0.1:7788"));
    // The visible text is preserved exactly.
    expect(strip(out)).toContain("listening on http://127.0.0.1:7788");
    // Exactly one cyan + one underline opener for the URL — not the doubled
    // "[36m[36m" the multi-stage replace produced.
    expect((out.match(/\x1b\[36m/g) ?? []).length).toBe(2); // glyph color + url color
    expect((out.match(/\x1b\[4m/g) ?? []).length).toBe(1); // url underline, once
});

test("highlights a number-with-unit (duration) green", () => {
    const out = captureLog(() => log.success("Build completed in 21.3s"));
    expect(strip(out)).toContain("Build completed in 21.3s");
    expect(out).toContain(`\x1b[32m21.3s${RESET}`);
});

test("does not touch a string already carrying a c.* accent", () => {
    const styled = `done ${c.url("http://x")}`;
    const out = captureLog(() => log.info(styled));
    // Only the one accent from c.url — highlight() bailed out (string had ESC).
    expect((out.match(/\x1b\[4m/g) ?? []).length).toBe(1);
});

test("leaves non-string args (objects/Errors) untouched", () => {
    const err = new Error("boom");
    const orig = console.error;
    let received: unknown;
    console.error = (...args: unknown[]) => {
        received = args[args.length - 1];
    };
    try {
        log.error("failed:", err);
    } finally {
        console.error = orig;
    }
    expect(received).toBe(err); // same Error instance, not stringified
});

test("c helpers wrap and reset", () => {
    expect(c.num(3000)).toContain("3000");
    expect(c.num(3000).endsWith(RESET)).toBe(true);
    expect(c.url("http://x")).toContain("\x1b[4m"); // underlined
});
