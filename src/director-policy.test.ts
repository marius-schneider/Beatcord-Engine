import { describe, expect, test } from "bun:test";
import {
    applyHardGates,
    assessStemReconstruction,
    assessUnifiedQuality,
    decideDirectorPolicy,
    optimizeTransitionParameters,
    orderDirectorQueue,
    routeTrackRequest,
    stemActivationGains,
    TailBus,
    transitionPhaseAt,
} from "./director-policy";
import type { TrackProfile } from "./track-profile";

const plan = { type: "acapella" as const, fadeSec: 8, eqSweep: true, tempoRatio: 1.02, reason: "stem mix" };
function profile(trackId: string, bpm: number): TrackProfile {
    return {
        trackId,
        bpm,
        bpmConfidence: 0.9,
        key: "8A",
        mode: "minor",
        keyConfidence: 0.9,
        genres: [],
        energy: bpm / 200,
        valence: 0.5,
        danceability: 0.7,
        acousticness: 0.2,
        vocalness: 0.3,
        intensity: 0.6,
        complexity: 0.5,
        loudness: -14,
        dynamicRange: 8,
        beatGrid: null,
        sections: [],
        vocalRegions: [],
        confidence: { beatGrid: 0.9, phrase: 0.9, key: 0.9, structure: 0.9, vocals: 0.9, stems: 0.9, overall: 0.9 },
        provenance: {},
    };
}

describe("director policy engine", () => {
    test("removes failed candidates before scoring and uses a final quality gate", () => {
        expect(
            applyHardGates([
                {
                    value: "stem",
                    expectedQuality: 1,
                    uncertainty: 0,
                    capabilityAllowed: true,
                    qualityApproved: true,
                    queueAllowed: true,
                    songIntegrityPreserved: true,
                    stemQuality: 0.31,
                },
            ]).eligible,
        ).toHaveLength(0);
        const safe = assessUnifiedQuality({
            clippingRisk: 0.1,
            loudnessDiscontinuity: 0.1,
            spectralCollision: 0.1,
            vocalCollision: 0.1,
            phaseRisk: 0.1,
            stretchArtifacts: 0.1,
            stemArtifacts: 0.1,
            rhythmicMismatch: 0.1,
        });
        const unsafe = assessUnifiedQuality({ ...safe, clippingRisk: 1 });
        expect(safe.approved).toBe(true);
        expect(unsafe.approved).toBe(false);
    });

    test("checks stem reconstruction, crossfades activation and detaches tails", () => {
        const stems = assessStemReconstruction({
            originalRms: 1,
            reconstructedRms: 0.98,
            correlation: 0.95,
            spectralError: 0.08,
        });
        expect(stems.approved).toBe(true);
        expect(stemActivationGains(0)).toEqual({ original: 1, reconstructed: 0 });
        expect(stemActivationGains(1)).toEqual({ original: 0, reconstructed: 1 });
        expect(transitionPhaseAt(17, 16, true).phase).toBe("tail");
        const bus = new TailBus();
        bus.add({ id: "echo", sourceDeck: "A", endsAtSessionSec: 12, gain: 0.8 });
        expect(bus.activeAt(10)).toHaveLength(1);
        expect(bus.activeAt(12)).toHaveLength(0);
    });

    test("optimizes only bounded musical parameters", () => {
        const result = optimizeTransitionParameters((candidate) =>
            candidate.durationBeats === 16 && candidate.crossfadeCurve === "s-curve" ? 1 : 0.5,
        );
        expect(result.parameters).toMatchObject({ durationBeats: 16, crossfadeCurve: "s-curve" });
        expect(result.evaluated).toBeLessThanOrEqual(18);
    });

    test("keeps explicit order and routes timed requests through bridges when possible", () => {
        const ordered = orderDirectorQueue(
            [
                { trackId: "explicit", origin: "explicit" },
                { trackId: "weak", origin: "auto" },
                { trackId: "strong", origin: "auto" },
            ],
            (from, to) => (from === "explicit" && to === "strong" ? 1 : 0.2),
        );
        expect(ordered.map((item) => item.trackId)).toEqual(["explicit", "strong", "weak"]);
        const routed = routeTrackRequest(
            { id: "r", trackId: "z", requestedBy: "guest", intent: { kind: "within", minutes: 10 }, allowBridge: true },
            "a",
            [profile("a", 100), profile("bridge", 115), profile("z", 130)],
            0,
        );
        expect(routed.route.at(-1)).toBe("z");
        expect(routed.onTime).toBe(true);
    });

    test("keeps policy separate from DSP and applies capability fallback last", () => {
        const quality = assessUnifiedQuality({
            clippingRisk: 0.05,
            loudnessDiscontinuity: 0.05,
            spectralCollision: 0.05,
            vocalCollision: 0.05,
            phaseRisk: 0.05,
            stretchArtifacts: 0.05,
            stemArtifacts: 0.05,
            rhythmicMismatch: 0.05,
        });
        const decision = decideDirectorPolicy({
            requestedPlan: plan,
            experience: "party",
            capabilities: {
                rawPcm: false,
                dualDeck: false,
                preciseSeek: false,
                playbackRate: false,
                pitchShift: false,
                crossfade: false,
                eq: false,
                effects: false,
                stemSeparation: false,
                offlineAnalysis: false,
            },
            quality,
            queueAllows: true,
            songIntegrityPreserved: true,
            stemReconstruction: assessStemReconstruction({
                originalRms: 1,
                reconstructedRms: 1,
                correlation: 0.95,
                spectralError: 0.05,
            }),
        });
        expect(decision.intent).toMatchObject({ experience: "party", requestedType: "acapella" });
        expect(decision.plan.type).toBe("cut");
        expect(decision.capability.mode).toBe("native-ordering");
    });
});
