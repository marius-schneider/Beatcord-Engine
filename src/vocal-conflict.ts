import type { StemQuality } from "./stem-quality";
import { type VocalActivityProfile, vocalActivityInWindow } from "./vocal-activity";

export interface VocalConflictOptions {
    outgoingStemQuality?: StemQuality | null | undefined;
    incomingStemQuality?: StemQuality | null | undefined;
    incomingVocalActivity?: VocalActivityProfile | null | undefined;
    incomingStartSec?: number | null | undefined;
    incomingIntroSec?: number | null | undefined;
    overlapSec?: number | undefined;
    keyScore?: number | null | undefined;
    maxRisk?: number | undefined;
}

export interface VocalConflictScore {
    /** 0 = clean vocal lane, 1 = very likely vocal-on-vocal conflict. */
    risk: number;
    /** 0-100 convenience inverse of risk for candidate scoring. */
    score: number;
    incomingVocalRisk: number;
    incomingWindowDensity: number | null;
    outgoingCrowdRisk: number;
    harmonicRisk: number;
    introProtection: number;
    knownIncomingVocal: boolean;
    safeForAcapella: boolean;
    reasons: string[];
}

const DEFAULT_MAX_RISK = 0.5;
const DEFAULT_OVERLAP_SEC = 8;

function clamp(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, n));
}

function round(n: number, digits = 3): number {
    const f = 10 ** digits;
    return Math.round(n * f) / f;
}

function incomingRisk(quality: StemQuality | null | undefined): number {
    if (!quality) return 0.36;
    const density = clamp(quality.vocalDensity / 0.6, 0, 1);
    const presence = quality.vocalPresence;
    const leakage = 1 - quality.vocalIsolation;
    return clamp(presence * 0.42 + density * 0.46 + leakage * 0.12, 0, 1);
}

function incomingWindowRisk(profile: VocalActivityProfile, startSec: number, overlapSec: number): number | null {
    const activity = vocalActivityInWindow(profile, startSec, overlapSec);
    if (!activity.hasData || activity.coverage < 0.45) return null;
    const densityRisk = clamp(activity.density / 0.42, 0, 1);
    const peakRisk = clamp(activity.peakDensity / 0.7, 0, 1);
    const presenceRisk = clamp((20 * Math.log10(Math.max(1e-9, activity.rms)) + 42) / 24, 0, 1);
    return clamp(densityRisk * 0.68 + peakRisk * 0.22 + presenceRisk * 0.1, 0, 1);
}

function outgoingRisk(quality: StemQuality | null | undefined): number {
    if (!quality) return 0.18;
    const denseVocal = clamp((quality.vocalDensity - 0.55) / 0.35, 0, 1);
    const isolated = quality.vocalIsolation;
    return clamp(denseVocal * quality.vocalPresence * 0.8 + (1 - isolated) * 0.2, 0, 1);
}

function introProtection(introSec: number | null | undefined, overlapSec: number): number {
    if (!introSec || introSec <= 0) return 0;
    const protectedWindow = Math.max(4, Math.min(12, overlapSec));
    return clamp(introSec / protectedWindow, 0, 1);
}

function harmonicRisk(keyScore: number | null | undefined): number {
    if (keyScore == null) return 0.25;
    return clamp((0.88 - keyScore) / 0.28, 0, 1);
}

/**
 * Estimate whether an acapella-out will leave a clean vocal lane: A's isolated
 * vocal over B's beat is strongest when B has little vocal activity during the
 * overlap, the keys are truly compatible, and A's vocal is not dense enough to
 * crowd the whole transition.
 */
export function assessVocalConflict(options: VocalConflictOptions): VocalConflictScore {
    const maxRisk = options.maxRisk ?? DEFAULT_MAX_RISK;
    const overlapSec = options.overlapSec ?? DEFAULT_OVERLAP_SEC;
    const knownIncomingVocal = options.incomingStemQuality !== undefined || options.incomingVocalActivity !== undefined;
    const incomingStartSec = options.incomingStartSec ?? options.incomingIntroSec ?? 0;
    const window = options.incomingVocalActivity
        ? vocalActivityInWindow(options.incomingVocalActivity, incomingStartSec, overlapSec)
        : null;
    const windowRisk =
        options.incomingVocalActivity && window
            ? incomingWindowRisk(options.incomingVocalActivity, incomingStartSec, overlapSec)
            : null;
    const incomingBase = windowRisk ?? incomingRisk(options.incomingStemQuality);
    const protection = introProtection(options.incomingIntroSec, overlapSec);
    const incomingVocalRisk = clamp(incomingBase * (1 - (windowRisk == null ? protection * 0.72 : 0)), 0, 1);
    const outgoingCrowdRisk = outgoingRisk(options.outgoingStemQuality);
    const harmonic = harmonicRisk(options.keyScore);
    const risk = clamp(incomingVocalRisk * 0.62 + outgoingCrowdRisk * 0.16 + harmonic * 0.22, 0, 1);
    const score = clamp(100 - risk * 100, 0, 100);

    const reasons: string[] = [];
    if (!knownIncomingVocal) reasons.push("incoming vocal profile unknown");
    else if (windowRisk != null && window) {
        if (window.density >= 0.45) reasons.push("incoming vocal window active");
        else if (window.density <= 0.12) reasons.push("incoming vocal window clear");
        else reasons.push("incoming vocal window moderate");
    } else if (!options.incomingStemQuality && !options.incomingVocalActivity)
        reasons.push("incoming vocal stem unavailable");
    else if (incomingBase >= 0.68) reasons.push("incoming vocal likely active");
    else if (incomingBase <= 0.32) reasons.push("incoming vocal light");
    else reasons.push("incoming vocal moderate");
    if (protection >= 0.65) reasons.push("intro gives vocal space");
    if (outgoingCrowdRisk >= 0.5) reasons.push("outgoing vocal is dense");
    if (harmonic >= 0.45) reasons.push("harmonic vocal tension");
    if (risk <= maxRisk) reasons.push("clean vocal lane");
    else reasons.push("vocal conflict risk");

    return {
        risk: round(risk),
        score: round(score, 1),
        incomingVocalRisk: round(incomingVocalRisk),
        incomingWindowDensity: window?.hasData ? window.density : null,
        outgoingCrowdRisk: round(outgoingCrowdRisk),
        harmonicRisk: round(harmonic),
        introProtection: round(protection),
        knownIncomingVocal,
        safeForAcapella: risk <= maxRisk,
        reasons,
    };
}
