/**
 * The "DJ brain": decides HOW to transition from the current track into the next,
 * the way a human DJ would — picking a different move depending on the two songs'
 * tempo, key, energy, structure, vocals, and genre evidence. Pure and deterministic
 * so it's easy to unit-test;
 * the {@link BeatmatchController} feeds it the analysed grids and executes the plan.
 *
 * The decision is made while the current track is still playing (we've already
 * prefetched + analysed the next one), so there's always time to prepare.
 */

import type { StretchDecision } from "./adaptive-stretch";
import type { BeatGrid } from "./beatgrid";
import { classifyGenre, inferGenre } from "./genre";
import { harmonicScore } from "./key";
import type { TransitionRegionSelection } from "./mix-regions";
import { isStemQualityUsable, type StemQuality } from "./stem-quality";
import { assessGridTempoRelationship, assessTempoRelationship } from "./tempo-awareness";
import type { VocalActivityProfile } from "./vocal-activity";
import { assessVocalConflict } from "./vocal-conflict";

/** The kinds of transition the mixer can perform. */
export type TransitionType =
    /** Long beatmatched blend with 3-band bass-swap EQ — the seamless club mix. */
    | "blend"
    /** Hard, beat-aligned cut on the downbeat — hip-hop / big tempo gap. */
    | "cut"
    /** Slow, smooth equal-power fade, no beatmatch — ballads / ambient. */
    | "fade"
    /** Outgoing track filtered out (rising high-pass), then the next drops in. */
    | "filter"
    /** Outgoing track rings out in an echo/delay tail while the next starts under it. */
    | "echo"
    /** Incoming bass killed until the downbeat, then a hard bass-swap "drop". */
    | "bassdrop"
    /** Aggressive reverse pitch-bend of the outgoing track, then a hard cut. */
    | "spinback"
    /** Rhythmic gate/stutter on the outgoing track while the next fades in. */
    | "gate"
    /** Beat-repeat roll: the last beat of the outgoing track stutters faster, then cut. */
    | "roll"
    /** Rising filtered-noise build that peaks, then the next track drops in. */
    | "riser"
    /** Outgoing track's isolated vocal sings over the incoming track's beat (stems). */
    | "acapella";

export interface TrackTraits {
    title: string;
    uploader?: string | null;
    grid: BeatGrid | null;
    durationMs: number;
    stemQuality?: StemQuality | null;
    vocalActivity?: VocalActivityProfile | null;
}

export interface TransitionPlan {
    type: TransitionType;
    /** Crossfade / fade length in seconds. */
    fadeSec: number;
    /** Apply the 3-band bass-swap EQ during a blend. */
    eqSweep: boolean;
    /** Tempo-stretch ratio for the incoming track (1 = none). */
    tempoRatio: number;
    /** Human-readable reason (logged + shown in the now-playing card). */
    reason: string;
    /** Material-aware render policy for the incoming track, when stretched. */
    stretch?: StretchDecision;
    /** Pair-specific musical regions selected for the outgoing and incoming hand-off. */
    regions?: TransitionRegionSelection;
}

/** Tunables for the planner's thresholds (kept here so they're easy to tweak). */
export interface PlannerConfig {
    /** Max crossfade length (s); the planner never exceeds this. */
    maxFadeSec: number;
    /** Tempo-matching is allowed within ±this fraction (0.08 = ±8%). */
    tempoTolerance: number;
    /** The outgoing track has separated stems → an acapella move is possible. */
    stemsReady?: boolean;
    /** Minimum stem quality score before a vocal stem is trusted for acapella. */
    minStemQuality?: number;
    /** Maximum vocal-on-vocal conflict risk before acapella is rejected. */
    vocalConflictMaxRisk?: number;
}

const DEFAULT_CONFIG: PlannerConfig = { maxFadeSec: 12, tempoTolerance: 0.08 };

/**
 * Compute the tempo-stretch ratio to beat-match `next` to `current`, or 1 if the
 * tempos are too far apart to stretch naturally. Handles half/double-time.
 */
export function tempoMatchRatio(
    curBpm: number | undefined,
    nextBpm: number | undefined,
    tolerance = DEFAULT_CONFIG.tempoTolerance,
): number {
    return assessTempoRelationship(curBpm, nextBpm, { tolerance }).stretchRatio;
}

/**
 * Pick the transition from `current` into `next`. The logic mirrors how a DJ
 * thinks:
 *  - Two low-energy / "chill" tracks → a long smooth fade (no beatmatch needed).
 *  - Punchy tracks with close tempo & compatible key → a beatmatched bass-swap
 *    blend (the seamless mix).
 *  - Punchy but tempo/key clash, or hip-hop → a beat-aligned cut (or a filter
 *    sweep when there's a clean outro to filter out).
 *  - Anything else → a sensible medium blend.
 */
export function planTransition(
    current: TrackTraits,
    next: TrackTraits,
    baseFadeSec: number,
    config: PlannerConfig = DEFAULT_CONFIG,
): TransitionPlan {
    const cg = current.grid;
    const ng = next.grid;
    const clampEarly = (s: number) => Math.min(config.maxFadeSec, Math.max(1, s));

    // Without a beat grid on the incoming track we can't beatmatch or judge energy
    // reliably — never hard-cut or choose a style on a metadata genre guess. A
    // medium equal-power blend is the safe, good-sounding default.
    if (!ng) {
        return {
            type: "blend",
            fadeSec: clampEarly(baseFadeSec),
            eqSweep: true,
            tempoRatio: 1,
            reason: "medium blend (unanalysed; genre not used alone)",
        };
    }

    // Audio-based genre (spectral + percussiveness + tempo), with the title as an
    // override when it carries an explicit keyword. Falls back to title-only if a
    // grid is missing.
    const curGenre = cg
        ? classifyGenre(
              {
                  spectral: cg.spectral,
                  percussiveness: cg.energy.percussiveness,
                  bpm: cg.bpm,
                  energy: cg.energy.energy,
                  danceability: cg.energy.danceability,
              },
              current.title,
              current.uploader,
          )
        : inferGenre(current.title, current.uploader);
    const nextGenre = classifyGenre(
        {
            spectral: ng.spectral,
            percussiveness: ng.energy.percussiveness,
            bpm: ng.bpm,
            energy: ng.energy.energy,
            danceability: ng.energy.danceability,
        },
        next.title,
        next.uploader,
    );

    const tempoRelationship = assessGridTempoRelationship(cg, ng, config.tempoTolerance);
    const gap = tempoRelationship.effectiveGap;
    const ratio = tempoRelationship.stretchRatio;
    const tempoClose = tempoRelationship.compatible;
    const keyScore = cg && ng ? harmonicScore(cg.key.camelot, ng.key.camelot) : 0;
    const keyOk = keyScore >= 0.5;
    // A completed separation is not evidence of quality. Unknown/unscored stems
    // are never exposed as a foreground acapella.
    const acapellaStemReady = !!config.stemsReady && isStemQualityUsable(current.stemQuality, config.minStemQuality);
    const vocalConflict = assessVocalConflict({
        outgoingStemQuality: current.stemQuality,
        incomingStemQuality: next.stemQuality,
        incomingVocalActivity: next.vocalActivity,
        incomingStartSec: ng.introSec,
        incomingIntroSec: ng.introSec,
        overlapSec: baseFadeSec + 2,
        keyScore,
        maxRisk: config.vocalConflictMaxRisk,
    });
    // Both tracks energetic? (gates the punchy bassdrop/spinback moves.)
    const curPunch = cg?.energy.percussiveness ?? 0.3;
    const nextPunch = ng.energy.percussiveness;
    const highEnergy = curPunch >= 0.34 && nextPunch >= 0.34;
    // Overall energy complements percussiveness on modern, heavily-compressed
    // masters (perc often clusters around 0.3).
    const curEnergy = cg?.energy.energy ?? 0.5;
    const nextEnergy = ng.energy.energy;
    const energetic = highEnergy || (curEnergy >= 0.55 && nextEnergy >= 0.55);
    // One bar of the outgoing track — for tight, beat-locked short moves.
    const barSec = cg && cg.beatInterval > 0 ? cg.beatInterval * 4 : 0;
    // A clean outro on the current track → an echo ring-out lands gracefully.
    const hasOutro = cg ? cg.musicalEndSec < current.durationMs / 1000 - 1 : false;
    // Deterministic "spice" so we don't ALWAYS pick the special move on identical
    // inputs — keyed off the BPMs so it's stable per pair, not random per render.
    const spice = (((cg?.bpm ?? 0) + (ng?.bpm ?? 0)) | 0) % 3;

    const clamp = (s: number) => Math.min(config.maxFadeSec, Math.max(1, s));

    // Genre may colour a move only after measured material supports it. This keeps
    // metadata such as "Chill House" or "Trap" from deciding the transition alone.
    const eitherChill = curGenre === "chill" || nextGenre === "chill";
    const eitherHiphop = curGenre === "hiphop" || nextGenre === "hiphop";
    const averagePunch = (curPunch + nextPunch) / 2;
    const pulseConfidence = Math.min(
        cg?.analysisConfidence?.tempo.confidence ?? (cg ? 0.7 : 0),
        ng.analysisConfidence?.tempo.confidence ?? 0.7,
    );
    const chillMaterial = eitherChill && averagePunch < 0.28;
    const hiphopRhythm = eitherHiphop && energetic && averagePunch >= 0.34 && pulseConfidence >= 0.45;

    // 1) Dark/low-pulse material plus a chill signal → a smooth fade, or an echo
    //    ring-out when the current track has a clean outro. Genre alone cannot enter.
    if (chillMaterial) {
        if (hasOutro) {
            return {
                type: "echo",
                fadeSec: clamp(baseFadeSec),
                eqSweep: false,
                tempoRatio: 1,
                reason: "echo ring-out (low pulse, chill signal, clean outro)",
            };
        }
        return {
            type: "fade",
            fadeSec: clamp(baseFadeSec + 2), // a touch longer for a relaxed feel
            eqSweep: false,
            tempoRatio: 1,
            reason: "smooth fade (low pulse, chill signal)",
        };
    }

    // 2) Tempos too far apart to blend musically → a tight beat-aligned cut, or an
    //    aggressive spinback for high-energy pairs (a big, deliberate gear-change).
    if (gap > 0.18) {
        if (highEnergy && spice === 0) {
            return {
                type: "spinback",
                fadeSec: clamp(2),
                eqSweep: false,
                tempoRatio: 1,
                reason: "spinback (big tempo gap, high energy)",
            };
        }
        return {
            type: "cut",
            fadeSec: clamp(2), // tiny overlap so it's not jarring
            eqSweep: false,
            tempoRatio: 1,
            reason: "cut (tempo gap too wide to blend)",
        };
    }

    // 3) A hip-hop signal may shape a cut only when pulse and energy evidence also
    //    support a tight rhythmic move.
    if (hiphopRhythm) {
        if (energetic && spice === 0) {
            return {
                type: "spinback",
                fadeSec: clamp(2),
                eqSweep: false,
                tempoRatio: 1,
                reason: "spinback (hip-hop, high energy)",
            };
        }
        if (energetic && spice === 1) {
            return {
                type: "roll",
                fadeSec: clamp(2),
                eqSweep: false,
                tempoRatio: 1,
                reason: "beat-repeat roll (hip-hop, high energy)",
            };
        }
        // Default hip-hop move: a TIGHT beat-locked cut with a fast bass-swap over
        // one bar — the way a real DJ drops the next beat in, not a bare chop.
        // Only when the tempos actually line up; a wide gap was cut above.
        if (tempoClose && barSec > 0.2) {
            return {
                type: "cut",
                fadeSec: clamp(Math.max(2, barSec)),
                eqSweep: true, // 3-band bass-swap across the 1-bar cut
                tempoRatio: ratio,
                reason: `bass-swap cut (hip-hop, 1 bar, ${tempoRelationship.label}${ratio !== 1 ? `, tempo ×${ratio.toFixed(3)}` : ""})`,
            };
        }
        return {
            type: "cut",
            fadeSec: clamp(2),
            eqSweep: false,
            tempoRatio: 1,
            reason: "beat-aligned cut (hip-hop)",
        };
    }

    // 4) EDM / pop, close tempo, compatible key → a beatmatched blend, or a bass-drop
    //    for high-energy pairs (B layers in up top, then the bass slams in on the
    //    downbeat — the classic EDM drop).
    if (tempoClose && keyOk) {
        // Acapella-out: A's vocal sings over B's beat. Needs a trusted outgoing
        // stem, a strong harmonic match, and enough vocal lane on B that two
        // singers/rappers do not fight for the same midrange.
        if (acapellaStemReady && keyScore >= 0.7 && vocalConflict.safeForAcapella) {
            return {
                type: "acapella",
                fadeSec: clamp(baseFadeSec + 2),
                eqSweep: false,
                tempoRatio: ratio,
                reason: `acapella (A's vocal over B's beat, ${tempoRelationship.label}, key ${keyScore.toFixed(1)}, stem ${current.stemQuality!.score.toFixed(0)} ${current.stemQuality!.tier}, vocal lane ${vocalConflict.score.toFixed(0)})`,
            };
        }
        if (highEnergy && spice === 0) {
            // Build the tension with a riser, then drop the next track in.
            return {
                type: "riser",
                fadeSec: clamp(baseFadeSec + 2),
                eqSweep: false,
                tempoRatio: ratio,
                reason: `riser → drop (${tempoRelationship.label}, key ${keyScore.toFixed(1)}, high energy)`,
            };
        }
        if (highEnergy && spice === 1) {
            return {
                type: "bassdrop",
                fadeSec: clamp(baseFadeSec + 2),
                eqSweep: true,
                tempoRatio: ratio,
                reason: `bass-drop (${tempoRelationship.label}, key ${keyScore.toFixed(1)}, high energy${ratio !== 1 ? `, tempo ×${ratio.toFixed(3)}` : ""})`,
            };
        }
        return {
            type: "blend",
            fadeSec: clamp(baseFadeSec + 2), // longer blend reads as more "mixed in"
            eqSweep: true,
            tempoRatio: ratio,
            reason: `beatmatched blend (${tempoRelationship.label}, key ${keyScore.toFixed(1)}${ratio !== 1 ? `, tempo ×${ratio.toFixed(3)}` : ""})`,
        };
    }

    // 5) Close tempo but the keys clash → mask it with a filter sweep, or a rhythmic
    //    gate/stutter (spice 1) for high-energy pairs — both hide the harmonic clash.
    if (tempoClose && !keyOk) {
        if (highEnergy && spice === 1) {
            return {
                type: "gate",
                fadeSec: clamp(baseFadeSec),
                eqSweep: false,
                tempoRatio: ratio,
                reason: `gate stutter (${tempoRelationship.label}, keys clash)`,
            };
        }
        return {
            type: "filter",
            fadeSec: clamp(baseFadeSec),
            eqSweep: true,
            tempoRatio: ratio,
            reason: `filter sweep (${tempoRelationship.label}, keys clash)`,
        };
    }

    // 6) Fallback: a medium equal-power blend with the bass-swap EQ.
    return {
        type: "blend",
        fadeSec: clamp(baseFadeSec),
        eqSweep: true,
        tempoRatio: ratio,
        reason: "medium blend (default)",
    };
}
