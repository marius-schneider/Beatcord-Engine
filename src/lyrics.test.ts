import { expect, test } from "bun:test";

import { activeLineIndex, parseLrc, titleVariants } from "./lyrics";
import { cleanTrackMeta } from "./trackmeta";

test("cleanTrackMeta strips YouTube junk and splits artist - title", () => {
    expect(cleanTrackMeta("Cro - Traum (Lyrics)", "SomeChannel")).toEqual({ artist: "Cro", title: "Traum" });
    expect(
        cleanTrackMeta("The Rolling Stones - (I Can't Get No) Satisfaction (Official Lyric Video)", "ABKCOVEVO"),
    ).toEqual({
        artist: "The Rolling Stones",
        title: "(I Cant Get No) Satisfaction",
    });
    expect(cleanTrackMeta("Robbie Williams - Candy (Audio)", "BestOF Music")).toEqual({
        artist: "Robbie Williams",
        title: "Candy",
    });
});

test("cleanTrackMeta falls back to uploader (minus Topic/VEVO) when no dash", () => {
    expect(cleanTrackMeta("Candy", "Robbie Williams - Topic")).toEqual({ artist: "Robbie Williams", title: "Candy" });
    expect(cleanTrackMeta("Some Song", "ArtistVEVO")).toEqual({ artist: "Artist", title: "Some Song" });
});

test("cleanTrackMeta drops a feat. clause", () => {
    expect(cleanTrackMeta("Pitbull - Feel This Moment ft. Christina Aguilera", null)).toEqual({
        artist: "Pitbull",
        title: "Feel This Moment",
    });
});

test("cleanTrackMeta never returns an empty title", () => {
    expect(cleanTrackMeta("(Official Video)", null).title).toBe("(Official Video)");
});

test("parseLrc parses [mm:ss.xx] timestamps to ascending ms lines", () => {
    const lines = parseLrc("[00:18.98] one\n[00:22.55] two\n[01:05.00] three");
    expect(lines).toEqual([
        { timeMs: 18980, text: "one" },
        { timeMs: 22550, text: "two" },
        { timeMs: 65000, text: "three" },
    ]);
});

test("parseLrc ignores metadata tags and keeps blank lyric lines", () => {
    const lines = parseLrc("[ar:Artist]\n[ti:Title]\n[00:10.00]\n[00:12.00] sing");
    expect(lines).toEqual([
        { timeMs: 10000, text: "" },
        { timeMs: 12000, text: "sing" },
    ]);
});

test("parseLrc handles a line with multiple timestamps", () => {
    const lines = parseLrc("[00:05.00][00:30.00] chorus");
    expect(lines).toEqual([
        { timeMs: 5000, text: "chorus" },
        { timeMs: 30000, text: "chorus" },
    ]);
});

test("activeLineIndex finds the last line at or before the position", () => {
    const lines = parseLrc("[00:10.00] a\n[00:20.00] b\n[00:30.00] c");
    expect(activeLineIndex(lines, 0)).toBe(-1); // before first
    expect(activeLineIndex(lines, 10000)).toBe(0);
    expect(activeLineIndex(lines, 19999)).toBe(0);
    expect(activeLineIndex(lines, 20000)).toBe(1);
    expect(activeLineIndex(lines, 999999)).toBe(2); // past end → last line
});

test("activeLineIndex on empty lyrics returns -1", () => {
    expect(activeLineIndex([], 5000)).toBe(-1);
});

test("titleVariants produces progressively looser forms for messy titles", () => {
    const v = titleVariants("Higher Power (Official Video) feat. Someone");
    // Most specific first; then without feat; then without the parenthetical.
    expect(v[0]).toBe("Higher Power (Official Video) feat. Someone");
    expect(v).toContain("Higher Power (Official Video)"); // feat clause dropped
    expect(v).toContain("Higher Power"); // brackets dropped too
});

test("titleVariants strips a trailing ' - Radio Edit' suffix", () => {
    expect(titleVariants("Song Title - Radio Edit")).toContain("Song Title");
});

test("titleVariants de-dupes and never emits empties", () => {
    const v = titleVariants("Clean Title");
    expect(v).toEqual(["Clean Title"]); // nothing to strip → single variant
    expect(v.every((s) => s.length > 0)).toBe(true);
});
