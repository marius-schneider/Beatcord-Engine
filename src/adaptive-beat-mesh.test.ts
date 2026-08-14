import { describe, expect, test } from "bun:test";
import {
    analysisFoveation,
    beatConsensus,
    classifyGridResidual,
    compatiblePulse,
    confidenceIsland,
    grooveCompatibility,
    grooveMixStrategy,
    groovePreservingSync,
    multiAxisBridgeScore,
    phaseResidual,
    pulseHierarchy,
    sectionRhythmSources,
    spreadGridCorrection,
    tempoDecomposition,
    transitionMixGrid,
} from "./adaptive-beat-mesh";

describe("adaptive beat mesh", () => {
    test("preserves half-time and double-time pulses", () => {
        const dnb = pulseHierarchy(87, 0.9);
        expect(dnb.doubleTime?.bpm).toBe(174);
        expect(compatiblePulse(dnb, pulseHierarchy(174, 0.8))).toMatchObject({ compatible: true, ratio: 1 });
    });
    test("routes rhythm evidence by section", () => {
        expect(sectionRhythmSources("intro")).toContain("harmonic-changes");
        expect(sectionRhythmSources("drop")).toEqual(["kick", "drums", "bass"]);
    });
    test("combines cross-source evidence and dispersion", () => {
        expect(
            beatConsensus(
                [
                    { source: "full-mix", onsetTimes: [], periodicities: [128], accentStrength: [], confidence: 0.9 },
                    { source: "kick", onsetTimes: [], periodicities: [128], accentStrength: [], confidence: 1 },
                ],
                0.1,
            ),
        ).toMatchObject({ confidence: 0.855, dispersion: 0.1 });
    });
    test("chooses section confidence islands", () => {
        const island = confidenceIsland([
            { sectionId: "break", confidence: 0.5, start: 0, end: 10 },
            { sectionId: "outro", confidence: 0.98, start: 20, end: 40 },
        ]);
        expect(island?.sectionId).toBe("outro");
    });
    test("creates HQ transition grids without demanding a perfect song grid", () => {
        expect(transitionMixGrid([120, 136], [0, 16])).toEqual({
            outgoingWindow: [120, 136],
            incomingWindow: [0, 16],
            precision: "transition-window-hq",
            wholeTrackPerfectRequired: false,
        });
    });
    test("foveates compute from catalog to committed alignment", () => {
        expect(analysisFoveation("catalog")).toEqual({ tier: 1, scope: "whole-song-quick" });
        expect(analysisFoveation("committed")).toEqual({ tier: 4, scope: "sample-transient-alignment" });
    });
    test("classifies residuals and heals audibly without jumps", () => {
        expect(phaseResidual(1.008, 1)).toBe(0.008);
        expect(classifyGridResidual([0.001, 0.002, 0.001])).toBe("LOCKED");
        expect(classifyGridResidual([0, 0.01, 0.02])).toBe("DRIFTING");
        expect(spreadGridCorrection(0.08, 4, true)).toEqual([0.02, 0.02, 0.02, 0.02]);
        expect(spreadGridCorrection(0.08, 4, false)).toEqual([0.08]);
    });
    test("preserves groove residuals during elastic sync", () => {
        const groove = {
            kickOffset: [0.002],
            snareOffset: [0.01],
            hatsOffset: [],
            bassOffset: [0.014],
            vocalOffset: [0.029],
        };
        expect(groovePreservingSync(128, 126, groove)).toMatchObject({
            tempoRatio: 0.984375,
            residualPreserved: true,
            groove,
        });
        expect(tempoDecomposition(126, 0.4).total).toBe(126.4);
    });
    test("uses groove compatibility to select blend strategy", () => {
        const a = {
            swingRatio: 0.5,
            syncopation: 0.4,
            kickDensity: 0.6,
            snarePlacement: 0.5,
            hatPattern: 0.7,
            bassKickTiming: 0.5,
        };
        expect(grooveCompatibility(a, a)).toBe(1);
        expect(grooveMixStrategy(0.9)).toBe("long-rhythmic-blend");
        expect(grooveMixStrategy(0.4)).toBe("structural-transition");
    });
    test("scores disentangled rhythm, timbre, harmony and genre bridges", () => {
        expect(
            multiAxisBridgeScore({
                rhythmContinuity: 1,
                timbreProgress: 0.8,
                harmonicFit: 0.5,
                targetGenreProgress: 0.8,
            }),
        ).toBe(0.8);
    });
});
