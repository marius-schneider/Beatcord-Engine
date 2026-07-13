import { expect, test } from "bun:test";

import { type NarratorEvent, type NarratorLang, type NarratorStyle, pickPhrase } from "./narrator-phrases";

const LANGS: NarratorLang[] = ["de", "en"];
const STYLES: NarratorStyle[] = ["club", "radio", "chill", "meme", "pro"];
const EVENTS: NarratorEvent[] = ["start", "drop", "bigTransition", "queueLow", "queueEmpty"];

test("every lang × style × event yields a non-empty line", () => {
    for (const lang of LANGS) {
        for (const style of STYLES) {
            for (const event of EVENTS) {
                const line = pickPhrase(lang, style, event, { title: "Traum", artist: "Cro", bpm: 122 });
                expect(line, `${lang}/${style}/${event}`).toBeTruthy();
                expect(line!.length).toBeGreaterThan(0);
            }
        }
    }
});

test("placeholders are filled and leave no empty braces or double spaces", () => {
    const line = pickPhrase("en", "radio", "bigTransition", { title: "Traum", artist: "Cro" }, 0);
    // radio/bigTransition seed 0 is the "Up next: {title} by {artist}." template.
    expect(line).toBe("Up next: Traum by Cro.");
    expect(line).not.toContain("{");
    expect(line).not.toContain("  ");
});

test("missing artist/bpm doesn't leave dangling words or punctuation", () => {
    // Force the template that uses {artist}; with no artist it must still read cleanly.
    const line = pickPhrase("en", "radio", "bigTransition", { title: "Traum" }, 0);
    expect(line).not.toContain("{");
    expect(line).not.toContain("  ");
    expect(line).not.toMatch(/\s[.,!?]/); // no " ." from an empty placeholder
});

test("rotation walks through the pool (different seeds → different lines when pool > 1)", () => {
    const a = pickPhrase("en", "meme", "drop", {}, 0);
    const b = pickPhrase("en", "meme", "drop", {}, 1);
    const c = pickPhrase("en", "meme", "drop", {}, 2);
    // The meme/drop pool has 3 entries → three consecutive seeds give three distinct lines.
    expect(new Set([a, b, c]).size).toBe(3);
});

test("seed wraps around the pool deterministically", () => {
    const first = pickPhrase("de", "club", "drop", {}, 0);
    const wrapped = pickPhrase("de", "club", "drop", {}, 3); // pool size 3 → 3 % 3 = 0
    expect(wrapped).toBe(first);
});

test("negative/large seeds stay in range (no crash, valid line)", () => {
    expect(pickPhrase("en", "pro", "start", {}, -7)).toBeTruthy();
    expect(pickPhrase("en", "pro", "start", {}, 9999)).toBeTruthy();
});
