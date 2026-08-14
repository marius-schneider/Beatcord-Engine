import { describe, expect, test } from "bun:test";
import {
    assessOverplay,
    classifyConsumptionTrend,
    classifyFamiliarity,
    detectPersonalTrend,
    detectTasteDrift,
    EXPLORATION_POLICIES,
    NegativeTasteGraph,
    planExplorationBridge,
    RecommendationMemory,
    rediscoveryPotential,
    TastePhaseHistory,
} from "./taste-dynamics";

describe("taste dynamics and exploration", () => {
    test("keeps popular, trending, viral, rising, evergreen and rediscovered distinct", () => {
        expect(
            classifyConsumptionTrend({
                absoluteConsumption: 0.95,
                sustainedGrowth: 0.1,
                sharingVelocity: 0.1,
                crossCommunitySpread: 0.2,
                baselineConsumption: 0.9,
                ageDays: 30,
                renewedGrowth: 0,
            }).trend,
        ).toBe("popular");
        expect(
            classifyConsumptionTrend({
                absoluteConsumption: 0.2,
                sustainedGrowth: 0.95,
                sharingVelocity: 0.3,
                crossCommunitySpread: 0.3,
                baselineConsumption: 0.05,
                ageDays: 20,
                renewedGrowth: 0,
            }).trend,
        ).toBe("rising");
        expect(
            classifyConsumptionTrend({
                absoluteConsumption: 0.4,
                sustainedGrowth: 0.4,
                sharingVelocity: 1,
                crossCommunitySpread: 1,
                baselineConsumption: 0.2,
                ageDays: 20,
                renewedGrowth: 0,
            }).trend,
        ).toBe("viral");
    });

    test("detects personal growth and taste drift without overwriting long-term taste", () => {
        expect(
            detectPersonalTrend([
                { period: "jan", value: 2, atMs: 1 },
                { period: "feb", value: 4, atMs: 2 },
                { period: "mar", value: 12, atMs: 3 },
                { period: "apr", value: 38, atMs: 4 },
            ]).direction,
        ).toBe("rising");
        const drift = detectTasteDrift({ house: 0.82, dnb: 0.2 }, { house: 0.61, dnb: 0.72 });
        expect(drift.possibleShift).toBe(true);
        expect(drift.preserveLongTerm).toBe(true);
    });

    test("stores finite taste phases without deleting history", () => {
        const phases = new TastePhaseHistory();
        phases.start({ id: "house", name: "Summer House", startedAt: 1, genres: { house: 0.9 }, confidence: 0.8 });
        phases.start({ id: "dnb", name: "DnB Phase", startedAt: 2, genres: { dnb: 0.9 }, confidence: 0.7 });
        expect(phases.all()[0]?.endedAt).toBe(2);
        expect(phases.current()?.id).toBe("dnb");
    });

    test("supports contextual negative exceptions", () => {
        const graph = new NegativeTasteGraph();
        graph.add({ id: "album-y", targetType: "album", targetId: "y", weight: 1, explicit: true });
        graph.add({
            id: "acoustic-party",
            targetType: "version",
            targetId: "acoustic",
            context: "party",
            weight: 0.8,
            explicit: true,
        });
        expect(graph.penalty({ trackId: "x", artistId: "liked", albumId: "y" }).hardBlocked).toBe(true);
        expect(graph.penalty({ trackId: "x", version: "acoustic", context: "chill" }).penalty).toBe(0);
        expect(graph.penalty({ trackId: "x", version: "acoustic", context: "party" }).penalty).toBe(0.8);
    });

    test("models familiarity and temporary overplay separately from taste", () => {
        expect(classifyFamiliarity({ plays: 0, completions: 0, saves: 0, favorite: false, recentPlays: 0 }).level).toBe(
            "never-heard",
        );
        expect(
            classifyFamiliarity({ plays: 20, completions: 18, saves: 1, favorite: true, recentPlays: 18 }).level,
        ).toBe("overplayed");
        const now = 1_000_000_000;
        const overplay = assessOverplay(
            Array.from({ length: 18 }, (_, index) => now - index * 10_000),
            now,
            true,
        );
        expect(overplay.temporaryPenalty).toBeGreaterThan(0);
        expect(overplay.permanentTastePenalty).toBe(0);
    });

    test("scores rediscovery and remembers later searches as positive evidence", () => {
        const now = 2_000_000_000_000;
        expect(
            rediscoveryPotential(
                {
                    affinity: 0.95,
                    lastPlayedAt: now - 14 * 30 * 86_400_000,
                    lastLovedAt: now - 2 * 365 * 86_400_000,
                    playCount: 30,
                    currentContextFit: 0.8,
                },
                now,
            ),
        ).toBeGreaterThan(0.8);
        const memory = new RecommendationMemory();
        memory.record({ trackId: "x", outcome: "ignored", atMs: 1 });
        memory.record({ trackId: "x", outcome: "searched-later", atMs: 2 });
        expect(memory.relevanceAdjustment("x")).toBeGreaterThan(0);
    });

    test("uses controlled exploration and musical bridges", () => {
        expect(EXPLORATION_POLICIES.wild.bridgeRequired).toBe(true);
        expect(EXPLORATION_POLICIES.safe.genreDistanceMax).toBeLessThan(EXPLORATION_POLICIES.wild.genreDistanceMax);
        const route = planExplorationBridge("favorite", "unknown", [
            { trackId: "bridge", familiarity: 0.6, compatibilityToPrevious: 0.9, compatibilityToDiscovery: 0.85 },
            { trackId: "bad", familiarity: 0.8, compatibilityToPrevious: 0.2, compatibilityToDiscovery: 0.2 },
        ]);
        expect(route.route).toEqual(["favorite", "bridge", "unknown"]);
    });
});
