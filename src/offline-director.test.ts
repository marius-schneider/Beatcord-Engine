import { expect, test } from "bun:test";

import type { BeatGrid } from "./beatgrid";
import { MusicDirector } from "./music-director";
import {
    createOfflineDirectorBundle,
    type OfflineDirectorTrack,
    OfflineFirstDirector,
    offlineDirectorReadiness,
    parseOfflineDirectorBundle,
} from "./offline-director";
import type { TrackProfile, TrackSection } from "./track-profile";

function grid(bpm: number, camelot: string): BeatGrid {
    return {
        bpm,
        beats: [0, 60 / bpm, 120 / bpm, 180 / bpm],
        beatInterval: 60 / bpm,
        analysisOffset: 0,
        musicalEndSec: 180,
        key: { name: camelot, camelot, confidence: 0.9 },
        energy: { energy: 0.8, percussiveness: 0.74, danceability: 2.5 },
        spectral: { centroid: 3_200, rolloff: 7_000, flatness: 0.1, flux: 0.34 },
        downbeatPhase: 0,
        introSec: 16,
    };
}

function section(type: TrackSection["type"], start: number, end: number): TrackSection {
    return {
        type,
        start,
        end,
        energy: 0.72,
        vocals: 0.12,
        drums: 0.8,
        bass: 0.7,
        entryQuality: 0.86,
        exitQuality: 0.86,
        phraseConfidence: 0.9,
        structureConfidence: 0.9,
    };
}

function profile(id: string, beatGrid: BeatGrid, energy: number): TrackProfile {
    return {
        trackId: id,
        artist: `Artist ${id}`,
        bpm: beatGrid.bpm,
        bpmConfidence: 0.9,
        key: beatGrid.key.name,
        mode: "minor",
        keyConfidence: 0.9,
        genres: [{ genre: "edm", confidence: 0.86 }],
        energy,
        valence: 0.62,
        danceability: 0.85,
        acousticness: 0.1,
        vocalness: 0.15,
        intensity: energy,
        complexity: 0.54,
        loudness: -10,
        dynamicRange: 8,
        beatGrid,
        sections: [section("intro", 0, 24), section("unknown", 24, 156), section("outro", 156, 180)],
        vocalRegions: [],
        intro: { start: 0, end: 24 },
        outro: { start: 156, end: 180 },
        confidence: {
            beatGrid: 0.9,
            phrase: 0.88,
            key: 0.9,
            structure: 0.9,
            vocals: 0.6,
            stems: 0,
            overall: 0.84,
        },
        provenance: { bpm: "measured", key: "measured", genre: "derived", structure: "measured" },
    };
}

function track(id: string, bpm: number, camelot: string, energy: number): OfflineDirectorTrack {
    const beatGrid = grid(bpm, camelot);
    return {
        id,
        profile: profile(id, beatGrid, energy),
        traits: { title: `Track ${id}`, uploader: `Artist ${id}`, grid: beatGrid, durationMs: 190_000 },
    };
}

function fixture() {
    const now = 1_780_000_000_000;
    const director = new MusicDirector({ now: () => now });
    director.setExperience("auto", 0.82, { chill: 0.1, love: 0.1, energy: 0.35, party: 0.45 });
    const tracks = [track("a", 128, "8A", 0.78), track("b", 126, "8A", 0.84), track("c", 124, "9A", 0.7)];
    const bundle = createOfflineDirectorBundle(director, tracks, {
        createdAtMs: now,
        analyzerVersions: { beatGrid: "beat-grid-v2", trackProfile: "track-profile-v1" },
    });
    return { bundle, tracks };
}

test("offline bundle is portable JSON without audio or source locations", () => {
    const { bundle } = fixture();
    const serialized = JSON.stringify(bundle);
    const restored = parseOfflineDirectorBundle(JSON.parse(serialized));

    expect(restored).toEqual(bundle);
    expect(bundle.policy).toEqual({ externalCalls: false, includesAudio: false, includesSourceLocations: false });
    expect(serialized).not.toContain("filePath");
    expect(serialized).not.toContain("sourceUrl");
    expect(serialized).not.toContain("credential");
});

test("repeated queue entries share one portable profile", () => {
    const { tracks } = fixture();
    const director = new MusicDirector({ now: () => 123 });
    const bundle = createOfflineDirectorBundle(director, [tracks[0]!, tracks[1]!, tracks[0]!], {
        createdAtMs: 123,
    });
    expect(bundle.tracks.map((item) => item.id)).toEqual(["a", "b"]);
});

test("independent offline runtimes make the same first decision", () => {
    const { bundle } = fixture();
    const left = new OfflineFirstDirector(bundle);
    const right = new OfflineFirstDirector(JSON.parse(JSON.stringify(bundle)));
    const request = { fromTrackId: "a", toTrackId: "b", lookaheadTrackIds: ["c"] } as const;

    expect(left.plan(request)).toEqual(right.plan(request));
    expect(left.readiness.mode).toBe("full");
    expect(left.readiness.networkRequired).toBe(false);
    expect(left.director.state(bundle.tracks.map((item) => item.profile)).experience.requested).toBe("auto");
});

test("offline runtime ranks cached profiles without a service dependency", () => {
    const runtime = new OfflineFirstDirector(fixture().bundle);
    const ranked = runtime.rank("a", ["b", "c"]);
    expect(ranked.map((candidate) => candidate.profile.trackId).sort()).toEqual(["b", "c"]);
    expect(ranked.every((candidate) => Number.isFinite(candidate.score))).toBe(true);
});

test("missing optional intelligence degrades to safe local planning", () => {
    const { bundle } = fixture();
    for (const item of bundle.tracks) {
        item.traits.grid = null;
        delete item.traits.stemQuality;
        delete item.traits.vocalActivity;
        item.profile.beatGrid = null;
        item.profile.bpm = 0;
        item.profile.bpmConfidence = 0;
        item.profile.genres = [{ genre: "unknown", confidence: 0.2 }];
        item.profile.sections = [];
        item.profile.confidence.beatGrid = 0;
        item.profile.confidence.structure = 0;
    }
    const readiness = offlineDirectorReadiness(bundle);
    const directed = new OfflineFirstDirector(bundle).plan({ fromTrackId: "a", toTrackId: "b" });

    expect(readiness.mode).toBe("safe");
    expect(readiness.offlineCapable).toBe(true);
    expect(readiness.capabilities["beat-grid"].status).toBe("unavailable");
    expect(directed.plan.tempoRatio).toBe(1);
    expect(directed.cue.aStartPlaySec).toBeGreaterThanOrEqual(0);
});

test("untrusted bundles fail closed", () => {
    const { bundle } = fixture();
    expect(parseOfflineDirectorBundle({ ...bundle, version: 99 })).toBeNull();
    expect(parseOfflineDirectorBundle({ ...bundle, policy: { ...bundle.policy, externalCalls: true } })).toBeNull();
    expect(() => new OfflineFirstDirector({ ...bundle, tracks: [{ ...bundle.tracks[0], id: "wrong" }] })).toThrow();
});
