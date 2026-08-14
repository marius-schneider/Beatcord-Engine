import { inferGenre } from "./genre";
import { assessTempoRelationship } from "./tempo-awareness";
import type { TrackInfo } from "./ytdlp";

/**
 * Rank smart-autoplay radio candidates for vibe-continuity with the seed track:
 *
 *  • Genre is a small continuity hint, never the dominant rule.
 *  • Compatible BPM and a runtime close to the seed score higher; a big length jump usually signals a
 *    different *kind* of track (a long mix, an interlude, an hour-long loop) that
 *    would break the flow.
 *
 * Stable: candidates of equal score keep YouTube's own ordering (which already
 * encodes "most related first"). Pure function so it's unit-testable in isolation
 * from the player. Returns a new array, best-first.
 */
export function rankByCoherence(seed: TrackInfo, candidates: TrackInfo[]): TrackInfo[] {
    const seedGenre = inferGenre(seed.title, seed.uploader);
    const seedDur = seed.durationMs;

    const score = (t: TrackInfo): number => {
        let s = 0;
        if (seedGenre !== "unknown" && inferGenre(t.title, t.uploader) === seedGenre) s += 0.65;
        const tempo = assessTempoRelationship(seed.bpm, t.bpm);
        if (tempo.compatible) s += tempo.plausibility;
        if (seedDur > 0 && t.durationMs > 0) {
            const ratio = Math.max(t.durationMs, seedDur) / Math.min(t.durationMs, seedDur);
            if (ratio <= 1.5)
                s += 1; // within 50% of the seed's length
            else if (ratio >= 3) s -= 0.5; // very different runtime → mild off-vibe nudge
        }
        return s;
    };

    return candidates
        .map((t, i) => ({ t, i, s: score(t) }))
        .sort((a, b) => b.s - a.s || a.i - b.i) // higher score first; original order breaks ties
        .map((x) => x.t);
}
