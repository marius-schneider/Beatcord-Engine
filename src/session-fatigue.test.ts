import { expect, test } from "bun:test";

import { assessSessionFatigue, transitionNoveltyBudget } from "./session-fatigue";

test("detects a flat, vocal-heavy and repetitive session", () => {
    const fatigue = assessSessionFatigue({
        recentArtists: ["A", "A", "B", "A", "A"],
        recentGenres: ["edm", "edm", "edm", "edm", "edm"],
        recentKeys: ["8A", "8A", "8A", "8A"],
        recentBpms: [124, 125, 124, 125, 124],
        vocalDensityHistory: [0.8, 0.85, 0.78, 0.9, 0.82],
        energyHistory: [0.7, 0.71, 0.69, 0.7, 0.71],
        transitionHistory: [{ type: "bassdrop" }, { type: "bassdrop" }, { type: "bassdrop" }],
    });

    expect(fatigue.total).toBeGreaterThan(0.55);
    expect(fatigue.genreRepetition).toBe(1);
    expect(fatigue.vocalFatigue).toBeGreaterThan(0.6);
    expect(fatigue.recommendations).toContain("rotate transition strategy");
});

test("short diverse histories remain below fatigue thresholds", () => {
    const fatigue = assessSessionFatigue({
        recentArtists: ["A", "B", "C"],
        recentGenres: ["edm", "pop", "chill"],
        recentKeys: ["8A", "9A", "10B"],
        recentBpms: [100, 118, 128],
        vocalDensityHistory: [0.2, 0.7, 0.3],
        energyHistory: [0.35, 0.7, 0.5],
        transitionHistory: [{ type: "fade" }, { type: "blend" }, { type: "filter" }],
    });

    expect(fatigue.total).toBeLessThan(0.35);
    expect(fatigue.recommendations).toEqual([]);
});

test("repeating a show-off transition depletes its novelty budget", () => {
    const history = [{ type: "bassdrop" }, { type: "filter" }, { type: "bassdrop" }, { type: "bassdrop" }];
    const bassdrop = transitionNoveltyBudget("bassdrop", history);
    const echo = transitionNoveltyBudget("echo", history);

    expect(bassdrop.recentCount).toBe(3);
    expect(bassdrop.consecutiveCount).toBe(2);
    expect(bassdrop.penalty).toBeGreaterThan(0.5);
    expect(echo.penalty).toBe(0);
});

test("safe fades retain substantially more budget than repeated effects", () => {
    const repeated = Array.from({ length: 4 }, () => ({ type: "fade" }));
    expect(transitionNoveltyBudget("fade", repeated).penalty).toBeLessThan(0.15);
    expect(transitionNoveltyBudget("spinback", repeated).penalty).toBe(0);
});
