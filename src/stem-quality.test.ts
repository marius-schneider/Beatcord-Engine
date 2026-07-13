import { expect, test } from "bun:test";

import { isStemQualityUsable, scoreStemQuality, stemQualityFeatures } from "./stem-quality";

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
