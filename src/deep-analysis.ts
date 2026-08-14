// Deep analysis — ONE extra decode of a track yields three new signals the
// beatgrid doesn't give us:
//   • GROOVE  (straight / swing / shuffle / triplet / broken) from onset phase
//   • SECTIONS (intro / build / drop / break / outro) from the energy curve
//   • HEALTH  (true-peak, DC offset, clipping) — the L1 "last 5%"
// The DSP core is split into pure, unit-tested functions; only decodePcm does I/O.

import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { config } from "./config";

const ffmpegPath = resolve(process.cwd(), config.FFMPEG_PATH);

const ANALYSIS_SR = 22_050;
const HOP_SEC = 0.046; // ~1024 samples @ 22050 — the envelope hop

export type GrooveKind = "straight" | "swing" | "shuffle" | "triplet" | "broken";
export interface Groove {
    kind: GrooveKind;
    /** Median 8th-note "and" phase (0.5 = straight, ~0.66 = hard swing). */
    swing: number;
}

export type SectionKind = "intro" | "build" | "drop" | "break" | "outro" | "body";
export interface Section {
    startSec: number;
    endSec: number;
    kind: SectionKind;
    level: number; // 0..1 mean energy
}

export interface TrackHealth {
    truePeakDb: number; // dBTP (4× oversampled peak)
    dcOffsetDb: number; // DC as dBFS (−inf = none)
    clipPct: number; // fraction of samples at/near full scale
}

export interface DeepAnalysis {
    groove: Groove;
    sections: Section[];
    health: TrackHealth;
}

// ── I/O: decode a mono analysis-rate segment ──

function decodePcm(filePath: string, startSec: number, durSec: number): Promise<Float32Array> {
    return new Promise((res) => {
        const p = spawn(
            ffmpegPath,
            [
                "-hide_banner",
                "-loglevel",
                "error",
                "-ss",
                String(startSec),
                "-t",
                String(durSec),
                "-i",
                filePath,
                "-ac",
                "1",
                "-ar",
                String(ANALYSIS_SR),
                "-f",
                "f32le",
                "pipe:1",
            ],
            { stdio: ["ignore", "pipe", "ignore"] },
        );
        const chunks: Buffer[] = [];
        p.stdout.on("data", (d: Buffer) => chunks.push(d));
        p.on("close", () => {
            const buf = Buffer.concat(chunks);
            res(new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4)));
        });
        p.on("error", () => res(new Float32Array(0)));
    });
}

// ── pure DSP ──

/** Windowed RMS envelope (0..1, normalized to its own max). */
export function rmsCurve(pcm: Float32Array, sr = ANALYSIS_SR, hopSec = HOP_SEC): number[] {
    const hop = Math.max(1, Math.round(sr * hopSec));
    const out: number[] = [];
    for (let i = 0; i + hop <= pcm.length; i += hop) {
        let s = 0;
        for (let j = i; j < i + hop; j++) s += pcm[j]! * pcm[j]!;
        out.push(Math.sqrt(s / hop));
    }
    const max = Math.max(1e-9, ...out);
    return out.map((v) => v / max);
}

/** Onset times (sec) as positive jumps in the RMS envelope above a threshold. */
export function detectOnsets(curve: number[], hopSec = HOP_SEC): number[] {
    const onsets: number[] = [];
    for (let i = 1; i < curve.length - 1; i++) {
        const rise = curve[i]! - curve[i - 1]!;
        if (rise > 0.12 && curve[i]! >= curve[i + 1]! && curve[i]! > 0.2) onsets.push(i * hopSec);
    }
    return onsets;
}

/**
 * Estimate groove from onset phases relative to the beat. Straight tracks put
 * the off-beat 8th at 0.5; swing/shuffle delay it toward 0.66; a triplet feel
 * clusters onsets near 0.33 and 0.66; scattered phases read as "broken".
 */
export function estimateGroove(onsets: number[], bpm: number): Groove {
    const beatSec = 60 / Math.max(60, Math.min(200, bpm || 120));
    const phases = onsets.map((t) => (t % beatSec) / beatSec).filter((p) => p > 0.05 && p < 0.95);
    if (phases.length < 8) return { kind: "straight", swing: 0.5 };

    // The "and" onsets: those in the middle of the beat.
    const ands = phases.filter((p) => p >= 0.35 && p <= 0.75).sort((a, b) => a - b);
    const swing = ands.length ? ands[Math.floor(ands.length / 2)]! : 0.5;

    // Triplet feel = onsets on the FIRST triplet subdivision (~1/3), which
    // straight and swing tracks never have (they sit only at 0 and ~0.5–0.66).
    const near = (p: number, c: number) => Math.abs(p - c) < 0.045;
    const trip13 = phases.filter((p) => near(p, 1 / 3)).length / phases.length;

    // Scatter: how off-grid the phases are (mean deviation from the nearest 8th).
    const grid = [0, 0.25, 0.5, 0.75];
    const dev = phases.reduce((a, p) => a + Math.min(...grid.map((g) => Math.abs(p - g))), 0) / phases.length;

    if (trip13 > 0.18) return { kind: "triplet", swing };
    if (dev > 0.14) return { kind: "broken", swing };
    if (swing < 0.54) return { kind: "straight", swing };
    if (swing < 0.61) return { kind: "swing", swing };
    return { kind: "shuffle", swing };
}

/**
 * Segment the energy curve into labeled sections. Heuristic but useful: a rising
 * ramp into a sustained high is a build→drop; a dip after a high is a break;
 * leading/trailing lows are intro/outro.
 */
export function segmentSections(curve: number[], hopSec = HOP_SEC): Section[] {
    const n = curve.length;
    if (n < 8) return [];
    // 3-level quantize with hysteresis-free simple thresholds, then merge runs.
    const level = (v: number): "low" | "mid" | "high" => (v < 0.4 ? "low" : v > 0.72 ? "high" : "mid");
    const raw: { start: number; end: number; lvl: "low" | "mid" | "high" }[] = [];
    let start = 0;
    for (let i = 1; i <= n; i++) {
        if (i === n || level(curve[i]!) !== level(curve[start]!)) {
            raw.push({ start, end: i, lvl: level(curve[start]!) });
            start = i;
        }
    }
    // Merge segments shorter than ~4s into their neighbor.
    const minLen = Math.max(1, Math.round(4 / hopSec));
    const merged = raw.filter((s) => s.end - s.start >= minLen || raw.length <= 2);
    if (!merged.length) return [];

    const sections: Section[] = [];
    for (let i = 0; i < merged.length; i++) {
        const s = merged[i]!;
        const mean = curve.slice(s.start, s.end).reduce((a, b) => a + b, 0) / (s.end - s.start);
        let kind: SectionKind = "body";
        const isFirst = i === 0;
        const isLast = i === merged.length - 1;
        const prev = merged[i - 1];
        if (s.lvl === "low" && isFirst) kind = "intro";
        else if (s.lvl === "low" && isLast) kind = "outro";
        else if (s.lvl === "low" && prev?.lvl === "high") kind = "break";
        else if (s.lvl === "mid" && merged[i + 1]?.lvl === "high") kind = "build";
        else if (s.lvl === "high") kind = "drop";
        sections.push({
            startSec: s.start * hopSec,
            endSec: s.end * hopSec,
            kind,
            level: Math.round(mean * 100) / 100,
        });
    }
    return sections;
}

/** True-peak (4× oversampled), DC offset, and clipping fraction. */
export function analyzeHealth(pcm: Float32Array): TrackHealth {
    if (pcm.length === 0) return { truePeakDb: -Infinity, dcOffsetDb: -Infinity, clipPct: 0 };
    let sum = 0;
    let clipped = 0;
    let peak = 0;
    for (let i = 0; i < pcm.length; i++) {
        const v = pcm[i]!;
        sum += v;
        const a = Math.abs(v);
        if (a > peak) peak = a;
        if (a >= 0.999) clipped++;
    }
    // 4× oversample via linear interpolation to estimate inter-sample true peak.
    let truePeak = peak;
    for (let i = 0; i + 1 < pcm.length; i++) {
        const a = pcm[i]!;
        const b = pcm[i + 1]!;
        for (let k = 1; k < 4; k++) {
            const v = Math.abs(a + ((b - a) * k) / 4);
            if (v > truePeak) truePeak = v;
        }
    }
    const dc = Math.abs(sum / pcm.length);
    const dB = (v: number) => (v <= 1e-9 ? -Infinity : 20 * Math.log10(v));
    return {
        truePeakDb: Math.round(dB(truePeak) * 10) / 10,
        dcOffsetDb: Math.round(dB(dc) * 10) / 10,
        clipPct: Math.round((clipped / pcm.length) * 10000) / 100,
    };
}

// ── orchestration ──

export async function deepAnalyze(filePath: string, bpm: number, durationSec: number): Promise<DeepAnalysis> {
    // Analyse a representative window (skip a quiet intro), like the beatgrid.
    const start = durationSec > 90 ? 30 : 0;
    const dur = Math.min(120, Math.max(30, durationSec - start));
    const pcm = await decodePcm(filePath, start, dur);
    const curve = rmsCurve(pcm);
    const onsets = detectOnsets(curve);
    return {
        groove: estimateGroove(onsets, bpm),
        sections: segmentSections(curve).map((s) => ({ ...s, startSec: s.startSec + start, endSec: s.endSec + start })),
        health: analyzeHealth(pcm),
    };
}
