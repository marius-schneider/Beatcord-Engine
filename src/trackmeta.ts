/**
 * Cleaning YouTube track metadata into a real {artist, title}. Raw YouTube video titles
 * are messy — "Cro - Traum (Lyrics)", "Artist - Song [Official Video]", "Song" by an
 * "Artist - Topic" channel — but the actual song name and performer can be teased out
 * reliably for most uploads.
 *
 * This is now used ONLY by the LRCLIB lyrics lookup, which needs the bare song name to
 * find a match. The display layer no longer cleans titles: tracks are resolved through the
 * YouTube Music API, which already provides clean fields, so the UI uses them verbatim.
 */

/** Junk parentheticals/brackets commonly tacked onto YouTube titles. */
const TITLE_JUNK =
    /\s*[([](?:[^)\]]*\b(?:official|lyric|lyrics|video|audio|visualizer|mv|hd|hq|4k|remaster(?:ed)?|explicit|clean|music\s*video|color\s*coded|sub|subtitulado|español|legendado|prod|prod\.?|directed)\b[^)\]]*)[)\]]/gi;

/** Channel-name suffixes that aren't part of the real artist name. */
const CHANNEL_JUNK = /\s*-\s*topic$|\s*VEVO$|\s*official$|\s*music$/i;

export interface CleanMeta {
    /** The real performer/creator, or null if it can't be determined. */
    artist: string | null;
    /** Just the song name, junk stripped. */
    title: string;
}

/**
 * Derive {artist, title} from a raw YouTube-style title + uploader/channel:
 *  - strip junk tags ("(Official Video)", "[Lyrics]", "(Audio)", a "feat." clause),
 *  - split "Artist - Title" on the first dash,
 *  - else use the uploader (minus "- Topic"/"VEVO") as the artist.
 */
export function cleanTrackMeta(rawTitle: string, uploader: string | null): CleanMeta {
    let t = (rawTitle ?? "")
        .replace(TITLE_JUNK, "")
        .replace(/\s*\bfeat\.?\b.*$|\s*\bft\.?\b.*$/i, "")
        .trim();
    let artist: string | null = null;

    // "Artist - Title" → split on the first dash variant.
    const dash = t.match(/^(.+?)\s+[-–—]\s+(.+)$/);
    if (dash) {
        artist = dash[1]!.trim();
        t = dash[2]!.trim();
    } else if (uploader) {
        artist = uploader.replace(CHANNEL_JUNK, "").trim() || null;
    }

    // Tidy leftovers: surrounding quotes, trailing separators, collapsed spaces.
    t = t
        .replace(/["']/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
    // Never return an empty title — fall back to the original if cleaning ate it all.
    if (!t) t = (rawTitle ?? "").trim();
    return { artist, title: t };
}
