import { expect, test } from "bun:test";

import { buildTrackProfile } from "./track-profile";
import { allowedOverrideRegions, overrideMatches, validateTransitionOverride } from "./transition-override";

test("validates and normalizes a bounded one-shot override", () => {
    const result = validateTransitionOverride(
        {
            transitionType: "filter",
            fadeSec: 12,
            mixOutPointSec: 140.5,
            alignment: "phrase",
            scope: "next",
        },
        1234,
    );
    expect(result).toEqual({
        ok: true,
        override: {
            version: 1,
            id: "override-1234",
            createdAtMs: 1234,
            scope: "next",
            transitionType: "filter",
            fadeSec: 12,
            mixOutPointSec: 140.5,
            alignment: "phrase",
            neverMixRegions: [],
        },
    });
});

test("rejects unsafe ranges and contradictory stem intent", () => {
    expect(validateTransitionOverride({ fadeSec: 0 }).ok).toBe(false);
    expect(validateTransitionOverride({ mixInPointSec: -1 }).ok).toBe(false);
    expect(validateTransitionOverride({ transitionType: "acapella", stemUsage: "forbid" }).ok).toBe(false);
    expect(validateTransitionOverride({}).ok).toBe(false);
});

test("pair targeting prevents an override leaking into another transition", () => {
    const result = validateTransitionOverride({ fromTrackId: "a", toTrackId: "b", fadeSec: 8 });
    if (!result.ok) throw new Error(result.error);
    expect(overrideMatches(result.override, "a", "b")).toBe(true);
    expect(overrideMatches(result.override, "a", "c")).toBe(false);
    expect(overrideMatches(result.override, "x", "b")).toBe(false);
});

test("never-mix and preserve-section rules remove forbidden outgoing regions", () => {
    const profile = buildTrackProfile(
        { id: "a", title: "a", durationMs: 120_000 },
        {
            grid: null,
            genre: "edm",
            sections: [
                { startSec: 0, endSec: 20, kind: "intro", level: 0.2 },
                { startSec: 20, endSec: 50, kind: "body", level: 0.8 },
                { startSec: 50, endSec: 80, kind: "break", level: 0.4 },
                { startSec: 80, endSec: 120, kind: "outro", level: 0.3 },
            ],
        },
    );
    profile.sections.find((section) => section.type === "unknown")!.type = "chorus";
    const result = validateTransitionOverride({
        preserveSection: "chorus",
        neverMixRegions: [{ track: "current", start: 45, end: 80 }],
    });
    if (!result.ok) throw new Error(result.error);
    const allowed = allowedOverrideRegions(profile, "current", "out", result.override);
    expect(allowed.every((region) => region.start >= 50)).toBe(true);
    expect(allowed.some((region) => region.kind === "break")).toBe(false);
    expect(allowed.some((region) => region.kind === "outro")).toBe(true);
});
