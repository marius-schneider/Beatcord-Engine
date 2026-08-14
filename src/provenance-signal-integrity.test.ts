import { describe, expect, test } from "bun:test";
import {
    AUDIO_UNDERSTANDING_CI,
    creativeBoundary,
    evaluationEnsemble,
    musicModelRegression,
    PROACTIVE_TASTE_CHOICES,
    PROVENANCE_RESEARCH,
    proactiveTastePolicy,
    provenanceRecommendation,
    provenanceVector,
    signalPath,
    spatialTransition,
    wirelessAudioPolicy,
} from "./provenance-signal-integrity";

describe("provenance and signal integrity", () => {
    test("uses trusted provider provenance and user-controlled AI preference", () => {
        const ai = { origin: "ai" as const, confidence: 0.95, providerLabel: "provider-ai", trustedProviderData: true };
        expect(provenanceRecommendation(ai, "hide")).toMatchObject({
            allowed: false,
            scoreMultiplier: 0,
            labelShown: true,
        });
        expect(provenanceRecommendation(ai, "deprioritize").scoreMultiplier).toBe(0.65);
    });
    test("does not expose uncertain self-classification as truth", () => {
        expect(provenanceRecommendation({ origin: "ai", confidence: 0.4, trustedProviderData: false }, "hide")).toEqual(
            { allowed: true, scoreMultiplier: 1, labelShown: false, uncertainClassifierClaim: false },
        );
        expect(PROVENANCE_RESEARCH.ownDetectionAsTruthForbidden).toBe(true);
    });
    test("represents hybrid origin per composition, vocal, instruments and production", () => {
        expect(
            provenanceVector(
                { composition: "human", vocal: "ai", instruments: "human", production: "hybrid" },
                0.9,
                true,
            ),
        ).toEqual({
            composition: "human",
            vocal: "ai",
            instruments: "human",
            production: "hybrid",
            confidence: 0.9,
            trustedData: true,
        });
    });
    test("offers proactive taste isolation choices at session start", () => {
        expect(PROACTIVE_TASTE_CHOICES).toHaveLength(4);
        expect(proactiveTastePolicy("dont-learn")).toEqual({
            bucket: "personal",
            persistent: false,
            promptAtSessionStart: true,
        });
        expect(proactiveTastePolicy("party-profile").bucket).toBe("party");
    });
    test("preserves lossless inputs through minimal chill paths", () => {
        expect(signalPath("chill", true)).toMatchObject({
            stages: ["decode", "gain", "optional-gentle-transition", "output"],
            preservesLosslessBenefit: true,
        });
        expect(signalPath("party", true).stages).toContain("stems");
    });
    test("separates Auracast broadcast from controlled multiroom rendering", () => {
        expect(
            wirelessAudioPolicy({ auracast: true, measuredReceiverLatency: false, multiroomRendering: false }),
        ).toMatchObject({ use: "broadcast", exactReceiverLatencyClaim: false });
        expect(
            wirelessAudioPolicy({ auracast: true, measuredReceiverLatency: true, multiroomRendering: true }).use,
        ).toBe("synchronized-multiroom");
    });
    test("uses spatial handoff only for genuine supported spatial sources", () => {
        expect(
            spatialTransition(
                { genuineMultichannel: true, foregroundPosition: 0, ambienceWidth: 0.4 },
                { genuineMultichannel: true, foregroundPosition: 0.2, ambienceWidth: 0.8 },
                "headphones",
            ),
        ).toMatchObject({ enabled: true, artificialExtremePanning: false, personalContextPersisted: false });
        expect(
            spatialTransition(
                { genuineMultichannel: false, foregroundPosition: 0, ambienceWidth: 0 },
                { genuineMultichannel: false, foregroundPosition: 0, ambienceWidth: 0 },
                "speaker",
            ).enabled,
        ).toBe(false);
    });
    test("separates creative remix from adaptive playback rights boundary", () => {
        expect(creativeBoundary("adaptive-playback")).toEqual({
            preserveArtistRecording: true,
            transformationAllowed: false,
            explicitUserOptIn: false,
        });
        expect(creativeBoundary("creative-remix").explicitUserOptIn).toBe(true);
    });
    test("uses LLM judge only as one component of an evaluation ensemble", () => {
        const result = evaluationEnsemble({ objective: 1, specialist: 1, llmJudge: 0, humanPanel: 1, realBehavior: 1 });
        expect(result.score).toBe(0.9);
        expect(result.llmGroundTruth).toBe(false);
    });
    test("runs tolerance-based model regression suites in CI", () => {
        expect(AUDIO_UNDERSTANDING_CI.suites).toHaveLength(4);
        expect(
            musicModelRegression([
                { id: "chorus", actual: 61, expected: 60, tolerance: 2 },
                { id: "vocal", actual: true, expected: true },
            ]),
        ).toEqual({ passed: true, failures: [] });
        expect(musicModelRegression([{ id: "outro", actual: 20, expected: 30, tolerance: 2 }]).failures).toEqual([
            "outro",
        ]);
    });
});
