export type TimedMomentKind = "track-start" | "drop" | "custom";

export interface TimedMomentRequest {
    id: string;
    targetEpochMs: number;
    targetTrackId: string;
    kind: TimedMomentKind;
    momentOffsetSec: number;
    toleranceSec?: number;
}

export interface BacktimingTrack {
    trackId: string;
    durationSec: number;
    transitionOverlapSec?: number;
}

export interface BacktimingEntry {
    trackId: string;
    startEpochMs: number;
    endEpochMs: number;
}

export interface BacktimingPlan {
    version: 1;
    request: TimedMomentRequest;
    status: "exact" | "waiting" | "late" | "unavailable";
    targetTrackStartEpochMs: number;
    projectedMomentEpochMs: number;
    errorSec: number;
    fillerSec: number;
    schedule: BacktimingEntry[];
    adjustments: string[];
}

/** Anchor the requested musical moment and schedule the preceding queue backwards. */
export function planBacktiming(
    nowEpochMs: number,
    request: TimedMomentRequest,
    queue: readonly BacktimingTrack[],
): BacktimingPlan {
    const targetIndex = queue.findIndex((track) => track.trackId === request.targetTrackId);
    const targetTrackStartEpochMs = request.targetEpochMs - Math.max(0, request.momentOffsetSec) * 1000;
    if (targetIndex < 0) {
        return {
            version: 1,
            request,
            status: "unavailable",
            targetTrackStartEpochMs,
            projectedMomentEpochMs: request.targetEpochMs,
            errorSec: 0,
            fillerSec: 0,
            schedule: [],
            adjustments: ["target track is not in the current queue"],
        };
    }
    const schedule: BacktimingEntry[] = [];
    let endEpochMs = targetTrackStartEpochMs;
    for (let index = targetIndex - 1; index >= 0; index--) {
        const track = queue[index]!;
        const effectiveSec = Math.max(1, track.durationSec - Math.max(0, track.transitionOverlapSec ?? 0));
        const startEpochMs = endEpochMs - effectiveSec * 1000;
        schedule.unshift({ trackId: track.trackId, startEpochMs, endEpochMs });
        endEpochMs = startEpochMs;
    }
    const target = queue[targetIndex]!;
    schedule.push({
        trackId: target.trackId,
        startEpochMs: targetTrackStartEpochMs,
        endEpochMs: targetTrackStartEpochMs + target.durationSec * 1000,
    });
    const firstStart = schedule[0]?.startEpochMs ?? targetTrackStartEpochMs;
    const fillerSec = Math.max(0, (firstStart - nowEpochMs) / 1000);
    const lateSec = Math.max(0, (nowEpochMs - firstStart) / 1000);
    const tolerance = Math.max(0.1, request.toleranceSec ?? 1);
    const status: BacktimingPlan["status"] = lateSec > tolerance ? "late" : fillerSec > tolerance ? "waiting" : "exact";
    return {
        version: 1,
        request,
        status,
        targetTrackStartEpochMs,
        projectedMomentEpochMs: targetTrackStartEpochMs + request.momentOffsetSec * 1000,
        errorSec: Math.round(lateSec * 1000) / 1000,
        fillerSec: Math.round(fillerSec * 1000) / 1000,
        schedule,
        adjustments: [
            "track order anchored backwards from target moment",
            ...(fillerSec > tolerance ? [`fill ${fillerSec.toFixed(1)}s before the scheduled sequence`] : []),
            ...(lateSec > tolerance
                ? [`sequence starts ${lateSec.toFixed(1)}s too late; shorten or skip earlier material`]
                : []),
        ],
    };
}
