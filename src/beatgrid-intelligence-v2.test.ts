import { describe, expect, test } from "bun:test";
import {
    AnalysisDependencyGraph,
    classifyBeatgridMode,
    downbeatAlignment,
    ensembleBeatHypotheses,
    hierarchicalMusicalClock,
    localGridConfidence,
    measurePhaseDrift,
    phraseLock,
    type ResearchBeatGrid,
    resolveTempoFamily,
    syncQualityDecision,
} from "./beatgrid-intelligence-v2";

function grid(segments: ResearchBeatGrid["tempoSegments"], confidence = 0.9): ResearchBeatGrid {
    return {
        beats: Array.from({ length: 16 }, (_, index) => ({
            time: index * 0.5,
            index,
            bar: Math.floor(index / 4),
            beatInBar: index % 4,
            bpmLocal: 120,
            confidence,
        })),
        tempoSegments: segments,
        meterSegments: [{ start: 0, end: 8, numerator: 4, denominator: 4, confidence: 0.9 }],
        downbeats: [0, 2, 4, 6],
        phrases: [{ start: 0, end: 8, bars: 4, confidence: 0.8 }],
        confidence: { beat: confidence, downbeat: 0.9, meter: 0.9, phrase: 0.8 },
    };
}

describe("beatgrid and sync intelligence v2", () => {
    test("represents beats, local tempo, meter, downbeats and phrases on one timeline", () => {
        const value = grid([{ start: 0, end: 8, bpmStart: 120, bpmEnd: 120, stability: 1, confidence: 0.9 }]);
        expect(value.beats[1]).toMatchObject({ time: 0.5, beatInBar: 1, bpmLocal: 120 });
        expect(value.downbeats).toEqual([0, 2, 4, 6]);
    });

    test("classifies static, drifting, ramping, sectional and free grids", () => {
        expect(
            classifyBeatgridMode(grid([{ start: 0, end: 8, bpmStart: 120, bpmEnd: 120, stability: 1, confidence: 1 }])),
        ).toBe("static");
        expect(
            classifyBeatgridMode(
                grid([{ start: 0, end: 8, bpmStart: 120, bpmEnd: 120.8, stability: 0.6, confidence: 1 }]),
            ),
        ).toBe("drifting");
        expect(
            classifyBeatgridMode(
                grid([{ start: 0, end: 8, bpmStart: 120, bpmEnd: 125, stability: 0.8, confidence: 1 }]),
            ),
        ).toBe("ramping");
        expect(
            classifyBeatgridMode(
                grid([
                    { start: 0, end: 4, bpmStart: 120, bpmEnd: 120, stability: 1, confidence: 1 },
                    { start: 4, end: 8, bpmStart: 128, bpmEnd: 128, stability: 1, confidence: 1 },
                ]),
            ),
        ).toBe("sectional");
        expect(classifyBeatgridMode(grid([], 0.1))).toBe("free");
    });

    test("keeps grid confidence local to musical regions", () => {
        const value = grid([{ start: 0, end: 8, bpmStart: 120, bpmEnd: 120, stability: 1, confidence: 1 }]);
        value.beats.slice(0, 4).forEach((beat) => {
            beat.confidence = 0.2;
        });
        const local = localGridConfidence(value, [
            { start: 0, end: 2 },
            { start: 2, end: 8 },
        ]);
        expect(local[0]!.beat).toBeLessThan(local[1]!.beat);
    });

    test("forms multi-analyzer consensus rather than trusting one tracker", () => {
        const consensus = ensembleBeatHypotheses([
            { source: "a", beats: [0, 0.5, 1], bpm: 120, confidence: 0.9 },
            { source: "b", beats: [0.01, 0.51, 1.01], bpm: 119.8, confidence: 0.8 },
            { source: "onset", beats: [0.02, 0.52, 1.02], bpm: 120.1, confidence: 0.7 },
        ]);
        expect(consensus.beats).toHaveLength(3);
        expect(consensus.agreement).toBe(1);
        expect(consensus.sources).toHaveLength(3);
    });

    test("resolves half/double-time as a tempo family with genre only as prior", () => {
        const tempo = resolveTempoFamily(70, { meterSupport: 0.8, genrePriorBpm: 140, genrePriorStrength: 0.8 });
        expect(tempo.canonical).toBe(140);
        expect(tempo.alternatives).toContain(70);
        expect(tempo.genreIsHardRule).toBe(false);
    });

    test("distinguishes beat alignment from bar/downbeat alignment", () => {
        expect(downbeatAlignment(0, 1, 0.5, 4)).toMatchObject({
            beatAligned: true,
            barAligned: false,
            barPhaseError: 2,
        });
        expect(downbeatAlignment(0, 2, 0.5, 4).barAligned).toBe(true);
    });

    test("publishes hierarchical phase and explicit phrase lock", () => {
        const clock = hierarchicalMusicalClock({
            timeSec: 2.25,
            sampleRate: 48_000,
            beatPeriodSec: 0.5,
            beatsPerBar: 4,
            barsPerPhrase: 4,
            phrasesPerSection: 4,
            sectionProgress: 0.3,
            journeyProgress: 0.4,
        });
        expect(clock.beatPhase).toBe(0.5);
        expect(clock.barPhase).toBe(0.125);
        expect(phraseLock(0.98, 0.02, 0.9)).toBe(true);
    });

    test("invalidates every dependent analysis after grid correction", () => {
        const result = new AnalysisDependencyGraph().invalidate("beat-grid");
        expect(result.invalidated).toContain("phrase");
        expect(result.invalidated).toContain("transition-zones");
        expect(result.incrementalReanalysis).toBe(true);
    });

    test("keeps five sync dimensions separate and refuses a phrase-broken blend", () => {
        const decision = syncQualityDecision({ tempo: 1, phase: 0.99, bar: 0.98, phrase: 0.42, groove: 0.9 });
        expect(decision.blendReady).toBe(false);
        expect(decision.weakest).toBe("phrase");
    });

    test("detects a currently aligned clock that is drifting", () => {
        expect(measurePhaseDrift({ initialErrorMs: 0, finalErrorMs: 15, durationSec: 10 })).toEqual({
            phaseErrorMs: 15,
            phaseDriftMsPerSec: 1.5,
            currentlyAligned: true,
            drifting: true,
        });
    });
});
