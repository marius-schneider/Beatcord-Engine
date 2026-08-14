import { describe, expect, test } from "bun:test";
import {
    accessiblePresentation,
    energyStrategy,
    HEARING_DIVERSITY_POLICY,
    hearingAccessibility,
    safeLoudnessGuard,
} from "./safe-listening-accessibility";

describe("safe listening and accessibility", () => {
    test("treats hearing diversity metrics as non-universal", () => {
        expect(HEARING_DIVERSITY_POLICY.factors).toHaveLength(7);
        expect(HEARING_DIVERSITY_POLICY.universalPerceptualTruth).toBe(false);
        expect(HEARING_DIVERSITY_POLICY.playbackPreferenceNotMedicalCorrection).toBe(true);
    });

    test("only applies hearing preferences explicitly chosen by the user", () => {
        expect(
            hearingAccessibility({
                mode: "reduced-harshness",
                highFrequencyPreference: 0,
                vocalClarityPreference: 0,
                explicitlySetByUser: false,
            }).enabled,
        ).toBe(false);
        expect(
            hearingAccessibility({
                mode: "reduced-harshness",
                highFrequencyPreference: 0,
                vocalClarityPreference: 0,
                explicitlySetByUser: true,
            }),
        ).toMatchObject({ enabled: true, highShelfDb: -2, medicalDiagnosis: false, inferredImpairment: false });
    });

    test("offers vocal clarity as playback preference, not diagnosis", () => {
        expect(
            hearingAccessibility({
                mode: "vocal-clarity",
                highFrequencyPreference: 0.5,
                vocalClarityPreference: 1,
                explicitlySetByUser: true,
            }),
        ).toMatchObject({ vocalPresenceDb: 2, medicalDiagnosis: false });
    });

    test("refuses false SPL claims when hardware confidence is insufficient", () => {
        expect(safeLoudnessGuard({ estimatedSpl: 100, duration: 3_600, confidence: 0.4 })).toEqual({
            assessmentAvailable: false,
            risk: "unknown",
            falseSplClaimPrevented: true,
            suggestedGainChangeDb: 0,
        });
        expect(safeLoudnessGuard({ estimatedSpl: 96, duration: 3_600, confidence: 0.9 })).toMatchObject({
            assessmentAvailable: true,
            risk: "high",
            suggestedGainChangeDb: -6,
        });
    });

    test("raises energy musically without increasing output gain", () => {
        expect(energyStrategy(1)).toEqual({
            outputGainIncreaseDb: 0,
            musicalActions: ["groove", "arrangement", "familiar-hook", "build"],
            safeListeningPreserved: true,
        });
    });

    test("keeps visual stimulation independent from party audio energy", () => {
        const result = accessiblePresentation(1, {
            reducedMotion: true,
            highContrast: true,
            screenReaderLabels: true,
            keyboardControl: true,
            hapticAlternatives: true,
            flashingVisuals: true,
        });
        expect(result).toMatchObject({
            visualizerComplexity: "minimal",
            flashingAllowed: false,
            audioEnergy: 1,
            visualEnergyCoupledToAudio: false,
        });
        expect(result.alternatives).toEqual(["screen-reader-labels", "keyboard-control", "haptic-alternatives"]);
    });
});
