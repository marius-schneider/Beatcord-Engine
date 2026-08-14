import { expect, test } from "bun:test";
import { decideAdaptiveStretch } from "./adaptive-stretch";
import { buildOfflineTransitionRender, OFFLINE_TRANSITIONS } from "./offline-renderer";
import type { TrackProfile } from "./track-profile";

function plan(extra: Partial<Parameters<typeof buildOfflineTransitionRender>[0]> = {}) {
    return buildOfflineTransitionRender({
        ffmpegPath: "/tmp/ffmpeg",
        aPath: "/tmp/a.wav",
        bPath: "/tmp/b.wav",
        outputPath: "/tmp/out.wav",
        aStartSec: 12,
        bStartSec: 0,
        preSec: 4,
        fadeSec: 3,
        postSec: 5,
        tempoRatio: 1.04,
        ...extra,
    });
}

test("buildOfflineTransitionRender uses SoXR and Rubberband in the input conditioning graph", () => {
    const p = plan();
    expect(p.filterComplex).toContain("aresample=48000:resampler=soxr");
    expect(p.filterComplex).toContain("rubberband=tempo=1.0400");
    expect(p.filterComplex).toContain("aformat=sample_fmts=fltp");
    expect(p.filterComplex).toContain("acrossfade=d=3:c1=qsin:c2=qsin");
    expect(p.args).toContain("-filter_complex");
    expect(p.outputDurationSec).toBe(12);
});

test("buildOfflineTransitionRender wires LV2 limiter with LV2_PATH", () => {
    const p = plan({ useLv2Limiter: true, lv2Path: "/opt/homebrew/lib/lv2" });
    expect(p.env).toEqual({ LV2_PATH: "/opt/homebrew/lib/lv2" });
    expect(p.filterComplex).toContain("lv2=p=http\\\\://drobilla.net/plugins/mda/Limiter");
    expect(p.postFilters).toContain("alimiter=limit=0.97:level=false:attack=5:release=50");
});

test("buildOfflineTransitionRender supports all offline transition graph variants", () => {
    const graphs = OFFLINE_TRANSITIONS.map((transition) => [transition, plan({ transition }).filterComplex] as const);
    expect(graphs.find(([transition]) => transition === "filter")?.[1]).toContain("highpass=f=900");
    expect(graphs.find(([transition]) => transition === "echo")?.[1]).toContain("aecho=0.80");
    expect(graphs.find(([transition]) => transition === "bassdrop")?.[1]).toContain("highpass=f=180");
    expect(graphs.find(([transition]) => transition === "gate")?.[1]).toContain("tremolo=f=8");
    expect(graphs.find(([transition]) => transition === "riser")?.[1]).toContain("anoisesrc=color=pink");
});

test("buildOfflineTransitionRender can emit float WAV and skip final limiting", () => {
    const p = plan({ finalLimiter: false, format: "wav32", resampler: "swr", stretcher: "atempo" });
    expect(p.filterComplex).toContain("anull[out]");
    expect(p.filterComplex).toContain("aresample=48000:resampler=swr");
    expect(p.filterComplex).toContain("atempo=1.0400");
    expect(p.args).toContain("pcm_f32le");
});

test("buildOfflineTransitionRender supports independent A/B source filters and tempo ratios", () => {
    const p = plan({
        aInputFilters: ["volume=0.9"],
        bInputFilters: ["bass=g=1:f=90"],
        aTempoRatio: 0.98,
        tempoRatio: 1.04,
    });
    expect(p.filterComplex).toContain("[0:a]volume=0.9,rubberband=tempo=0.9800");
    expect(p.filterComplex).toContain("[1:a]bass=g=1:f=90,rubberband=tempo=1.0400");
    expect(p.commandPreview).toContain("-t 6.86");
    expect(p.commandPreview).toContain("-t 8.32");
});

test("buildOfflineTransitionRender compiles material-specific stretch tuning", () => {
    const decision = decideAdaptiveStretch(
        {
            vocalness: 0.85,
            danceability: 0.4,
            intensity: 0.55,
            energy: 0.6,
            acousticness: 0.2,
            complexity: 0.5,
            dynamicRange: 8,
            confidence: { overall: 0.9, structure: 0.8 },
        } as TrackProfile,
        0.96,
    );
    const rendered = plan({ tempoRatio: decision.appliedRatio, bStretchTuning: decision.tuning });
    expect(rendered.filterComplex).toContain("transients=mixed");
    expect(rendered.filterComplex).toContain("formant=preserved");
});
