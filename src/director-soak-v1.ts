import type { BeatGrid } from "./beatgrid";
import type { GenreHint } from "./genre";
import { MusicDirector } from "./music-director";
import { type PerformanceDistributionV1, performanceDistributionMicros } from "./performance-stability-v1";
import { RuntimeEvidenceLedgerV1 } from "./runtime-evidence-ledger-v1";
import { buildTrackProfile, type TrackProfile } from "./track-profile";
import type { TransitionType } from "./transition-planner";

export interface DirectorSoakOptionsV1 {
    iterations?: number;
    seed?: number;
    p99BudgetMicros?: number;
}

export interface DirectorSoakReportV1 {
    version: 1;
    seed: number;
    iterations: number;
    passed: boolean;
    failures: string[];
    distribution: PerformanceDistributionV1;
    decisions: {
        transitionTypes: Partial<Record<TransitionType, number>>;
        uniqueInputHashes: number;
        deterministicSamples: number;
        deterministicFailures: number;
    };
    evidence: { retainedEvents: number; totalGenerated: number };
    boundedState: {
        transitionHistory: number;
        recentArtists: number;
        recentGenres: number;
        recentBpms: number;
    };
}

const GENRES: readonly GenreHint[] = ["edm", "hiphop", "pop", "chill", "unknown"];

function fraction(value: number): number {
    return value - Math.floor(value);
}

function noise(seed: number, index: number, salt: number): number {
    return fraction(Math.sin((seed + 1) * 12.9898 + (index + 1) * 78.233 + salt * 37.719) * 43_758.5453);
}

function syntheticGrid(seed: number, index: number, energy: number, bpm: number): BeatGrid {
    const beatInterval = 60 / bpm;
    return {
        bpm,
        beats: Array.from({ length: 128 }, (_, beat) => beat * beatInterval),
        beatInterval,
        analysisOffset: 0,
        musicalEndSec: 176,
        key: {
            name: index % 3 === 0 ? "C major" : "A minor",
            camelot: index % 3 === 0 ? "8B" : "8A",
            confidence: 0.55 + noise(seed, index, 1) * 0.44,
        },
        energy: {
            energy,
            percussiveness: Math.min(1, energy * (0.75 + noise(seed, index, 2) * 0.25)),
            danceability: Math.min(3, energy * 2.7),
        },
        spectral: {
            centroid: 1_500 + noise(seed, index, 3) * 3_500,
            rolloff: 4_000 + noise(seed, index, 4) * 6_000,
            flatness: 0.05 + noise(seed, index, 5) * 0.25,
            flux: 0.1 + noise(seed, index, 6) * 0.7,
        },
        downbeatPhase: index % 7 === 0 ? 0.5 : 0,
        introSec: 8,
    };
}

function syntheticProfile(seed: number, index: number): TrackProfile {
    const energy = 0.18 + noise(seed, index, 7) * 0.78;
    const bpm = 72 + noise(seed, index, 8) * 104;
    const grid = index % 19 === 0 ? null : syntheticGrid(seed, index, energy, bpm);
    const genre = GENRES[index % GENRES.length]!;
    const profile = buildTrackProfile(
        {
            id: `soak-${seed}-${index}`,
            title: `Synthetic Soak ${index}`,
            durationMs: 180_000,
            uploader: `artist-${index % 37}`,
        },
        {
            grid,
            genre,
            sections: [
                { startSec: 0, endSec: 8, kind: "intro", level: Math.max(0.1, energy * 0.4) },
                { startSec: 8, endSec: 90, kind: "body", level: energy },
                { startSec: 90, endSec: 124, kind: "drop", level: Math.min(1, energy + 0.15) },
                { startSec: 124, endSec: 180, kind: "outro", level: Math.max(0.1, energy * 0.45) },
            ],
        },
    );
    profile.confidence = grid
        ? { beatGrid: 0.85, phrase: 0.78, key: 0.82, structure: 0.76, vocals: 0.7, stems: 0, overall: 0.79 }
        : { beatGrid: 0, phrase: 0, key: 0, structure: 0.15, vocals: 0.2, stems: 0, overall: 0.08 };
    return profile;
}

function planOnce(director: MusicDirector, current: TrackProfile, next: TrackProfile, index: number) {
    return director.planTransition(
        { title: current.trackId, grid: current.beatGrid, durationMs: 180_000 },
        { title: next.trackId, grid: next.beatGrid, durationMs: 180_000 },
        current,
        next,
        {
            fadeSec: 4 + (index % 9),
            tempoSync: index % 5 !== 0,
            eqSweep: index % 4 !== 0,
            harmonic: index % 3 !== 0,
            stemsReady: index % 11 === 0,
            outgoingTempoRatio: 1,
            maxFadeSec: 24,
        },
    );
}

function deterministicDecision(seed: number, index: number, nowMs: number): boolean {
    const current = syntheticProfile(seed, index);
    const next = syntheticProfile(seed, index + 1);
    const decide = () => {
        const director = new MusicDirector({ now: () => nowMs });
        director.setExperience(index % 2 ? "party" : "chill", 0.8);
        const result = planOnce(director, current, next, index);
        return JSON.stringify({ hash: result.decision.inputStateHash, plan: result.plan, cue: result.cue });
    };
    const first = decide();
    const second = decide();
    return first === second;
}

export function runDirectorSoakV1(options: DirectorSoakOptionsV1 = {}): DirectorSoakReportV1 {
    const iterations = Math.max(10, Math.min(10_000, Math.floor(options.iterations ?? 500)));
    const seed = Math.floor(options.seed ?? 42) >>> 0;
    const p99BudgetMicros = Math.max(1, options.p99BudgetMicros ?? 50_000);
    let nowMs = 1_700_000_000_000;
    const director = new MusicDirector({ now: () => nowMs });
    director.setExperience("auto");
    const ledger = new RuntimeEvidenceLedgerV1(2_000);
    const durations: number[] = [];
    const inputHashes = new Set<string>();
    const transitionTypes: Partial<Record<TransitionType, number>> = {};
    const failures: string[] = [];
    let deterministicSamples = 0;
    let deterministicFailures = 0;

    for (let index = 0; index < iterations; index++) {
        nowMs += 1_000;
        ledger.append({
            version: 1,
            id: `network-${index}`,
            atMs: nowMs,
            kind: "network-sync",
            weight: 1,
            network: {
                clockOffsetMs: (noise(seed, index, 9) - 0.5) * 80,
                bufferMs: 20 + noise(seed, index, 10) * 180,
                playoutDriftMs: (noise(seed, index, 11) - 0.5) * 240,
                lateObjects: index % 23 === 0 ? 1 : 0,
                packetLossRate: noise(seed, index, 12) * 0.04,
            },
        });
        ledger.append({
            version: 1,
            id: `interaction-${index}`,
            atMs: nowMs,
            kind: index % 13 === 0 ? "profile-correct" : index % 7 === 0 ? "manual-queue-add" : "transition-completed",
            weight: 1,
            subjectRef: `media:${index % 101}`,
        });
        director.setRuntimeEvidence(ledger.summary({ nowMs }));
        const current = syntheticProfile(seed, index);
        const next = syntheticProfile(seed, index + 1);
        const started = Bun.nanoseconds();
        const result = planOnce(director, current, next, index);
        durations.push((Bun.nanoseconds() - started) / 1_000);
        director.recordOutcome(index % 17 === 0 ? "skipped" : "played", 0.5);

        const type = result.plan.type;
        transitionTypes[type] = (transitionTypes[type] ?? 0) + 1;
        inputHashes.add(result.decision.inputStateHash);
        if (!Number.isFinite(result.plan.fadeSec) || result.plan.fadeSec <= 0 || result.plan.fadeSec > 24) {
            failures.push(`invalid-plan-duration:${index}`);
        }
        if (!Number.isFinite(result.decision.compatibility?.total) || result.decision.candidateScores.length === 0) {
            failures.push(`invalid-decision:${index}`);
        }
        if (index % 50 === 0) {
            deterministicSamples++;
            if (!deterministicDecision(seed, index, nowMs)) deterministicFailures++;
        }
    }

    const distribution = performanceDistributionMicros(durations);
    const snapshot = director.exportSnapshot();
    if (distribution.p99Micros > p99BudgetMicros) failures.push("p99-budget-exceeded");
    if (deterministicFailures) failures.push("determinism-regression");
    if (snapshot.memory.transitionHistory.length > 40) failures.push("transition-history-unbounded");
    if (snapshot.memory.recentArtists.length > 12) failures.push("recent-artists-unbounded");
    if (snapshot.memory.recentGenres.length > 12) failures.push("recent-genres-unbounded");
    if (snapshot.memory.recentBpms.length > 12) failures.push("recent-bpms-unbounded");

    return {
        version: 1,
        seed,
        iterations,
        passed: failures.length === 0,
        failures,
        distribution,
        decisions: {
            transitionTypes,
            uniqueInputHashes: inputHashes.size,
            deterministicSamples,
            deterministicFailures,
        },
        evidence: { retainedEvents: ledger.events().length, totalGenerated: iterations * 2 },
        boundedState: {
            transitionHistory: snapshot.memory.transitionHistory.length,
            recentArtists: snapshot.memory.recentArtists.length,
            recentGenres: snapshot.memory.recentGenres.length,
            recentBpms: snapshot.memory.recentBpms.length,
        },
    };
}
