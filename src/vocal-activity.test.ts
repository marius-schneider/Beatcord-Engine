import { expect, test } from "bun:test";

import { buildVocalActivityProfile, vocalActivityInWindow } from "./vocal-activity";

function samples(sr: number): Float32Array {
    const out = new Float32Array(sr * 16);
    for (let i = 0; i < out.length; i++) {
        const sec = i / sr;
        const active = sec >= 8 && sec < 12;
        out[i] = active ? (i % 60 < 30 ? 0.07 : 0.015) : 0.001;
    }
    return out;
}

test("buildVocalActivityProfile marks active vocal segments", () => {
    const profile = buildVocalActivityProfile(samples(1000), 1000, { segmentSec: 4, windowMs: 80 });
    expect(profile.segments).toHaveLength(4);
    expect(profile.segments[0]?.active).toBe(false);
    expect(profile.segments[2]?.active).toBe(true);
    expect(profile.firstActiveSec).toBe(8);
});

test("vocalActivityInWindow reports clear and active windows", () => {
    const profile = buildVocalActivityProfile(samples(1000), 1000, { segmentSec: 4, windowMs: 80 });
    const clear = vocalActivityInWindow(profile, 0, 4);
    const active = vocalActivityInWindow(profile, 8, 4);
    expect(clear.density).toBeLessThan(0.1);
    expect(active.density).toBeGreaterThan(0.7);
    expect(active.hasData).toBe(true);
});
