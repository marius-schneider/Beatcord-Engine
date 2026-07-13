import { expect, test } from "bun:test";

import type { BeatGrid } from "./beatgrid";
import { scoreStemQuality } from "./stem-quality";
import { planTransition, type TrackTraits, tempoMatchRatio } from "./transition-planner";
import { buildVocalActivityProfile } from "./vocal-activity";

/** Build a minimal BeatGrid with the fields the planner reads. */
function grid(
    bpm: number,
    camelot: string,
    percussiveness: number,
    keyConf = 0.8,
    spectral = { centroid: 3200, rolloff: 6000, flatness: 0.1, flux: 0.3 },
): BeatGrid {
    return {
        bpm,
        beats: [0, 60 / bpm],
        beatInterval: 60 / bpm,
        analysisOffset: 0,
        musicalEndSec: 180,
        key: { name: camelot, camelot, confidence: keyConf },
        energy: { energy: 1, percussiveness },
        spectral,
        downbeatPhase: 0,
        introSec: 0,
    };
}

function track(title: string, g: BeatGrid | null, uploader: string | null = null): TrackTraits {
    return { title, uploader, grid: g, durationMs: 200_000 };
}

function vocalActivity(activeFromSec: number, activeToSec: number) {
    const sr = 1000;
    const samples = new Float32Array(sr * 20);
    for (let i = 0; i < samples.length; i++) {
        const sec = i / sr;
        samples[i] = sec >= activeFromSec && sec < activeToSec ? 0.07 : 0.001;
    }
    return buildVocalActivityProfile(samples, sr, { segmentSec: 4, windowMs: 80 });
}

test("two close-tempo, in-key, punchy tracks → beatmatched blend (or its high-energy bass-drop variant)", () => {
    const cur = track("Track A", grid(128, "8A", 0.7));
    const next = track("Track B", grid(129, "9A", 0.7)); // +1 Camelot = compatible
    const plan = planTransition(cur, next, 6);
    expect(["blend", "bassdrop", "riser"]).toContain(plan.type);
    expect(plan.eqSweep).toBe(true);
});

test("stems ready + in-key, close tempo → acapella move (A's vocal over B's beat)", () => {
    const cur = track("Track A", grid(128, "8A", 0.7));
    const next = track("Track B", grid(128, "8A", 0.7)); // same key = keyScore 1.0
    const plan = planTransition(cur, next, 6, { maxFadeSec: 12, tempoTolerance: 0.08, stemsReady: true });
    expect(plan.type).toBe("acapella");
});

test("stems ready but poor vocal stem quality → NOT acapella", () => {
    const cur = track("Track A", grid(128, "8A", 0.7));
    cur.stemQuality = scoreStemQuality({
        vocalRms: 0.001,
        instrumentalRms: 0.04,
        vocalDensity: 0.03,
        vocalDynamicRange: 1.2,
        vocalToInstrumentalDb: -32,
    });
    const next = track("Track B", grid(128, "8A", 0.7));
    const plan = planTransition(cur, next, 6, { maxFadeSec: 12, tempoTolerance: 0.08, stemsReady: true });
    expect(plan.type).not.toBe("acapella");
});

test("good vocal stem quality is mentioned in the acapella reason", () => {
    const cur = track("Track A", grid(128, "8A", 0.7));
    cur.stemQuality = scoreStemQuality({
        vocalRms: 0.035,
        instrumentalRms: 0.07,
        vocalDensity: 0.35,
        vocalDynamicRange: 3,
        vocalToInstrumentalDb: -6,
    });
    const next = track("Track B", grid(128, "8A", 0.7));
    const plan = planTransition(cur, next, 6, { maxFadeSec: 12, tempoTolerance: 0.08, stemsReady: true });
    expect(plan.type).toBe("acapella");
    expect(plan.reason).toContain("stem");
    expect(plan.reason).toContain("vocal lane");
});

test("dense incoming vocals block acapella even with good outgoing stems", () => {
    const cur = track("Track A", grid(128, "8A", 0.7));
    cur.stemQuality = scoreStemQuality({
        vocalRms: 0.035,
        instrumentalRms: 0.07,
        vocalDensity: 0.35,
        vocalDynamicRange: 3,
        vocalToInstrumentalDb: -6,
    });
    const next = track("Track B", grid(128, "8A", 0.7));
    next.stemQuality = scoreStemQuality({
        vocalRms: 0.09,
        instrumentalRms: 0.08,
        vocalDensity: 0.8,
        vocalDynamicRange: 3,
        vocalToInstrumentalDb: 1,
    });
    const plan = planTransition(cur, next, 6, { maxFadeSec: 12, tempoTolerance: 0.08, stemsReady: true });
    expect(plan.type).not.toBe("acapella");
});

test("a long incoming intro keeps acapella available despite global incoming vocals", () => {
    const cur = track("Track A", grid(128, "8A", 0.7));
    cur.stemQuality = scoreStemQuality({
        vocalRms: 0.035,
        instrumentalRms: 0.07,
        vocalDensity: 0.35,
        vocalDynamicRange: 3,
        vocalToInstrumentalDb: -6,
    });
    const nextGrid = grid(128, "8A", 0.7);
    nextGrid.introSec = 10;
    const next = track("Track B", nextGrid);
    next.stemQuality = scoreStemQuality({
        vocalRms: 0.09,
        instrumentalRms: 0.08,
        vocalDensity: 0.8,
        vocalDynamicRange: 3,
        vocalToInstrumentalDb: 1,
    });
    const plan = planTransition(cur, next, 6, { maxFadeSec: 12, tempoTolerance: 0.08, stemsReady: true });
    expect(plan.type).toBe("acapella");
});

test("segment-level incoming vocal activity can rescue a globally vocal-heavy track", () => {
    const cur = track("Track A", grid(128, "8A", 0.7));
    cur.stemQuality = scoreStemQuality({
        vocalRms: 0.035,
        instrumentalRms: 0.07,
        vocalDensity: 0.35,
        vocalDynamicRange: 3,
        vocalToInstrumentalDb: -6,
    });
    const next = track("Track B", grid(128, "8A", 0.7));
    next.stemQuality = scoreStemQuality({
        vocalRms: 0.09,
        instrumentalRms: 0.08,
        vocalDensity: 0.8,
        vocalDynamicRange: 3,
        vocalToInstrumentalDb: 1,
    });
    next.vocalActivity = vocalActivity(12, 20);

    const plan = planTransition(cur, next, 6, { maxFadeSec: 12, tempoTolerance: 0.08, stemsReady: true });
    expect(plan.type).toBe("acapella");
});

test("stems ready but keys clash → NOT acapella (vocal would clash)", () => {
    const cur = track("Track A", grid(128, "8A", 0.7));
    const next = track("Track B", grid(127, "2B", 0.7)); // distant key
    const plan = planTransition(cur, next, 6, { maxFadeSec: 12, tempoTolerance: 0.08, stemsReady: true });
    expect(plan.type).not.toBe("acapella"); // falls to a key-masking move instead
});

test("in-key + close tempo but NO stems → never acapella (falls back to blend)", () => {
    const cur = track("Track A", grid(128, "8A", 0.7));
    const next = track("Track B", grid(128, "8A", 0.7));
    const plan = planTransition(cur, next, 6); // stemsReady defaults false
    expect(plan.type).not.toBe("acapella");
    expect(["blend", "bassdrop", "riser"]).toContain(plan.type);
});

test("ballad / low percussiveness → smooth fade, no beatmatch", () => {
    const cur = track("Sad Piano Ballad", grid(70, "8A", 0.1));
    const next = track("Acoustic Cover", grid(72, "3A", 0.15));
    const plan = planTransition(cur, next, 6);
    // Chill → fade, or echo when the current track has a clean outro.
    expect(["fade", "echo"]).toContain(plan.type);
    expect(plan.eqSweep).toBe(false);
    expect(plan.tempoRatio).toBe(1);
});

test("hip-hop punchy tracks → cut (or its high-energy spinback variant)", () => {
    const cur = track("Some Trap Banger", grid(140, "8A", 0.8));
    const next = track("Drill Type Beat", grid(142, "8A", 0.8));
    const plan = planTransition(cur, next, 6);
    expect(["cut", "spinback"]).toContain(plan.type);
});

test("punchy tracks with a wide tempo gap → cut (or spinback; can't blend)", () => {
    const cur = track("Fast One", grid(150, "8A", 0.7));
    const next = track("Slow One", grid(100, "8A", 0.7)); // gap > 18% after folding
    const plan = planTransition(cur, next, 6);
    expect(["cut", "spinback"]).toContain(plan.type);
});

test("close tempo but clashing key → key-masking move (filter or gate)", () => {
    const cur = track("House Tune", grid(126, "8A", 0.6));
    const next = track("Other House Tune", grid(127, "2B", 0.6)); // distant key
    const plan = planTransition(cur, next, 6);
    expect(["filter", "gate"]).toContain(plan.type); // both mask the harmonic clash
});

test("fade length never exceeds maxFadeSec", () => {
    const cur = track("Ambient", grid(70, "8A", 0.05));
    const next = track("Ambient 2", grid(70, "8A", 0.05));
    const plan = planTransition(cur, next, 30, { maxFadeSec: 12, tempoTolerance: 0.08 });
    expect(plan.fadeSec).toBeLessThanOrEqual(12);
});

test("missing grids → safe default blend", () => {
    const plan = planTransition(track("A", null), track("B", null), 6);
    expect(["blend", "fade"]).toContain(plan.type);
    expect(plan.fadeSec).toBeGreaterThan(0);
});

test("tempoMatchRatio folds half/double-time and respects tolerance", () => {
    expect(tempoMatchRatio(128, 128)).toBeCloseTo(1);
    expect(tempoMatchRatio(128, 64)).toBeCloseTo(1); // double-time → match
    expect(tempoMatchRatio(128, 100)).toBe(1); // 28% gap → no stretch
    expect(tempoMatchRatio(128, 124)).toBeGreaterThan(1); // within tolerance → stretch
});

test("audio-only classification steers a dark sustained track to a chill move (fade/echo)", () => {
    // No genre keyword in the title → must rely on audio: dark + low punch = chill.
    const dark = { centroid: 1800, rolloff: 3000, flatness: 0.04, flux: 0.2 };
    const cur = track("Untitled 1", grid(80, "8A", 0.2, 0.8, dark));
    const next = track("Untitled 2", grid(82, "9A", 0.2, 0.8, dark));
    const plan = planTransition(cur, next, 6);
    expect(["fade", "echo"]).toContain(plan.type); // chill → soft move, never beatmatch
    expect(plan.eqSweep).toBe(false);
});

test("audio-only classification: bright punchy tracks → blend / bassdrop / filter", () => {
    const bright = { centroid: 3600, rolloff: 7500, flatness: 0.15, flux: 0.4 };
    const cur = track("Untitled A", grid(128, "8A", 0.6, 0.8, bright));
    const next = track("Untitled B", grid(128, "9A", 0.6, 0.8, bright));
    const plan = planTransition(cur, next, 6);
    expect(["blend", "bassdrop", "filter", "riser", "gate"]).toContain(plan.type);
});

test("regression: mid-energy EDM tracks (perc ~0.3, typical compressed master) BLEND, not always fade", () => {
    // The bug: real percussiveness clusters ~0.3, below the old 0.45 "punchy" gate,
    // so every transition fell through to "fade". Bright timbre → edm → must blend.
    const edm = { centroid: 3300, rolloff: 7000, flatness: 0.12, flux: 0.35 };
    const cur = track("Untitled A", grid(126, "8A", 0.3, 0.8, edm));
    const next = track("Untitled B", grid(127, "8A", 0.3, 0.8, edm)); // same key, close tempo
    const plan = planTransition(cur, next, 6);
    expect(plan.type).not.toBe("fade");
    expect(["blend", "filter"]).toContain(plan.type);
});
