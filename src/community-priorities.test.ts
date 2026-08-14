import { describe, expect, test } from "bun:test";

import { assessCommunityPriorities, finalizeCommunityPriorities } from "./community-priorities";
import { planSessionJourney } from "./session-journey";

const journey = planSessionJourney({
    phase: "build",
    currentEnergy: 0.5,
    targetEnergy: 0.72,
    recentEnergies: [0.4, 0.46, 0.5],
    sessionAgeMinutes: 16,
    peakReached: false,
    userSkips: 0,
    userLikes: 1,
    fatigue: { total: 0.2, energyFlatness: 0.1, vocalFatigue: 0.2 },
});

const strong = () => ({
    complexity: 0.72,
    confidence: 0.88,
    compatibility: 0.84,
    routeFutureScore: 0.8,
    beat: 92,
    downbeat: 88,
    phrase: 86,
    structure: 82,
    vocals: 90,
    candidateEnergy: journey.nextTargetEnergy,
    journey,
});

describe("community priority policy", () => {
    test("strong musical evidence supports a complex transition", () => {
        const result = assessCommunityPriorities(strong());
        expect(result.eligible).toBe(true);
        expect(result.overall).toBeGreaterThan(0.75);
        expect(result.reasons.join(" ")).toContain("Track selection".toLowerCase().slice(0, 5));
    });

    test("technical complexity is rejected at a weak musical moment", () => {
        const result = assessCommunityPriorities({ ...strong(), phrase: 10, downbeat: 12, beat: 20 });
        expect(result.eligible).toBe(false);
        expect(result.reasons.join(" ")).toContain("musical moment too weak");
    });

    test("simple transitions remain available as safety fallbacks", () => {
        const result = assessCommunityPriorities({
            ...strong(),
            complexity: 0.08,
            confidence: 0.15,
            phrase: 10,
            downbeat: 10,
            structure: 15,
        });
        expect(result.eligible).toBe(true);
    });

    test("actual phrase cues beat fixed timestamp fallbacks", () => {
        const base = assessCommunityPriorities(strong());
        const phrase = finalizeCommunityPriorities(base, { aGrid: "phrase", bGrid: "bar" }, 0.9);
        const fallback = finalizeCommunityPriorities(base, { aGrid: "target", bGrid: "start" }, null);
        expect(phrase.musicalMoment).toBeGreaterThan(fallback.musicalMoment);
        expect(phrase.fixedTimestampFallback).toBe(false);
        expect(fallback.fixedTimestampFallback).toBe(true);
    });
});
