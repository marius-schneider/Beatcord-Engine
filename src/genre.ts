/**
 * Genre hinting for the transition planner. Two signals are combined:
 *  1. AUDIO features — spectral brightness/noisiness/flux + percussiveness + tempo,
 *     a real (if coarse) timbre classifier that works even when the title is
 *     unhelpful. This is the primary signal.
 *  2. TITLE/uploader keywords — a strong free hint when present (e.g. "lofi", "trap
 *     remix", "acoustic"); used to confirm or override the audio guess.
 */

import type { SpectralFeatures } from "./spectral";

/** Broad genre families that map to different mixing behaviour. */
export type GenreHint =
    | "edm" // house/techno/trance/dnb — long beatmatched blends
    | "hiphop" // hip-hop/trap/rap — quick cuts on the downbeat
    | "pop" // pop/rock — medium blends
    | "chill" // lofi/ambient/acoustic/ballad — smooth fades, no beatmatch
    | "unknown";

interface Pattern {
    genre: GenreHint;
    /** Matched case-insensitively against "title uploader". */
    re: RegExp;
}

// Ordered by specificity: the first match wins, so put the narrow cues first.
const PATTERNS: Pattern[] = [
    {
        genre: "chill",
        re: /\b(lo-?fi|lofi|ambient|acoustic|ballad|piano|chill ?hop|sleep|study|rain|asmr|instrumental)\b/,
    },
    { genre: "hiphop", re: /\b(hip ?hop|trap|rap|drill|boom ?bap|phonk|grime|r&b|rnb)\b/ },
    {
        genre: "edm",
        re: /\b(edm|house|techno|trance|dubstep|drum ?and ?bass|dnb|d&b|electro|future bass|hardstyle|big room|progressive|deep house|tech house|festival|remix|bootleg|club mix|extended mix)\b/,
    },
    { genre: "pop", re: /\b(pop|rock|indie|punk|metal|alt(ernative)?|band|guitar)\b/ },
];

/**
 * Infer a coarse genre family from a track's title + uploader. Returns "unknown"
 * when nothing matches (the planner then leans entirely on the audio signals).
 */
export function inferGenre(title: string, uploader?: string | null): GenreHint {
    const hay = `${title} ${uploader ?? ""}`.toLowerCase();
    for (const { genre, re } of PATTERNS) {
        if (re.test(hay)) return genre;
    }
    return "unknown";
}

/** Audio signals the classifier reads (subset of BeatGrid). */
export interface AudioTraits {
    spectral: SpectralFeatures;
    /** [0,1] beat punchiness from the energy analysis. */
    percussiveness: number;
    bpm: number;
    /** [0,1] overall energy — a robust discriminator when available (lossless). */
    energy?: number | undefined;
    /** [0,3] danceability — high + driving reinforces EDM. */
    danceability?: number | undefined;
}

/**
 * Classify genre family from AUDIO alone, using thresholds drawn from typical
 * values (verified on real tracks): brightness (centroid), noisiness (flatness),
 * punch (percussiveness) and tempo. Coarse by design — it only needs to land in
 * the right family to steer the transition style.
 */
export function classifyGenreAudio(a: AudioTraits): GenreHint {
    const { centroid, flatness } = a.spectral;
    const perc = a.percussiveness;
    const energy = a.energy;
    const dance = a.danceability;

    // Chill: low punch is the anchor (works even when energy metadata is flat).
    // A genuinely low-energy track is chill regardless of a bright timbre.
    if (perc < 0.3 && centroid < 2900) return "chill";
    if (energy !== undefined && energy < 0.32 && perc < 0.42) return "chill";

    // Hip-hop / trap: strong kick, warm (dark centroid), tonal (low flatness).
    if (perc >= 0.42 && centroid < 2700 && flatness < 0.09) return "hiphop";

    // EDM / electronic: bright OR synthetic/noisy, WITH drive. On lossless the
    // real top end lifts centroid/flatness, so an energy/danceability/punch
    // "driving" signal is the tie-breaker instead of brightness alone — this is
    // what keeps FLAC's honest high end from over-labelling everything EDM.
    const driving = (energy ?? 0.6) >= 0.6 || (dance ?? 1.5) >= 2 || perc >= 0.45;
    if ((centroid >= 3100 || flatness >= 0.14) && driving) return "edm";
    if (centroid >= 3400 || flatness >= 0.18) return "edm";

    // Pop/rock: the broad middle — mid brightness, some punch.
    if (perc >= 0.3) return "pop";

    // Fallback: soft/unclear → treat as chill (safer = a fade, not a hard cut).
    return "chill";
}

/**
 * Final genre decision: start from the audio classification, then let an explicit
 * title/uploader keyword override it (a human-labelled "lofi"/"trap" is more
 * reliable than the coarse audio guess). Returns the audio guess when the title
 * says nothing.
 */
export function classifyGenre(audio: AudioTraits, title: string, uploader?: string | null): GenreHint {
    const fromTitle = inferGenre(title, uploader);
    const fromAudio = classifyGenreAudio(audio);
    return fromTitle !== "unknown" ? fromTitle : fromAudio;
}
