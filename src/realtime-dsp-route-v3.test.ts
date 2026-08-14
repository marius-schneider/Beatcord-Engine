import { describe, expect, test } from "bun:test";
import {
    capabilityMatrix,
    DSP_PREWARM,
    negotiateRoute,
    ROUTE_CHANGE_STATES_V2,
    rendererChange,
    routeDspBackend,
    sectionAdaptiveStretch,
    stretchQualityTier,
} from "./realtime-dsp-route-v3";

describe("realtime DSP route v3", () => {
    test("routes Rubber Band quality by realtime budget", () => {
        expect(stretchQualityTier({ realtime: true, cpuHeadroom: 0.8, preview: false }).tier).toBe("hq-realtime-r3");
        expect(stretchQualityTier({ realtime: true, cpuHeadroom: 0.2, preview: false }).tier).toBe("fast-r2");
        expect(stretchQualityTier({ realtime: false, cpuHeadroom: 1, preview: true }).tier).toBe("offline-r3");
    });
    test("maps musical section material to stretch parameters", () => {
        expect(sectionAdaptiveStretch("drums").window).toBe("short");
        expect(sectionAdaptiveStretch("vocals").formants).toBeTrue();
    });
    test("routes each DSP job to a specialized backend", () => {
        expect(
            routeDspBackend({
                type: "resample",
                realtime: false,
                platform: "other",
                openImmersive: false,
                quality: "hq",
            }),
        ).toBe("soxr");
        expect(
            routeDspBackend({ type: "spatial", realtime: true, platform: "other", openImmersive: true, quality: "hq" }),
        ).toBe("oar");
        expect(
            routeDspBackend({
                type: "loudness",
                realtime: true,
                platform: "apple",
                openImmersive: false,
                quality: "fast",
            }),
        ).toBe("vdsp");
    });
    test("queries actual hardware format instead of assuming the request", () => {
        expect(
            negotiateRoute(48_000, { hardwareRate: 44_100, channels: 2, latencyMs: 20, deviceId: "airpods" }),
        ).toEqual({ rate: 44_100, requestedHonored: false, resampleRequired: true, queriedActualRoute: true });
    });
    test("prewarms and follows the route change state machine", () => {
        expect(DSP_PREWARM).toContain("preallocate");
        expect(ROUTE_CHANGE_STATES_V2.at(-1)).toBe("stable");
    });
    test("recompiles presentation without changing the musical journey", () => {
        const changed = rendererChange({
            experience: "party",
            energy: 0.84,
            journeyTarget: "peak",
            currentTrack: "a",
            from: "atmos-avr",
            to: "headphones",
        });
        expect(changed.renderRecompiled).toBeTrue();
        expect(changed.journeyReplanned).toBeFalse();
        expect(changed.energy).toBe(0.84);
    });
    test("models codec, spatial, DSP and raw PCM separately", () => {
        expect(capabilityMatrix("local-flac").rawPcm).toBeTrue();
        expect(capabilityMatrix("iamf").dsp).toContain("oar");
        expect(capabilityMatrix("provider-playback").rawPcm).toBeFalse();
    });
});
