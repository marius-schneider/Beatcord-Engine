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

    // Thresholds calibrated on real tracks: percussiveness clusters ~0.25–0.75,
    // centroid ~1500–4100Hz, flatness ~0.03–0.19.

    // Chill: sustained (low punch) AND not bright — lo-fi/ambient/acoustic/ballad.
    if (perc < 0.3 && centroid < 2800) return "chill";

    // Hip-hop / trap: punchy, warm (dark centroid), tonal (low flatness). The
    // hallmark is a strong kick with little high-frequency air.
    if (perc >= 0.45 && centroid < 2600 && flatness < 0.08) return "hiphop";

    // EDM / electronic: bright (high centroid) or noisy/synthetic (high flatness),
    // with a driving beat. Lots of high-frequency energy.
    if (centroid >= 3000 || flatness >= 0.14) return "edm";

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
