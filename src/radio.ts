// RadioDirector — the "AI DJ builds the evening" brain. Two jobs:
//
//  1. Endless sets: when the queue runs low it pulls radio candidates from the
//     last track (yt-dlp RD-mix) so the music never stops.
//  2. Energy arc: it holds a TARGET energy that evolves over the night
//     (warm-up → build → peak, with breathers) and picks the next track whose
//     measured energy / danceability / key best fits that target — the
//     difference between "a playlist plays" and "a DJ reads the room."

import { DjMemory, type PairOutcome } from "./dj-memory";
import { trackDNA } from "./dna";
import { genomeSimilarity, trackVector } from "./genome";
import { type GenreHint, inferGenre } from "./genre";
import { harmonicScore } from "./key";
import { createLogger } from "./logger";
import type { MusicDirector } from "./music-director";
import {
    DEFAULT_PERSONA,
    type Persona,
    type PersonaId,
    persona as personaFor,
    phaseAt,
    type SetPhase,
    type SetTarget,
    scoreForSet,
    targetAt,
} from "./personas";
import type { AnalysisRecord, TrackPrep } from "./prefetch";
import { sourceResolveRadio } from "./source";
import { buildTrackProfile } from "./track-profile";
import type { TrackInfo } from "./ytdlp";

const log = createLogger("radio");

export type Vibe = "auto" | "warmup" | "peak" | "chill";

/** Default planned set length — "build me a 3-hour night". */
const DEFAULT_SET_MINUTES = 180;

/** Target energy (0..1) for a given set-elapsed time + vibe. Pure + testable. */
export function targetEnergy(vibe: Vibe, elapsedMin: number): number {
    switch (vibe) {
        case "warmup":
            return 0.45;
        case "peak":
            return 0.9;
        case "chill":
            return 0.3;
        default: {
            // Auto arc: ramp 0.5 → 0.88 over the first ~22 min, then hold near
            // peak with a gentle recurring breather dip so the floor can breathe.
            const ramp = Math.min(1, elapsedMin / 22);
            const base = 0.5 + ramp * 0.38;
            const breather = elapsedMin > 22 ? 0.08 * Math.max(0, Math.sin((elapsedMin / 6) * Math.PI * 2)) : 0;
            return Math.max(0.3, Math.min(0.92, base - breather));
        }
    }
}

/**
 * Score a candidate for how well it fits right now. Three forces:
 *  - energy arc: how close its energy is to the set's target energy;
 *  - harmonic flow: Camelot compatibility with the current track;
 *  - genome: overall DNA similarity (brightness, drive, danceability, genre…)
 *    so the next track FEELS like a continuation, not just a tempo match.
 * Pure + testable.
 */
export function scoreCandidate(
    target: number,
    candEnergy: number,
    candDanceability: number, // 0..3
    currentKey: string | undefined,
    candKey: string | undefined,
    vibe: Vibe,
    genomeSim = 0.5,
): number {
    const dance = candDanceability / 3;
    const energyScore = 1 - Math.abs(candEnergy - target);
    const danceScore = vibe === "chill" ? 1 - dance : dance;
    const harm = currentKey && candKey ? harmonicScore(currentKey, candKey) : 0.5;
    return energyScore * 2 + harm * 1.2 + danceScore * 0.6 + genomeSim * 1.6;
}

export class RadioDirector {
    enabled = false;
    /** Manual energy override, layered on top of the persona's set arc. */
    vibe: Vibe = "auto";
    /** The resident DJ deciding how the night is built + how tracks are chosen. */
    persona: Persona = personaFor(DEFAULT_PERSONA);
    /** Planned set length in minutes — the arc stretches across the whole night. */
    setDurationMin = DEFAULT_SET_MINUTES;

    #prep: TrackPrep;
    #memory = new DjMemory();
    #userId: string;
    #director: MusicDirector | null;
    #startedAt = Date.now();
    #inFlight = false;
    #recent: string[] = []; // recently used ids (dedup window)

    /**
     * `memoryScope` names whose taste this director learns — DjMemory keeps one
     * store per scope. The single-session server leaves it at "solo"; a bot serving
     * many guilds passes the guild id, so one room's skips don't retrain another's.
     */
    constructor(prep: TrackPrep, memoryScope = "solo", director: MusicDirector | null = null) {
        this.#prep = prep;
        this.#userId = memoryScope;
        this.#director = director;
        void this.#memory.load(this.#userId);
    }

    /** Begin radio (from the currently-playing track as the first seed). */
    start(seedId: string): void {
        this.enabled = true;
        this.#startedAt = Date.now();
        this.#recent = [seedId];
        log.info(`radio started (${this.persona.name}, ${this.setDurationMin}min) from seed ${seedId}`);
    }

    stop(): void {
        this.enabled = false;
        log.info("radio stopped");
    }

    setVibe(v: Vibe): void {
        this.vibe = v;
        log.info(`vibe → ${v} (target ${this.targetEnergy.toFixed(2)})`);
    }

    setPersona(id: PersonaId | string): void {
        this.persona = personaFor(id);
        log.info(`persona → ${this.persona.name} (${this.persona.blurb})`);
    }

    setSetDuration(minutes: number): void {
        this.setDurationMin = Math.max(20, Math.min(600, Math.round(minutes)));
    }

    /** Record how an A → B pairing landed, feeding this user's DJ memory. */
    recordOutcome(aId: string, bId: string, aGenre: GenreHint, bGenre: GenreHint, outcome: PairOutcome): void {
        this.#memory.remember(aId, bId, aGenre, bGenre, outcome, this.#userId);
    }

    /** Remember an id so radio won't re-pick it soon. */
    markUsed(id: string): void {
        this.#recent.push(id);
        if (this.#recent.length > 200) this.#recent.shift();
    }

    get elapsedMin(): number {
        return (Date.now() - this.#startedAt) / 60000;
    }
    /** Position through the planned set (0 = doors open, 1 = last song). */
    get progress(): number {
        return Math.min(1, this.elapsedMin / Math.max(1, this.setDurationMin));
    }
    /** The current set target ("feel"), persona arc + manual vibe override. */
    get target(): SetTarget {
        const wobble = (this.elapsedMin / 6) % 1; // drives the peak breather
        const base = targetAt(this.persona, this.progress, wobble);
        switch (this.vibe) {
            case "warmup":
                return { ...base, energy: this.persona.floorEnergy, phase: "warmup" };
            case "peak":
                return { ...base, energy: this.persona.peakEnergy, phase: "peak" };
            case "chill":
                return { ...base, energy: this.persona.tailEnergy, phase: "cooldown" };
            default:
                return base;
        }
    }
    get targetEnergy(): number {
        return this.target.energy;
    }
    get phase(): SetPhase {
        if (this.vibe === "peak") return "peak";
        if (this.vibe === "chill") return "cooldown";
        if (this.vibe === "warmup") return "warmup";
        return phaseAt(this.persona, this.progress);
    }

    /**
     * Pull radio candidates from the seed and pick the best next track for the
     * current target energy + harmonic flow. Analyzes a few candidates (the DJ
     * "auditioning" the next records); the rest stay cached for later.
     */
    async pickNext(
        seed: TrackInfo,
        currentRec: AnalysisRecord | undefined,
        avoidIds: ReadonlySet<string>,
    ): Promise<TrackInfo | null> {
        if (!this.enabled || this.#inFlight) return null;
        this.#inFlight = true;
        const seedId = seed.id;
        try {
            const recent = new Set(this.#recent);
            const candidates = (await sourceResolveRadio(seed, 15)).filter(
                (t) => !t.isLive && !recent.has(t.id) && !avoidIds.has(t.id),
            );
            if (!candidates.length) return null;

            const target = this.target;
            const currentKey = currentRec?.grid?.key.camelot;
            const currentVec = trackVector(currentRec);
            const currentGenre = currentRec?.genre ?? "edm";
            const auditioned = await Promise.all(
                candidates.slice(0, 4).map(async (t) => {
                    const rec = await this.#prep.ensureAnalyzed(t).catch(() => null);
                    return { t, rec };
                }),
            );

            const directorScores = new Map<string, { score: number; reason: string }>();
            if (this.#director) {
                const currentProfile =
                    currentRec?.profile ??
                    buildTrackProfile(seed, currentRec ?? { grid: null, genre: inferGenre(seed.title, seed.uploader) });
                const candidateProfiles = auditioned.map(
                    ({ t, rec }) =>
                        rec?.profile ??
                        buildTrackProfile(t, rec ?? { grid: null, genre: inferGenre(t.title, t.uploader) }),
                );
                for (const ranked of this.#director.rankTrackCandidates(currentProfile, candidateProfiles)) {
                    directorScores.set(ranked.profile.trackId, {
                        score: ranked.score,
                        reason: [...ranked.reasons, ...ranked.penalties].join(", "),
                    });
                }
            }

            let best: TrackInfo | null = null;
            let bestScore = Number.NEGATIVE_INFINITY;
            let bestDirectorReason = "";
            for (const { t, rec } of auditioned) {
                const dna = trackDNA(rec ?? undefined);
                const genomeSim = genomeSimilarity(currentVec, trackVector(rec ?? undefined));
                const candKey = rec?.grid?.key.camelot;
                const harmonic = currentKey && candKey ? harmonicScore(currentKey, candKey) : 0.5;
                const candGenre = rec?.genre ?? inferGenre(t.title, t.uploader);
                const memory = this.#memory.pairScore(seedId, t.id, currentGenre, candGenre, this.#userId);
                const directed = directorScores.get(t.id);
                // The shared Music Director contributes up to roughly half of the
                // final score; persona and learned pair memory retain a real vote.
                const score =
                    scoreForSet(this.persona, target, dna, harmonic, genomeSim, memory) + (directed?.score ?? 50) / 20;
                if (score > bestScore) {
                    bestScore = score;
                    best = t;
                    bestDirectorReason = directed?.reason ?? "";
                }
            }
            const chosen = best ?? candidates[0] ?? null;
            if (chosen) {
                this.markUsed(chosen.id);
                log.info(
                    `radio pick "${chosen.title}" (${this.persona.name}, ${target.phase}, target energy ${target.energy.toFixed(2)}${bestDirectorReason ? `; ${bestDirectorReason}` : ""})`,
                );
            }
            return chosen;
        } catch (err) {
            log.warn(`radio pick failed: ${(err as Error).message}`);
            return null;
        } finally {
            this.#inFlight = false;
        }
    }
}
