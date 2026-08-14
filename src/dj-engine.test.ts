import { describe, expect, test } from "bun:test";

import { DjMemory } from "./dj-memory";
import { trackDNA } from "./dna";
import { persona, phaseAt, scoreForSet, targetAt, targetEnergyAt } from "./personas";
import type { AnalysisRecord } from "./prefetch";

// Minimal fake grid — only the fields the DNA reads.
function rec(over: {
    bpm?: number;
    energy?: number;
    dance?: number;
    perc?: number;
    centroid?: number;
    flatness?: number;
    flux?: number;
    rolloff?: number;
    camelot?: string;
    genre?: AnalysisRecord["genre"];
    drop?: boolean;
    swing?: number;
}): AnalysisRecord {
    return {
        filePath: "/x.opus",
        genre: over.genre ?? "edm",
        complete: true,
        ...(over.drop ? { sections: [{ startSec: 30, endSec: 60, kind: "drop", level: 0.9 }] } : {}),
        ...(over.swing ? { groove: { kind: "swing", swing: over.swing } } : {}),
        grid: {
            bpm: over.bpm ?? 128,
            key: { camelot: over.camelot ?? "8A", name: "A minor", confidence: 1 },
            energy: { energy: over.energy ?? 0.7, percussiveness: over.perc ?? 0.5, danceability: over.dance ?? 2 },
            spectral: {
                centroid: over.centroid ?? 3000,
                rolloff: over.rolloff ?? 8000,
                flatness: over.flatness ?? 0.1,
                flux: over.flux ?? 0.2,
            },
        } as unknown as AnalysisRecord["grid"],
    };
}

describe("Song-DNA", () => {
    test("no grid → null", () => {
        expect(trackDNA({ filePath: "x", genre: "edm", complete: true, grid: null })).toBeNull();
        expect(trackDNA(undefined)).toBeNull();
    });

    test("0..1 features stay normalized", () => {
        const d = trackDNA(rec({}))!;
        for (const k of [
            "energy",
            "intensity",
            "danceability",
            "mood",
            "vocalness",
            "festivalFit",
            "loungeFit",
        ] as const) {
            expect(d[k]).toBeGreaterThanOrEqual(0);
            expect(d[k]).toBeLessThanOrEqual(1);
        }
    });

    test("driving EDM fits festival; sparse chill fits lounge", () => {
        const edm = trackDNA(rec({ energy: 0.9, dance: 2.7, perc: 0.75, bpm: 128, drop: true, genre: "edm" }))!;
        const chill = trackDNA(rec({ energy: 0.25, dance: 0.7, perc: 0.2, bpm: 95, centroid: 1400, genre: "chill" }))!;
        expect(edm.festivalFit).toBeGreaterThan(chill.festivalFit);
        expect(chill.loungeFit).toBeGreaterThan(edm.loungeFit);
    });

    test("vocal genres read as more vocal-forward", () => {
        const pop = trackDNA(rec({ genre: "pop" }))!;
        const edm = trackDNA(rec({ genre: "edm" }))!;
        expect(pop.vocalness).toBeGreaterThan(edm.vocalness);
        expect(pop.singalong).toBeGreaterThan(edm.singalong);
    });

    test("major key + brightness lift the mood", () => {
        const major = trackDNA(rec({ camelot: "8B", centroid: 4200, energy: 0.7 }))!;
        const minor = trackDNA(rec({ camelot: "8A", centroid: 1500, energy: 0.7 }))!;
        expect(major.mood).toBeGreaterThan(minor.mood);
    });

    test("time-of-day tracks energy", () => {
        expect(trackDNA(rec({ energy: 0.2 }))!.timeOfDay).toBe("afternoon");
        expect(trackDNA(rec({ energy: 0.95 }))!.timeOfDay).toBe("afterhours");
    });
});

describe("Set Engine arc", () => {
    const club = persona("club");

    test("phases fall in order across the night", () => {
        expect(phaseAt(club, 0.0)).toBe("warmup");
        expect(phaseAt(club, 0.3)).toBe("build");
        expect(phaseAt(club, 0.6)).toBe("peak");
        expect(phaseAt(club, 0.95)).toBe("cooldown");
    });

    test("energy starts near floor, tops out near peak, eases to tail", () => {
        expect(targetEnergyAt(club, 0)).toBeCloseTo(club.floorEnergy, 1);
        expect(targetEnergyAt(club, 0.6)).toBeGreaterThan(targetEnergyAt(club, 0));
        expect(targetEnergyAt(club, 0.99)).toBeLessThan(targetEnergyAt(club, 0.6));
    });

    test("personas differ: festival peaks harder than lounge", () => {
        expect(targetEnergyAt(persona("festival"), 0.6)).toBeGreaterThan(targetEnergyAt(persona("lounge"), 0.6));
    });

    test("unknown persona id falls back to a valid persona", () => {
        expect(persona("nonsense").id).toBeDefined();
    });
});

describe("scoreForSet", () => {
    const club = persona("club");

    test("a candidate on the target energy beats one far off", () => {
        const target = targetAt(club, 0.6); // peak-ish
        const onTarget = trackDNA(rec({ energy: target.energy, dance: 2.4 }));
        const offTarget = trackDNA(rec({ energy: 0.15, dance: 0.5 }));
        const s1 = scoreForSet(club, target, onTarget, 0.8, 0.8, 0.5);
        const s2 = scoreForSet(club, target, offTarget, 0.8, 0.8, 0.5);
        expect(s1).toBeGreaterThan(s2);
    });

    test("null DNA is handled (penalized, not crashing)", () => {
        const target = targetAt(club, 0.5);
        expect(Number.isFinite(scoreForSet(club, target, null, 0.5, 0.5, 0.5))).toBe(true);
    });

    test("positive memory lifts the score", () => {
        const target = targetAt(club, 0.5);
        const dna = trackDNA(rec({}));
        const hi = scoreForSet(club, target, dna, 0.7, 0.7, 0.9);
        const lo = scoreForSet(club, target, dna, 0.7, 0.7, 0.1);
        expect(hi).toBeGreaterThan(lo);
    });
});

describe("DJ memory (pair affinity)", () => {
    test("unknown pairs are neutral", () => {
        const m = new DjMemory();
        expect(m.pairScore("a", "b", "edm", "edm", "u_neutral")).toBe(0.5);
    });

    test("played lifts, skipped drops — per user", () => {
        const m = new DjMemory();
        m.remember("a", "b", "edm", "edm", "played", "u_test1");
        m.remember("a", "c", "edm", "hiphop", "skipped", "u_test1");
        expect(m.pairScore("a", "b", "edm", "edm", "u_test1")).toBeGreaterThan(0.5);
        expect(m.pairScore("a", "c", "edm", "hiphop", "u_test1")).toBeLessThan(0.5);
        // Another user hasn't learned anything.
        expect(m.pairScore("a", "b", "edm", "edm", "u_test2")).toBe(0.5);
    });

    test("genre pairing generalizes to unseen song pairs", () => {
        const m = new DjMemory();
        for (let i = 0; i < 4; i++) m.remember(`x${i}`, `y${i}`, "chill", "chill", "played", "u_gen");
        // A brand-new chill→chill song pair benefits from the learned genre bias.
        expect(m.pairScore("new1", "new2", "chill", "chill", "u_gen")).toBeGreaterThan(0.5);
    });
});
