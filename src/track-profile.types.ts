/** A region in the source track's timeline, in seconds. */
export interface TimeRegion {
    start: number;
    end: number;
}

/** Narrow local mirror that keeps TrackProfile independent from source providers. */
export interface TrackInfo {
    id: string;
    title: string;
    durationMs: number;
    bpm?: number | null;
    uploader?: string | null;
    album?: string | null;
    albumId?: string | null;
    discNumber?: number | null;
    trackNumber?: number | null;
    continuityGroup?: string | null;
    gapless?: boolean;
    originalGapSec?: number | null;
    conceptAlbum?: boolean;
    recordingId?: string | null;
    isrc?: string | null;
    fingerprint?: string | null;
    version?: import("./track-identity").TrackVersion | null;
    userSelectedVersion?: boolean;
}
