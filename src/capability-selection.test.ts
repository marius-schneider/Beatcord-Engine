import { describe, expect, test } from "bun:test";
import {
    FULL_PLAYBACK_CAPABILITIES,
    gatePlanByCapabilities,
    LazyCompatibilityGraph,
    planSonicRoute,
    riskAwareUtility,
    selectTracksTwoStage,
} from "./capability-selection";
import { MusicDirector } from "./music-director";
import type { TrackProfile } from "./track-profile";

function profile(trackId: string, bpm: number, energy: number, confidence = 0.9): TrackProfile {
    return {
        trackId,
        bpm,
        bpmConfidence: confidence,
        key: "8A",
        mode: "minor",
        keyConfidence: confidence,
        genres: [{ genre: "house", confidence }],
        energy,
        valence: 0.6,
        danceability: 0.8,
        acousticness: 0.2,
        vocalness: 0.3,
        intensity: energy,
        complexity: 0.5,
        loudness: -14,
        dynamicRange: 8,
        beatGrid: null,
        sections: [],
        vocalRegions: [],
        confidence: {
            beatGrid: confidence,
            phrase: confidence,
            key: confidence,
            structure: confidence,
            vocals: confidence,
            stems: 0,
            overall: confidence,
        },
        provenance: {},
    };
}

describe("roadmap capability and selection policy", () => {
    test("degrades DSP while preserving the experience intent", () => {
        const result = gatePlanByCapabilities(
            { type: "echo", fadeSec: 8, eqSweep: true, tempoRatio: 1.03, reason: "party echo" },
            { ...FULL_PLAYBACK_CAPABILITIES, effects: false, eq: false, playbackRate: false },
            "party",
        );
        expect(result.experiencePreserved).toBe("party");
        expect(result.plan).toMatchObject({ type: "blend", eqSweep: false, tempoRatio: 1 });
        expect(result.disabled).toEqual(["effect:echo", "tempo-sync", "eq-sweep"]);
    });

    test("the production Director emits a native handoff for a playback-only provider", () => {
        const director = new MusicDirector({
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
        });
        director.setExperience("party", 1);
        const current = profile("current", 124, 0.8);
        const next = profile("next", 126, 0.84);
        const directed = director.planTransition(
            { title: "current", grid: null, durationMs: 180_000 },
            { title: "next", grid: null, durationMs: 180_000 },
            current,
            next,
            {
                fadeSec: 8,
                tempoSync: true,
                eqSweep: true,
                harmonic: true,
                stemsReady: false,
                outgoingTempoRatio: 1,
            },
        );
        expect(directed.plan.type).toBe("cut");
        expect(directed.policyDecision.capability.mode).toBe("native-ordering");
        expect(directed.policyDecision.intent.experience).toBe("party");
    });

    test("uses retrieval, detailed ranking and risk-aware selection", () => {
        const current = {
            profile: profile("a", 120, 0.5),
            embedding: { track: new Float32Array([1, 0]), sections: [] },
        };
        const result = selectTracksTwoStage(current, [
            {
                profile: profile("b", 121, 0.52, 0.95),
                embedding: { track: new Float32Array([0.99, 0.01]), sections: [] },
            },
            { profile: profile("c", 121, 0.52, 0.2), embedding: { track: new Float32Array([1, 0]), sections: [] } },
            { profile: profile("d", 170, 0.9), embedding: { track: new Float32Array([0, 1]), sections: [] } },
        ]);
        expect(result.selected?.track.profile.trackId).toBe("b");
        expect(result.retrieved).toHaveLength(3);
        expect(riskAwareUtility(0.95, 0.28, 1)).toBeLessThan(riskAwareUtility(0.9, 0.04, 1));
    });

    test("builds compatibility edges lazily and finds a bounded sonic route", () => {
        const profiles = [profile("a", 100, 0.2), profile("bridge", 115, 0.5), profile("z", 130, 0.8)];
        const graph = new LazyCompatibilityGraph(profiles);
        expect(graph.materializedEdgeCount).toBe(0);
        expect(graph.edge("a", "bridge")?.score).toBeGreaterThan(0);
        expect(graph.materializedEdgeCount).toBe(1);
        expect(planSonicRoute("a", "z", profiles).trackIds.at(-1)).toBe("z");
    });
});
