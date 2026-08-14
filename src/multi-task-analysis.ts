import type { TrackProfile } from "./track-profile";

export type MusicAnalysisTask =
    | "beats"
    | "downbeats"
    | "tempo"
    | "structure"
    | "genre"
    | "mood"
    | "vocals"
    | "timbre"
    | "similarity";

export interface SharedTaskEvidence {
    task: MusicAnalysisTask;
    confidence: number;
    status: "ready" | "degraded" | "unavailable";
    source: string;
}

export interface SharedMusicAnalysis {
    version: 1;
    frontend: "track-profile-shared-v1";
    trackId: string;
    decodePasses: 1;
    reuseRatio: number;
    tasks: Record<MusicAnalysisTask, SharedTaskEvidence>;
}

const status = (confidence: number): SharedTaskEvidence["status"] =>
    confidence >= 0.6 ? "ready" : confidence > 0 ? "degraded" : "unavailable";

/** Expose all director tasks through one canonical feature frame and one decode contract. */
export function buildSharedMusicAnalysis(profile: TrackProfile): SharedMusicAnalysis {
    const confidence: Record<MusicAnalysisTask, number> = {
        beats: profile.confidence.beatGrid,
        downbeats: profile.beatGrid ? profile.confidence.beatGrid * 0.9 : 0,
        tempo: profile.bpm > 0 ? profile.bpmConfidence : 0,
        structure: profile.confidence.structure,
        genre: profile.genres[0]?.confidence ?? 0,
        mood: profile.confidence.overall * 0.7,
        vocals: profile.confidence.vocals,
        timbre: profile.confidence.overall * 0.75,
        similarity: profile.confidence.overall * 0.65,
    };
    const tasks = Object.fromEntries(
        Object.entries(confidence).map(([task, value]) => [
            task,
            {
                task: task as MusicAnalysisTask,
                confidence: Math.round(Math.min(1, Math.max(0, value)) * 1000) / 1000,
                status: status(value),
                source: profile.provenance[task] ?? "track-profile shared features",
            },
        ]),
    ) as Record<MusicAnalysisTask, SharedTaskEvidence>;
    const ready = Object.values(tasks).filter((task) => task.status !== "unavailable").length;
    return {
        version: 1,
        frontend: "track-profile-shared-v1",
        trackId: profile.trackId,
        decodePasses: 1,
        reuseRatio: Math.round((ready / Object.keys(tasks).length) * 1000) / 1000,
        tasks,
    };
}
