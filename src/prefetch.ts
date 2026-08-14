// TrackPrep — download + analysis pipeline for upcoming tracks. Everything a
// track needs before it can start (file) and before it can be *mixed well*
// (loudness, beatgrid, genre) is prepared here, deduplicated and cached, so
// skips are instant and the BeatmatchController always finds traits ready.
//
// detectBeatGrid bundles tempo+beats+downbeat+key+spectral+energy in ONE
// worker-pooled call — never call the individual analyzers separately.

import { AnalysisCache, type AnalyzerDescriptor, analyzerFingerprint, hashTrackFile } from "./analysis-cache";
import type { BeatGrid } from "./beatgrid";
import { detectBeatGrid, reconcileTempo } from "./beatgrid";
import {
    type ComputeBudgetScheduler,
    type ComputeSchedulerSnapshot,
    type ComputeTaskPriority,
    computeScheduler,
} from "./compute-budget";
import { type DeepAnalysis, deepAnalyze, type Groove, type Section, type TrackHealth } from "./deep-analysis";
import { classifyGenre, type GenreHint, inferGenre } from "./genre";
import { type PreparationReadiness, type PreparationResource, readyPreparation } from "./latency-aware-planning";
import { createLogger } from "./logger";
import { type LoudnessStats, loudnormFilter, measureLoudness, TARGET_I, TARGET_LRA, TARGET_TP } from "./loudness";
import { sourceDownloadTrack } from "./source";
import { analyzeStemQuality, type StemQuality } from "./stem-quality";
import { cachedStems, getStems, type Stems, stemsAvailable } from "./stems";
import { buildTrackProfile, type TrackProfile } from "./track-profile";
import { analyzeVocalActivityProfile, type VocalActivityProfile } from "./vocal-activity";
import type { TrackInfo } from "./ytdlp";

const log = createLogger("prep");

const STORE_MAX = 100;

/** A queue entry as far as warming is concerned: a track, maybe already on disk. */
export interface WarmCandidate {
    track: TrackInfo;
    filePath?: string | null | undefined;
}

/**
 * Which of a queue's head entries are worth warming.
 *
 * Bounded by `depth` on purpose: adding a 50-track playlist must not become 50
 * downloads. Entries that already have a file are dropped (nothing to fetch), and
 * live streams are dropped because they have no finite file at all — asking for one
 * wedges the download path, which is why `enqueue` rejects them outright.
 */
export function warmTargets(queue: readonly WarmCandidate[], depth: number): TrackInfo[] {
    if (depth <= 0) return [];
    return queue
        .slice(0, depth)
        .filter((entry) => !entry.filePath && !entry.track.isLive)
        .map((entry) => entry.track);
}

export const TRACK_ANALYZER_VERSIONS = {
    loudness: "loudness-ebur128-v2",
    beatGrid: "beat-grid-v3-confidence-fusion",
    genre: "genre-classifier-v2",
    structure: "deep-analysis-v1",
    trackProfile: "track-profile-v3-musical-timeline",
    stemQuality: "stem-quality-gate-v2",
    vocalActivity: "vocal-activity-v1",
} as const;

export interface AnalysisCacheAudit {
    trackHash: string;
    hits: string[];
    misses: string[];
    analyzerVersions: Record<string, string>;
}

export interface AnalysisComputeAudit {
    tier: number;
    priority: ComputeTaskPriority;
    deferred: string[];
}

export interface AnalysisRecord {
    filePath: string;
    loudnorm?: string;
    grid: BeatGrid | null;
    genre: GenreHint;
    /** True once grid+loudness analysis finished (grid may still be null). */
    complete: boolean;
    // ── stems (Ultra-Mode; only computed opportunistically for the current
    //    track, since Demucs is expensive) ──
    stems?: Stems;
    stemQuality?: StemQuality;
    vocalActivity?: VocalActivityProfile;
    /** Guards against double stem work. */
    stemsAttempted?: boolean;
    // ── deep analysis (one extra decode: groove + sections + health) ──
    groove?: Groove;
    sections?: Section[];
    health?: TrackHealth;
    /** Canonical director-level view of every available analysis signal. */
    profile?: TrackProfile;
    /** Reproducibility and cache-hit surface for logs/debug APIs. */
    cache?: AnalysisCacheAudit;
    /** Device-tier decisions that intentionally omitted optional analyzers. */
    compute?: AnalysisComputeAudit;
}

export interface TrackPrepOptions {
    analysisCache?: AnalysisCache;
    analyzerVersions?: Partial<Record<keyof typeof TRACK_ANALYZER_VERSIONS, string>>;
    analyzers?: Partial<TrackPrepAnalyzers>;
    computeScheduler?: ComputeBudgetScheduler;
    now?: () => number;
}

export interface TrackPreparationReadiness {
    buffer: PreparationReadiness;
    analysis: PreparationReadiness;
    stems: PreparationReadiness;
}

export interface TrackPrepAnalyzers {
    download: typeof sourceDownloadTrack;
    hashFile: typeof hashTrackFile;
    loudness: typeof measureLoudness;
    beatGrid: typeof detectBeatGrid;
    structure: typeof deepAnalyze;
}

export class TrackPrep {
    #store = new Map<string, AnalysisRecord>();
    #downloads = new Map<string, Promise<string>>();
    #analyses = new Map<string, Promise<AnalysisRecord>>();
    #analysisCache: AnalysisCache;
    #versions: Record<keyof typeof TRACK_ANALYZER_VERSIONS, string>;
    #analyzers: TrackPrepAnalyzers;
    #computeScheduler: ComputeBudgetScheduler;
    #now: () => number;
    #stageStarted = new Map<string, number>();
    #stageFailures = new Map<string, string>();
    #stageEstimateMs: Record<"download" | "analysis" | "stems", number> = {
        download: 15_000,
        analysis: 8_000,
        stems: 180_000,
    };
    #stageSamples: Record<"download" | "analysis" | "stems", number> = { download: 0, analysis: 0, stems: 0 };

    constructor(options: TrackPrepOptions = {}) {
        this.#analysisCache = options.analysisCache ?? new AnalysisCache();
        this.#versions = { ...TRACK_ANALYZER_VERSIONS, ...options.analyzerVersions };
        this.#analyzers = {
            download: sourceDownloadTrack,
            hashFile: hashTrackFile,
            loudness: measureLoudness,
            beatGrid: detectBeatGrid,
            structure: deepAnalyze,
            ...options.analyzers,
        };
        this.#computeScheduler = options.computeScheduler ?? computeScheduler;
        this.#now = options.now ?? Date.now;
    }

    /** Fired when a track's full analysis lands (UI chips, automix planning). */
    onAnalysisReady: (trackId: string, record: AnalysisRecord) => void = () => {};

    /** Best-known record (may be download-only while analysis runs). */
    get(trackId: string): AnalysisRecord | undefined {
        const rec = this.#store.get(trackId);
        if (rec) {
            // LRU refresh.
            this.#store.delete(trackId);
            this.#store.set(trackId, rec);
        }
        return rec;
    }

    /** Download (deduplicated). Resolves to the cached file path. */
    ensureDownloaded(track: TrackInfo): Promise<string> {
        const existing = this.get(track.id);
        if (existing) return Promise.resolve(existing.filePath);
        let p = this.#downloads.get(track.id);
        if (!p) {
            this.#startStage(track.id, "download");
            p = this.#analyzers
                .download(track)
                .then((filePath) => {
                    this.#remember(track.id, {
                        filePath,
                        grid: null,
                        genre: inferGenre(track.title, track.uploader),
                        complete: false,
                    });
                    this.#finishStage(track.id, "download");
                    return filePath;
                })
                .catch((error: unknown) => {
                    this.#failStage(track.id, "download", error);
                    throw error;
                })
                .finally(() => this.#downloads.delete(track.id));
            this.#downloads.set(track.id, p);
        }
        return p;
    }

    /** Download + full analysis (loudness ∥ beatgrid → genre), deduplicated. */
    ensureAnalyzed(track: TrackInfo, priority: ComputeTaskPriority = "foreground"): Promise<AnalysisRecord> {
        const existing = this.get(track.id);
        if (existing?.complete) return Promise.resolve(existing);
        let p = this.#analyses.get(track.id);
        if (!p) {
            this.#startStage(track.id, "analysis");
            p = this.#analyze(track, priority)
                .then((record) => {
                    this.#finishStage(track.id, "analysis");
                    return record;
                })
                .catch((error: unknown) => {
                    this.#failStage(track.id, "analysis", error);
                    throw error;
                })
                .finally(() => this.#analyses.delete(track.id));
            this.#analyses.set(track.id, p);
        }
        return p;
    }

    /** Fire-and-forget warmup for the queue head (current + next N). Pick the
     *  argument with `warmTargets` rather than passing a whole queue. */
    prefetch(tracks: TrackInfo[]): void {
        for (const track of tracks) {
            void this.ensureAnalyzed(track, "background").catch((err) => {
                log.debug(`prefetch failed for ${track.id}: ${(err as Error).message}`);
            });
        }
    }

    async #analyze(track: TrackInfo, priority: ComputeTaskPriority): Promise<AnalysisRecord> {
        const filePath = await this.ensureDownloaded(track);
        const trackHash = await this.#analyzers.hashFile(filePath);
        const cached = await this.#analysisCache.load(trackHash);
        const hits: string[] = [];
        const misses: string[] = [];
        const deferred: string[] = [];
        const computeTier = this.#computeScheduler.snapshot().tier;
        const fromCache = <T>(name: string, value: T | undefined): T | undefined => {
            (value === undefined ? misses : hits).push(name);
            return value;
        };
        const loudnessDescriptor: AnalyzerDescriptor = {
            analyzerVersion: this.#versions.loudness,
            parameters: { targetI: TARGET_I, targetTp: TARGET_TP, targetLra: TARGET_LRA },
        };
        const beatDescriptor: AnalyzerDescriptor = {
            analyzerVersion: this.#versions.beatGrid,
            modelVersion: "aubio+beatroot+essentia+chroma-confidence-fusion-v1",
            parameters: { durationMs: track.durationMs, bpmHint: track.bpm ?? null },
        };
        const cachedStats = fromCache(
            "loudness",
            this.#analysisCache.get<LoudnessStats>(cached, "loudness", loudnessDescriptor),
        );
        const cachedGrid = fromCache("beatGrid", this.#analysisCache.get<BeatGrid>(cached, "beatGrid", beatDescriptor));
        const allowBackgroundBeatGrid = priority !== "background" || computeTier >= 1;
        let gridAnalysis: Promise<BeatGrid | null>;
        if (cachedGrid !== undefined) gridAnalysis = Promise.resolve(cachedGrid);
        else if (allowBackgroundBeatGrid) {
            gridAnalysis = this.#runCompute(
                track.id,
                "beat-grid",
                priority,
                { cpu: 0.25, memoryMb: 256, minimumTier: priority === "background" ? 1 : 0 },
                () =>
                    this.#analyzers
                        .beatGrid(filePath, track.durationMs)
                        .then((raw) => (raw ? reconcileTempo(raw, track.bpm) : null))
                        .catch(() => null),
                deferred,
            );
        } else {
            deferred.push("beat-grid: compute tier 0");
            gridAnalysis = Promise.resolve(null);
        }
        const [stats, grid] = await Promise.all([
            cachedStats ??
                this.#runCompute(
                    track.id,
                    "loudness",
                    priority,
                    { cpu: 0.25, memoryMb: 96, minimumTier: 0 },
                    () => this.#analyzers.loudness(filePath, trackHash).catch(() => null),
                    deferred,
                ),
            gridAnalysis,
        ]);
        const writes: Promise<void>[] = [];
        if (cachedStats === undefined && stats) {
            writes.push(this.#analysisCache.set(trackHash, track.id, "loudness", loudnessDescriptor, stats));
        }
        if (cachedGrid === undefined && grid) {
            writes.push(this.#analysisCache.set(trackHash, track.id, "beatGrid", beatDescriptor, grid));
        }

        const genreDescriptor: AnalyzerDescriptor = {
            analyzerVersion: this.#versions.genre,
            parameters: {
                title: track.title,
                uploader: track.uploader ?? null,
                beatDependency: analyzerFingerprint(beatDescriptor),
            },
        };
        const cachedGenre = fromCache("genre", this.#analysisCache.get<GenreHint>(cached, "genre", genreDescriptor));
        const genre =
            cachedGenre ??
            (grid
                ? classifyGenre(
                      {
                          spectral: grid.spectral,
                          percussiveness: grid.energy.percussiveness,
                          bpm: grid.bpm,
                          energy: grid.energy.energy,
                          danceability: grid.energy.danceability,
                      },
                      track.title,
                      track.uploader,
                  )
                : inferGenre(track.title, track.uploader));
        if (cachedGenre === undefined) {
            writes.push(this.#analysisCache.set(trackHash, track.id, "genre", genreDescriptor, genre));
        }

        const structureDescriptor: AnalyzerDescriptor = {
            analyzerVersion: this.#versions.structure,
            parameters: {
                durationSec: track.durationMs / 1000,
                bpm: grid?.bpm ?? 120,
                beatDependency: analyzerFingerprint(beatDescriptor),
            },
        };
        const cachedDeep = fromCache(
            "structure",
            this.#analysisCache.get<DeepAnalysis>(cached, "structure", structureDescriptor),
        );
        const allowBackgroundStructure = priority !== "background" || computeTier >= 2;
        let deep: DeepAnalysis | null | undefined = cachedDeep;
        if (cachedDeep === undefined && allowBackgroundStructure) {
            deep = await this.#runCompute(
                track.id,
                "structure",
                priority,
                { cpu: 0.25, memoryMb: 192, minimumTier: priority === "background" ? 2 : 0 },
                () => this.#analyzers.structure(filePath, grid?.bpm ?? 120, track.durationMs / 1000).catch(() => null),
                deferred,
            );
        } else if (cachedDeep === undefined) {
            deferred.push(`structure: compute tier ${computeTier}`);
            deep = null;
        }
        if (cachedDeep === undefined && deep) {
            writes.push(this.#analysisCache.set(trackHash, track.id, "structure", structureDescriptor, deep));
        }

        const record: AnalysisRecord = {
            filePath,
            ...(stats ? { loudnorm: loudnormFilter(stats) } : {}),
            grid,
            genre,
            complete: true,
            ...(deep ? { groove: deep.groove, sections: deep.sections, health: deep.health } : {}),
            cache: {
                trackHash,
                hits,
                misses,
                analyzerVersions: { ...this.#versions },
            },
            compute: { tier: computeTier, priority, deferred },
        };
        const profileDescriptor: AnalyzerDescriptor = {
            analyzerVersion: this.#versions.trackProfile,
            parameters: {
                track: {
                    id: track.id,
                    title: track.title,
                    uploader: track.uploader ?? null,
                    durationMs: track.durationMs,
                    bpm: track.bpm ?? null,
                },
                dependencies: {
                    loudness: analyzerFingerprint(loudnessDescriptor),
                    beatGrid: analyzerFingerprint(beatDescriptor),
                    genre: analyzerFingerprint(genreDescriptor),
                    structure: analyzerFingerprint(structureDescriptor),
                },
            },
        };
        const cachedProfile = fromCache(
            "trackProfile",
            this.#analysisCache.get<TrackProfile>(cached, "trackProfile", profileDescriptor),
        );
        record.profile = cachedProfile ?? buildTrackProfile(track, record, { loudness: stats });
        if (cachedProfile === undefined) {
            writes.push(
                this.#analysisCache.set(trackHash, track.id, "trackProfile", profileDescriptor, record.profile),
            );
        }
        await Promise.all(writes);
        this.#remember(track.id, record);
        log.info(
            `analyzed ${track.id}: ${grid ? `${grid.bpm.toFixed(1)} BPM, ${grid.key.camelot}` : "no grid"}, ${genre}` +
                (deep
                    ? `, ${deep.groove.kind}${deep.health.clipPct > 1 ? `, ⚠ clip ${deep.health.clipPct}%` : ""}`
                    : "") +
                `, cache ${hits.length}/${hits.length + misses.length}`,
        );
        this.onAnalysisReady(track.id, record);
        return record;
    }

    /**
     * Opportunistically separate + analyze the vocal stem of a track (the
     * expensive Demucs pass). Only call this for the CURRENT track — it's the
     * potential OUTGOING side of the next transition, so its isolated vocal is
     * what an acapella move layers over the incoming beat. Best-effort: if it
     * isn't done by the time the transition fires, the planner just won't pick
     * acapella. Never throws.
     */
    ensureStems(track: TrackInfo): void {
        if (!stemsAvailable()) return;
        const existing = this.get(track.id);
        if (!existing || existing.stemsAttempted) return;
        existing.stemsAttempted = true;
        this.#startStage(track.id, "stems");
        void (async () => {
            let completed = false;
            try {
                const filePath = existing.filePath;
                const alreadyCached = cachedStems(track.id);
                const stemOutcome = alreadyCached
                    ? { status: "completed" as const, value: alreadyCached }
                    : await this.#computeScheduler.schedule(
                          {
                              id: `${track.id}:stem-separation`,
                              kind: "stem-separation",
                              lane: "background",
                              priority: "opportunistic",
                              cpu: 1.5,
                              memoryMb: 2_500,
                              minimumTier: 2,
                          },
                          ({ signal }) => getStems(track.id, filePath, signal),
                      );
                if (stemOutcome.status !== "completed") {
                    existing.stemsAttempted = false;
                    if (existing.compute) existing.compute.deferred.push(`stems: ${stemOutcome.reason}`);
                    return;
                }
                const stems = stemOutcome.value;
                if (!stems) return;
                const stemQualityDescriptor: AnalyzerDescriptor = {
                    analyzerVersion: this.#versions.stemQuality,
                    modelVersion: stems.modelVersion,
                    parameters: { fourStem: !!(stems.drums && stems.bass && stems.other) },
                };
                const vocalActivityDescriptor: AnalyzerDescriptor = {
                    analyzerVersion: this.#versions.vocalActivity,
                    modelVersion: stems.modelVersion,
                    parameters: { durationSec: track.durationMs / 1000 },
                };
                const trackHash = existing.cache?.trackHash;
                const cached = trackHash ? await this.#analysisCache.load(trackHash) : null;
                const cachedQuality = this.#analysisCache.get<StemQuality>(
                    cached,
                    "stemQuality",
                    stemQualityDescriptor,
                );
                const cachedVocalActivity = this.#analysisCache.get<VocalActivityProfile>(
                    cached,
                    "vocalActivity",
                    vocalActivityDescriptor,
                );
                const [quality, vocalActivity] = await Promise.all([
                    cachedQuality ??
                        analyzeStemQuality({
                            vocalsPath: stems.vocals,
                            instrumentalPath: stems.instrumental,
                            ...(stems.drums && stems.bass && stems.other
                                ? { drumsPath: stems.drums, bassPath: stems.bass, otherPath: stems.other }
                                : {}),
                        }).catch(() => null),
                    cachedVocalActivity ??
                        analyzeVocalActivityProfile({
                            vocalsPath: stems.vocals,
                            durationSec: track.durationMs / 1000,
                        }).catch(() => null),
                ]);
                const rec = this.get(track.id);
                if (!rec) return;
                rec.stems = stems;
                if (quality) rec.stemQuality = quality;
                if (vocalActivity) rec.vocalActivity = vocalActivity;
                if (quality || vocalActivity) {
                    const previousProfile = rec.profile;
                    const priorLoudness: LoudnessStats | undefined = previousProfile
                        ? {
                              input_i: String(previousProfile.loudness),
                              input_tp: "0",
                              input_lra: String(previousProfile.dynamicRange),
                              input_thresh: "0",
                              target_offset: "0",
                          }
                        : undefined;
                    rec.profile = buildTrackProfile(track, rec, priorLoudness ? { loudness: priorLoudness } : {});
                }
                if (rec.cache) {
                    (cachedQuality ? rec.cache.hits : rec.cache.misses).push("stemQuality");
                    (cachedVocalActivity ? rec.cache.hits : rec.cache.misses).push("vocalActivity");
                }
                const writes: Promise<void>[] = [];
                if (trackHash && !cachedQuality && quality) {
                    writes.push(
                        this.#analysisCache.set(trackHash, track.id, "stemQuality", stemQualityDescriptor, quality),
                    );
                }
                if (trackHash && !cachedVocalActivity && vocalActivity) {
                    writes.push(
                        this.#analysisCache.set(
                            trackHash,
                            track.id,
                            "vocalActivity",
                            vocalActivityDescriptor,
                            vocalActivity,
                        ),
                    );
                }
                await Promise.all(writes);
                log.info(`stems ready for ${track.id}${quality ? ` (vocal quality ${quality.score.toFixed(0)})` : ""}`);
                this.onAnalysisReady(track.id, rec);
                completed = true;
            } catch (err) {
                log.debug(`stems failed for ${track.id}: ${(err as Error).message}`);
                this.#failStage(track.id, "stems", err);
            } finally {
                if (completed) this.#finishStage(track.id, "stems");
                else if (!this.#stageFailures.has(this.#stageKey(track.id, "stems"))) {
                    this.#cancelStage(track.id, "stems");
                }
            }
        })();
    }

    preparationReadiness(trackId: string, nowMs = this.#now()): TrackPreparationReadiness {
        const record = this.#store.get(trackId);
        return {
            buffer: record?.filePath
                ? readyPreparation("buffer", nowMs, "audio file is locally addressable")
                : this.#stageReadiness(trackId, "download", "buffer", nowMs),
            analysis: record?.complete
                ? readyPreparation("analysis", nowMs, "core track analysis complete")
                : this.#stageReadiness(trackId, "analysis", "analysis", nowMs),
            stems: record?.stems
                ? readyPreparation("stems", nowMs, "separated stems and quality analysis complete")
                : this.#stageReadiness(trackId, "stems", "stems", nowMs),
        };
    }

    computeSnapshot(): ComputeSchedulerSnapshot {
        return this.#computeScheduler.snapshot();
    }

    setPlaybackActive(active: boolean): ComputeSchedulerSnapshot {
        return this.#computeScheduler.updateRuntime({ playbackActive: active });
    }

    async #runCompute<T>(
        trackId: string,
        kind: "loudness" | "beat-grid" | "structure",
        priority: ComputeTaskPriority,
        cost: { cpu: number; memoryMb: number; minimumTier: 0 | 1 | 2 | 3 },
        run: () => Promise<T>,
        deferred: string[],
    ): Promise<T | null> {
        const outcome = await this.#computeScheduler.schedule(
            { id: `${trackId}:${kind}`, kind, lane: "background", priority, ...cost },
            run,
        );
        if (outcome.status === "completed") return outcome.value;
        deferred.push(`${kind}: ${outcome.reason}`);
        return null;
    }

    #stageKey(trackId: string, stage: "download" | "analysis" | "stems"): string {
        return `${trackId}:${stage}`;
    }

    #startStage(trackId: string, stage: "download" | "analysis" | "stems"): void {
        const key = this.#stageKey(trackId, stage);
        if (!this.#stageStarted.has(key)) this.#stageStarted.set(key, this.#now());
        this.#stageFailures.delete(key);
    }

    #finishStage(trackId: string, stage: "download" | "analysis" | "stems"): void {
        const key = this.#stageKey(trackId, stage);
        const startedAt = this.#stageStarted.get(key);
        this.#stageStarted.delete(key);
        this.#stageFailures.delete(key);
        if (startedAt === undefined) return;
        const duration = Math.max(1, this.#now() - startedAt);
        const samples = this.#stageSamples[stage];
        const alpha = samples === 0 ? 1 : 0.25;
        this.#stageEstimateMs[stage] = this.#stageEstimateMs[stage] * (1 - alpha) + duration * alpha;
        this.#stageSamples[stage] = samples + 1;
    }

    #failStage(trackId: string, stage: "download" | "analysis" | "stems", error: unknown): void {
        const key = this.#stageKey(trackId, stage);
        this.#stageStarted.delete(key);
        this.#stageFailures.set(key, error instanceof Error ? error.message : String(error));
    }

    #cancelStage(trackId: string, stage: "download" | "analysis" | "stems"): void {
        this.#stageStarted.delete(this.#stageKey(trackId, stage));
    }

    #stageReadiness(
        trackId: string,
        stage: "download" | "analysis" | "stems",
        resource: PreparationResource,
        nowMs: number,
    ): PreparationReadiness {
        const key = this.#stageKey(trackId, stage);
        const failure = this.#stageFailures.get(key);
        if (failure) {
            return {
                resource,
                status: "failed",
                progress: 0,
                estimatedRemainingMs: null,
                confidence: 1,
                updatedAtMs: nowMs,
                reason: failure,
            };
        }
        const estimate = this.#stageEstimateMs[stage];
        const samples = this.#stageSamples[stage];
        const confidence = Math.min(0.92, 0.35 + samples * 0.1);
        const startedAt = this.#stageStarted.get(key);
        if (startedAt === undefined) {
            return {
                resource,
                status: "not-started",
                progress: 0,
                estimatedRemainingMs: Math.round(estimate),
                confidence,
                updatedAtMs: nowMs,
                reason: `${stage} has not started`,
            };
        }
        const elapsed = Math.max(0, nowMs - startedAt);
        const progress = Math.min(0.95, elapsed / Math.max(1, estimate));
        const estimatedRemainingMs = Math.max(250, estimate - elapsed, estimate * 0.15);
        return {
            resource,
            status: "running",
            progress,
            estimatedRemainingMs: Math.round(estimatedRemainingMs),
            confidence,
            updatedAtMs: nowMs,
            reason: `${stage} ETA learned from ${samples} completed job${samples === 1 ? "" : "s"}`,
        };
    }

    #remember(trackId: string, record: AnalysisRecord): void {
        this.#store.delete(trackId);
        this.#store.set(trackId, record);
        while (this.#store.size > STORE_MAX) {
            const oldest = this.#store.keys().next().value;
            if (oldest === undefined) break;
            this.#store.delete(oldest);
        }
    }
}
