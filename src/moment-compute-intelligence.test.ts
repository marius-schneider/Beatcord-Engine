import { describe, expect, test } from "bun:test";
import {
    BEATCORD_2026_DIFFERENTIATION,
    backtimeTargetMoment,
    computeBudgetForRisk,
    confidenceNativeExplanation,
    horizonConfidence,
    INNOVATION_PRIORITY_MATRIX,
    learnCrowdRecipe,
    momentFirstRecommendation,
    rollingHorizonControl,
    STRONGEST_INNOVATION,
    similarMixRecipes,
    transitionMotifScore,
} from "./moment-compute-intelligence";

describe("moment and compute intelligence", () => {
    test("scores reusable transition motifs beyond exact track pairs", () => {
        expect(
            transitionMotifScore({
                fromMomentType: "outro",
                toMomentType: "intro",
                roleHandoff: "bass-swap",
                tempoFit: 1,
                phraseFit: 1,
                semanticFit: 0.8,
                crowdFit: 0.8,
                feedback: 0.9,
            }),
        ).toBeGreaterThan(0.85);
    });
    test("retrieves structurally and role-similar mix recipes", () => {
        const query = { structural: [1], rhythmic: [1], harmonic: [1], roleHandoff: [1] };
        expect(
            similarMixRecipes(query, [
                { id: "near", embedding: query },
                { id: "far", embedding: { structural: [0], rhythmic: [0], harmonic: [0], roleHandoff: [0] } },
            ]),
        ).toEqual(["near", "far"]);
    });
    test("learns crowd vocal-swap taste under session/privacy retention", () => {
        expect(learnCrowdRecipe(true, true, 0.9)).toEqual({ recognizableVocalSwapAffinity: 0.9, retention: "session" });
        expect(learnCrowdRecipe(false, true, 0.8).retention).toBe("persistent");
    });
    test("backtimes track and transition to a desired chorus/drop moment", () => {
        expect(
            backtimeTargetMoment(
                { track: "b", moment: "chorus", desiredSessionTime: 600, momentTimeInTrack: 72 },
                16,
                8,
            ),
        ).toEqual({ trackStartSessionTime: 528, transitionStartSessionTime: 504 });
    });
    test("selects the best next musical moment rather than only track fit", () => {
        const result = momentFirstRecommendation([
            { trackId: "track-fit", trackFit: 1, momentFit: 0.3, timeToMomentFit: 0.3, transitionToMomentFit: 0.3 },
            { trackId: "moment-fit", trackFit: 0.8, momentFit: 1, timeToMomentFit: 0.9, transitionToMomentFit: 0.9 },
        ]);
        expect(result.selected).toBe("moment-fit");
        expect(result.selectsMomentNotOnlyTrack).toBe(true);
    });
    test("simulates 3–6 tracks, executes one action and replans", () => {
        const result = rollingHorizonControl([
            {
                trackIds: ["a", "b", "c", "d", "e", "f", "g"],
                energies: [0.5, 0.7, 0.9],
                genreOptions: 3,
                crowdFamiliarity: 0.8,
                bridgeUtility: 0.9,
                confidence: 0.8,
            },
        ]);
        expect(result).toEqual({
            selectedFirstAction: "a",
            simulatedTracks: 6,
            replanAfterAction: true,
            horizonCapped: true,
        });
    });
    test("degrades long-horizon confidence explicitly", () => {
        expect(horizonConfidence(1)).toBe("high");
        expect(horizonConfidence(3)).toBe("medium");
        expect(horizonConfidence(10)).toBe("low");
    });
    test("spends compute on medium/high risk and simplifies extreme risk", () => {
        expect(computeBudgetForRisk(0.1).path).toBe("fast");
        expect(computeBudgetForRisk(0.7)).toMatchObject({
            path: "hq-multi-candidate",
            budget: { previewRenders: 3, stemQualityTier: 2 },
        });
        expect(computeBudgetForRisk(0.95).path).toBe("simpler-transition");
    });
    test("explains confidence and conservative fallbacks as intelligence", () => {
        const result = confidenceNativeExplanation({
            transition: 0.95,
            beatgrid: 0.8,
            stemQuality: 0.6,
            fallback: "classic EQ mix",
            reason: "stem separation quality is uncertain",
        });
        expect(result.ratings).toEqual({ transition: "excellent", beatgrid: "high", stemQuality: "medium" });
        expect(result.fallbackPresentedAsIntelligence).toBe(true);
    });
    test("records build/prototype/watch priorities and integrated differentiation", () => {
        expect(INNOVATION_PRIORITY_MATRIX.buildNow).toHaveLength(8);
        expect(INNOVATION_PRIORITY_MATRIX.prototype).toContain("moment-recommendation");
        expect(BEATCORD_2026_DIFFERENTIATION).toHaveLength(7);
        expect(STRONGEST_INNOVATION).toContain("role-by-role-mixing");
    });
});
