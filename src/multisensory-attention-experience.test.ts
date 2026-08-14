import { describe, expect, test } from "bun:test";
import {
    ADAPTIVE_PRECISION_PIPELINE_V2,
    attentionPreservingQueue,
    compileExperienceProgram,
    contextualSilence,
    embodiedDiscoveryScore,
    experienceResumePoint,
    importancePrecision,
    listeningEffortPolicy,
    multisensoryMomentPlan,
    PERCEPTUAL_OS_QUESTIONS,
    ROUND_II_BUILD,
    ROUND_II_PROTOTYPES,
    ROUND_II_RESEARCH,
    sectionAwareIntent,
    temporalOpportunityCost,
} from "./multisensory-attention-experience";

describe("multisensory attention experience", () => {
    test("discovers dance bridges through movement", () => {
        const movement = { cadence: 120, accentPattern: [1], groove: 0.8, contactPattern: [1, 0] };
        expect(embodiedDiscoveryScore(movement, movement)).toBe(1);
    });
    test("schedules every modality from one moment clock", () => {
        const plan = multisensoryMomentPlan(10_000, [
            { channel: "lighting", offsetMs: -2_000, payload: "tension", importance: "high" },
            { channel: "audio", offsetMs: 0, payload: "drop", importance: "very-high" },
        ]);
        expect(plan.oneMomentClock).toBeTrue();
        expect(plan.events).toEqual([
            { channel: "lighting", scheduledAt: 8_000, payload: "tension", importance: "high" },
            { channel: "audio", scheduledAt: 10_000, payload: "drop", importance: "very-high" },
        ]);
    });
    test("allocates sync precision by perceptual importance", () => {
        expect(importancePrecision("very-high")).toEqual({ targetJitterMs: 10, priority: 1 });
        expect(importancePrecision("low")).toEqual({ targetJitterMs: 500, priority: 0.2 });
    });
    test("protects moments under attention demand", () => {
        expect(
            attentionPreservingQueue({ demand: "phone-call", importantMomentInSec: 10, extensibleSafeSection: true }),
        ).toEqual({ action: "extend-safe-section", momentProtected: true });
        expect(attentionPreservingQueue({ importantMomentInSec: 10, extensibleSafeSection: true }).action).toBe(
            "continue",
        );
    });
    test("resumes musical journeys rather than blindly timestamps", () => {
        expect(
            experienceResumePoint({ interruptedSection: "build", interruptionMinutes: 20, replayAllowed: true }).resume,
        ).toBe("safe-buildup");
    });
    test("treats listening effort as preference, not diagnosis", () => {
        expect(listeningEffortPolicy("immersive")).toEqual({
            intent: "immersive",
            userChosen: true,
            hearingAbilityInferred: false,
            spatialStrength: 0.8,
        });
    });
    test("treats intentional silence as a valid state", () => {
        expect(contextualSilence("memorial")).toEqual({ action: "silence-hold", engineFailure: false });
        expect(contextualSilence("normal").action).toBe("music");
    });
    test("waits for an imminent natural energy section", () => {
        const result = sectionAwareIntent({
            desiredEnergy: 0.8,
            currentEnergy: 0.4,
            futureSections: [{ type: "chorus", startsInSec: 32, energy: 0.9, confidence: 0.9 }],
        });
        expect(result).toMatchObject({ action: "wait-current-track", section: { type: "chorus" } });
    });
    test("compares skip and wait opportunity costs", () => {
        expect(
            temporalOpportunityCost({ skipLosesMomentValue: 0.8, waitSeconds: 15, desiredStateUrgency: 0.5 }),
        ).toEqual({ skipCost: 0.8, waitCost: 0.125, choice: "wait" });
    });
    test("implements adaptive precision v2", () => {
        expect(ADAPTIVE_PRECISION_PIPELINE_V2).toEqual([
            "cheap-whole-track",
            "uncertainty-calibration",
            "decision-relevance",
            "targeted-refinement",
            "active-correction-high-value",
            "minimal-safe-intervention",
        ]);
    });
    test("compiles rights-aware multisensory experience programs", () => {
        const result = compileExperienceProgram(
            {
                audio: "mix",
                spatial: "scene",
                haptics: "pulse",
                futureMoments: [],
                confidence: 0.9,
                fallback: "original",
            },
            { audio: false, spatial: false },
        );
        expect(result.audio).toBe("original");
        expect(result.spatial).toBeUndefined();
    });
    test("separates build, prototype and research priorities", () => {
        expect(ROUND_II_BUILD).toContain("decision-confidence");
        expect(ROUND_II_PROTOTYPES).toContain("multisensory-transition");
        expect(ROUND_II_RESEARCH).toContain("beatcord-hrtf-generation");
        expect(PERCEPTUAL_OS_QUESTIONS).toHaveLength(6);
    });
});
