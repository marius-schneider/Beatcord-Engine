import { describe, expect, test } from "bun:test";
import {
    dataPolicy,
    decisionProvenance,
    LOCAL_FIRST_DATA_BOUNDARY,
    mayLearnFrom,
    narrationDecision,
    normalizedTasteBlend,
    reliabilityPriority,
    sanitizeCrowdContribution,
    tasteLearningPolicy,
    updateMusicRelation,
} from "./taste-privacy-governance";

describe("taste and privacy governance", () => {
    test("isolates normal, party, guest and private learning", () => {
        expect(tasteLearningPolicy("normal").bucket).toBe("personal");
        expect(tasteLearningPolicy("party").bucket).toBe("party");
        expect(tasteLearningPolicy("guest").expiresWithSession).toBe(true);
        expect(tasteLearningPolicy("private").persistent).toBe(false);
    });

    test("honors explicit don't-learn scopes", () => {
        const policy = tasteLearningPolicy("normal", ["playlist", "device"]);
        expect(mayLearnFrom(policy, ["track"])).toBe(true);
        expect(mayLearnFrom(policy, ["playlist"])).toBe(false);
        expect(mayLearnFrom(tasteLearningPolicy("guest"), [])).toBe(false);
    });

    test("normalizes controlled taste-bucket blends", () => {
        const blend = normalizedTasteBlend({ personal: 2, family: 1, guest: -5 });
        expect(blend.personal).toBeCloseTo(2 / 3);
        expect(blend.family).toBeCloseTo(1 / 3);
        expect(blend.guest).toBe(0);
    });

    test("keeps raw and sensitive data behind the local-first boundary", () => {
        expect(LOCAL_FIRST_DATA_BOUNDARY.deviceOnly).toContain("raw-history");
        expect(LOCAL_FIRST_DATA_BOUNDARY.transfer).toBe("minimal-representations-only");
        expect(dataPolicy("session", "account")).toEqual({
            retention: "session",
            sharing: "none",
            rawHistoryLeavesDevice: false,
        });
    });

    test("shares only bounded crowd-session representations", () => {
        const input = sanitizeCrowdContribution({
            participantId: "guest-1",
            sessionVector: [2, -2, 0.2],
            hardExclusions: ["Rock", "rock"],
            familiarity: 4,
        });
        expect(input.sessionVector).toEqual([1, -1, 0.2]);
        expect(input.hardExclusions).toEqual(["rock"]);
        expect(input.familiarity).toBe(1);
        expect(input).not.toHaveProperty("history");
    });

    test("makes recommendation provenance visible", () => {
        const provenance = decisionProvenance([
            { source: "personal", weight: 0.3, reason: "liked artists" },
            { source: "crowd", weight: 0.8, reason: "party vote" },
        ]);
        expect(provenance.dominantSource).toBe("crowd");
        expect(provenance.contributions).toHaveLength(2);
    });

    test("allows explicit corrections to replace behavioral inference", () => {
        const result = updateMusicRelation(
            { entityId: "x", relation: "like", source: "behavioral", correctable: true },
            { entityId: "x", relation: "never-play", source: "explicit" },
        );
        expect(result.supersededBehavioralInference).toBe(true);
        expect(result.relation.relation).toBe("never-play");
    });

    test("narrates briefly only inside safe musical windows and mode budgets", () => {
        const window = { instrumental: true, foreground: 0.1, lyricDensity: 0, musicalImportance: 0.2, usedBudget: 0 };
        expect(narrationDecision("party", window).allowed).toBe(true);
        expect(narrationDecision("pure-music", window).allowed).toBe(false);
        expect(narrationDecision("chill", { ...window, foreground: 0.9 }).reason).toBe("protect-musical-moment");
    });

    test("prioritizes reliable playback and prepared fallbacks over novelty", () => {
        expect(reliabilityPriority({ playbackStable: false, fallbackReady: true, aiNoveltyGain: 1 })).toBe("stabilize");
        expect(reliabilityPriority({ playbackStable: true, fallbackReady: false, aiNoveltyGain: 1 })).toBe(
            "prepare-fallback",
        );
        expect(reliabilityPriority({ playbackStable: true, fallbackReady: true, aiNoveltyGain: 0.2 })).toBe(
            "allow-ai-novelty",
        );
    });
});
