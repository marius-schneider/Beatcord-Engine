import { DEFAULT_RUBBERBAND_TUNING, type RubberbandTuning } from "./constants";
import type { TrackProfile } from "./track-profile";

export type StretchMaterial = "drums" | "vocals" | "bass" | "ambient" | "full-mix";
export type StretchQualityMode = "bypass" | "realtime" | "high-quality";

export interface StretchRisk {
    total: number;
    transientSmear: number;
    vocalFormant: number;
    bassInstability: number;
    stereoPhase: number;
    confidence: number;
}

export interface StretchDecision {
    version: 1;
    requestedRatio: number;
    appliedRatio: number;
    material: StretchMaterial;
    algorithm: "none" | "atempo" | "rubberband-r2" | "rubberband-r3";
    preserveFormants: boolean;
    qualityMode: StretchQualityMode;
    allowed: boolean;
    risk: StretchRisk;
    tuning: RubberbandTuning;
    reason: string;
}

export interface AdaptiveStretchOptions {
    rubberbandAvailable?: boolean;
    highQualityAvailable?: boolean;
    realtime?: boolean;
    maximumSafeDelta?: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round = (value: number) => Math.round(value * 1_000) / 1_000;

export function classifyStretchMaterial(profile: TrackProfile): StretchMaterial {
    if (profile.vocalness >= 0.58) return "vocals";
    if (profile.danceability >= 0.72 && profile.intensity >= 0.62) return "drums";
    if (profile.energy >= 0.72 && profile.danceability >= 0.52 && profile.acousticness < 0.35) return "bass";
    if (profile.acousticness >= 0.65 || (profile.energy < 0.38 && profile.intensity < 0.42)) return "ambient";
    return "full-mix";
}

function tuningFor(material: StretchMaterial): RubberbandTuning {
    switch (material) {
        case "drums":
            return {
                ...DEFAULT_RUBBERBAND_TUNING,
                transients: "crisp",
                detector: "percussive",
                window: "short",
                formant: "shifted",
            };
        case "vocals":
            return {
                ...DEFAULT_RUBBERBAND_TUNING,
                transients: "mixed",
                detector: "compound",
                window: "standard",
                formant: "preserved",
            };
        case "bass":
            return {
                ...DEFAULT_RUBBERBAND_TUNING,
                transients: "mixed",
                detector: "compound",
                window: "long",
                smoothing: "on",
            };
        case "ambient":
            return {
                ...DEFAULT_RUBBERBAND_TUNING,
                transients: "smooth",
                detector: "soft",
                phase: "independent",
                window: "long",
                smoothing: "on",
            };
        case "full-mix":
            return DEFAULT_RUBBERBAND_TUNING;
    }
}

function materialSafeDelta(material: StretchMaterial): number {
    switch (material) {
        case "bass":
            return 0.055;
        case "vocals":
            return 0.06;
        case "drums":
        case "full-mix":
            return 0.07;
        case "ambient":
            return 0.08;
    }
}

export function decideAdaptiveStretch(
    profile: TrackProfile,
    requestedRatio: number,
    options: AdaptiveStretchOptions = {},
): StretchDecision {
    const ratio = Number.isFinite(requestedRatio) && requestedRatio > 0 ? requestedRatio : 1;
    const delta = Math.abs(ratio - 1);
    const material = classifyStretchMaterial(profile);
    const tuning = tuningFor(material);
    const amount = clamp01(delta / 0.1);
    const transientDensity = clamp01(profile.intensity * 0.62 + profile.danceability * 0.38);
    const transientSmear = clamp01(amount * transientDensity * (material === "drums" ? 1 : 0.75));
    const vocalFormant = clamp01(amount * profile.vocalness * (tuning.formant === "preserved" ? 0.55 : 1));
    const bassDensity = clamp01(profile.energy * 0.55 + profile.danceability * 0.45);
    const bassInstability = clamp01(amount * bassDensity * (material === "bass" ? 1 : 0.7));
    const stereoPhase = clamp01(amount * profile.complexity * (tuning.channels === "together" ? 0.55 : 0.85));
    const confidence = clamp01(profile.confidence.overall * 0.65 + profile.confidence.structure * 0.35);
    const total = clamp01(transientSmear * 0.36 + vocalFormant * 0.3 + bassInstability * 0.22 + stereoPhase * 0.12);
    const maximumSafeDelta = options.maximumSafeDelta ?? materialSafeDelta(material);
    const rubberband = options.rubberbandAvailable ?? true;
    const highQuality = options.highQualityAvailable ?? false;
    const realtime = options.realtime ?? true;
    const noOp = delta < 0.0001;
    // Heroic stretching is rejected even if its scalar artifact estimate looks
    // acceptable. A route/bridge change is musically safer beyond this bound.
    const allowed = noOp || (delta <= maximumSafeDelta && total < 0.62);
    const appliedRatio = allowed ? ratio : 1;
    const algorithm =
        noOp || !allowed ? "none" : rubberband ? (highQuality ? "rubberband-r3" : "rubberband-r2") : "atempo";
    const qualityMode: StretchQualityMode =
        algorithm === "none" ? "bypass" : highQuality && !realtime ? "high-quality" : "realtime";
    const reason = noOp
        ? "tempo already aligned"
        : !allowed
          ? delta > maximumSafeDelta
              ? `stretch ${(delta * 100).toFixed(1)}% exceeds safe ${(maximumSafeDelta * 100).toFixed(1)}% bound`
              : `predicted stretch artifact risk ${total.toFixed(2)}`
          : `${material} material, ${(delta * 100).toFixed(1)}% stretch, risk ${total.toFixed(2)}`;

    return {
        version: 1,
        requestedRatio: round(ratio),
        appliedRatio: round(appliedRatio),
        material,
        algorithm,
        preserveFormants: tuning.formant === "preserved",
        qualityMode,
        allowed,
        risk: {
            total: round(total),
            transientSmear: round(transientSmear),
            vocalFormant: round(vocalFormant),
            bassInstability: round(bassInstability),
            stereoPhase: round(stereoPhase),
            confidence: round(confidence),
        },
        tuning,
        reason,
    };
}
