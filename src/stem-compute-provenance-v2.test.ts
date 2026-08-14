import { describe, expect, test } from "bun:test";
import {
    computeMigration,
    computePlacement,
    decisionProvenanceGraph,
    perceptualStemBakeOff,
    recommendationSelfInfluence,
    reconstructionResidual,
    routeStemJob,
    shadowDirector,
    spatialIntegrityGate,
    TINY_LOCAL_SPECIALISTS,
    VERSION_ALIGNMENT_PIPELINE,
    versionAssistedStem,
} from "./stem-compute-provenance-v2";

describe("stem compute and provenance v2", () => {
    test("uses aligned alternate versions only as weak priors", () => {
        expect(VERSION_ALIGNMENT_PIPELINE).toHaveLength(5);
        expect(
            versionAssistedStem({ fingerprintMatch: 1, timingMatch: 1, spectralMatch: 1, phaseCoherence: 1 }),
        ).toEqual({ weakPrior: 1, directSubtractionAllowed: false, status: "research" });
    });
    test("preserves coherent residual and flags structured failure", () => {
        expect(reconstructionResidual({ originalEnergy: 1, summedStemEnergy: 0.9, coherence: 0.9 })).toEqual({
            magnitude: 0.1,
            role: "preserve",
            assignAllToOther: false,
        });
        expect(reconstructionResidual({ originalEnergy: 1, summedStemEnergy: 0.5, coherence: 0.2 }).role).toBe(
            "separation-failure",
        );
    });
    test("gates separation on spatial cues rather than SDR alone", () => {
        expect(
            spatialIntegrityGate({
                interauralTiming: 0.9,
                levelDifference: 0.8,
                stereoWidth: 0.75,
                localization: 0.85,
            }),
        ).toEqual({ quality: 0.825, allowed: true, sdrOnly: false });
    });
    test("uses human utility alongside objective stem metrics", () => {
        expect(
            perceptualStemBakeOff([
                { model: "metric-winner", objectiveQuality: 0.95, humanUtility: 0.4 },
                { model: "listener-winner", objectiveQuality: 0.8, humanUtility: 0.9 },
            ]).winner,
        ).toBe("listener-winner");
    });
    test("routes stem jobs by role, region, deadline, device and human utility", () => {
        const models = [
            {
                id: "vocal-mobile",
                roles: ["vocal"],
                sections: ["chorus"],
                realtime: true,
                spatialQuality: 0.8,
                deviceTiers: ["phone"],
                objectiveQuality: 0.8,
                humanUtility: 0.9,
                maxLatencyMs: 40,
            },
            {
                id: "vocal-bad",
                roles: ["vocal"],
                sections: ["chorus"],
                realtime: true,
                spatialQuality: 0.8,
                deviceTiers: ["phone"],
                objectiveQuality: 0.9,
                humanUtility: 0.4,
            },
        ];
        expect(
            routeStemJob(models, {
                role: "vocal",
                sectionType: "chorus",
                realtime: true,
                spatialRequirement: 0.7,
                device: "phone",
                deadlineMs: 50,
            })?.id,
        ).toBe("vocal-mobile");
    });
    test("keeps tiny specialists local", () => {
        expect(TINY_LOCAL_SPECIALISTS).toContain("warning-detector");
        expect(TINY_LOCAL_SPECIALISTS).toContain("simple-intent-parser");
    });
    test("places tasks on capable session nodes", () => {
        expect(computePlacement("realtime-dsp", ["audio-master", "desktop-server"])).toBe("audio-master");
        expect(computePlacement("heavy-stems", ["phone", "desktop-server"])).toBe("desktop-server");
        expect(computePlacement("private-context", ["phone"])).toBe("phone");
    });
    test("migrates HQ analysis without changing session", () => {
        expect(computeMigration("phone", "desktop-server", "hq-analysis")).toEqual({
            from: "phone",
            to: "desktop-server",
            sessionChanged: false,
        });
        expect(computeMigration("audio-master", "desktop-server", "realtime-dsp").to).toBe("audio-master");
    });
    test("normalizes decision evidence into a provenance graph", () => {
        const result = decisionProvenanceGraph("play-b", [
            { source: "request", weight: 0.6, modelVersion: "v1" },
            { source: "journey", weight: 0.4, modelVersion: "v2" },
        ]);
        expect(result.evidence.map((item) => item.weight)).toEqual([0.6, 0.4]);
        expect(result.supports).toContain("model-rollback");
    });
    test("keeps shadow outcomes explicitly counterfactual", () => {
        expect(shadowDirector([{ model: "x", trackId: "c" }], false)).toEqual({
            predictions: [{ model: "x", trackId: "c" }],
            affectsUser: false,
            trueRewardObservable: false,
            evaluation: "offline-only",
        });
    });
    test("monitors recommendation self-influence", () => {
        expect(recommendationSelfInfluence(6, 10)).toEqual({
            ratio: 0.6,
            action: "increase-independent-discovery",
            repeatedEvidenceReduced: true,
        });
    });
});
