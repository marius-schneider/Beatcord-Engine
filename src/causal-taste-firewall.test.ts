import { describe, expect, test } from "bun:test";
import { causalPreferenceEvidence, causalPreferenceFirewall } from "./causal-taste-firewall";

describe("causal taste firewall", () => {
    test("weights explicit search more strongly than passive autoplay", () => {
        const chosen = causalPreferenceEvidence(
            {
                wasUserSelected: true,
                recommendationSource: "search",
                rankPosition: 1,
                contextSpecific: false,
                algorithmicRepeatCount: 1,
            },
            "search",
        );
        const autoplay = causalPreferenceEvidence(
            {
                wasUserSelected: false,
                recommendationSource: "autoplay",
                rankPosition: 1,
                contextSpecific: false,
                algorithmicRepeatCount: 1,
            },
            "completed",
        );
        expect(chosen.weight).toBe(1);
        expect(autoplay.weight).toBeLessThan(chosen.weight);
    });
    test("discounts repeated algorithmic exposure", () => {
        const once = causalPreferenceEvidence(
            {
                wasUserSelected: false,
                recommendationSource: "autoplay",
                rankPosition: 1,
                contextSpecific: false,
                algorithmicRepeatCount: 1,
            },
            "completed",
        );
        const thrice = causalPreferenceEvidence(
            {
                wasUserSelected: false,
                recommendationSource: "autoplay",
                rankPosition: 1,
                contextSpecific: false,
                algorithmicRepeatCount: 3,
            },
            "completed",
        );
        expect(thrice.weight).toBeLessThan(once.weight);
    });
    test("does not let the algorithm learn its own echo", () => {
        const evidence = causalPreferenceEvidence(
            {
                wasUserSelected: false,
                recommendationSource: "autoplay",
                rankPosition: 1,
                contextSpecific: false,
                algorithmicRepeatCount: 3,
            },
            "completed",
        );
        expect(causalPreferenceFirewall({ evidence, algorithmForced: true, sessionOnly: false })).toEqual({
            updateLongTerm: false,
            appliedWeight: 0,
            learnsOwnEcho: false,
        });
    });
    test("allows independent user choice into long-term taste", () => {
        const evidence = causalPreferenceEvidence(
            {
                wasUserSelected: true,
                recommendationSource: "search",
                rankPosition: 1,
                contextSpecific: false,
                algorithmicRepeatCount: 1,
            },
            "like",
        );
        expect(causalPreferenceFirewall({ evidence, algorithmForced: false, sessionOnly: false })).toMatchObject({
            updateLongTerm: true,
            learnsOwnEcho: false,
        });
    });
});
