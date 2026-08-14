import { type AudioTraits, classifyGenreAudio, type GenreHint, inferGenre } from "./genre";
import type { TransitionType } from "./transition-planner";

export interface GenreEvidence {
    genre: GenreHint;
    confidence: number;
    audio: GenreHint;
    metadata: GenreHint;
    conflicted: boolean;
    reasons: string[];
}

export interface GenreTransitionSignal {
    score: number;
    confidence: number;
    /** Absolute scoring weight; genre is intentionally capped at ten percent. */
    weight: 0.1;
    contribution: number;
    current: GenreEvidence;
    next: GenreEvidence;
    reason: string;
}

const NEUTRAL = 72;

const AFFINITY: Record<GenreHint, Record<TransitionType, number>> = {
    unknown: {
        fade: 72,
        blend: 72,
        cut: 72,
        filter: 72,
        echo: 72,
        bassdrop: 72,
        spinback: 72,
        gate: 72,
        roll: 72,
        riser: 72,
        acapella: 72,
    },
    chill: {
        fade: 96,
        blend: 68,
        cut: 48,
        filter: 62,
        echo: 94,
        bassdrop: 42,
        spinback: 34,
        gate: 45,
        roll: 38,
        riser: 48,
        acapella: 64,
    },
    hiphop: {
        fade: 60,
        blend: 68,
        cut: 94,
        filter: 76,
        echo: 70,
        bassdrop: 72,
        spinback: 92,
        gate: 78,
        roll: 94,
        riser: 68,
        acapella: 82,
    },
    edm: {
        fade: 58,
        blend: 92,
        cut: 70,
        filter: 86,
        echo: 68,
        bassdrop: 94,
        spinback: 74,
        gate: 86,
        roll: 80,
        riser: 94,
        acapella: 78,
    },
    pop: {
        fade: 74,
        blend: 84,
        cut: 70,
        filter: 82,
        echo: 78,
        bassdrop: 72,
        spinback: 60,
        gate: 68,
        roll: 62,
        riser: 72,
        acapella: 76,
    },
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const round = (value: number, digits = 3) => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

/** Keep audio and title evidence separate so a keyword cannot masquerade as certainty. */
export function assessGenreEvidence(audio: AudioTraits | null, title: string, uploader?: string | null): GenreEvidence {
    const metadata = inferGenre(title, uploader);
    const audioGenre = audio ? classifyGenreAudio(audio) : "unknown";
    const conflicted = metadata !== "unknown" && audioGenre !== "unknown" && metadata !== audioGenre;
    let genre: GenreHint;
    let confidence: number;
    if (metadata !== "unknown" && metadata === audioGenre) {
        genre = metadata;
        confidence = 0.92;
    } else if (conflicted) {
        // Preserve the explicit label for explainability, but heavily discount it.
        genre = metadata;
        confidence = 0.42;
    } else if (audioGenre !== "unknown") {
        genre = audioGenre;
        confidence = 0.7;
    } else if (metadata !== "unknown") {
        genre = metadata;
        confidence = 0.58;
    } else {
        genre = "unknown";
        confidence = 0.2;
    }
    return {
        genre,
        confidence,
        audio: audioGenre,
        metadata,
        conflicted,
        reasons: conflicted
            ? [`metadata says ${metadata}, audio says ${audioGenre}`]
            : [
                  `genre ${genre} from ${metadata === audioGenre ? "audio + metadata" : audioGenre !== "unknown" ? "audio" : metadata !== "unknown" ? "metadata" : "no evidence"}`,
              ],
    };
}

/** Genre preference for one move, shrunk toward neutral when evidence is weak. */
export function genreTransitionSignal(
    current: GenreEvidence,
    next: GenreEvidence,
    type: TransitionType,
): GenreTransitionSignal {
    const raw = (AFFINITY[current.genre][type] + AFFINITY[next.genre][type]) / 2;
    const confidence = clamp01(
        Math.min(current.confidence, next.confidence) * 0.65 + ((current.confidence + next.confidence) / 2) * 0.35,
    );
    const score = NEUTRAL + (raw - NEUTRAL) * confidence;
    return {
        score: round(score, 1),
        confidence: round(confidence),
        weight: 0.1,
        contribution: round(score * 0.1, 2),
        current,
        next,
        reason: `${current.genre}→${next.genre} genre affinity ${score.toFixed(1)} at confidence ${confidence.toFixed(2)} (10% cap)`,
    };
}
