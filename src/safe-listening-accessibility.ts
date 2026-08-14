const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
export type HearingAccessibilityMode = "standard" | "vocal-clarity" | "reduced-harshness" | "custom";
export interface UserHearingPreference {
    mode: HearingAccessibilityMode;
    highFrequencyPreference: number;
    vocalClarityPreference: number;
    explicitlySetByUser: boolean;
}

export function hearingAccessibility(preference: UserHearingPreference): {
    enabled: boolean;
    highShelfDb: number;
    vocalPresenceDb: number;
    medicalDiagnosis: false;
    inferredImpairment: false;
} {
    if (!preference.explicitlySetByUser || preference.mode === "standard")
        return {
            enabled: false,
            highShelfDb: 0,
            vocalPresenceDb: 0,
            medicalDiagnosis: false,
            inferredImpairment: false,
        };
    const highShelfDb =
        preference.mode === "reduced-harshness" ? -2 : (clamp01(preference.highFrequencyPreference) - 0.5) * 4;
    const vocalPresenceDb = preference.mode === "vocal-clarity" ? 2 : clamp01(preference.vocalClarityPreference) * 2;
    return { enabled: true, highShelfDb, vocalPresenceDb, medicalDiagnosis: false, inferredImpairment: false };
}

export interface ListeningExposure {
    estimatedSpl?: number;
    duration: number;
    confidence: number;
}
export function safeLoudnessGuard(exposure: ListeningExposure): {
    assessmentAvailable: boolean;
    risk: "unknown" | "low" | "moderate" | "high";
    falseSplClaimPrevented: boolean;
    suggestedGainChangeDb: number;
} {
    if (exposure.estimatedSpl === undefined || exposure.confidence < 0.8)
        return { assessmentAvailable: false, risk: "unknown", falseSplClaimPrevented: true, suggestedGainChangeDb: 0 };
    const dose = exposure.estimatedSpl + Math.max(0, Math.log2(Math.max(1, exposure.duration / 3_600))) * 3;
    const risk = dose >= 94 ? "high" : dose >= 85 ? "moderate" : "low";
    return {
        assessmentAvailable: true,
        risk,
        falseSplClaimPrevented: false,
        suggestedGainChangeDb: risk === "high" ? -6 : risk === "moderate" ? -3 : 0,
    };
}

export function energyStrategy(requestedIncrease: number): {
    outputGainIncreaseDb: 0;
    musicalActions: Array<"groove" | "arrangement" | "familiar-hook" | "build">;
    safeListeningPreserved: true;
} {
    const amount = clamp01(requestedIncrease);
    const actions: Array<"groove" | "arrangement" | "familiar-hook" | "build"> = ["groove"];
    if (amount >= 0.25) actions.push("arrangement");
    if (amount >= 0.5) actions.push("familiar-hook");
    if (amount >= 0.75) actions.push("build");
    return { outputGainIncreaseDb: 0, musicalActions: actions, safeListeningPreserved: true };
}

export interface AccessibilityPreferences {
    reducedMotion: boolean;
    highContrast: boolean;
    screenReaderLabels: boolean;
    keyboardControl: boolean;
    hapticAlternatives: boolean;
    flashingVisuals: boolean;
}
export function accessiblePresentation(
    audioEnergy: number,
    preferences: AccessibilityPreferences,
): {
    visualizerComplexity: "minimal" | "normal";
    flashingAllowed: boolean;
    audioEnergy: number;
    visualEnergyCoupledToAudio: false;
    alternatives: string[];
} {
    const alternatives = [
        preferences.screenReaderLabels && "screen-reader-labels",
        preferences.keyboardControl && "keyboard-control",
        preferences.hapticAlternatives && "haptic-alternatives",
    ].filter((value): value is string => Boolean(value));
    return {
        visualizerComplexity: preferences.reducedMotion ? "minimal" : "normal",
        flashingAllowed: preferences.flashingVisuals && !preferences.reducedMotion,
        audioEnergy: clamp01(audioEnergy),
        visualEnergyCoupledToAudio: false,
        alternatives,
    };
}

export const HEARING_DIVERSITY_POLICY = {
    factors: [
        "age",
        "hearing-thresholds",
        "noise-exposure",
        "headphones",
        "speaker-response",
        "room",
        "listening-level",
    ],
    universalPerceptualTruth: false,
    playbackPreferenceNotMedicalCorrection: true,
    userControlledOnly: true,
} as const;
