import type { MixRegion } from "./mix-regions";
import type { TrackProfile, TrackSectionType } from "./track-profile";
import type { TransitionType } from "./transition-planner";

export type OverrideScope = "next" | "session";
export type CueAlignment = "exact" | "beat" | "bar" | "phrase";
export type EnergyDirection = "up" | "down" | "hold";
export type StemUsage = "auto" | "forbid" | "prefer";

export interface NeverMixRegion {
    track: "current" | "next";
    start: number;
    end: number;
}

/** Validated power-user intent. Audio safety remains outside and above this contract. */
export interface TransitionOverride {
    version: 1;
    id: string;
    createdAtMs: number;
    scope: OverrideScope;
    fromTrackId?: string;
    toTrackId?: string;
    transitionType?: TransitionType;
    fadeSec?: number;
    mixOutPointSec?: number;
    mixInPointSec?: number;
    alignment?: CueAlignment;
    energyDirection?: EnergyDirection;
    stemUsage?: StemUsage;
    preserveSection?: TrackSectionType;
    neverMixRegions: NeverMixRegion[];
}

export interface TransitionOverrideAudit {
    overrideId: string;
    applied: boolean;
    scope: OverrideScope;
    appliedFields: string[];
    rejectedFields: { field: string; reason: string }[];
    reasons: string[];
}

export type TransitionOverrideValidation = { ok: true; override: TransitionOverride } | { ok: false; error: string };

const TYPES = new Set<TransitionType>([
    "blend",
    "cut",
    "fade",
    "filter",
    "echo",
    "bassdrop",
    "spinback",
    "gate",
    "roll",
    "riser",
    "acapella",
]);
const ALIGNMENTS = new Set<CueAlignment>(["exact", "beat", "bar", "phrase"]);
const ENERGY_DIRECTIONS = new Set<EnergyDirection>(["up", "down", "hold"]);
const STEM_USAGE = new Set<StemUsage>(["auto", "forbid", "prefer"]);
const SECTION_TYPES = new Set<TrackSectionType>([
    "intro",
    "verse",
    "pre-chorus",
    "chorus",
    "bridge",
    "break",
    "build",
    "drop",
    "outro",
    "unknown",
]);

function object(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function optionalString(value: unknown, _field: string, maxLength = 200): string | undefined | null {
    if (value === undefined) return undefined;
    if (typeof value !== "string" || !value.trim() || value.length > maxLength) return null;
    return value.trim();
}

function optionalNumber(value: unknown, _field: string, min: number, max: number): number | undefined | null {
    if (value === undefined) return undefined;
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) return null;
    return value;
}

export function validateTransitionOverride(value: unknown, now = Date.now()): TransitionOverrideValidation {
    const input = object(value);
    if (!input) return { ok: false, error: "override must be an object" };
    const fromTrackId = optionalString(input.fromTrackId, "fromTrackId");
    if (fromTrackId === null) return { ok: false, error: "fromTrackId must be a non-empty string" };
    const toTrackId = optionalString(input.toTrackId, "toTrackId");
    if (toTrackId === null) return { ok: false, error: "toTrackId must be a non-empty string" };
    const transitionType = input.transitionType as TransitionType | undefined;
    if (transitionType !== undefined && !TYPES.has(transitionType)) {
        return { ok: false, error: "transitionType is unsupported" };
    }
    const fadeSec = optionalNumber(input.fadeSec, "fadeSec", 1, 60);
    if (fadeSec === null) return { ok: false, error: "fadeSec must be between 1 and 60" };
    const mixOutPointSec = optionalNumber(input.mixOutPointSec, "mixOutPointSec", 0, 86_400);
    if (mixOutPointSec === null) return { ok: false, error: "mixOutPointSec must be a finite non-negative number" };
    const mixInPointSec = optionalNumber(input.mixInPointSec, "mixInPointSec", 0, 86_400);
    if (mixInPointSec === null) return { ok: false, error: "mixInPointSec must be a finite non-negative number" };
    const scope = (input.scope ?? "next") as OverrideScope;
    if (scope !== "next" && scope !== "session") return { ok: false, error: "scope must be next or session" };
    const alignment = input.alignment as CueAlignment | undefined;
    if (alignment !== undefined && !ALIGNMENTS.has(alignment)) return { ok: false, error: "alignment is unsupported" };
    const energyDirection = input.energyDirection as EnergyDirection | undefined;
    if (energyDirection !== undefined && !ENERGY_DIRECTIONS.has(energyDirection)) {
        return { ok: false, error: "energyDirection must be up, down or hold" };
    }
    const stemUsage = input.stemUsage as StemUsage | undefined;
    if (stemUsage !== undefined && !STEM_USAGE.has(stemUsage)) {
        return { ok: false, error: "stemUsage must be auto, forbid or prefer" };
    }
    const preserveSection = input.preserveSection as TrackSectionType | undefined;
    if (preserveSection !== undefined && !SECTION_TYPES.has(preserveSection)) {
        return { ok: false, error: "preserveSection is unsupported" };
    }
    if (transitionType === "acapella" && stemUsage === "forbid") {
        return { ok: false, error: "acapella conflicts with stemUsage=forbid" };
    }
    const neverMixInput = input.neverMixRegions ?? [];
    if (!Array.isArray(neverMixInput) || neverMixInput.length > 32) {
        return { ok: false, error: "neverMixRegions must be an array with at most 32 entries" };
    }
    const neverMixRegions: NeverMixRegion[] = [];
    for (const raw of neverMixInput) {
        const region = object(raw);
        if (!region || (region.track !== "current" && region.track !== "next")) {
            return { ok: false, error: "neverMixRegions entries need track=current|next" };
        }
        const start = optionalNumber(region.start, "start", 0, 86_400);
        const end = optionalNumber(region.end, "end", 0, 86_400);
        if (start === undefined || start === null || end === undefined || end === null || end <= start) {
            return { ok: false, error: "neverMixRegions entries need finite start < end" };
        }
        neverMixRegions.push({ track: region.track, start, end });
    }
    const hasIntent =
        transitionType !== undefined ||
        fadeSec !== undefined ||
        mixOutPointSec !== undefined ||
        mixInPointSec !== undefined ||
        alignment !== undefined ||
        energyDirection !== undefined ||
        stemUsage !== undefined ||
        preserveSection !== undefined ||
        neverMixRegions.length > 0;
    if (!hasIntent) return { ok: false, error: "override contains no editable intent" };
    return {
        ok: true,
        override: {
            version: 1,
            id: `override-${Math.max(0, Math.floor(now))}`,
            createdAtMs: Math.max(0, Math.floor(now)),
            scope,
            ...(fromTrackId ? { fromTrackId } : {}),
            ...(toTrackId ? { toTrackId } : {}),
            ...(transitionType ? { transitionType } : {}),
            ...(fadeSec !== undefined ? { fadeSec } : {}),
            ...(mixOutPointSec !== undefined ? { mixOutPointSec } : {}),
            ...(mixInPointSec !== undefined ? { mixInPointSec } : {}),
            ...(alignment ? { alignment } : {}),
            ...(energyDirection ? { energyDirection } : {}),
            ...(stemUsage ? { stemUsage } : {}),
            ...(preserveSection ? { preserveSection } : {}),
            neverMixRegions,
        },
    };
}

export function overrideMatches(override: TransitionOverride, fromTrackId: string, toTrackId?: string): boolean {
    if (override.fromTrackId && override.fromTrackId !== fromTrackId) return false;
    if (override.toTrackId && override.toTrackId !== toTrackId) return false;
    return true;
}

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
    return a.start < b.end && b.start < a.end;
}

export function allowedOverrideRegions(
    profile: TrackProfile,
    side: "current" | "next",
    direction: "out" | "in",
    override: TransitionOverride,
): MixRegion[] {
    const source = direction === "out" ? (profile.mixOutRegions ?? []) : (profile.mixInRegions ?? []);
    const forbidden = override.neverMixRegions.filter((region) => region.track === side);
    let minimumStart = 0;
    if (side === "current" && override.preserveSection) {
        minimumStart = profile.sections
            .filter((section) => section.type === override.preserveSection)
            .reduce((latest, section) => Math.max(latest, section.end), 0);
    }
    return source.filter(
        (region) => region.start >= minimumStart && !forbidden.some((blocked) => overlaps(region, blocked)),
    );
}
