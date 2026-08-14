import { describe, expect, test } from "bun:test";
import {
    autonomyPolicyForCohort,
    discoveryHalfLife,
    LONGITUDINAL_TASTE_LAB_V1,
    longitudinalLabSuccess,
    longitudinalSelfInfluence,
    meaningfulDiscoveryScore,
    tasteEvolutionAssessment,
} from "./longitudinal-taste-lab-v1";

describe("longitudinal taste lab v1", () => {
    test("requires a twelve-week first-class longitudinal study", () => {
        expect(LONGITUDINAL_TASTE_LAB_V1.minimumWeeks).toBe(12);
        expect(LONGITUDINAL_TASTE_LAB_V1.outcomes).toEqual(["satisfaction", "identity", "discovery", "autonomy"]);
    });
    test("tracks feedback-loop self-influence without declaring it automatically bad", () => {
        expect(longitudinalSelfInfluence({ algorithmGenerated: 6, voluntary: 2, editorial: 1, organic: 1 })).toEqual({
            ratio: 0.6,
            certaintyMultiplier: 0.7,
            automaticallyBad: false,
        });
    });
    test("values discoveries that survive beyond the initial recommendation", () => {
        const signals = {
            saved: true,
            replayAfterWeek: true,
            replayAfterMonth: true,
            voluntaryArtistExploration: true,
            playlistAdd: true,
        };
        expect(meaningfulDiscoveryScore(signals)).toBe(1);
        expect(discoveryHalfLife(signals)).toBe("month");
    });
    test("distinguishes user-confirmed evolution from contamination", () => {
        expect(
            tasteEvolutionAssessment({ profileDrift: 0.4, userConfirmedChange: 0.35, profileIdentification: 0.8 })
                .state,
        ).toBe("confirmed-evolution");
        expect(
            tasteEvolutionAssessment({ profileDrift: 0.4, userConfirmedChange: 0, profileIdentification: 0.3 })
                .correctionRequired,
        ).toBeTrue();
    });
    test("does not impose one autonomy policy on every cohort", () => {
        expect(autonomyPolicyForCohort("active-explorer").algorithmicShareTarget).toBeLessThan(
            autonomyPolicyForCohort("algorithm-led").algorithmicShareTarget,
        );
    });
    test("requires satisfaction, discovery and profile gains without agency loss", () => {
        expect(
            longitudinalLabSuccess({
                satisfactionGain: 0.1,
                discoveryGain: 0.1,
                profileAccuracyGain: 0.1,
                agencyChange: 0,
            }).success,
        ).toBeTrue();
        expect(
            longitudinalLabSuccess({
                satisfactionGain: 0.1,
                discoveryGain: 0.1,
                profileAccuracyGain: 0.1,
                agencyChange: -0.1,
            }).success,
        ).toBeFalse();
    });
    test("separates voluntary behavior from passive autoplay", () => {
        expect(LONGITUDINAL_TASTE_LAB_V1.voluntarySignals).toContain("user-search");
        expect(LONGITUDINAL_TASTE_LAB_V1.voluntarySignals).not.toContain("passive-autoplay");
    });
    test("keeps long-term anti-metrics visible", () => {
        expect(LONGITUDINAL_TASTE_LAB_V1.antiMetrics).toContain("repetition-fatigue");
        expect(LONGITUDINAL_TASTE_LAB_V1.monthlyProfileActions).toContain("correct");
    });
});
