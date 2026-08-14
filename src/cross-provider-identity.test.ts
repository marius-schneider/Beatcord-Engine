import { describe, expect, test } from "bun:test";
import {
    type CanonicalRecording,
    CROSSPLAY_IDENTITY_PRINCIPLE,
    canonicalQueue,
    migrateProviderQueue,
    resolvePlaybackSource,
    versionMatch,
} from "./cross-provider-identity";

const recording: CanonicalRecording = {
    recordingId: "rec",
    metadata: { title: "Song", primaryArtist: "Artist", version: "studio", durationSec: 200, isrc: "ISRC1" },
    fingerprints: [{ algorithm: "chromaprint", value: "abc", confidence: 0.95 }],
    providers: [
        {
            provider: "a",
            trackId: "1",
            isrc: "ISRC1",
            availableMarkets: ["DE"],
            lossless: false,
            explicit: false,
            version: "studio",
            durationSec: 200,
        },
        {
            provider: "b",
            trackId: "2",
            isrc: "ISRC1",
            availableMarkets: ["DE"],
            lossless: true,
            explicit: false,
            version: "studio",
            durationSec: 200,
        },
    ],
};
describe("cross-provider identity", () => {
    test("treats multiple provider IDs as one canonical recording", () => {
        expect(recording.providers).toHaveLength(2);
        expect(CROSSPLAY_IDENTITY_PRINCIPLE.providerUrlNotIdentity).toBe(true);
    });
    test("matches versions through ISRC, fingerprint, duration and version metadata", () => {
        expect(
            versionMatch(recording, recording.providers[0]!, {
                algorithm: "chromaprint",
                value: "abc",
                confidence: 0.9,
            }),
        ).toMatchObject({ match: true, score: 1, studioLiveSwapPrevented: false });
    });
    test("prevents studio-to-live swaps even with matching ISRC/duration", () => {
        expect(versionMatch(recording, { ...recording.providers[0]!, version: "live" })).toMatchObject({
            match: false,
            studioLiveSwapPrevented: true,
        });
    });
    test("resolves best source by entitlement, device, market and rights", () => {
        const result = resolvePlaybackSource(
            recording,
            { providers: ["a", "b"], market: "DE", lossless: true, explicitAllowed: true },
            { deviceId: "mac", lossless: true, providers: ["a", "b"] },
            { allowedProviders: ["a", "b"], recordingAllowed: true },
        );
        expect(result.source?.provider).toBe("b");
        expect(result.providerIsNotRecording).toBe(true);
    });
    test("rejects unavailable or rights-denied sources", () => {
        expect(
            resolvePlaybackSource(
                recording,
                { providers: ["a"], market: "US", lossless: false, explicitAllowed: true },
                { deviceId: "x", lossless: false, providers: ["a"] },
                { allowedProviders: ["a"], recordingAllowed: true },
            ).source,
        ).toBeNull();
        expect(
            resolvePlaybackSource(
                recording,
                { providers: ["a"], market: "DE", lossless: false, explicitAllowed: true },
                { deviceId: "x", lossless: false, providers: ["a"] },
                { allowedProviders: ["a"], recordingAllowed: false },
            ).reason,
        ).toBe("recording-rights-denied");
    });
    test("stores canonical recording IDs in cross-provider queues", () => {
        expect(canonicalQueue([recording])).toEqual([{ recordingId: "rec", fallbackRecordingIds: [] }]);
        expect(CROSSPLAY_IDENTITY_PRINCIPLE.sourceResolvedAtPlayback).toBe(true);
    });
    test("migrates provider queues only when canonical version identity resolves", () => {
        const result = migrateProviderQueue(
            [recording.providers[0]!, { ...recording.providers[0]!, trackId: "live", version: "live" }],
            [recording],
        );
        expect(result.queue).toEqual([{ recordingId: "rec", fallbackRecordingIds: [] }]);
        expect(result.unresolved).toEqual(["a:live"]);
    });
});
