import { describe, expect, test } from "bun:test";
import {
    AUTOMATIC_CORRECTION_HIERARCHY,
    activeTeachingPrompt,
    annotationValue,
    applyBeatConstraints,
    beatMeshMemory,
    CORRECTION_PROPAGATION_GRAPH,
    queryByCommittee,
    selectDjPulse,
    TOP_FIVE_IMPLEMENTATION,
    trustedCommunityCorrection,
} from "./active-beat-mesh-v2";

describe("active beat mesh v2", () => {
    const hypotheses = [
        { source: "full-mix" as const, bpm: 87, phase: 0, meter: 4, confidence: 0.89 },
        { source: "foundation" as const, bpm: 174, phase: 0.2, meter: 4, confidence: 0.91 },
    ];

    test("preserves competing rhythm hypotheses and maps disagreement", () => {
        const result = queryByCommittee(hypotheses);
        expect(result.primary?.bpm).toBe(174);
        expect(result.hypothesesPreserved).toBeTrue();
        expect(result.disagreement.tempoDisagreement).toBe(0.5);
    });

    test("asks only where annotation value is high", () => {
        expect(annotationValue({ uncertainty: 0.9, expectedTransitionUse: 0.8, downstreamDependencyCount: 8 })).toBe(
            0.72,
        );
        expect(activeTeachingPrompt({ mode: "normal", value: 1 }).visible).toBeFalse();
        expect(activeTeachingPrompt({ mode: "dj-power", value: 0.8, pulseOptions: [87, 174] }).actions).toContain(
            "tap-four-beats",
        );
    });

    test("applies reversible per-track constraints before neural retraining", () => {
        const corrected = applyBeatConstraints(hypotheses, [
            { type: "tempo-scale", time: 0, value: 2, source: "human", timestamp: 42, scope: "track", undoable: true },
        ]);
        expect(corrected.neuralModelRetrained).toBeFalse();
        expect(corrected.hypotheses[0]?.bpm).toBe(174);
        expect(corrected.correctionLayer).toBe("per-track-constraints");
    });

    test("propagates downbeat constraints to dependent timing systems", () => {
        expect(CORRECTION_PROPAGATION_GRAPH["downbeat-anchor"]).toContain("loop-safety");
        expect(AUTOMATIC_CORRECTION_HIERARCHY.at(-1)).toBe("ask-user");
    });

    test("persists correction source, interpretations and DJ pulse separately", () => {
        const memory = beatMeshMemory({
            trackId: "dnb",
            constraints: [],
            interpretations: [
                { bpm: 87, meter: 4, confidence: 0.89 },
                { bpm: 174, meter: 4, confidence: 0.91 },
            ],
            preferredDjPulse: 174,
        });
        expect(memory.reusable).toBeTrue();
        expect(selectDjPulse(memory.interpretations, memory.preferredDjPulse)).toEqual({
            musicalHypotheses: [87, 174],
            controlGrid: 174,
            preferenceSeparate: true,
        });
    });

    test("never blindly merges community interpretations", () => {
        const result = trustedCommunityCorrection([
            { bpm: 87, meter: 4, trust: 0.9 },
            { bpm: 174, meter: 4, trust: 0.9 },
        ]);
        expect(result.merge).toBeFalse();
        expect(result.blindMerge).toBeFalse();
        expect(result.interpretations).toHaveLength(2);
    });

    test("separates architecture, production, prototype and partner phases", () => {
        expect(TOP_FIVE_IMPLEMENTATION.architectureNow).toContain("confidence-calibration-api");
        expect(TOP_FIVE_IMPLEMENTATION.partnerFuture).toContain("os-anc-control");
    });
});
