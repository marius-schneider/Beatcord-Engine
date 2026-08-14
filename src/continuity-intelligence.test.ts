import { describe, expect, test } from "bun:test";

import { planBacktiming } from "./backtiming";
import { planEmergencyContinuity } from "./emergency-continuity";
import { scoreLoopability } from "./loopability";
import { assessPayoffCut } from "./musical-tension";
import type { TrackProfile, TrackSection } from "./track-profile";

const section = (
    type: TrackSection["type"],
    start: number,
    end: number,
    energy: number,
    vocals = 0.1,
): TrackSection => ({
    type,
    start,
    end,
    energy,
    vocals,
    drums: 0.8,
    bass: 0.7,
    entryQuality: 0.8,
    exitQuality: 0.8,
    phraseConfidence: 0.9,
    structureConfidence: 0.9,
});

const profile = {
    trackId: "a",
    keyConfidence: 0.9,
    complexity: 0.25,
    sections: [
        section("break", 0, 16, 0.35),
        section("build", 16, 32, 0.58),
        section("drop", 32, 48, 0.96),
        section("outro", 48, 64, 0.4),
    ],
    confidence: { beatGrid: 0.9 },
} as TrackProfile;

describe("continuity intelligence", () => {
    test("blocks a transition during high anticipation until its payoff ends", () => {
        const result = assessPayoffCut(profile, 24);
        expect(result.blocked).toBe(true);
        expect(result.payoffAtSec).toBe(48);
        expect(result.anticipation).toBeGreaterThan(0.9);
    });

    test("loopability includes harmony, vocals and seam similarity", () => {
        const safe = scoreLoopability(profile, 0);
        const vocal = { ...profile, sections: [{ ...profile.sections[0]!, vocals: 0.95 }] } as TrackProfile;
        expect(safe.total).toBeGreaterThan(scoreLoopability(vocal, 0).total);
        expect(safe.beatStability).toBeGreaterThan(0.8);
    });

    test("emergency continuity retries inside a hard loop deadline", () => {
        const result = planEmergencyContinuity({
            current: profile,
            nextReady: false,
            currentPositionSec: 60,
            maxLoopSec: 18,
            fallbackTrackId: "c",
        });
        expect(result.mode).toBe("loop-retry");
        expect(result.hardDeadlineSec).toBe(78);
        expect(result.maxLoopSec).toBe(18);
    });

    test("backtiming anchors the requested drop and plans preceding tracks backwards", () => {
        const now = 1_000_000;
        const target = now + 460_000;
        const result = planBacktiming(
            now,
            { id: "midnight", targetEpochMs: target, targetTrackId: "c", kind: "drop", momentOffsetSec: 30 },
            [
                { trackId: "a", durationSec: 240, transitionOverlapSec: 10 },
                { trackId: "b", durationSec: 210, transitionOverlapSec: 10 },
                { trackId: "c", durationSec: 200 },
            ],
        );
        expect(result.projectedMomentEpochMs).toBe(target);
        expect(result.schedule.map((entry) => entry.trackId)).toEqual(["a", "b", "c"]);
        expect(result.status).toBe("exact");
    });
});
