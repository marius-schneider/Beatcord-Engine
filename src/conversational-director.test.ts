import { describe, expect, test } from "bun:test";
import {
    CONVERSATIONAL_TOOL_LAYER,
    controlTier,
    conversationApplication,
    critiqueFromText,
    deterministicToolParameters,
    LLM_BOUNDARY,
    PRODUCTION_NL_SYSTEMS,
    parseMusicIntent,
    RECOMMENDATION_MODE_WEIGHTS,
    resolveCatalogEntity,
    storeConversationMemory,
    usefulExplanation,
} from "./conversational-director";

describe("conversational music director", () => {
    test("parses gradual energy and subtle mixing into structured intent", () => {
        const result = parseMusicIntent(
            "Mach es in 30 Minuten langsam etwas energetischer, aber keine harten Übergänge.",
        );
        expect(result.desiredJourney).toMatchObject({ targetEnergyDelta: 0.25, transitionMinutes: 30 });
        expect(result.softPreferences.find((p) => p.field === "mix-intensity")?.direction).toBe("decrease");
    });
    test("distinguishes hard, soft, future and next language", () => {
        expect(parseMusicIntent("Auf keinen Fall Deutschrap.").hardConstraints).toContainEqual({
            field: "genre",
            operator: "exclude",
            value: "deutschrap",
        });
        expect(parseMusicIntent("Lieber etwas weniger Deutschrap.").softPreferences[0]?.direction).toBe("decrease");
        expect(parseMusicIntent("In 20 Minuten Richtung Techno.").temporalConstraints?.[0]).toMatchObject({
            afterMinutes: 20,
            action: "prefer-genre",
        });
        expect(parseMusicIntent("Spiel X als Nächstes.").hardConstraints[0]?.operator).toBe("next");
    });
    test("maps critique language to deterministic controlled operators", () => {
        expect(critiqueFromText("Less aggressive mixing")).toEqual({
            type: "reduce-mix-intensity",
            scope: "mix",
            deterministicOperation: true,
        });
        expect(critiqueFromText("Less vocals")?.scope).toBe("track");
    });
    test("keeps the LLM as orchestrator over deterministic tools", () => {
        expect(CONVERSATIONAL_TOOL_LAYER).toHaveLength(7);
        expect(LLM_BOUNDARY.llmAudioEngine).toBe(false);
        expect(LLM_BOUNDARY.validationRequired).toBe(true);
        expect(deterministicToolParameters("Find upbeat 2000s tracks everyone knows")).toEqual({
            arousal: "high",
            eraStart: 2000,
            eraEnd: 2009,
            crowdFamiliarity: "high",
        });
    });
    test("blocks hallucinated or unavailable tracks through catalog resolution", () => {
        const catalog = [{ id: "1", title: "Real Song", artist: "Artist", available: true }];
        expect(resolveCatalogEntity("Real Song", catalog).verified).toBe(true);
        expect(resolveCatalogEntity("Imaginary Song", catalog)).toMatchObject({
            entity: null,
            verified: false,
            hallucinationBlocked: true,
        });
    });
    test("tracks production evidence without bypassing the ranker", () => {
        expect(PRODUCTION_NL_SYSTEMS).toEqual(["jam", "muchator", "production-playlist-agent-2026"]);
    });
    test("keeps playback running and applies normal intents beyond commit horizon", () => {
        expect(
            conversationApplication({ command: "mehr techno", transitionState: "committed", isSkip: false }),
        ).toEqual({ playbackContinues: true, apply: "outside-commit-horizon", abortTransition: false });
        expect(
            conversationApplication({ command: "skip", transitionState: "committed", isSkip: true }).abortTransition,
        ).toBe(true);
    });
    test("stores persistent conversational memory only with explicit save", () => {
        expect(storeConversationMemory("never long transitions", "persistent", false).layer).toBe("session");
        expect(storeConversationMemory("never long transitions", "persistent", true).layer).toBe("persistent");
    });
    test("adapts control depth to context and preference", () => {
        expect(
            controlTier("driving", { preferredAutomation: 0, explanationFrequency: 1, manualCorrectionDepth: 1 }),
        ).toEqual({ tier: "simple", maxVisibleControls: 2 });
        expect(
            controlTier("desktop", { preferredAutomation: 0, explanationFrequency: 1, manualCorrectionDepth: 1 }).tier,
        ).toBe("lab");
    });
    test("offers transparent modes and useful-level explanations", () => {
        expect(RECOMMENDATION_MODE_WEIGHTS.discover.novelty).toBeGreaterThan(
            RECOMMENDATION_MODE_WEIGHTS["for-you"].novelty,
        );
        expect(RECOMMENDATION_MODE_WEIGHTS["best-mix"].mix).toBe(0.55);
        expect(usefulExplanation(["vibe", "smooth-mix"], "normal", true, 0).text).toBe(
            "Fits the current vibe and mixes smoothly.",
        );
        expect(usefulExplanation(["vibe"], "normal", false, 0).show).toBe(false);
    });
});
