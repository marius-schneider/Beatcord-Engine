import { describe, expect, test } from "bun:test";
import {
    AMBIENT_PRIVACY,
    adaptiveMasterBudget,
    adaptivePlaybackPolicy,
    ambientLoudnessProtection,
    bioadaptiveEnergy,
    bodyAlignedJourney,
    conversationSafeJourney,
    hapticRoleMix,
    motionCompatibility,
    perceptualHapticCritic,
    safeEnergyStrategy,
    semanticEnvironmentMix,
    spatialProfilePolicy,
    spatialRoleHandoff,
    spectralEnvironmentDucking,
    virtualVenue,
} from "./perceptual-playback-embodiment";

describe("perceptual playback and embodiment", () => {
    const twin = {
        outputDevice: {
            type: "phone" as const,
            dynamicCapability: 0.3,
            maxReliableBass: 0.2,
            spatialCapability: 0,
            calibrationConfidence: 0.8,
        },
        environmentNoise: 0.4,
        userAudioPreferences: { clarity: 0.8, bass: 0.5, dynamics: 0.7 },
        confidence: 0.8,
    };
    test("selects subtle output-specific playback policy", () => {
        expect(adaptivePlaybackPolicy(twin)).toEqual({
            policy: "protect-low-end-headroom",
            subtle: true,
            reversible: true,
            artistPreserving: true,
        });
    });
    test("keeps adaptive mastering tightly budgeted", () => {
        expect(adaptiveMasterBudget("chill").eqDb).toBe(0.6);
        expect(adaptiveMasterBudget("party").eqDb).toBe(1.5);
    });
    test("uses clarity before volume in noise", () => {
        expect(ambientLoudnessProtection(0.6)).toMatchObject({
            clarityAdaptation: 0.3,
            volumeGainDb: 0,
            volumeLast: true,
        });
        expect(ambientLoudnessProtection(0.9).volumeGainDb).toBe(1);
    });
    test("raises energy without raising SPL", () => {
        expect(safeEnergyStrategy(1)).toMatchObject({ rhythm: 1, journey: 1, splIncreaseDb: 0 });
    });
    test("keeps warnings audible and generic traffic reduced", () => {
        expect(semanticEnvironmentMix("sirens")).toEqual({ level: 1, class: "always-hear" });
        expect(semanticEnvironmentMix("traffic")).toEqual({ level: 0.2, class: "reduce" });
    });
    test("creates spectral pockets for speech", () => {
        expect(spectralEnvironmentDucking({ type: "speech", urgency: 0.5, confidence: 0.9 })).toEqual({
            gainDuckDb: 0,
            spectralPocket: [1_000, 4_000],
            preserveImmersion: true,
        });
    });
    test("preserves important moments around conversation", () => {
        expect(conversationSafeJourney({ type: "speech", urgency: 0.5, confidence: 0.9 }, 10).action).toBe(
            "delay-target-moment",
        );
        expect(AMBIENT_PRIVACY).toMatchObject({
            rawMicrophoneStored: false,
            explicitOptIn: true,
            transcriptionRequired: false,
        });
    });
    test("prefers OS spatial profiles and never fakes calibration", () => {
        expect(spatialProfilePolicy(null)).toEqual({
            personalization: "generic",
            confidence: 0.25,
            source: "beatcord",
        });
        const os = { personalization: "measured" as const, confidence: 0.9, source: "os-provided" as const };
        expect(spatialProfilePolicy(os)).toBe(os);
    });
    test("keeps normal spatial role movement subtle", () => {
        expect(spatialRoleHandoff([{ role: "vocal", azimuth: 0 }], false)).toMatchObject({
            movement: "subtle",
            objectives: ["separation", "clarity", "continuity"],
        });
    });
    test("applies virtual venues only by explicit choice", () => {
        expect(virtualVenue("small-club", false)).toEqual({
            apply: false,
            venue: "small-club",
            automaticMasterReverb: false,
        });
    });
    test("compiles device-specific haptics", () => {
        const ir = {
            pulse: [{ time: 0, intensity: 1, kind: "pulse" as const }],
            bass: [{ time: 0, intensity: 1, kind: "pulse" as const }],
            moments: [{ time: 1, intensity: 1, kind: "drop" as const }],
        };
        expect(hapticRoleMix("watch", ir)[0]?.intensity).toBe(0.3);
        expect(hapticRoleMix("phone", ir)).toEqual(ir.moments);
        expect(hapticRoleMix("chair-vest", ir)).toHaveLength(2);
    });
    test("scores haptic mappings with human perception", () => {
        expect(perceptualHapticCritic({ alignment: 1, humanRating: 1, comfort: 1 })).toBe(1);
    });
    test("aligns motion beyond BPM", () => {
        const movement = {
            cadence: 120,
            accentPattern: [1],
            groove: 0.7,
            barPhase: 0,
            contactPattern: [1],
            confidence: 1,
        };
        expect(motionCompatibility(movement, movement)).toBe(1);
        expect(bodyAlignedJourney("push")).toEqual({
            phase: "push",
            target: "strong-aligned-moments",
            medicalClaim: false,
        });
    });
    test("uses bio signals only as physical activation", () => {
        expect(bioadaptiveEnergy({ activityLevel: 0.8, confidence: 0.9 }, "workout")).toEqual({
            allowed: true,
            interpretation: "physical-activation",
            emotionClaim: false,
        });
        expect(bioadaptiveEnergy({ activityLevel: 0.8, confidence: 0.9 }, "emotion-inference").allowed).toBeFalse();
    });
});
