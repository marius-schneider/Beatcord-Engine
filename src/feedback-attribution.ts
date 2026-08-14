import type { TransitionType } from "./transition-planner";

export type FeedbackCause = "track" | "transition" | "session" | "repetition" | "uncertain";

export interface FeedbackAttributionInput {
    afterTransitionMs: number | null;
    skippedPositionRatio: number | null;
    transitionType?: TransitionType;
    energyDelta?: number | null;
    repeatedGenreCount?: number;
    explicitTrackDislike?: boolean;
}

export interface FeedbackAttribution {
    trackPreference: number;
    transitionPreference: number;
    sessionMismatch: number;
    repetitionFatigue: number;
    confidence: number;
    dominant: FeedbackCause;
    learnTrack: boolean;
    learnTransition: boolean;
}

const COMPLEX_TRANSITIONS = new Set<TransitionType>(["bassdrop", "gate", "riser", "spinback", "roll", "acapella"]);

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Attribute a skip across independent causes. The scores form a distribution;
 * learning flags require both a clear cause and enough observable context.
 */
export function attributeFeedback(input: FeedbackAttributionInput): FeedbackAttribution {
    const after = input.afterTransitionMs;
    const ratio = input.skippedPositionRatio;
    let transition =
        after === null ? 0.06 : after <= 4_000 ? 0.9 : after <= 12_000 ? 0.68 : after <= 30_000 ? 0.35 : 0.05;
    if (input.transitionType && COMPLEX_TRANSITIONS.has(input.transitionType)) transition += 0.18;

    let track = ratio === null ? 0.28 : ratio < 0.04 ? 0.16 : ratio < 0.15 ? 0.46 : ratio < 0.5 ? 0.74 : 0.9;
    if (input.explicitTrackDislike) track = 1.4;

    const energyDelta = input.energyDelta;
    const session = energyDelta === null || energyDelta === undefined ? 0.2 : 0.22 + Math.abs(energyDelta) * 2;
    const repetition = Math.min(0.9, Math.max(0, input.repeatedGenreCount ?? 0) * 0.24);
    const total = transition + track + session + repetition;
    const scores = {
        trackPreference: round(track / total),
        transitionPreference: round(transition / total),
        sessionMismatch: round(session / total),
        repetitionFatigue: round(repetition / total),
    };
    const confidence = round(
        clamp01(
            0.28 +
                (after !== null ? 0.2 : 0) +
                (ratio !== null ? 0.2 : 0) +
                (input.transitionType ? 0.12 : 0) +
                (energyDelta !== null && energyDelta !== undefined ? 0.1 : 0) +
                ((input.repeatedGenreCount ?? 0) > 0 ? 0.06 : 0),
        ),
    );
    const ranked: [Exclude<FeedbackCause, "uncertain">, number][] = [
        ["track", scores.trackPreference],
        ["transition", scores.transitionPreference],
        ["session", scores.sessionMismatch],
        ["repetition", scores.repetitionFatigue],
    ];
    ranked.sort((a, b) => b[1] - a[1]);
    const lead = ranked[0]?.[1] ?? 0;
    const runnerUp = ranked[1]?.[1] ?? 0;
    const dominant = lead - runnerUp >= 0.08 ? (ranked[0]?.[0] ?? "uncertain") : "uncertain";
    return {
        ...scores,
        confidence,
        dominant,
        learnTrack: confidence >= 0.6 && dominant === "track" && scores.trackPreference >= 0.45,
        learnTransition: confidence >= 0.6 && dominant === "transition" && scores.transitionPreference >= 0.45,
    };
}
