import { expect, test } from "bun:test";

import { attributeFeedback } from "./feedback-attribution";

test("a near-instant skip after a complex move is attributed to the transition", () => {
    const result = attributeFeedback({
        afterTransitionMs: 1_800,
        skippedPositionRatio: 0.01,
        transitionType: "bassdrop",
        energyDelta: 0.08,
        repeatedGenreCount: 0,
    });
    expect(result.dominant).toBe("transition");
    expect(result.learnTransition).toBe(true);
    expect(result.learnTrack).toBe(false);
});

test("a late skip deep into a track is track feedback, not transition feedback", () => {
    const result = attributeFeedback({
        afterTransitionMs: 180_000,
        skippedPositionRatio: 0.62,
        transitionType: "fade",
        energyDelta: 0.04,
    });
    expect(result.dominant).toBe("track");
    expect(result.learnTrack).toBe(true);
    expect(result.learnTransition).toBe(false);
});

test("a large energy cliff is treated as session mismatch", () => {
    const result = attributeFeedback({
        afterTransitionMs: 22_000,
        skippedPositionRatio: 0.12,
        transitionType: "blend",
        energyDelta: -0.55,
    });
    expect(result.dominant).toBe("session");
    expect(result.learnTrack).toBe(false);
    expect(result.learnTransition).toBe(false);
});

test("missing context stays uncertain and cannot update persistent taste", () => {
    const result = attributeFeedback({ afterTransitionMs: null, skippedPositionRatio: null });
    expect(result.confidence).toBeLessThan(0.6);
    expect(result.learnTrack).toBe(false);
    expect(result.learnTransition).toBe(false);
});
