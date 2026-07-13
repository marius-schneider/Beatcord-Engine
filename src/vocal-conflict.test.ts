import { expect, test } from "bun:test";

import { scoreStemQuality } from "./stem-quality";
import { buildVocalActivityProfile } from "./vocal-activity";
import { assessVocalConflict } from "./vocal-conflict";

const outgoing = scoreStemQuality({
    vocalRms: 0.035,
    instrumentalRms: 0.07,
    vocalDensity: 0.35,
    vocalDynamicRange: 3,
    vocalToInstrumentalDb: -6,
});

const denseIncoming = scoreStemQuality({
    vocalRms: 0.09,
    instrumentalRms: 0.08,
    vocalDensity: 0.8,
    vocalDynamicRange: 3,
    vocalToInstrumentalDb: 1,
});

function activity(activeFromSec: number, activeToSec: number) {
    const sr = 1000;
    const samples = new Float32Array(sr * 16);
    for (let i = 0; i < samples.length; i++) {
        const sec = i / sr;
        const active = sec >= activeFromSec && sec < activeToSec;
        samples[i] = active ? 0.07 : 0.001;
    }
    return buildVocalActivityProfile(samples, sr, { segmentSec: 4, windowMs: 80 });
}

test("assessVocalConflict rejects dense incoming vocals for acapella lanes", () => {
    const score = assessVocalConflict({
        outgoingStemQuality: outgoing,
        incomingStemQuality: denseIncoming,
        incomingIntroSec: 0,
        overlapSec: 8,
        keyScore: 1,
    });

    expect(score.safeForAcapella).toBe(false);
    expect(score.risk).toBeGreaterThan(0.5);
    expect(score.reasons.join(" ")).toContain("incoming vocal likely active");
});

test("assessVocalConflict allows a vocal-heavy incoming track when the intro gives space", () => {
    const score = assessVocalConflict({
        outgoingStemQuality: outgoing,
        incomingStemQuality: denseIncoming,
        incomingIntroSec: 10,
        overlapSec: 8,
        keyScore: 1,
    });

    expect(score.safeForAcapella).toBe(true);
    expect(score.introProtection).toBe(1);
    expect(score.reasons.join(" ")).toContain("intro gives vocal space");
});

test("assessVocalConflict uses the incoming segment window over global vocal density", () => {
    const clearIntro = assessVocalConflict({
        outgoingStemQuality: outgoing,
        incomingStemQuality: denseIncoming,
        incomingVocalActivity: activity(8, 16),
        incomingStartSec: 0,
        overlapSec: 8,
        keyScore: 1,
    });
    expect(clearIntro.safeForAcapella).toBe(true);
    expect(clearIntro.incomingWindowDensity).toBeLessThan(0.2);
    expect(clearIntro.reasons.join(" ")).toContain("incoming vocal window clear");

    const busyIntro = assessVocalConflict({
        outgoingStemQuality: outgoing,
        incomingStemQuality: denseIncoming,
        incomingVocalActivity: activity(0, 8),
        incomingStartSec: 0,
        overlapSec: 8,
        keyScore: 1,
    });
    expect(busyIntro.safeForAcapella).toBe(false);
    expect(busyIntro.incomingWindowDensity).toBeGreaterThan(0.7);
    expect(busyIntro.reasons.join(" ")).toContain("incoming vocal window active");
});
