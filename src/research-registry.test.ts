import { describe, expect, test } from "bun:test";

import { RESEARCH_SOURCES, researchProvenanceForDecision, researchRegistry } from "./research-registry";

describe("research registry", () => {
    test("keeps every roadmap source unique, linked and actionable", () => {
        const registry = researchRegistry();
        expect(registry.sources).toHaveLength(22);
        expect(new Set(registry.sources.map((source) => source.id)).size).toBe(22);
        expect(new Set(registry.sources.map((source) => source.url)).size).toBe(22);
        expect(registry.sources.every((source) => source.url.startsWith("https://"))).toBe(true);
        expect(registry.sources.every((source) => source.themes.length > 0 && source.capabilities.length > 0)).toBe(
            true,
        );
        expect(Object.values(registry.coverage).every((sourceIds) => sourceIds.length > 0)).toBe(true);
    });

    test("decision provenance adds specialist sources only when relevant", () => {
        const plain = researchProvenanceForDecision({
            transitionType: "fade",
            tempoRatio: 1,
            usesStems: false,
            harmonicOverlap: false,
            fixedTimestampFallback: true,
            hasStructuredRegions: false,
            overrideApplied: false,
            rescueAvailable: true,
            journeyPlanned: true,
        });
        const advanced = researchProvenanceForDecision({
            transitionType: "acapella",
            tempoRatio: 1.04,
            usesStems: true,
            harmonicOverlap: true,
            fixedTimestampFallback: false,
            hasStructuredRegions: true,
            overrideApplied: true,
            rescueAvailable: true,
            journeyPlanned: true,
        });
        expect(plain.sourceIds).not.toContain("ableton-warping");
        expect(plain.sourceIds).not.toContain("spotify-mix-report");
        expect(advanced.sourceIds).toContain("ableton-warping");
        expect(advanced.sourceIds).toContain("demucs-paper");
        expect(advanced.sourceIds).toContain("djstudio-harmonic");
        expect(advanced.sourceIds).toContain("spotify-mix-report");
    });

    test("archived or context-sensitive references retain their caveats", () => {
        expect(RESEARCH_SOURCES.find((source) => source.id === "demucs")?.caveat).toContain("archived");
        expect(RESEARCH_SOURCES.find((source) => source.id === "ebu-r128")?.caveat).toContain("Broadcast");
    });
});
