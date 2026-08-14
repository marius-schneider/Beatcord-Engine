import { expect, test } from "bun:test";

import {
    isStemQualityUsable,
    scoreStemQuality,
    scoreStemSetQuality,
    stemPolicyAllows,
    stemQualityFeatures,
    stemSetQualityFeatures,
} from "./stem-quality";

test("scoreStemQuality accepts a present, dynamic vocal stem", () => {
    const quality = scoreStemQuality({
        vocalRms: 0.035,
        instrumentalRms: 0.07,
        vocalDensity: 0.35,
        vocalDynamicRange: 3,
        vocalToInstrumentalDb: -6,
    });
    expect(quality.usableForAcapella).toBe(true);
    expect(isStemQualityUsable(quality)).toBe(true);
    expect(quality.score).toBeGreaterThan(70);
    expect(quality).toMatchObject({ tier: "high", analysisMode: "two-stem", usableForMixing: true });
    expect(stemPolicyAllows(quality, "acapella")).toBe(true);
    expect(stemPolicyAllows(quality, "bass-swap")).toBe(false);
});

test("scoreStemQuality rejects weak or mostly silent vocals", () => {
    const quality = scoreStemQuality({
        vocalRms: 0.001,
        instrumentalRms: 0.04,
        vocalDensity: 0.03,
        vocalDynamicRange: 1.3,
        vocalToInstrumentalDb: -30,
    });
    expect(quality.usableForAcapella).toBe(false);
    expect(quality.reasons.join(" ")).toContain("weak vocal");
});

test("scoreStemQuality rejects dense leakage-like vocal stems", () => {
    const quality = scoreStemQuality({
        vocalRms: 0.05,
        instrumentalRms: 0.056,
        vocalDensity: 0.95,
        vocalDynamicRange: 1.05,
        vocalToInstrumentalDb: -1,
    });
    expect(quality.usableForAcapella).toBe(false);
    expect(quality.leakageRisk).toBeGreaterThan(0.65);
});

test("stemQualityFeatures detects intermittent vocal activity", () => {
    const sr = 100;
    const vocals = new Float32Array(sr * 4);
    const instrumental = new Float32Array(sr * 4);
    for (let i = 0; i < vocals.length; i++) {
        instrumental[i] = 0.04;
        vocals[i] = i % 100 < 35 ? 0.06 : 0.002;
    }
    const features = stemQualityFeatures(vocals, instrumental, sr);
    expect(features.vocalDensity).toBeGreaterThan(0.2);
    expect(features.vocalDensity).toBeLessThan(0.6);
    expect(features.vocalDynamicRange).toBeGreaterThan(1.5);
});

test("four-stem scoring exposes component quality and enables clean mashups", () => {
    const quality = scoreStemSetQuality({
        components: {
            vocals: { rms: 0.04, activityDensity: 0.4, dynamicRange: 3, artifactRisk: 0.04 },
            drums: { rms: 0.08, activityDensity: 0.6, dynamicRange: 2.8, artifactRisk: 0.03 },
            bass: { rms: 0.07, activityDensity: 0.55, dynamicRange: 2.5, artifactRisk: 0.04 },
            other: { rms: 0.05, activityDensity: 0.45, dynamicRange: 2.7, artifactRisk: 0.05 },
        },
        bleed: 0.1,
        artifacts: 0.04,
        legacyVocal: {
            vocalRms: 0.04,
            instrumentalRms: 0.1,
            vocalDensity: 0.4,
            vocalDynamicRange: 3,
            vocalToInstrumentalDb: -8,
        },
    });
    expect(quality).toMatchObject({ tier: "high", analysisMode: "four-stem", usableForMixing: true });
    expect(quality.vocals).toBeGreaterThan(70);
    expect(quality.drums).toBeGreaterThan(70);
    expect(quality.policy.mode).toBe("mashup");
    expect(stemPolicyAllows(quality, "acapella")).toBe(true);
    expect(stemPolicyAllows(quality, "bass-swap")).toBe(true);
});

test("medium stems require EQ assistance and bad stems force full-mix fallback", () => {
    const base = {
        components: {
            vocals: { rms: 0.025, activityDensity: 0.3, dynamicRange: 2, artifactRisk: 0.3 },
            drums: { rms: 0.05, activityDensity: 0.4, dynamicRange: 2, artifactRisk: 0.3 },
            bass: { rms: 0.04, activityDensity: 0.35, dynamicRange: 1.8, artifactRisk: 0.32 },
            other: { rms: 0.035, activityDensity: 0.3, dynamicRange: 1.8, artifactRisk: 0.3 },
        },
        legacyVocal: {
            vocalRms: 0.025,
            instrumentalRms: 0.07,
            vocalDensity: 0.3,
            vocalDynamicRange: 2,
            vocalToInstrumentalDb: -9,
        },
    } as const;
    const medium = scoreStemSetQuality({ ...base, bleed: 0.42, artifacts: 0.31 });
    expect(medium.tier).toBe("medium");
    expect(medium.policy).toMatchObject({ mode: "eq-assisted", eqAssist: true });
    expect(stemPolicyAllows(medium, "bass-swap")).toBe(true);
    expect(stemPolicyAllows(medium, "acapella")).toBe(false);

    const low = scoreStemSetQuality({ ...base, bleed: 0.9, artifacts: 0.8 });
    expect(low).toMatchObject({ tier: "low", usableForMixing: false, usableForAcapella: false });
    expect(low.policy.mode).toBe("full-mix");
    expect(low.policy.allowedUses).toEqual([]);
});

test("four-stem features measure cross-stem bleed", () => {
    const length = 400;
    const vocals = Float32Array.from({ length }, (_, index) => Math.sin(index * 0.1) * 0.04);
    const drums = vocals.slice();
    const bass = Float32Array.from({ length }, (_, index) => Math.sin(index * 0.037) * 0.05);
    const other = Float32Array.from({ length }, (_, index) => Math.cos(index * 0.071) * 0.03);
    const instrumental = Float32Array.from({ length }, (_, index) => drums[index]! + bass[index]! + other[index]!);
    const features = stemSetQualityFeatures({ vocals, drums, bass, other }, instrumental, 100);
    expect(features.bleed).toBeGreaterThan(0.95);
    expect(features.components.vocals.rms).toBeGreaterThan(0);
});
