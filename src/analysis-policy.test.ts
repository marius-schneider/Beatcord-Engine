import { describe, expect, test } from "bun:test";
import {
    auditRealtimeOperations,
    beatlessTransitionPolicy,
    detectBeatgridFailure,
    detectContentType,
    genreAdapter,
    planAnalysis,
    planNarration,
    SharedAnalysisFrontend,
    scoreGroupTaste,
} from "./analysis-policy";

describe("realtime and analysis policy", () => {
    test("rejects non-realtime work and schedules analysis by proximity and tier", () => {
        expect(auditRealtimeOperations(["sample-processing", "network", "allocation"])).toEqual({
            safe: false,
            allowed: ["sample-processing"],
            violations: ["network", "allocation"],
        });
        expect(planAnalysis({ position: "next", selectionProbability: 0.9 }, 3)).toMatchObject({
            priority: "critical",
            fidelity: 4,
            generateStems: true,
        });
        expect(planAnalysis({ position: "next", selectionProbability: 0.9 }, 1)).toMatchObject({
            fidelity: 2,
            generateStems: false,
        });
    });

    test("shares immutable spectral frames between analyzers", () => {
        const frontend = new SharedAnalysisFrontend();
        const magnitudes = new Float32Array([1, 2]);
        frontend.store({ timeSec: 1, magnitudes, spectralCentroid: 2_000, spectralFlux: 0.2, rms: 0.5 });
        magnitudes[0] = 9;
        expect(frontend.frame(1)?.magnitudes[0]).toBe(1);
        expect(frontend.size).toBe(1);
    });

    test("actively detects beatgrid drift and chooses a safe recovery", () => {
        const report = detectBeatgridFailure({
            expectedBeatsSec: [0, 0.5, 1, 1.5],
            actualOnsetsSec: [0, 0.55, 1.1, 1.65],
            downbeatOffsetsSec: [0, 0.2, -0.2],
            localBpms: [100, 140],
            sectionResetErrorsSec: [0.3],
        });
        expect(report.failed).toBe(true);
        expect(report.action).toBe("safe-transition");
        expect(report.issues).toContain("tempo-discontinuity");
    });

    test("adapts rhythmic assumptions and protects non-music", () => {
        const ambient = genreAdapter(["ambient drone"]);
        expect(beatlessTransitionPolicy(0.3, ambient).strategy).toBe("spectral-harmonic-fade");
        expect(genreAdapter(["trap"]).halfDoubleTimeAware).toBe(true);
        expect(detectContentType({ speechRatio: 0.9, musicProbability: 0.05, durationSec: 3_600 }).type).toBe(
            "audiobook",
        );
    });

    test("places narration in a vocal gap and balances group fairness", () => {
        expect(planNarration([{ start: 8, end: 30 }], 40, 5)).toMatchObject({
            allowed: true,
            region: { start: 0, end: 5 },
            restoreAtSec: 8,
        });
        const score = scoreGroupTaste([
            { userId: "a", satisfaction: 0.9, candidateAffinity: 0.7, fairnessDebt: 0, requested: false, host: true },
            { userId: "b", satisfaction: 0.2, candidateAffinity: 0.9, fairnessDebt: 0.8, requested: true, host: false },
        ]);
        expect(score.fairnessBoost).toBeGreaterThan(0);
        expect(score.debts.b).toBeDefined();
    });
});
