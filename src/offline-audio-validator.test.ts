import { expect, test } from "bun:test";

import { assessOfflineAudioValidation } from "./offline-audio-validator";
import { RealtimeQualityGuardian } from "./quality-guardian";

function cleanSnapshot() {
    const guardian = new RealtimeQualityGuardian();
    for (let frame = 0; frame < 30; frame++) {
        const samples = new Float32Array(960 * 2);
        for (let i = 0; i < 960; i++) {
            const value = Math.sin(((frame * 960 + i) * Math.PI * 2 * 220) / 48_000) * 0.7;
            samples[i * 2] = value;
            samples[i * 2 + 1] = value;
        }
        guardian.observeFloatFrame(samples, 1, 1);
    }
    return guardian.snapshot();
}

test("offline validation accepts a clean render with the expected duration", () => {
    const result = assessOfflineAudioValidation(cleanSnapshot(), 14.01, 14);
    expect(result.usable).toBe(true);
    expect(result.recommendation).toBe("accept");
    expect(result.durationErrorMs).toBe(10);
});

test("offline validation rejects truncated and silent renders", () => {
    const silent = new RealtimeQualityGuardian();
    for (let i = 0; i < 30; i++) silent.observeFloatFrame(new Float32Array(960 * 2), 1, 1);
    const result = assessOfflineAudioValidation(silent.snapshot(), 2, 14);
    expect(result.usable).toBe(false);
    expect(result.recommendation).toBe("fallback");
    expect(result.issues).toContain("unexpected-silence");
    expect(result.issues).toContain("duration-mismatch");
});

test("offline validation rejects non-finite DSP output", () => {
    const guardian = new RealtimeQualityGuardian();
    for (let i = 0; i < 30; i++) {
        const frame = new Float32Array(960 * 2).fill(0.2);
        if (i === 3) frame[7] = Number.POSITIVE_INFINITY;
        guardian.observeFloatFrame(frame, 1, 1);
    }
    const result = assessOfflineAudioValidation(guardian.snapshot(), 14, 14);
    expect(result.usable).toBe(false);
    expect(result.issues).toContain("non-finite-samples");
});
