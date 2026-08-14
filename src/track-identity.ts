export type TrackVersion = "original" | "radio-edit" | "extended" | "remix" | "live" | "acoustic" | "clean" | "unknown";

export interface TrackIdentity {
    recordingId?: string;
    isrc?: string;
    fingerprint?: string;
    version: TrackVersion;
    versionConfidence: number;
    userSelectedVersion: boolean;
    evidence: string[];
}

export interface VersionPreferenceContext {
    performanceStyle: "natural" | "dj" | "club";
    familySafe?: boolean;
    userQueued?: boolean;
}

const VERSION_PATTERNS: readonly [TrackVersion, RegExp][] = [
    ["radio-edit", /\b(radio edit|single edit)\b/i],
    ["extended", /\b(extended( mix| version)?|club mix)\b/i],
    ["acoustic", /\b(acoustic|unplugged)\b/i],
    ["live", /\b(live( at| from| version)?|concert)\b/i],
    ["clean", /\b(clean|radio clean|no explicit)\b/i],
    ["remix", /\b(remix|rework|bootleg|edit)\b/i],
    ["original", /\b(original( mix| version)?)\b/i],
];

export function identifyTrack(input: {
    title: string;
    recordingId?: string | null;
    isrc?: string | null;
    fingerprint?: string | null;
    version?: TrackVersion | null;
    userSelectedVersion?: boolean;
}): TrackIdentity {
    const detected =
        input.version ?? VERSION_PATTERNS.find(([, pattern]) => pattern.test(input.title))?.[0] ?? "unknown";
    const explicitVersion = input.version !== undefined && input.version !== null;
    const evidence = [
        ...(explicitVersion
            ? ["provider supplied version"]
            : detected !== "unknown"
              ? [`title indicates ${detected}`]
              : []),
        ...(input.recordingId ? ["recording id available"] : []),
        ...(input.isrc ? ["ISRC available"] : []),
        ...(input.fingerprint ? ["audio fingerprint available"] : []),
    ];
    return {
        ...(input.recordingId ? { recordingId: input.recordingId } : {}),
        ...(input.isrc ? { isrc: input.isrc.toUpperCase() } : {}),
        ...(input.fingerprint ? { fingerprint: input.fingerprint } : {}),
        version: detected,
        versionConfidence: explicitVersion ? 1 : detected === "unknown" ? 0.25 : 0.82,
        userSelectedVersion: input.userSelectedVersion ?? false,
        evidence: evidence.length ? evidence : ["metadata does not identify a specific version"],
    };
}

export function sameRecording(a: TrackIdentity, b: TrackIdentity): boolean {
    return Boolean(
        (a.recordingId && b.recordingId && a.recordingId === b.recordingId) ||
            (a.isrc && b.isrc && a.isrc === b.isrc) ||
            (a.fingerprint && b.fingerprint && a.fingerprint === b.fingerprint),
    );
}

/** Version preference is soft; an explicitly queued version always receives zero adjustment. */
export function versionPreferenceAdjustment(identity: TrackIdentity, context: VersionPreferenceContext): number {
    if (identity.userSelectedVersion || context.userQueued) return 0;
    if (context.familySafe) return identity.version === "clean" ? 4 : 0;
    if (context.performanceStyle === "club") {
        if (identity.version === "extended" || identity.version === "remix") return 3;
        if (identity.version === "radio-edit") return -1.5;
    }
    if (context.performanceStyle === "natural") {
        if (identity.version === "original" || identity.version === "unknown") return 2;
        if (identity.version === "extended") return -1;
    }
    return 0;
}
