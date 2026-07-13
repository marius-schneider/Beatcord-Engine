import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import {
    type ResamplerProfile,
    SAFETY_LIMITER,
    SAMPLE_RATE,
    SOXR_RESAMPLE,
    SWR_RESAMPLE,
    type TempoStretcherProfile,
    tempoStretchFilter,
} from "./constants";
import type { TransitionType } from "./transition-planner";

export const OFFLINE_TRANSITIONS = ["blend", "fade", "filter", "echo", "bassdrop", "gate", "riser"] as const;
export type OfflineTransitionType = Extract<TransitionType, (typeof OFFLINE_TRANSITIONS)[number]>;
export type OfflineRenderFormat = "wav16" | "wav32" | "flac";

export const MDA_LIMITER_URI = "http://drobilla.net/plugins/mda/Limiter";
export const DEFAULT_LV2_PATH = "/opt/homebrew/lib/lv2:/usr/local/lib/lv2";

export interface OfflineTransitionRenderOptions {
    ffmpegPath: string;
    aPath: string;
    bPath: string;
    outputPath: string;
    aStartSec?: number;
    bStartSec?: number;
    preSec?: number;
    fadeSec?: number;
    postSec?: number;
    aTempoRatio?: number;
    tempoRatio?: number;
    aInputFilters?: string[];
    bInputFilters?: string[];
    transition?: OfflineTransitionType;
    eqSweep?: boolean;
    resampler?: ResamplerProfile;
    stretcher?: TempoStretcherProfile;
    format?: OfflineRenderFormat;
    finalLimiter?: boolean;
    useLv2Limiter?: boolean;
    lv2Path?: string;
    useLadspaTrim?: boolean;
    ladspaAmpPath?: string;
    ladspaTrimGain?: number;
}

export interface OfflineTransitionRenderPlan {
    ffmpegPath: string;
    args: string[];
    env: Record<string, string>;
    filterComplex: string;
    outputPath: string;
    outputDurationSec: number;
    transition: OfflineTransitionType;
    format: OfflineRenderFormat;
    commandPreview: string;
    postFilters: string[];
}

export interface OfflineTransitionRenderResult extends OfflineTransitionRenderPlan {
    stderr: string;
}

interface NormalizedOptions {
    ffmpegPath: string;
    aPath: string;
    bPath: string;
    outputPath: string;
    aStartSec: number;
    bStartSec: number;
    preSec: number;
    fadeSec: number;
    postSec: number;
    aTempoRatio: number;
    tempoRatio: number;
    aInputFilters: string[];
    bInputFilters: string[];
    transition: OfflineTransitionType;
    eqSweep: boolean;
    resampler: ResamplerProfile;
    stretcher: TempoStretcherProfile;
    format: OfflineRenderFormat;
    finalLimiter: boolean;
    useLv2Limiter: boolean;
    lv2Path: string;
    useLadspaTrim: boolean;
    ladspaAmpPath: string;
    ladspaTrimGain: number;
}

const FLOAT_FORMAT = `aformat=sample_fmts=fltp:sample_rates=${SAMPLE_RATE}:channel_layouts=stereo`;

function numberOr(name: string, value: number | undefined, fallback: number, min: number, max: number): number {
    const n = value ?? fallback;
    if (!Number.isFinite(n) || n < min || n > max) {
        throw new Error(`${name} must be a finite number between ${min} and ${max}.`);
    }
    return n;
}

function normalizeOptions(options: OfflineTransitionRenderOptions): NormalizedOptions {
    const transition = options.transition ?? "blend";
    if (!OFFLINE_TRANSITIONS.includes(transition)) {
        throw new Error(`Unsupported offline transition: ${transition}`);
    }

    return {
        ffmpegPath: options.ffmpegPath,
        aPath: options.aPath,
        bPath: options.bPath,
        outputPath: options.outputPath,
        aStartSec: numberOr("aStartSec", options.aStartSec, 30, 0, 60 * 60 * 6),
        bStartSec: numberOr("bStartSec", options.bStartSec, 0, 0, 60 * 60 * 6),
        preSec: numberOr("preSec", options.preSec, 8, 0.25, 120),
        fadeSec: numberOr("fadeSec", options.fadeSec, 6, 0.25, 60),
        postSec: numberOr("postSec", options.postSec, 8, 0.25, 120),
        aTempoRatio: numberOr("aTempoRatio", options.aTempoRatio, 1, 0.5, 2),
        tempoRatio: numberOr("tempoRatio", options.tempoRatio, 1, 0.5, 2),
        aInputFilters: options.aInputFilters ?? [],
        bInputFilters: options.bInputFilters ?? [],
        transition,
        eqSweep: options.eqSweep ?? (transition === "blend" || transition === "bassdrop"),
        resampler: options.resampler ?? "soxr",
        stretcher: options.stretcher ?? "rubberband",
        format: options.format ?? "wav16",
        finalLimiter: options.finalLimiter ?? true,
        useLv2Limiter: options.useLv2Limiter ?? false,
        lv2Path: options.lv2Path ?? DEFAULT_LV2_PATH,
        useLadspaTrim: options.useLadspaTrim ?? false,
        ladspaAmpPath: options.ladspaAmpPath ?? "",
        ladspaTrimGain: numberOr("ladspaTrimGain", options.ladspaTrimGain, 0.98, 0, 4),
    };
}

function sec(n: number): string {
    return Number(n.toFixed(4)).toString();
}

function ms(n: number): string {
    return Math.round(n * 1000).toString();
}

function resampleFilter(profile: ResamplerProfile): string {
    return profile === "soxr" ? SOXR_RESAMPLE : SWR_RESAMPLE;
}

function escapeFilterValue(value: string): string {
    return value
        .replaceAll("\\", "\\\\")
        .replaceAll(":", "\\\\:")
        .replaceAll(",", "\\,")
        .replaceAll(";", "\\;")
        .replaceAll("[", "\\[")
        .replaceAll("]", "\\]");
}

function sourceChain(
    input: number,
    label: string,
    duration: number,
    o: NormalizedOptions,
    tempo = 1,
    inputFilters: string[] = [],
): string {
    const filters = [
        ...inputFilters,
        tempoStretchFilter(tempo, o.stretcher),
        resampleFilter(o.resampler),
        FLOAT_FORMAT,
        `atrim=duration=${sec(duration)}`,
        "asetpts=PTS-STARTPTS",
    ].filter(Boolean) as string[];
    return `[${input}:a]${filters.join(",")}[${label}]`;
}

function filteredTail(source: string, label: string, preSec: number, fadeSec: number, filters: string[]): string[] {
    if (!filters.length) return [];
    return [
        `[${source}]asplit=2[${label}pre_src][${label}tail_src]`,
        `[${label}pre_src]atrim=duration=${sec(preSec)},asetpts=PTS-STARTPTS[${label}pre]`,
        `[${label}tail_src]atrim=start=${sec(preSec)}:duration=${sec(fadeSec)},asetpts=PTS-STARTPTS,${filters.join(
            ",",
        )},atrim=duration=${sec(fadeSec)},asetpts=PTS-STARTPTS[${label}tail]`,
        `[${label}pre][${label}tail]concat=n=2:v=0:a=1[${label}]`,
    ];
}

function filteredIntro(
    source: string,
    label: string,
    fadeSec: number,
    postSec: number,
    introFilters: string[],
    postFilters: string[] = [],
): string[] {
    if (!introFilters.length && !postFilters.length) return [];
    const intro = introFilters.length ? `,${introFilters.join(",")}` : "";
    const post = postFilters.length ? `,${postFilters.join(",")}` : "";
    return [
        `[${source}]asplit=2[${label}fade_src][${label}post_src]`,
        `[${label}fade_src]atrim=duration=${sec(fadeSec)},asetpts=PTS-STARTPTS${intro},atrim=duration=${sec(
            fadeSec,
        )},asetpts=PTS-STARTPTS[${label}fade]`,
        `[${label}post_src]atrim=start=${sec(fadeSec)}:duration=${sec(
            postSec,
        )},asetpts=PTS-STARTPTS${post},atrim=duration=${sec(postSec)},asetpts=PTS-STARTPTS[${label}post]`,
        `[${label}fade][${label}post]concat=n=2:v=0:a=1[${label}]`,
    ];
}

function curve(transition: OfflineTransitionType): string {
    if (transition === "fade") return "c1=hsin:c2=hsin";
    return "c1=qsin:c2=qsin";
}

function transitionGraph(o: NormalizedOptions): { graph: string[]; mixLabel: string } {
    const graph: string[] = [];
    const aTailFilters: string[] = [];
    const bIntroFilters: string[] = [];
    const bPostFilters: string[] = [];

    if (o.eqSweep) {
        aTailFilters.push("bass=g=-2.5:f=100");
        bIntroFilters.push("bass=g=-4.5:f=100");
    }

    switch (o.transition) {
        case "filter":
            aTailFilters.push("highpass=f=900:width_type=o:width=2", "treble=g=-1.5:f=9000");
            break;
        case "echo":
            aTailFilters.push("aecho=0.80:0.52:250|500:0.35|0.18");
            break;
        case "bassdrop":
            bIntroFilters.push("highpass=f=180:width_type=h:width=200", "volume=0.92");
            bPostFilters.push("bass=g=1.5:f=90");
            break;
        case "gate":
            aTailFilters.push("tremolo=f=8:d=0.82");
            break;
        case "riser":
            aTailFilters.push("bass=g=-1.5:f=100");
            bIntroFilters.push("bass=g=-3:f=100");
            break;
        case "blend":
        case "fade":
            break;
    }

    const aLabel = aTailFilters.length ? "a_fx" : "a0";
    const bLabel = bIntroFilters.length || bPostFilters.length ? "b_fx" : "b0";
    graph.push(...filteredTail("a0", "a_fx", o.preSec, o.fadeSec, aTailFilters));
    graph.push(...filteredIntro("b0", "b_fx", o.fadeSec, o.postSec, bIntroFilters, bPostFilters));
    graph.push(`[${aLabel}][${bLabel}]acrossfade=d=${sec(o.fadeSec)}:${curve(o.transition)}[mix0]`);

    if (o.transition !== "riser") return { graph, mixLabel: "mix0" };

    const riserFade = Math.max(0.1, o.fadeSec * 0.75);
    const riserOutStart = Math.max(0, o.fadeSec - 0.15);
    graph.push(
        `anoisesrc=color=pink:duration=${sec(o.fadeSec)}:sample_rate=${SAMPLE_RATE}:amplitude=0.055,${FLOAT_FORMAT},highpass=f=2500,lowpass=f=12000,afade=t=in:st=0:d=${sec(
            riserFade,
        )},afade=t=out:st=${sec(riserOutStart)}:d=0.15,adelay=${ms(o.preSec)}|${ms(o.preSec)}[riser]`,
    );
    graph.push("[mix0][riser]amix=inputs=2:duration=first:normalize=0[mix1]");
    return { graph, mixLabel: "mix1" };
}

function postFilterChain(o: NormalizedOptions): string[] {
    const filters: string[] = [];
    if (o.useLadspaTrim) {
        if (!o.ladspaAmpPath) throw new Error("useLadspaTrim requires ladspaAmpPath.");
        filters.push(
            `ladspa=file=${escapeFilterValue(o.ladspaAmpPath)}:plugin=amp_stereo:controls=${o.ladspaTrimGain}`,
        );
    }
    if (o.useLv2Limiter) {
        filters.push(
            `lv2=p=${escapeFilterValue(MDA_LIMITER_URI)}:c=thresh=0.62|output=0.60|release=0.45|attack=0.12|knee=1`,
        );
    }
    if (o.finalLimiter) filters.push(SAFETY_LIMITER);
    return filters;
}

function outputArgs(format: OfflineRenderFormat): string[] {
    if (format === "flac") {
        return ["-c:a", "flac", "-compression_level", "12", "-ar", String(SAMPLE_RATE), "-ac", "2"];
    }
    if (format === "wav32") {
        return ["-c:a", "pcm_f32le", "-ar", String(SAMPLE_RATE), "-ac", "2"];
    }
    return ["-c:a", "pcm_s16le", "-ar", String(SAMPLE_RATE), "-ac", "2"];
}

function shellQuote(value: string): string {
    if (/^[A-Za-z0-9_./:=,+@%-]+$/.test(value)) return value;
    return `'${value.replaceAll("'", "'\\''")}'`;
}

function commandPreview(ffmpegPath: string, args: string[]): string {
    return [ffmpegPath, ...args].map(shellQuote).join(" ");
}

export function buildOfflineTransitionRender(options: OfflineTransitionRenderOptions): OfflineTransitionRenderPlan {
    const o = normalizeOptions(options);
    const outputDurationSec = o.preSec + o.fadeSec + o.postSec;
    const aInputDuration = (o.preSec + o.fadeSec) * o.aTempoRatio;
    const bInputDuration = (o.fadeSec + o.postSec) * o.tempoRatio;
    const graph = [
        sourceChain(0, "a0", o.preSec + o.fadeSec, o, o.aTempoRatio, o.aInputFilters),
        sourceChain(1, "b0", o.fadeSec + o.postSec, o, o.tempoRatio, o.bInputFilters),
    ];
    const transition = transitionGraph(o);
    graph.push(...transition.graph);
    const postFilters = postFilterChain(o);
    graph.push(`[${transition.mixLabel}]${postFilters.length ? postFilters.join(",") : "anull"}[out]`);

    const args = ["-hide_banner", "-y", "-loglevel", "error"];
    if (o.aStartSec > 0) args.push("-ss", sec(o.aStartSec));
    args.push("-t", sec(aInputDuration), "-i", o.aPath);
    if (o.bStartSec > 0) args.push("-ss", sec(o.bStartSec));
    args.push("-t", sec(bInputDuration), "-i", o.bPath);
    args.push("-filter_complex", graph.join(";"), "-map", "[out]", ...outputArgs(o.format), o.outputPath);

    const env: Record<string, string> = {};
    if (o.useLv2Limiter) env.LV2_PATH = o.lv2Path;

    return {
        ffmpegPath: o.ffmpegPath,
        args,
        env,
        filterComplex: graph.join(";"),
        outputPath: o.outputPath,
        outputDurationSec,
        transition: o.transition,
        format: o.format,
        commandPreview: commandPreview(o.ffmpegPath, args),
        postFilters,
    };
}

export async function renderOfflineTransition(
    options: OfflineTransitionRenderOptions,
): Promise<OfflineTransitionRenderResult> {
    const plan = buildOfflineTransitionRender(options);
    if (!existsSync(plan.ffmpegPath)) throw new Error(`FFmpeg not found: ${plan.ffmpegPath}`);
    mkdirSync(dirname(plan.outputPath), { recursive: true });

    const proc = Bun.spawn([plan.ffmpegPath, ...plan.args], {
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, ...plan.env },
    });
    const [stderr, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
    if (code !== 0) throw new Error(stderr.trim() || `ffmpeg exited ${code}`);
    return { ...plan, stderr };
}
