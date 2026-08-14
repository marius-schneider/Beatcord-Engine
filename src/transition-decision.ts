// The DJ decision for one transition: WHAT move to play (type + fade + tempo),
// WHERE to cut it (bar lines on both sides), and how much lead the incoming deck
// needs. Pure — no deck, no I/O, no state machine.
//
// Both consumers used to compute this inline and had drifted apart in three ways;
// this module is the reconciliation, each choice documented at its `preRollSec` /
// `clubBlendSec` / DROP_MOVES site below. The surrounding state machines stay
// separate on purpose: the bot owns its MixDeck and queue, while the server's
// session owns them and the controller only schedules against them.

import { config } from "./config";
import type { GenreHint } from "./genre";
import { B_PRE_ROLL_SEC } from "./mixer";
import { chooseTransitionCue, type TransitionCue } from "./phrase-cues";
import { assessGridTempoRelationship } from "./tempo-awareness";
import { planTransitionWithFeedback, type TransitionFeedbackProfile } from "./transition-candidates";
import { planTransition, type TrackTraits, type TransitionPlan } from "./transition-planner";

/**
 * Moves that drop straight in on their first transient instead of riding a fade.
 * They get a 20 ms hair of lead rather than a real pre-roll — just enough that the
 * transient isn't clipped.
 *
 * (The bot previously counted only spinback/roll here, so `cut` and `bassdrop` were
 * handed a fade-sized pre-roll. The server's wider set is the correct one: all four
 * are hard entries.)
 */
const DROP_MOVES = new Set<string>(["spinback", "roll", "cut", "bassdrop"]);

/** Lead for a hard entry, in the incoming file's own seconds. */
const HARD_ENTRY_LEAD_SEC = 0.02;

export interface TransitionDecisionOptions {
    /** Baseline crossfade length; the planner may shorten or extend it. */
    fadeSec: number;
    /** Tempo-match the incoming track to the current BPM (within ±8%). */
    tempoSync: boolean;
    /** Allow the bass-swap EQ sweep during the blend. */
    eqSweep: boolean;
    /** Allow harmonic-driven transition types. */
    harmonic: boolean;
    /** The outgoing vocal stem is separated AND clean enough to sing acapella. */
    stemsReady: boolean;
    /**
     * The tempo ratio the OUTGOING deck is already playing at. Its grid times are in
     * the original timeline while the deck's clock counts emitted audio, so the cue
     * math needs this to convert. 1 when the current track wasn't stretched.
     */
    outgoingTempoRatio: number;
    /** Telemetry-derived scoring feedback; without it the base planner is used. */
    feedback?: TransitionFeedbackProfile | null;
    /** Extend a plain blend to a bar-quantized club-length ride. */
    clubBlend?: boolean;
    /** Genres of both sides — one supporting signal when sizing a club blend. */
    currentGenre?: GenreHint | undefined;
    nextGenre?: GenreHint | undefined;
    /** Ceiling the planner may not exceed. */
    maxFadeSec?: number;
}

export interface TransitionDecision {
    plan: TransitionPlan;
    cue: TransitionCue;
    /**
     * How far before its bar line the incoming deck starts, in that FILE's seconds.
     * The mixer trims this away sample-accurately at fire time. The prepare and fire
     * paths must pass the SAME value or the pre-warmed deck is discarded and respawned.
     */
    preRollSec: number;
}

/**
 * Evidence needed before a genre hint may extend a transition to a full club phrase.
 */
export interface ClubBlendEvidence {
    beatConfidence: number;
    tempoCompatible: boolean;
    phraseConfidence: number;
    structureConfidence: number;
    energy: number;
}

/**
 * Bar-quantized club blend length (seconds). A full 16-bar ride needs EDM/club
 * context AND reliable beat, tempo, phrase, structure and energy evidence. Genre
 * by itself gets the conservative 8-bar target used for every other style.
 */
export function clubBlendSec(
    beatIntervalSec: number,
    currentGenre: GenreHint,
    nextGenre: GenreHint | undefined,
    currentDurationSec: number,
    evidence?: Partial<ClubBlendEvidence>,
): number {
    const barSec = beatIntervalSec * 4;
    if (!(barSec > 0.1)) return 0;
    const edm = currentGenre === "edm" || nextGenre === "edm";
    const fullPhraseSupported =
        edm &&
        (evidence?.beatConfidence ?? 0) >= 0.65 &&
        evidence?.tempoCompatible === true &&
        (evidence?.phraseConfidence ?? 0) >= 0.6 &&
        (evidence?.structureConfidence ?? 0) >= 0.55 &&
        (evidence?.energy ?? 0) >= 0.5;
    const targetBars = fullPhraseSupported
        ? config.AUTOMIX_BLEND_BARS
        : Math.max(8, Math.round(config.AUTOMIX_BLEND_BARS / 2));
    const ceilingBars = Math.floor(Math.min(config.AUTOMIX_MAX_BLEND_SEC, currentDurationSec * 0.45) / barSec);
    const bars = Math.max(4, Math.min(targetBars, ceilingBars));
    return bars * barSec;
}

/** Decide the whole transition from the two tracks' traits. */
export function decideTransition(
    current: TrackTraits,
    next: TrackTraits,
    opts: TransitionDecisionOptions,
): TransitionDecision {
    const plannerConfig = {
        maxFadeSec: opts.maxFadeSec ?? 12,
        // Tempo-sync off means never time-stretch, so the tolerance collapses to zero.
        tempoTolerance: opts.tempoSync ? 0.08 : 0,
        stemsReady: opts.stemsReady,
        ...(opts.feedback ? { feedback: opts.feedback } : {}),
    };
    const plan = opts.feedback
        ? planTransitionWithFeedback(current, next, opts.fadeSec, plannerConfig)
        : planTransition(current, next, opts.fadeSec, plannerConfig);

    if (!opts.eqSweep) plan.eqSweep = false;
    // A harmonic-motivated move without harmonic mixing enabled degrades to a blend
    // rather than being played for a reason the operator turned off.
    if (!opts.harmonic && plan.reason.includes("harmonic")) plan.type = "blend";

    const currentDurationSec = current.durationMs / 1000;
    if (opts.clubBlend && plan.type === "blend" && current.grid) {
        const tempo = assessGridTempoRelationship(current.grid, next.grid, plannerConfig.tempoTolerance);
        const beatConfidence = Math.min(
            current.grid.analysisConfidence?.tempo.confidence ?? 0.7,
            next.grid?.analysisConfidence?.tempo.confidence ?? 0,
        );
        const phraseConfidence = Math.min(1, Math.min(current.grid.beats.length, next.grid?.beats.length ?? 0) / 32);
        const hasOutgoingStructure = current.grid.musicalEndSec < currentDurationSec - 1;
        const hasIncomingStructure = (next.grid?.introSec ?? 0) > 0 || (next.grid?.beats.length ?? 0) >= 32;
        const structureConfidence = (Number(hasOutgoingStructure) + Number(hasIncomingStructure)) / 2;
        const energy = (current.grid.energy.energy + (next.grid?.energy.energy ?? 0)) / 2;
        const clubSec = clubBlendSec(
            current.grid.beatInterval,
            opts.currentGenre ?? "unknown",
            opts.nextGenre,
            currentDurationSec,
            {
                beatConfidence,
                tempoCompatible: tempo.compatible,
                phraseConfidence,
                structureConfidence,
                energy,
            },
        );
        if (clubSec > plan.fadeSec) {
            plan.reason = `${plan.reason}; club blend ${(clubSec / (current.grid.beatInterval * 4)).toFixed(0)} bars`;
            plan.fadeSec = clubSec;
        }
    }

    // Pre-roll lives in the INCOMING file's timeline, but that deck is played back at
    // `plan.tempoRatio`. Scaling by the ratio keeps the *heard* lead constant at
    // B_PRE_ROLL_SEC; without it a tempo-synced entry gets a slightly short lead.
    // (The server previously passed the unscaled constant.)
    const preRollSec = DROP_MOVES.has(plan.type) ? HARD_ENTRY_LEAD_SEC : B_PRE_ROLL_SEC * plan.tempoRatio;

    const cue = chooseTransitionCue({
        currentGrid: current.grid ?? null,
        nextGrid: next.grid ?? null,
        currentDurationSec,
        transitionType: plan.type,
        fadeSec: plan.fadeSec,
        outgoingTempoRatio: opts.outgoingTempoRatio,
        preRollSec,
    });

    return { plan, cue, preRollSec };
}
