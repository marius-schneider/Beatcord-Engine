import { type Loopability, selectSafeLoop } from "./loopability";
import type { TrackProfile } from "./track-profile";

export type EmergencyContinuityMode = "none" | "loop-retry" | "fallback-track" | "hard-stop";

export interface EmergencyContinuityPlan {
    version: 1;
    mode: EmergencyContinuityMode;
    loop: Loopability | null;
    maxLoopSec: number;
    hardDeadlineSec: number;
    retryNext: boolean;
    fallbackTrackId: string | null;
    reasons: string[];
}

export function planEmergencyContinuity(input: {
    current: TrackProfile;
    nextReady: boolean;
    currentPositionSec: number;
    fallbackTrackId?: string | null;
    maxLoopSec?: number;
}): EmergencyContinuityPlan {
    const maxLoopSec = Math.min(30, Math.max(4, input.maxLoopSec ?? 20));
    if (input.nextReady) {
        return {
            version: 1,
            mode: "none",
            loop: null,
            maxLoopSec,
            hardDeadlineSec: input.currentPositionSec,
            retryNext: false,
            fallbackTrackId: input.fallbackTrackId ?? null,
            reasons: ["next track is ready"],
        };
    }
    const loop = selectSafeLoop(input.current, input.currentPositionSec + 0.001);
    if (loop && loop.total >= 0.62) {
        return {
            version: 1,
            mode: "loop-retry",
            loop,
            maxLoopSec,
            hardDeadlineSec: Math.round((input.currentPositionSec + maxLoopSec) * 1000) / 1000,
            retryNext: true,
            fallbackTrackId: input.fallbackTrackId ?? null,
            reasons: [
                `loop safe phrase ${loop.start.toFixed(1)}-${loop.end.toFixed(1)}s`,
                `hard ${maxLoopSec}s emergency limit`,
                input.fallbackTrackId ? "prepare fallback track in parallel" : "no fallback track available",
            ],
        };
    }
    return {
        version: 1,
        mode: input.fallbackTrackId ? "fallback-track" : "hard-stop",
        loop,
        maxLoopSec,
        hardDeadlineSec: input.currentPositionSec,
        retryNext: false,
        fallbackTrackId: input.fallbackTrackId ?? null,
        reasons: [
            loop ? `best loop quality ${loop.total.toFixed(2)} is unsafe` : "no loopable instrumental phrase",
            input.fallbackTrackId ? "switch to fallback track" : "stop instead of hiding failure indefinitely",
        ],
    };
}
