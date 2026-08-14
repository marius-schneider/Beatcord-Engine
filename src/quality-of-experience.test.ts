import { describe, expect, test } from "bun:test";
import {
    adaptiveBufferHorizon,
    aiResponseRoute,
    assessSearchQoe,
    dspDegradation,
    momentWeightedStallCost,
    perceivedQoe,
    QOE_DIMENSIONS,
    qoeAwareRouteScore,
    qualityOfExperienceScore,
    streamingDegradation,
    transitionReadiness,
} from "./quality-of-experience";

describe("quality of experience", () => {
    test("scores playback, navigation, search, AI, sync and handoff together", () => {
        expect(
            qualityOfExperienceScore({
                playback: 1,
                startup: 1,
                navigation: 1,
                search: 1,
                recommendationLatency: 1,
                sessionSync: 1,
                handoff: 1,
                integrationHealth: 1,
            }),
        ).toBe(1);
        expect(QOE_DIMENSIONS).toEqual(["audio", "navigation", "search", "ai", "social-sync", "integration"]);
    });

    test("combines technical, behavioral and user-perceived evidence", () => {
        expect(perceivedQoe({ technical: 0.8, behavioral: 0.6, userFeedback: 1 })).toBe(0.79);
        expect(perceivedQoe({ technical: 0.8, behavioral: 0.6 })).toBe(0.72);
    });

    test("weights stalls by musical and experience importance", () => {
        expect(momentWeightedStallCost(2, 1, 0.9)).toBe(1.8);
        expect(momentWeightedStallCost(2, 0.2, 0.9)).toBe(0.36);
    });

    test("adds buffer before critical moments and on weak networks", () => {
        const normal = adaptiveBufferHorizon({
            baseSeconds: 5,
            moment: "normal",
            networkQuality: 1,
            complexTransition: false,
        });
        const critical = adaptiveBufferHorizon({
            baseSeconds: 5,
            moment: "transition",
            networkQuality: 0.5,
            complexTransition: true,
        });
        expect(normal.targetSeconds).toBe(5);
        expect(critical).toEqual({ targetSeconds: 18, criticalMomentProtected: true });
    });

    test("delays fancy transitions when buffering is unsafe", () => {
        expect(transitionReadiness(4, 8)).toEqual({ action: "delay-fancy-transition", qualityBeforeImmediacy: true });
        expect(transitionReadiness(8, 8).action).toBe("proceed");
    });

    test("includes availability and buffer readiness in route score", () => {
        expect(qoeAwareRouteScore({ musicalFit: 0.9, availabilityConfidence: 0.8, bufferReadiness: 0.5 })).toBe(0.795);
    });

    test("degrades stream quality before choosing a stall", () => {
        expect(streamingDegradation(0.6, true)).toEqual({ quality: "high-lossy", stallPreferred: false });
        expect(streamingDegradation(0.2, true).quality).toBe("lower-bitrate");
    });

    test("degrades DSP complexity while preserving continuity", () => {
        expect(dspDegradation(0.8).quality).toBe("stem-hq");
        expect(dspDegradation(0.1)).toEqual({ quality: "crossfade", continuityWins: true });
    });

    test("treats search QoE as a release gate", () => {
        expect(assessSearchQoe({ p50Ms: 200, p95Ms: 700, noResultRate: 0.04, correctionRate: 0.08 })).toEqual({
            healthy: true,
            failures: [],
            releaseCritical: true,
        });
        expect(
            assessSearchQoe({ p50Ms: 300, p95Ms: 900, noResultRate: 0.1, correctionRate: 0.2 }).failures,
        ).toHaveLength(4);
    });

    test("keeps simple AI commands on the immediate local path", () => {
        expect(aiResponseRoute("More energy")).toEqual({
            route: "local-structured",
            latencyClass: "interactive",
            cloudRequired: false,
        });
        expect(aiResponseRoute("Make it feel like a nostalgic rooftop night").route).toBe("semantic-planner");
    });
});
