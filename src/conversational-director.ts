const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const round = (v: number) => Math.round(v * 1000) / 1000;

export type Constraint = {
    field: string;
    operator: "exclude" | "require" | "max" | "min" | "next";
    value: string | number;
};
export type Preference = {
    field: string;
    direction: "increase" | "decrease" | "prefer";
    value?: string | number;
    weight: number;
};
export interface JourneyIntent {
    targetEnergyDelta?: number;
    targetGenre?: string;
    transitionMinutes?: number;
    shape?: string;
}
export interface TemporalIntent {
    afterMinutes: number;
    action: string;
    value?: string;
}
export interface NaturalLanguageIntent {
    hardConstraints: Constraint[];
    softPreferences: Preference[];
    desiredJourney?: JourneyIntent;
    temporalConstraints?: TemporalIntent[];
    confidence: number;
    original: string;
}

export function parseMusicIntent(text: string): NaturalLanguageIntent {
    const normalized = text.toLowerCase();
    const hardConstraints: Constraint[] = [];
    const softPreferences: Preference[] = [];
    const journey: JourneyIntent = {};
    const temporal: TemporalIntent[] = [];
    const genre = normalized.match(/(?:kein|keine|keinen|ohne)\s+([\p{L}-]+)/u)?.[1];
    if (genre) hardConstraints.push({ field: "genre", operator: "exclude", value: genre });
    if (/auf keinen fall/.test(normalized) && normalized.includes("deutschrap"))
        hardConstraints.push({ field: "genre", operator: "exclude", value: "deutschrap" });
    if (/weniger\s+(?:deutschrap|vocals|gesang)/.test(normalized))
        softPreferences.push({
            field: normalized.includes("deutschrap") ? "genre:deutschrap" : "vocals",
            direction: "decrease",
            weight: 0.65,
        });
    if (/energetischer|mehr energie|eskalieren/.test(normalized)) {
        softPreferences.push({ field: "energy", direction: "increase", weight: 0.8 });
        journey.targetEnergyDelta = 0.25;
    }
    if (/keine harten|weniger aggressiv/.test(normalized))
        softPreferences.push({ field: "mix-intensity", direction: "decrease", weight: 0.85 });
    const minutes = normalized.match(/(?:in|über)\s+(\d+)\s+min/)?.[1];
    if (minutes) journey.transitionMinutes = Number(minutes);
    const toward = normalized.match(/(?:richtung|danach gerne)\s+([\p{L}-]+)/u)?.[1];
    if (toward) {
        journey.targetGenre = toward;
        temporal.push({ afterMinutes: Number(minutes ?? 0), action: "prefer-genre", value: toward });
    }
    const next = normalized.match(/spiel\s+(.+?)\s+als nächstes/)?.[1];
    if (next) hardConstraints.push({ field: "track", operator: "next", value: next });
    return {
        hardConstraints,
        softPreferences,
        ...(Object.keys(journey).length ? { desiredJourney: journey } : {}),
        ...(temporal.length ? { temporalConstraints: temporal } : {}),
        confidence: round(
            clamp01(0.45 + (hardConstraints.length + softPreferences.length + Object.keys(journey).length) * 0.1),
        ),
        original: text,
    };
}

export type CritiqueType =
    | "increase-energy"
    | "decrease-energy"
    | "increase-novelty"
    | "increase-familiarity"
    | "exclude-genre"
    | "prefer-genre"
    | "prefer-artist"
    | "reduce-vocals"
    | "increase-groove"
    | "reduce-mix-intensity"
    | "set-target-track"
    | "set-deadline";
export interface StructuredCritique {
    type: CritiqueType;
    value?: string | number;
    scope: "track" | "session" | "mix";
    deterministicOperation: true;
}
export function critiqueFromText(text: string): StructuredCritique | null {
    const n = text.toLowerCase();
    if (n.includes("more energetic") || n.includes("mehr energie"))
        return { type: "increase-energy", scope: "session", deterministicOperation: true };
    if (n.includes("less mainstream"))
        return { type: "increase-novelty", scope: "session", deterministicOperation: true };
    if (n.includes("less vocals") || n.includes("weniger vocals"))
        return { type: "reduce-vocals", scope: "track", deterministicOperation: true };
    if (n.includes("less aggressive mixing") || n.includes("weniger aggressive übergänge"))
        return { type: "reduce-mix-intensity", scope: "mix", deterministicOperation: true };
    const genre = n.match(/not this genre|kein ([\p{L}-]+)/u)?.[1];
    return genre ? { type: "exclude-genre", value: genre, scope: "session", deterministicOperation: true } : null;
}

export const CONVERSATIONAL_TOOL_LAYER = [
    "catalog-search",
    "user-taste",
    "crowd-state",
    "chart-search",
    "similarity",
    "journey-planner",
    "music-director",
] as const;
export interface CatalogEntity {
    id: string;
    title: string;
    artist: string;
    available: boolean;
}
export function resolveCatalogEntity(
    candidateText: string,
    catalog: readonly CatalogEntity[],
): { entity: CatalogEntity | null; verified: boolean; hallucinationBlocked: boolean } {
    const normalized = candidateText.toLowerCase();
    const entity =
        catalog.find(
            (item) =>
                item.available &&
                (`${item.artist} ${item.title}`.toLowerCase().includes(normalized) ||
                    item.title.toLowerCase() === normalized),
        ) ?? null;
    return { entity: entity ? { ...entity } : null, verified: Boolean(entity), hallucinationBlocked: !entity };
}
export function deterministicToolParameters(text: string): Record<string, string | number | boolean> {
    const n = text.toLowerCase();
    return {
        ...(n.includes("upbeat") || n.includes("energetic") ? { arousal: "high" } : {}),
        ...(n.includes("2000") ? { eraStart: 2000, eraEnd: 2009 } : {}),
        ...(n.includes("everyone knows") || n.includes("bekannte") ? { crowdFamiliarity: "high" } : {}),
    };
}
export const PRODUCTION_NL_SYSTEMS = ["jam", "muchator", "production-playlist-agent-2026"] as const;

export function conversationApplication(input: {
    command: string;
    transitionState: "idle" | "planned" | "armed" | "committed";
    isSkip: boolean;
}): { playbackContinues: true; apply: "immediate" | "outside-commit-horizon"; abortTransition: boolean } {
    return input.isSkip
        ? { playbackContinues: true, apply: "immediate", abortTransition: true }
        : {
              playbackContinues: true,
              apply:
                  input.transitionState === "idle" || input.transitionState === "planned"
                      ? "immediate"
                      : "outside-commit-horizon",
              abortTransition: false,
          };
}

export type ConversationMemoryLayer = "turn" | "session" | "user-preference" | "persistent";
export interface ConversationMemoryEntry {
    text: string;
    layer: ConversationMemoryLayer;
    savedExplicitly: boolean;
}
export function storeConversationMemory(
    text: string,
    requestedLayer: ConversationMemoryLayer,
    explicitSave: boolean,
): ConversationMemoryEntry {
    return {
        text,
        layer: requestedLayer === "persistent" && !explicitSave ? "session" : requestedLayer,
        savedExplicitly: explicitSave,
    };
}

export type ControlTier = "simple" | "advanced" | "lab";
export interface ControlPreference {
    preferredAutomation: number;
    explanationFrequency: number;
    manualCorrectionDepth: number;
}
export function controlTier(
    context: "driving" | "desktop" | "party-host",
    preference: ControlPreference,
): { tier: ControlTier; maxVisibleControls: number } {
    if (context === "driving") return { tier: "simple", maxVisibleControls: 2 };
    const depth = (1 - preference.preferredAutomation + preference.manualCorrectionDepth) / 2;
    return depth > 0.7
        ? { tier: "lab", maxVisibleControls: 12 }
        : depth > 0.35 || context === "party-host"
          ? { tier: "advanced", maxVisibleControls: 6 }
          : { tier: "simple", maxVisibleControls: 2 };
}

export type RecommendationMode = "for-you" | "for-this-moment" | "for-the-crowd" | "discover" | "best-mix";
export const RECOMMENDATION_MODE_WEIGHTS: Record<
    RecommendationMode,
    { personal: number; moment: number; crowd: number; novelty: number; mix: number }
> = {
    "for-you": { personal: 0.55, moment: 0.15, crowd: 0.05, novelty: 0.1, mix: 0.15 },
    "for-this-moment": { personal: 0.2, moment: 0.45, crowd: 0.1, novelty: 0.05, mix: 0.2 },
    "for-the-crowd": { personal: 0.1, moment: 0.2, crowd: 0.5, novelty: 0.05, mix: 0.15 },
    discover: { personal: 0.2, moment: 0.15, crowd: 0.05, novelty: 0.45, mix: 0.15 },
    "best-mix": { personal: 0.15, moment: 0.2, crowd: 0.05, novelty: 0.05, mix: 0.55 },
};
export function usefulExplanation(
    reasons: readonly string[],
    user: "normal" | "power",
    asked: boolean,
    frequency: number,
): { show: boolean; text: string } {
    const show = asked || frequency >= 0.7;
    return {
        show,
        text: !show
            ? ""
            : user === "normal"
              ? `Fits the current vibe${reasons.includes("smooth-mix") ? " and mixes smoothly" : ""}.`
              : `Decision reasons: ${reasons.join(", ")}.`,
    };
}

export const LLM_BOUNDARY = {
    input: "natural-language",
    output: "structured-session-contract",
    validationRequired: true,
    deterministicDownstream: ["recommendation", "journey", "transition", "dsp"],
    llmAudioEngine: false,
} as const;
