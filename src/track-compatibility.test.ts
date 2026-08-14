import { expect, test } from "bun:test";

import type { BeatGrid } from "./beatgrid";
import {
    assessTrackCompatibility,
    buildTrackCompatibilityGraph,
    scoreCompatibilityRoutes,
} from "./track-compatibility";
import { buildTrackProfile, type TrackProfile } from "./track-profile";

function profile(id: string, bpm: number, camelot: string, energy: number, genre = "edm"): TrackProfile {
    const grid: BeatGrid = {
        bpm,
        beats: Array.from({ length: 64 }, (_, index) => index * (60 / bpm)),
        beatInterval: 60 / bpm,
        analysisOffset: 0,
        musicalEndSec: 176,
        key: { name: camelot, camelot, confidence: 0.9 },
        energy: { energy, percussiveness: energy * 0.8, danceability: energy * 2.5 },
        spectral: {
            centroid: 2_000 + energy * 2_000,
            rolloff: 6_000,
            flatness: 0.1 + energy * 0.05,
            flux: energy * 0.4,
        },
        downbeatPhase: 0,
        introSec: 8,
    };
    const result = buildTrackProfile(
        { id, title: id, durationMs: 180_000 },
        {
            grid,
            genre: genre as "edm",
            sections: [
                { startSec: 0, endSec: 16, kind: "intro", level: energy * 0.5 },
                { startSec: 16, endSec: 152, kind: "body", level: energy },
                { startSec: 152, endSec: 176, kind: "outro", level: energy * 0.6 },
            ],
        },
    );
    result.confidence = {
        beatGrid: 0.9,
        phrase: 0.85,
        key: 0.9,
        structure: 0.82,
        vocals: 0.75,
        stems: 0,
        overall: 0.85,
    };
    return result;
}

test("compatibility exposes why a close pair is safer than a distant pair", () => {
    const current = profile("current", 124, "8A", 0.7);
    const close = assessTrackCompatibility(current, profile("close", 126, "9A", 0.73), { energy: 0.75 });
    const distant = assessTrackCompatibility(current, profile("distant", 92, "2B", 0.25, "chill"), {
        energy: 0.75,
    });

    expect(close.total).toBeGreaterThan(distant.total);
    expect(close.tempo).toBeGreaterThan(distant.tempo);
    expect(close.key).toBeGreaterThan(distant.key);
    expect(close.reasons).toContain("harmonic hand-off");
    expect(distant.reasons).toContain("wide tempo gap");
});

test("builds a complete directed graph without self edges", () => {
    const profiles = [profile("a", 120, "8A", 0.6), profile("b", 122, "9A", 0.65), profile("c", 100, "3B", 0.4)];
    const graph = buildTrackCompatibilityGraph(profiles);

    expect(graph.nodeIds).toEqual(["a", "b", "c"]);
    expect(graph.edges).toHaveLength(6);
    expect(graph.edges.every((edge) => edge.fromTrackId !== edge.toTrackId)).toBe(true);
});

test("compatibility recognizes half-time and 3:2 pulse bridges", () => {
    const halfTime = assessTrackCompatibility(profile("a", 70, "8A", 0.7), profile("b", 140, "8A", 0.7));
    const threeTwo = assessTrackCompatibility(profile("c", 100, "8A", 0.7), profile("d", 150, "8A", 0.7));

    expect(halfTime.tempoRelation).toBe("double-time");
    expect(halfTime.tempo).toBeGreaterThan(0.85);
    expect(threeTwo.tempoRelation).toBe("three-over-two");
    expect(threeTwo.tempoPlausibility).toBeGreaterThan(0.7);
    expect(threeTwo.reasons.some((reason) => reason.includes("3:2 pulse"))).toBe(true);
});

test("route scoring can prefer a bridge with a stronger continuation over a direct dead end", () => {
    const current = profile("current", 120, "8A", 0.6);
    const deadEnd = profile("dead-end", 132, "8A", 0.95);
    const bridge = profile("bridge", 104, "10A", 0.48);
    const destination = profile("destination", 102, "10A", 0.45);
    const routes = scoreCompatibilityRoutes(current, [deadEnd, bridge, destination], {
        depth: 2,
        decay: 1,
        target: { energy: 0.45, danceability: 0.45 },
    });
    const bridgeRoute = routes.find((route) => route.trackIds[1] === "bridge");
    const deadEndRoute = routes.find((route) => route.trackIds[1] === "dead-end");

    expect(bridgeRoute?.trackIds[2]).toBe("destination");
    expect(bridgeRoute?.futureScore).toBeGreaterThan(deadEndRoute?.futureScore ?? 1);
    expect(bridgeRoute?.score).toBeGreaterThan(deadEndRoute?.score ?? 1);
});
