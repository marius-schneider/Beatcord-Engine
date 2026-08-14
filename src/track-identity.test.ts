import { describe, expect, test } from "bun:test";

import { assessAlbumIntegrity } from "./album-integrity";
import { identifyTrack, sameRecording, versionPreferenceAdjustment } from "./track-identity";

describe("track identity and album integrity", () => {
    test("recognizes versions while recording identity survives metadata differences", () => {
        const remix = identifyTrack({ title: "Song (Extended Remix)", isrc: "deabc1234567" });
        const cleanMetadata = identifyTrack({ title: "Completely Different Title", isrc: "DEABC1234567" });
        expect(remix.version).toBe("extended");
        expect(sameRecording(remix, cleanMetadata)).toBe(true);
    });

    test("club style softly prefers extended versions but never overrides explicit selection", () => {
        const extended = identifyTrack({ title: "Song (Extended Mix)" });
        expect(versionPreferenceAdjustment(extended, { performanceStyle: "club" })).toBeGreaterThan(0);
        expect(
            versionPreferenceAdjustment({ ...extended, userSelectedVersion: true }, { performanceStyle: "club" }),
        ).toBe(0);
    });

    test("disables crossfade only for evidenced continuous album neighbors", () => {
        const current = {
            identity: identifyTrack({ title: "Movement I" }),
            albumContext: { albumId: "album", albumTitle: "Suite", trackNumber: 1, gapless: true },
        };
        const next = {
            identity: identifyTrack({ title: "Movement II" }),
            albumContext: { albumId: "album", albumTitle: "Suite", trackNumber: 2, gapless: true },
        };
        const policy = assessAlbumIntegrity(current, next);
        expect(policy.preserveAlbumSequence).toBe(true);
        expect(policy.disableCrossfade).toBe(true);
        expect(
            assessAlbumIntegrity(current, { ...next, albumContext: { ...next.albumContext, trackNumber: 4 } })
                .disableCrossfade,
        ).toBe(false);
    });
});
