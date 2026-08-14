export interface ProviderTrackRef {
    provider: string;
    trackId: string;
    url?: string;
    isrc?: string;
    availableMarkets: string[];
    lossless: boolean;
    explicit: boolean;
    version: string;
    durationSec: number;
}
export interface AudioFingerprint {
    algorithm: string;
    value: string;
    confidence: number;
}
export interface CanonicalMetadata {
    title: string;
    primaryArtist: string;
    version: string;
    durationSec: number;
    isrc?: string;
}
export interface CanonicalRecording {
    recordingId: string;
    providers: ProviderTrackRef[];
    fingerprints: AudioFingerprint[];
    metadata: CanonicalMetadata;
}
export interface PlaybackEntitlements {
    providers: string[];
    market: string;
    lossless: boolean;
    explicitAllowed: boolean;
}
export interface PlaybackDevice {
    deviceId: string;
    lossless: boolean;
    providers: string[];
}
export interface PlaybackRights {
    allowedProviders: string[];
    recordingAllowed: boolean;
}

export function versionMatch(
    recording: CanonicalRecording,
    ref: ProviderTrackRef,
    fingerprint?: AudioFingerprint,
): { match: boolean; score: number; studioLiveSwapPrevented: boolean; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;
    if (recording.metadata.isrc && ref.isrc === recording.metadata.isrc) {
        score += 0.4;
        reasons.push("isrc");
    }
    if (
        fingerprint &&
        recording.fingerprints.some(
            (item) =>
                item.algorithm === fingerprint.algorithm &&
                item.value === fingerprint.value &&
                fingerprint.confidence >= 0.8,
        )
    ) {
        score += 0.35;
        reasons.push("fingerprint");
    }
    if (Math.abs(recording.metadata.durationSec - ref.durationSec) <= 2) {
        score += 0.15;
        reasons.push("duration");
    }
    if (recording.metadata.version.toLowerCase() === ref.version.toLowerCase()) {
        score += 0.1;
        reasons.push("version");
    }
    const versionSafe = recording.metadata.version.toLowerCase() === ref.version.toLowerCase();
    return { match: score >= 0.65 && versionSafe, score, studioLiveSwapPrevented: !versionSafe, reasons };
}

export function resolvePlaybackSource(
    recording: CanonicalRecording,
    entitlement: PlaybackEntitlements,
    device: PlaybackDevice,
    rights: PlaybackRights,
): { source: ProviderTrackRef | null; canonicalRecordingId: string; providerIsNotRecording: true; reason: string } {
    if (!rights.recordingAllowed)
        return {
            source: null,
            canonicalRecordingId: recording.recordingId,
            providerIsNotRecording: true,
            reason: "recording-rights-denied",
        };
    const allowed = recording.providers.filter(
        (ref) =>
            entitlement.providers.includes(ref.provider) &&
            device.providers.includes(ref.provider) &&
            rights.allowedProviders.includes(ref.provider) &&
            ref.availableMarkets.includes(entitlement.market) &&
            (entitlement.explicitAllowed || !ref.explicit) &&
            versionMatch(recording, ref).match,
    );
    const source =
        [...allowed].sort(
            (a, b) =>
                Number(entitlement.lossless && device.lossless && b.lossless) -
                Number(entitlement.lossless && device.lossless && a.lossless),
        )[0] ?? null;
    return {
        source,
        canonicalRecordingId: recording.recordingId,
        providerIsNotRecording: true,
        reason: source ? "entitlement-device-rights-version-resolved" : "no-compatible-source",
    };
}

export interface CanonicalQueueItem {
    recordingId: string;
    requestedBy?: string;
    fallbackRecordingIds: string[];
}
export function canonicalQueue(recordings: readonly CanonicalRecording[]): CanonicalQueueItem[] {
    return recordings.map((recording) => ({ recordingId: recording.recordingId, fallbackRecordingIds: [] }));
}
export function migrateProviderQueue(
    refs: readonly ProviderTrackRef[],
    catalog: readonly CanonicalRecording[],
): { queue: CanonicalQueueItem[]; unresolved: string[] } {
    const queue: CanonicalQueueItem[] = [];
    const unresolved: string[] = [];
    for (const ref of refs) {
        const recording = catalog.find((candidate) => versionMatch(candidate, ref).match);
        if (recording) queue.push({ recordingId: recording.recordingId, fallbackRecordingIds: [] });
        else unresolved.push(`${ref.provider}:${ref.trackId}`);
    }
    return { queue, unresolved };
}
export const CROSSPLAY_IDENTITY_PRINCIPLE = {
    queueStoresCanonicalRecording: true,
    sourceResolvedAtPlayback: true,
    providerUrlNotIdentity: true,
    supportedSources: ["provider-a", "provider-b", "local-library"],
} as const;
