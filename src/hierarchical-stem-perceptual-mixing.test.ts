import { describe, expect, test } from "bun:test";
import {
    beatSourceRouter,
    harmonicOverlapWindow,
    harmonicOwnership,
    hybridReconstruction,
    manipulationCost,
    meterAlignment,
    openVocabularyStemQuery,
    planStemDemand,
    repairBeatFromDrums,
    roleCollisionMap,
    sequentialRoleHandoffs,
    spatialStemGate,
    stemMosaic,
    stemPipeline,
    stemRegionScore,
    stemTransitionUtility,
    timbreBridge,
} from "./hierarchical-stem-perceptual-mixing";

describe("hierarchical stems and perceptual mixing", () => {
    test("separates only the hierarchy needed by the transition", () => {
        expect(planStemDemand("vocal-removal", 0.8, 100).required).toEqual(["vocals"]);
        expect(planStemDemand("kick-handoff", 0.9, 100).required).toContain("kick");
    });
    test("keeps open vocabulary experimental", () => {
        expect(openVocabularyStemQuery("lead synth", false)).toEqual({
            route: "experimental-open-vocabulary",
            realtimePrimary: false,
            query: "lead synth",
        });
        expect(openVocabularyStemQuery("vocals", true).route).toBe("fixed-stem");
    });
    test("builds mosaics from the best model by role and region", () => {
        const base = {
            role: "vocals" as const,
            start: 0,
            end: 10,
            leakage: 0.1,
            artifacts: 0.1,
            transientIntegrity: 0.9,
            tonalIntegrity: 0.9,
            reconstructionConsistency: 0.9,
        };
        const a = { ...base, model: "a" };
        const b = { ...base, model: "b", artifacts: 0.5 };
        expect(stemRegionScore(a)).toBeGreaterThan(stemRegionScore(b));
        expect(stemMosaic([b, a])[0]?.model).toBe("a");
    });
    test("restores only when benefit exceeds risk and utility is sufficient", () => {
        expect(
            stemPipeline({
                baseQuality: 0.6,
                restorationBenefit: 0.8,
                restorationRisk: 0.2,
                transitionUtility: 0.9,
                windowSeconds: 16,
            }),
        ).toEqual({
            separate: true,
            roleQualityGate: true,
            restore: true,
            utilityTest: true,
            use: true,
            localWindowOnly: true,
        });
    });
    test("scores transition utility rather than separation SDR", () => {
        expect(
            stemTransitionUtility({
                perceptualMasking: 1,
                roleIsolation: 1,
                artifactSalience: 0,
                requiredExposure: 0,
                transitionDuration: 0,
            }),
        ).toBe(1);
    });
    test("preserves the master when coherent and falls back safely", () => {
        expect(hybridReconstruction({ residualCoherence: 0.9, fullReconstructionQuality: 0.9 })).toEqual({
            mode: "original-preserving-delta",
            originalMasterPreserved: true,
        });
        expect(hybridReconstruction({ residualCoherence: 0.2, fullReconstructionQuality: 0.2 }).mode).toBe(
            "classic-eq",
        );
    });
    test("raises the spatial stem threshold for headphones", () => {
        const quality = {
            interChannelPhase: 0.8,
            stereoImagePreservation: 0.8,
            localizationStability: 0.8,
            monoCompatibility: 0.8,
        };
        expect(spatialStemGate(quality, "party-speaker").allowed).toBeTrue();
        expect(spatialStemGate(quality, "spatial-headphones").allowed).toBeFalse();
    });
    test("routes beat sources and repairs uncertain full-mix grids", () => {
        expect(beatSourceRouter("house")).toEqual(["kick", "drums"]);
        expect(beatSourceRouter("ballad")).toEqual(["piano", "vocal-phrasing"]);
        expect(repairBeatFromDrums({ fullMixConfidence: 0.3, kick: 0.9, snare: 0.8, hats: 0.7 })).toMatchObject({
            repaired: true,
            meterEvidence: true,
        });
    });
    test("supports diverse and unknown meters without fake downbeats", () => {
        expect(meterAlignment("unknown", "4/4", 0.2)).toEqual({ strategy: "phrase-bridge", fakeDownbeats: false });
        expect(meterAlignment("3/4", "4/4", 0.9).strategy).toBe("structural-cut");
        expect(meterAlignment("4/4", "4/4", 0.9).strategy).toBe("bar-beatmix");
    });
    test("selects low-risk local harmonic windows and ownership", () => {
        const a = [{ start: 0, end: 10, tonalCenter: "Am", confidence: 1, activity: 0.2 }];
        const b = [{ start: 0, end: 10, tonalCenter: "Am", confidence: 1, activity: 0.3 }];
        expect(harmonicOverlapWindow(a, b)?.risk).toBe(0.1);
        expect(harmonicOwnership(0.8)).toEqual({ corridor: "neutral-percussion", simultaneousOwnership: false });
    });
    test("uses bounded temporary timbre morphing", () => {
        const a = { centroid: 0.2, lowMidDensity: 0.8, brightness: 0.2, stereoWidth: 0.5, transientSharpness: 0.4 };
        const b = { centroid: 0.8, lowMidDensity: 0.2, brightness: 0.8, stereoWidth: 0.7, transientSharpness: 0.8 };
        const bridge = timbreBridge(a, b, 1);
        expect(bridge.outgoing.centroid).toBeCloseTo(0.275, 6);
        expect(bridge.returnsToOriginalMaster).toBeTrue();
    });
    test("maps perceptual foreground collision beyond vocal labels", () => {
        const a = { time: 1, vocal: 1, melodicLead: 0, signatureHook: 0.8, frequencyOverlap: 1 };
        const b = { time: 1, vocal: 0, melodicLead: 1, signatureHook: 0.8, frequencyOverlap: 1 };
        expect(roleCollisionMap(a, b)).toBeGreaterThan(0.3);
    });
    test("stops sequential handoffs when desired utility is reached", () => {
        const handoffs = [
            { role: "drums" as const, outgoingGainCurve: [1, 0], incomingGainCurve: [0, 1], startBar: 0, endBar: 4 },
            { role: "bass" as const, outgoingGainCurve: [1, 0], incomingGainCurve: [0, 1], startBar: 4, endBar: 8 },
        ];
        expect(sequentialRoleHandoffs(handoffs, 0.8, [0.9, 1])).toHaveLength(1);
    });
    test("minimizes necessary manipulation", () => {
        expect(
            manipulationCost({
                tempoWarp: 1,
                pitchShift: 0,
                stemExposure: 0.5,
                eqChange: 0.5,
                fxIntensity: 0,
                structuralEditing: 0,
            }),
        ).toBeCloseTo(0.333333, 6);
    });
});
