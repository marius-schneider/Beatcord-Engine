/**
 * Worker thread that runs the CPU-heavy beat-grid analysis off the main thread.
 *
 * detectBeatGridSync blocks for ~500ms (MusicTempo + FFT + essentia, all
 * synchronous). On the main thread that froze the audio tick and the voice receiver
 * — heard as playback stutter and dropped voice commands whenever a track was
 * analysed. Here it runs in isolation; the main thread stays responsive and just
 * awaits the posted result.
 *
 * Protocol: main posts `{ id, filePath, durationMs }`; we reply `{ id, grid }`
 * (grid is a plain serialisable object or null). One analysis at a time per worker —
 * the pool in beatgrid.ts owns concurrency.
 */

import { detectBeatGridSync } from "./beatgrid";

interface Job {
    id: number;
    filePath: string;
    durationMs: number;
}

declare const self: Worker;

self.onmessage = async (e: MessageEvent<Job>) => {
    const { id, filePath, durationMs } = e.data;
    try {
        const grid = await detectBeatGridSync(filePath, durationMs);
        self.postMessage({ id, grid });
    } catch (err) {
        // Never let a worker error go unanswered — the pool would leak a pending
        // promise. Report null (same as "couldn't analyse") with the message.
        self.postMessage({ id, grid: null, error: (err as Error).message });
    }
};
