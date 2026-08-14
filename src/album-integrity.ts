import type { TrackIdentity } from "./track-identity";

export interface AlbumTrackContext {
    albumId?: string;
    albumTitle: string;
    artist?: string;
    discNumber?: number;
    trackNumber?: number;
    continuityGroup?: string;
    gapless?: boolean;
    originalGapSec?: number;
    conceptAlbum?: boolean;
}

export interface ContinuityPolicy {
    preserveAlbumSequence: boolean;
    preserveOriginalGap: boolean;
    disableCrossfade: boolean;
    sameAlbum: boolean;
    consecutive: boolean;
    confidence: number;
    reason: string;
}

export function assessAlbumIntegrity(
    current: { albumContext?: AlbumTrackContext; identity?: TrackIdentity },
    next: { albumContext?: AlbumTrackContext; identity?: TrackIdentity },
): ContinuityPolicy {
    const a = current.albumContext;
    const b = next.albumContext;
    if (!a || !b) {
        return {
            preserveAlbumSequence: false,
            preserveOriginalGap: false,
            disableCrossfade: false,
            sameAlbum: false,
            consecutive: false,
            confidence: 0,
            reason: "album continuity metadata unavailable",
        };
    }
    const sameAlbum =
        a.albumId && b.albumId ? a.albumId === b.albumId : a.albumTitle === b.albumTitle && a.artist === b.artist;
    const sameDisc = (a.discNumber ?? 1) === (b.discNumber ?? 1);
    const consecutive = sameAlbum && sameDisc && a.trackNumber !== undefined && b.trackNumber === a.trackNumber + 1;
    const linkedGroup = Boolean(a.continuityGroup && a.continuityGroup === b.continuityGroup);
    const explicitContinuity = consecutive && (a.gapless === true || b.gapless === true || linkedGroup);
    const liveSequence = consecutive && current.identity?.version === "live" && next.identity?.version === "live";
    const preserve = Boolean(explicitContinuity || liveSequence || (consecutive && (a.conceptAlbum || b.conceptAlbum)));
    return {
        preserveAlbumSequence: preserve,
        preserveOriginalGap:
            preserve && (a.originalGapSec !== undefined || b.originalGapSec !== undefined || !explicitContinuity),
        disableCrossfade: Boolean(explicitContinuity || liveSequence),
        sameAlbum: Boolean(sameAlbum),
        consecutive: Boolean(consecutive),
        confidence: explicitContinuity ? 1 : preserve ? 0.78 : sameAlbum ? 0.45 : 0,
        reason: explicitContinuity
            ? "consecutive album tracks carry explicit gapless continuity"
            : liveSequence
              ? "consecutive live-album tracks preserve the recorded performance"
              : preserve
                ? "concept-album sequence should remain intact"
                : sameAlbum
                  ? "same album without evidence of a continuous boundary"
                  : "tracks belong to different albums",
    };
}
