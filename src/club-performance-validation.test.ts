import { describe, expect, test } from "bun:test";
import {
    applyRuntimeGridCorrection,
    assessDjBeatgrid,
    BEATGRID_EVALUATION_GROUPS,
    CLUB_ENGINE_ARCHITECTURE_V3,
    CLUB_MODE_PRINCIPLE,
    CLUB_PERFORMANCE_ARC,
    CLUB_RESEARCH_SOURCES,
    CLUB_SUCCESS_METRICS,
    CLUB_SYNC_DIMENSIONS,
    calibrateGridConfidence,
    clubDebugTrace,
    clubSurpriseBudget,
    doubleDropDecision,
    dropSwapReadiness,
    HUMAN_AUDITION_QUESTIONS,
    LISTENER_PANELS,
    learnClubCorrection,
    localHarmonicBlend,
    protectMoment,
    SampleAccurateScheduler,
    transitionQualityGuardian,
} from "./club-performance-validation";

describe("club performance and validation", () => {
    test("uses phase-specific performance intensity instead of maxing every mix", () => {
        expect(CLUB_PERFORMANCE_ARC.warmup.intensity).toBeLessThan(CLUB_PERFORMANCE_ARC.peak.intensity);
        expect(CLUB_PERFORMANCE_ARC.reset.style).toBe("low-complexity");
    });
    test("protects drops and payoffs unless intentionally replaced", () => {
        const moment = { start: 10, end: 20, type: "drop" as const, importance: 1, overlayTolerance: 0.2 };
        expect(protectMoment(moment, 0.8, false).allowed).toBe(false);
        expect(protectMoment(moment, 0.8, true).reason).toBe("intentional-drop-swap");
    });
    test("requires every drop-swap dimension and rare double-drop cooldown", () => {
        const ready = { barLock: 1, phraseLock: 1, energyCompatibility: 0.9, dropConfidence: 0.9, latencyReadiness: 1 };
        expect(dropSwapReadiness(ready)).toBe(0.9);
        expect(
            doubleDropDecision({
                ...ready,
                harmonic: 0.9,
                rhythmic: 0.9,
                bassManagement: 0.9,
                arrangement: 0.9,
                stems: 0.9,
                minutesSinceLast: 10,
            }).allowed,
        ).toBe(false);
        expect(
            doubleDropDecision({
                ...ready,
                harmonic: 0.9,
                rhythmic: 0.9,
                bassManagement: 0.9,
                arrangement: 0.9,
                stems: 0.9,
                minutesSinceLast: 60,
            }).allowed,
        ).toBe(true);
    });
    test("limits combined club surprise", () => {
        expect(clubSurpriseBudget({ track: 1, transition: 1, energy: 1, tempo: 1, fx: 1 }).allowed).toBe(false);
    });
    test("uses local key confidence/activity and percussive escape", () => {
        const sparse = { start: 0, end: 10, tonic: 0, mode: "minor", confidence: 0.9, harmonicActivity: 0.1 };
        expect(localHarmonicBlend(sparse, sparse, 0.1).percussiveEscape).toBe(true);
        const melodic = { ...sparse, harmonicActivity: 1 };
        expect(localHarmonicBlend(melodic, melodic, 0.1).rejectByKey).toBe(true);
    });
    test("publishes broad beatgrid cohorts and DJ-specific catastrophic metrics", () => {
        expect(BEATGRID_EVALUATION_GROUPS).toHaveLength(17);
        const result = assessDjBeatgrid({
            f1: 0.99,
            phaseErrorMs: 2,
            downbeatError: 0.01,
            barContinuity: 0.99,
            tempoDriftError: 0.01,
            gridJumpCount: 0,
            phraseAlignmentError: 0.01,
            transitionWindowAccuracy: 0.99,
            catastrophicGridErrorRate: 0.02,
        });
        expect(result.djReady).toBe(false);
        expect(result.f1Sufficient).toBe(false);
    });
    test("calibrates confidence per genre and keeps offline/runtime grids dual", () => {
        expect(
            calibrateGridConfidence([{ genre: "jazz", confidence: 0.99, correct: false }]).jazz?.reliabilityGap,
        ).toBe(0.99);
        const dual = applyRuntimeGridCorrection({ bpm: 120 }, { 4: 12 }, 0.8);
        expect(dual.offlineReference).toEqual({ bpm: 120 });
        expect(dual.runtimeCorrection.localOnly).toBe(true);
    });
    test("schedules sample-accurate events and guards previews with a fallback ladder", () => {
        const scheduler = new SampleAccurateScheduler();
        scheduler.scheduleAtSample({ sampleIndex: 48_000n, type: "stem-swap" });
        expect(scheduler.due(47_999n)).toHaveLength(0);
        expect(scheduler.due(48_000n)).toHaveLength(1);
        const guardian = transitionQualityGuardian(
            {
                clippingRisk: 0.9,
                lowEndCollision: 0.9,
                vocalCollision: 0,
                phaseRisk: 0,
                stretchRisk: 0,
                stemArtifacts: 0,
                loudnessJump: 0,
            },
            0.9,
            0.9,
        );
        expect(guardian.allowed).toBe(false);
        expect(guardian.fallback).toBe("short-phrase-blend");
    });
    test("learns mixing corrections and emits auditable traces", () => {
        expect(
            learnClubCorrection({ preferredBlendLength: 0.8, dropSwapAffinity: 0.2 }, "skip-long-transition")
                .preferredBlendLength,
        ).toBe(0.72);
        expect(
            clubDebugTrace({
                type: "eq-blend",
                tracks: ["a", "b"],
                context: "peak",
                predictedQuality: 0.9,
                observedFeedback: 0.7,
                corrections: [],
            }),
        ).toHaveLength(6);
    });
    test("defines audition panels, success metrics, architecture and principle", () => {
        expect(HUMAN_AUDITION_QUESTIONS).toHaveLength(5);
        expect(LISTENER_PANELS).toHaveLength(4);
        expect(CLUB_SUCCESS_METRICS).toHaveLength(9);
        expect(CLUB_ENGINE_ARCHITECTURE_V3).toHaveLength(18);
        expect(CLUB_SYNC_DIMENSIONS).toHaveLength(12);
        expect(CLUB_MODE_PRINCIPLE).toContain("musical-transition");
        expect(Object.values(CLUB_RESEARCH_SOURCES).reduce((a, b) => a + b, 0)).toBe(18);
    });
});
