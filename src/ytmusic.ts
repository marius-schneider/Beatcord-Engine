import { Buffer } from "node:buffer";
import { resolve } from "node:path";
import { config } from "./config";
import { createLogger } from "./logger";
import { Semaphore } from "./semaphore";

const log = createLogger("ytmusic");

export interface YtMusicSong {
    id: string;
    title: string;
    artists: string[];
    album: string | null;
    albumId: string | null;
    durationMs: number;
    thumbnail: string | null;
    playlistId: string | null;
    videoType: string | null;
}

export interface YtMusicPlaylist {
    id: string;
    title: string;
    uploader: string | null;
    count: number;
    url: string;
    thumbnail: string | null;
}

export interface YtMusicAlbum {
    id: string;
    title: string | null;
    artist: string | null;
    year: string | null;
    count: number;
    audioPlaylistId: string | null;
    thumbnail: string | null;
}

export interface YtMusicAlbumDetails extends YtMusicAlbum {
    tracks: YtMusicSong[];
}

export interface YtMusicWatchPlaylist {
    playlistId: string | null;
    tracks: YtMusicSong[];
}

type BridgeResponse<T> = { ok: true; data: T } | { ok: false; error: string };

const ytmusicSemaphore = new Semaphore(Math.max(1, Math.min(config.YTDLP_MAX_CONCURRENCY, 4)));
let pythonReady: Promise<string | null> | null = null;
let unavailableLogged = false;

const YTMUSIC_BRIDGE = String.raw`
import base64
import json
import re
import sys

def safe_int(value):
    if value is None:
        return 0
    if isinstance(value, bool):
        return 0
    if isinstance(value, (int, float)):
        return int(value)
    text = str(value).replace(",", "")
    match = re.search(r"\d+", text)
    return int(match.group(0)) if match else 0

def duration_text_ms(value):
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        return int(value) * 1000
    parts = [p for p in str(value).strip().split(":") if p != ""]
    if not parts:
        return 0
    total = 0
    for part in parts:
        if not part.isdigit():
            return 0
        total = total * 60 + int(part)
    return total * 1000

def best_thumb(item):
    thumbs = item.get("thumbnails") or item.get("thumbnail") or []
    if isinstance(thumbs, list) and thumbs:
        thumb = thumbs[-1]
        if isinstance(thumb, dict):
            return thumb.get("url")
    return None

def is_stat_label(value):
    text = str(value or "").lower().replace("\xa0", " ")
    if not re.search(r"\d", text):
        return False
    return bool(re.search(r"(views?|likes?|wiedergaben|reproducciones|visualiza|mio\.?|million|millions|billion|mrd\.?)", text))

def artist_names(item):
    names = []
    artists = item.get("artists")
    if isinstance(artists, list):
        for artist in artists:
            if isinstance(artist, dict) and artist.get("name"):
                name = str(artist.get("name"))
                if not is_stat_label(name):
                    names.append(name)
            elif isinstance(artist, str) and not is_stat_label(artist):
                names.append(artist)
    elif isinstance(artists, str) and not is_stat_label(artists):
        names.append(artists)
    if not names:
        for key in ("artist", "author", "uploader"):
            value = item.get(key)
            if isinstance(value, dict) and value.get("name"):
                names.append(str(value.get("name")))
                break
            if isinstance(value, str) and value:
                names.append(value)
                break
    return names

def album_info(item, fallback_album=None):
    album = item.get("album")
    if isinstance(album, dict):
        return album.get("name") or album.get("title") or fallback_album, album.get("id") or album.get("browseId")
    if isinstance(album, str):
        return album, None
    return fallback_album, None

def normalize_song(item, fallback_album=None):
    album_name, album_id = album_info(item, fallback_album)
    duration_ms = 0
    if item.get("duration_seconds") is not None:
        duration_ms = safe_int(item.get("duration_seconds")) * 1000
    elif item.get("durationMs") is not None:
        duration_ms = safe_int(item.get("durationMs"))
    elif item.get("lengthMs") is not None:
        duration_ms = safe_int(item.get("lengthMs"))
    elif item.get("duration") is not None:
        duration_ms = duration_text_ms(item.get("duration"))
    elif item.get("length") is not None:
        duration_ms = duration_text_ms(item.get("length"))
    return {
        "id": item.get("videoId") or item.get("id") or "",
        "title": item.get("title") or "",
        "artists": artist_names(item),
        "album": album_name,
        "albumId": album_id,
        "durationMs": duration_ms,
        "thumbnail": best_thumb(item),
        "playlistId": item.get("playlistId"),
        "videoType": item.get("videoType"),
    }

def playlist_id_from(item):
    pid = item.get("playlistId") or item.get("browseId") or item.get("id") or ""
    if pid.startswith("VL"):
        pid = pid[2:]
    return pid

def normalize_playlist(item):
    pid = playlist_id_from(item)
    return {
        "id": pid,
        "title": item.get("title") or "Playlist",
        "uploader": (artist_names(item) or [None])[0],
        "count": safe_int(item.get("itemCount") or item.get("count") or item.get("trackCount")),
        "url": "https://music.youtube.com/playlist?list=" + pid if pid else "",
        "thumbnail": best_thumb(item),
    }

def normalize_album(item):
    browse_id = item.get("browseId") or item.get("id") or ""
    artists = artist_names(item)
    return {
        "id": browse_id,
        "title": item.get("title"),
        "artist": artists[0] if artists else None,
        "year": str(item.get("year")) if item.get("year") else None,
        "count": safe_int(item.get("trackCount") or item.get("songCount") or item.get("itemCount")),
        "audioPlaylistId": item.get("audioPlaylistId") or item.get("playlistId"),
        "thumbnail": best_thumb(item),
    }

def normalize_album_details(album, browse_id=None):
    details = normalize_album(album)
    if browse_id:
        details["id"] = browse_id
    tracks = []
    for track in album.get("tracks") or []:
        normalized = normalize_song(track, details.get("title"))
        if normalized.get("id"):
            tracks.append(normalized)
    details["count"] = details.get("count") or len(tracks)
    details["tracks"] = tracks
    return details

def run(payload):
    from ytmusicapi import YTMusic

    ytmusic = YTMusic(language=payload.get("language") or "en", location=payload.get("location") or "")
    op = payload.get("operation")
    data = payload.get("input") or {}
    limit = int(data.get("limit") or 25)

    if op == "search_songs":
        return [
            song
            for song in (normalize_song(item) for item in ytmusic.search(data.get("query") or "", filter="songs", limit=limit))
            if song.get("id")
        ][:limit]

    if op == "search_albums":
        return [
            album
            for album in (normalize_album(item) for item in ytmusic.search(data.get("query") or "", filter="albums", limit=limit))
            if album.get("id")
        ][:limit]

    if op == "search_playlists":
        out = []
        seen = set()
        for filt in ("community_playlists", "featured_playlists"):
            for item in ytmusic.search(data.get("query") or "", filter=filt, limit=limit):
                playlist = normalize_playlist(item)
                if playlist.get("id") and playlist.get("id") not in seen:
                    seen.add(playlist.get("id"))
                    out.append(playlist)
                if len(out) >= limit:
                    return out
        return out

    if op == "get_album":
        browse_id = data.get("browseId") or ""
        return normalize_album_details(ytmusic.get_album(browse_id), browse_id)

    if op == "get_watch_playlist":
        kwargs = {
            "limit": limit,
            "radio": bool(data.get("radio")),
            "shuffle": bool(data.get("shuffle")),
        }
        if data.get("videoId"):
            kwargs["videoId"] = data.get("videoId")
        if data.get("playlistId"):
            kwargs["playlistId"] = data.get("playlistId")
        watch = ytmusic.get_watch_playlist(**kwargs)
        tracks = []
        for item in watch.get("tracks") or []:
            song = normalize_song(item)
            if song.get("id"):
                tracks.append(song)
        return {"playlistId": watch.get("playlistId"), "tracks": tracks}

    if op == "search_suggestions":
        return ytmusic.get_search_suggestions(data.get("query") or "", detailed_runs=False)

    raise ValueError("unknown operation: " + str(op))

try:
    payload = json.loads(base64.b64decode(sys.argv[1]).decode("utf-8"))
    print(json.dumps({"ok": True, "data": run(payload)}, ensure_ascii=False))
except Exception as exc:
    print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False))
`;

async function probePython(cmd: string): Promise<boolean> {
    try {
        const proc = Bun.spawn(
            [cmd, "-c", "import sys; assert sys.version_info >= (3, 10); import ytmusicapi; print('ok')"],
            {
                stdout: "pipe",
                stderr: "pipe",
            },
        );
        const [stdout, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
        return exitCode === 0 && stdout.trim() === "ok";
    } catch {
        return false;
    }
}

async function findYtMusicPython(): Promise<string | null> {
    if (!config.YTMUSICAPI_ENABLED) return null;

    const candidates = [
        config.YTMUSICAPI_PYTHON.trim(),
        process.env.PYTHON ?? "",
        resolve(process.cwd(), "vendor/ytmusicapi-venv/bin/python"),
        "/opt/homebrew/bin/python3",
        "python3.14",
        "python3.13",
        "python3.12",
        "python3.11",
        "python3.10",
        "python3",
    ].filter(Boolean);

    for (const cmd of candidates) {
        if (await probePython(cmd)) {
            log.info(`Using YouTube Music catalogue via ytmusicapi (${cmd}).`);
            return cmd;
        }
    }

    if (!unavailableLogged) {
        unavailableLogged = true;
        log.info("Optional ytmusicapi not found; falling back to yt-dlp-only YouTube Music scraping.");
    }
    return null;
}

async function callYtMusic<T>(operation: string, input: Record<string, unknown>): Promise<T | null> {
    const python = await (pythonReady ??= findYtMusicPython());
    if (!python) return null;

    return ytmusicSemaphore.run(async () => {
        const payload = Buffer.from(
            JSON.stringify({
                operation,
                input,
                language: config.YTMUSICAPI_LANG,
                location: config.YTMUSICAPI_LOCATION,
            }),
            "utf8",
        ).toString("base64");

        const proc = Bun.spawn([python, "-c", YTMUSIC_BRIDGE, payload], {
            stdout: "pipe",
            stderr: "pipe",
        });
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            proc.kill();
        }, config.YTMUSICAPI_TIMEOUT_MS);

        try {
            const [stdout, stderr, exitCode] = await Promise.all([
                new Response(proc.stdout).text(),
                new Response(proc.stderr).text(),
                proc.exited,
            ]);
            if (timedOut) {
                log.debug(`ytmusicapi ${operation} timed out after ${config.YTMUSICAPI_TIMEOUT_MS}ms.`);
                return null;
            }
            if (exitCode !== 0) {
                log.debug(`ytmusicapi ${operation} exited ${exitCode}: ${stderr.trim() || "unknown error"}`);
                return null;
            }
            const line = stdout.trim().split("\n").at(-1);
            if (!line) return null;
            const response = JSON.parse(line) as BridgeResponse<T>;
            if (!response.ok) {
                log.debug(`ytmusicapi ${operation} failed: ${response.error}`);
                return null;
            }
            return response.data;
        } catch (err) {
            log.debug(`ytmusicapi ${operation} failed: ${(err as Error).message}`);
            return null;
        } finally {
            clearTimeout(timer);
        }
    });
}

export function searchYtMusicSongs(query: string, limit: number): Promise<YtMusicSong[] | null> {
    return callYtMusic<YtMusicSong[]>("search_songs", { query, limit });
}

export function searchYtMusicAlbums(query: string, limit: number): Promise<YtMusicAlbum[] | null> {
    return callYtMusic<YtMusicAlbum[]>("search_albums", { query, limit });
}

export function searchYtMusicPlaylists(query: string, limit: number): Promise<YtMusicPlaylist[] | null> {
    return callYtMusic<YtMusicPlaylist[]>("search_playlists", { query, limit });
}

export function getYtMusicAlbum(browseId: string): Promise<YtMusicAlbumDetails | null> {
    return callYtMusic<YtMusicAlbumDetails>("get_album", { browseId });
}

export function getYtMusicWatchPlaylist(input: {
    videoId?: string;
    playlistId?: string;
    limit: number;
    radio?: boolean;
    shuffle?: boolean;
}): Promise<YtMusicWatchPlaylist | null> {
    return callYtMusic<YtMusicWatchPlaylist>("get_watch_playlist", input);
}

export function getYtMusicSearchSuggestions(query: string): Promise<string[] | null> {
    return callYtMusic<string[]>("search_suggestions", { query });
}
