import type { ExperienceSelection } from "./experience-engine";
import type { TrackProfile } from "./track-profile";

export type PerformanceStyleId = "natural" | "dj" | "club";

export interface PerformanceStyle {
    manipulation: number;
    transitionIntensity: number;
    tempoFlexibility: number;
    structurePreservation: number;
    effectIntensity: number;
    stemUsage: number;
}

export interface PerformanceStyleSelection {
    id: PerformanceStyleId;
    style: PerformanceStyle;
    source: "derived" | "override";
    confidence: number;
    reason: string;
}

export interface PerformanceStyleOverride {
    id?: PerformanceStyleId;
    style?: Partial<PerformanceStyle>;
}

export const PERFORMANCE_STYLES: Record<PerformanceStyleId, PerformanceStyle> = {
    natural: {
        manipulation: 0.16,
        transitionIntensity: 0.24,
        tempoFlexibility: 0.1,
        structurePreservation: 0.94,
        effectIntensity: 0.12,
        stemUsage: 0.08,
    },
    dj: {
        manipulation: 0.56,
        transitionIntensity: 0.62,
        tempoFlexibility: 0.52,
        structurePreservation: 0.68,
        effectIntensity: 0.48,
        stemUsage: 0.42,
    },
    club: {
        manipulation: 0.82,
        transitionIntensity: 0.86,
        tempoFlexibility: 0.78,
        structurePreservation: 0.48,
        effectIntensity: 0.76,
        stemUsage: 0.7,
    },
};

const FIELDS = [
    "manipulation",
    "transitionIntensity",
    "tempoFlexibility",
    "structurePreservation",
    "effectIntensity",
    "stemUsage",
] as const satisfies readonly (keyof PerformanceStyle)[];

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

function inferredId(profiles: readonly TrackProfile[]): PerformanceStyleId {
    if (!profiles.length) return "natural";
    const average = (field: "danceability" | "acousticness" | "energy") =>
        profiles.reduce((sum, profile) => sum + profile[field], 0) / profiles.length;
    const electronicShare =
        profiles.filter((profile) => ["edm", "house", "techno", "dance"].includes(profile.genres[0]?.genre ?? ""))
            .length / profiles.length;
    if (electronicShare >= 0.5 && average("danceability") >= 0.62) return "club";
    if (average("danceability") >= 0.48 && average("acousticness") < 0.6) return "dj";
    return "natural";
}

/** Derive technical performance independently from the requested emotional experience. */
export function selectPerformanceStyle(
    experience: ExperienceSelection,
    profiles: readonly TrackProfile[] = [],
    override?: PerformanceStyleOverride | null,
): PerformanceStyleSelection {
    const id = override?.id ?? inferredId(profiles);
    const base = PERFORMANCE_STYLES[id];
    const style = Object.fromEntries(
        FIELDS.map((field) => {
            const requested = override?.style?.[field];
            return [field, clamp01(typeof requested === "number" ? requested : base[field])];
        }),
    ) as unknown as PerformanceStyle;
    const source = override ? "override" : "derived";
    return {
        id,
        style,
        source,
        confidence: override ? 1 : Math.min(0.9, 0.55 + profiles.length * 0.1),
        reason:
            source === "override"
                ? `Explicit ${id} performance style; experience remains ${experience.resolved}`
                : `Derived ${id} performance style from audio context; experience remains ${experience.resolved}`,
    };
}
