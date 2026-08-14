#!/usr/bin/env python3
"""Bridge between the Beatcord engine (TypeScript) and TIDAL via the `tiddl`
library. The engine spawns this with a subcommand and reads JSON from stdout,
exactly like it spawns yt-dlp. All heavy lifting (auth, the TIDAL API, FLAC
download + decryption) is tiddl's; this only shapes the results into the
engine's TrackInfo contract.

Subcommands (argv):
  search "<query>" [limit]        -> {"tracks": [TrackInfo, ...]}
  track  <id>                     -> {"track": TrackInfo}
  radio  <id> [limit]             -> {"tracks": [TrackInfo, ...]}  (the track's TIDAL mix)
  download <id> <out_path> [q]    -> {"path": "...", "ext": ".flac", "quality": "..."}
  lyrics <id>                     -> {"synced": [{"timeMs":int,"text":str}], "plain": str|None}
  home                            -> {"sections": [{"title","kind","tracks","albums","playlists","mixes"}]}
  mix    <id>                      -> {"mix": {...}, "tracks": [TrackInfo, ...]}
  explore                         -> {"groups": [{"title","categories":[{"title","path","icon"}]}]}
  page   <pages/...>              -> {"title": str, "sections": [...]}
  credits <id>                    -> {"credits": [{"role": str, "names": [str]}]}
  favorites [kind] [limit]        -> {"kind","total","items":[...]}  (the user's collection;
                                     kind = tracks|albums|artists|playlists, default tracks)
  streamurl <id> [q]              -> {"url","bootstrappable","expiresAt",...}  (playable URL
                                     for starting audio before the download finishes)

Auth comes from `~/.tiddl/auth.json` (run `tiddl auth login` first). Errors are
printed as {"error": "..."} to stdout with exit code 1, so the caller can fall
back to yt-dlp cleanly.
"""

import json
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

DEFAULT_QUALITY = "LOSSLESS"  # 16-bit/44.1kHz FLAC; "HI_RES_LOSSLESS" for up to 24/192


class HelperError(Exception):
    """A clean, caller-facing failure — reported as {"error": ...} without a
    traceback. Distinct from unexpected exceptions so the dispatch layer can
    format both, and (crucially) so a single bad command never kills a `serve`
    worker: it's caught per-command, not fatal."""


def _fail(msg: str, code: int = 1):
    print(json.dumps({"error": msg}))
    sys.exit(code)


_API = None  # memoized so a long-lived `serve` worker builds the client only once
_STREAM_APIS: dict[str, object] = {}  # per playback profile (see _stream_api)
_PROFILE_MGR = None

# One lock for every mutation of the shared client state above. The `serve` worker
# dispatches commands across a thread pool, so lazy init and token refresh must not
# interleave — a refresh rewrites session.headers underneath in-flight requests.
_STATE_LOCK = threading.RLock()

# api.tidal.com base — pulled from tiddl so it stays version-correct, hardcoded
# fallback for the (unlikely) case the constant moves.
try:
    from tiddl.core.api import TidalClient as _TC

    API_URL = _TC.fetch.__globals__.get("API_URL", "https://api.tidal.com/v1")
except Exception:
    API_URL = "https://api.tidal.com/v1"


def _refresh_token() -> str | None:
    """Exchange the stored refresh token for a fresh access token and persist it.
    TIDAL access tokens expire after a week; without this the whole integration
    silently falls back to yt-dlp once the token lapses. Returns the new token, or
    None if refresh is impossible (no refresh token / network) — callers then fail
    cleanly. Wired as the client's on_token_expiry hook AND used by the raw page
    fetch, so both the typed API and the page endpoints self-heal on a 401."""
    try:
        from tiddl.core.auth import AuthAPI
        from tiddl.cli.utils.auth import load_auth_data, save_auth_data
    except Exception:
        return None
    with _STATE_LOCK:
        try:
            auth = load_auth_data()
            if not auth.refresh_token:
                return None
            resp = AuthAPI().refresh_token(auth.refresh_token)
            auth.token = resp.access_token
            try:
                auth.expires_at = getattr(resp, "expires_in", None)
            except Exception:
                pass
            # A refresh may rotate the refresh token; persisting the new one keeps
            # the profile broker (and the next process) from using a dead one.
            new_refresh = getattr(resp, "refresh_token", None)
            if new_refresh and new_refresh != auth.refresh_token:
                auth.refresh_token = new_refresh
                if _PROFILE_MGR is not None:
                    _PROFILE_MGR.replace_refresh_token(new_refresh)
            save_auth_data(auth)
            return resp.access_token
        except Exception:
            return None


def _auth_data():
    """Load the stored login, or raise a caller-facing HelperError."""
    try:
        from tiddl.cli.utils.auth import load_auth_data
    except Exception as e:  # tiddl not installed
        raise HelperError(f"tiddl not importable: {e}")
    try:
        auth = load_auth_data()
    except Exception as e:
        raise HelperError(f"not logged in (run `tiddl auth login`): {e}")
    if not (auth.token and auth.country_code and auth.user_id):
        raise HelperError("not logged in (run `tiddl auth login`)")
    return auth


def _api():
    """Build (once) an authenticated TidalAPI, or raise HelperError."""
    global _API
    if _API is not None:
        return _API
    with _STATE_LOCK:
        if _API is not None:  # another thread won the race while we waited
            return _API
        try:
            from tiddl.core.api import TidalAPI, TidalClient
            from tiddl.cli.const import APP_PATH
        except Exception as e:  # tiddl not installed
            raise HelperError(f"tiddl not importable: {e}")

        auth = _auth_data()

        # on_token_expiry lets the typed API (get_search, get_album, …) recover from
        # an expired token mid-session instead of erroring out to the yt-dlp fallback.
        client = TidalClient(
            token=auth.token, cache_name=APP_PATH / "api_cache", on_token_expiry=_refresh_token
        )
        _API = TidalAPI(client, country_code=auth.country_code, user_id=auth.user_id)
        return _API


def _stream_api(quality: str):
    """A TidalAPI authenticated for the playback profile `quality` needs.

    TIDAL grants playback capabilities per *client id*, not per account: asking for
    HI_RES_LOSSLESS with the default client id silently hands back LOSSLESS even on
    a MAX subscription. The `hires` profile unlocks 24-bit, and its token is derived
    from the refresh token of the existing login — no second login involved.

    Metadata still goes through the plain `_api()` client; only stream requests need
    the profile, so the shared api_cache is never polluted with profile-specific
    responses."""
    global _PROFILE_MGR

    if quality != "HI_RES_LOSSLESS":
        return _api()

    with _STATE_LOCK:
        cached = _STREAM_APIS.get("hires")
        if cached is not None:
            return cached
        try:
            from tiddl.core.api import TidalAPI, TidalClient
            from tiddl.core.auth import ProfileTokenManager
            from tiddl.cli.const import APP_PATH
        except Exception as e:
            raise HelperError(f"tiddl too old for hi-res profiles: {e}")

        auth = _auth_data()
        if not auth.refresh_token:
            raise HelperError("no refresh token — re-run `tiddl auth login` for hi-res")

        if _PROFILE_MGR is None:
            _PROFILE_MGR = ProfileTokenManager(auth.refresh_token)
        token = _PROFILE_MGR.get_token("hires")

        client = TidalClient(
            token=token.access_token,
            cache_name=APP_PATH / "api_cache_hires",
            client_id=token.client_id,
            on_token_expiry=lambda: _PROFILE_MGR.get_token("hires", force=True).access_token,
        )
        api = TidalAPI(client, country_code=auth.country_code, user_id=auth.user_id)
        _STREAM_APIS["hires"] = api
        return api


PAGE_TTL = int(os.environ.get("TIDAL_PAGE_TTL") or 300)  # seconds
PAGE_RETRIES = 3  # for 429/5xx on the raw page path — see _page

# How many commands the `serve` worker runs at once. Small on purpose — see _serve.
SERVE_WORKERS = max(1, int(os.environ.get("TIDAL_SERVE_WORKERS") or 4))


def _page(endpoint: str, expire_after: int | None = None, **extra) -> dict:
    """GET a TIDAL `pages/*` (or other) endpoint as raw JSON. tiddl's typed `fetch`
    needs a Pydantic model per response and its page models are incomplete, so we
    talk to the CDN session directly here and shape the modules ourselves. Mirrors
    fetch's 401→refresh→retry so page fetches self-heal on token expiry too.

    `expire_after` is passed explicitly because the session is a requests_cache
    CachedSession whose default is NEVER_EXPIRE: without it, Home/Explore froze at
    whatever TIDAL served the very first time and never refreshed again."""
    api = _api()
    client = api.client
    params = {
        "countryCode": api.country_code,
        "deviceType": "BROWSER",
        # TIDAL übersetzt Gruppen-/Kategorienamen anhand der Locale; der Engine
        # reicht sie über die Umgebung durch (TIDAL_LOCALE).
        "locale": os.environ.get("TIDAL_LOCALE") or "en_US",
        **extra,
    }
    ttl = PAGE_TTL if expire_after is None else expire_after
    url = f"{API_URL}/{endpoint}"
    res = client.session.get(url, params=params, expire_after=ttl)
    if res.status_code == 401:
        token = _refresh_token()
        if token:
            client.token = token
            client.session.headers["Authorization"] = f"Bearer {token}"
            res = client.session.get(url, params=params, expire_after=ttl)

    # This path deliberately bypasses the typed `fetch`, so it also bypasses the
    # retry logic living there. TIDAL rate-limits bursts and occasionally 5xxs;
    # without this a single blip turns straight into an empty Home screen.
    for attempt in range(1, PAGE_RETRIES + 1):
        if res.status_code != 429 and res.status_code < 500:
            break
        retry_after = res.headers.get("Retry-After")
        try:
            delay = float(retry_after) if retry_after else 0.5 * 2 ** (attempt - 1)
        except ValueError:
            delay = 0.5 * 2 ** (attempt - 1)
        print(f"page {endpoint} got {res.status_code}, retry {attempt}/{PAGE_RETRIES} in {delay}s", file=sys.stderr)
        time.sleep(min(delay, 8.0))
        res = client.session.get(url, params=params, expire_after=ttl)

    if res.status_code != 200:
        raise HelperError(f"page {endpoint} failed ({res.status_code})")
    return res.json()


def _cover_url(cover: str | None, size: int = 640) -> str | None:
    """TIDAL cover UUID -> CDN image URL."""
    if not cover:
        return None
    path = cover.replace("-", "/")
    return f"https://resources.tidal.com/images/{path}/{size}x{size}.jpg"


def _g(obj, key, default=None):
    """Read `key` from either a pydantic model (attribute) or a plain dict. The
    typed API returns models; the `pages/*` endpoints return raw dicts. One
    accessor lets every mapper below shape both without duplication."""
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _artist_name(track) -> str | None:
    a = _g(track, "artist")
    if a and _g(a, "name"):
        return _g(a, "name")
    artists = _g(track, "artists") or []
    names = [_g(x, "name") for x in artists if _g(x, "name")]
    return ", ".join(names) if names else None


def _track_info(track) -> dict:
    """Shape a tiddl Track model (or a raw page-item dict) into the engine's
    TrackInfo contract."""
    version = _g(track, "version")
    title = (_g(track, "title") or "") + (f" ({version})" if version else "")
    album = _g(track, "album")
    tid = _g(track, "id")
    return {
        "id": str(tid),
        "source": "tidal",
        "title": title,
        "url": _g(track, "url", "") or f"https://tidal.com/track/{tid}",
        "durationMs": int(_g(track, "duration", 0) or 0) * 1000,
        "uploader": _artist_name(track),
        "thumbnail": _cover_url(_g(album, "cover") if album else None),
        "album": _g(album, "title") if album else None,
        "isLive": False,
        # Bonus signals TIDAL gives us for free (used opportunistically):
        "tidalBpm": _g(track, "bpm"),
        "isrc": _g(track, "isrc"),
        "explicit": bool(_g(track, "explicit", False)),
        "quality": _g(track, "audioQuality"),
        # ReplayGain ships with the metadata, so the engine gets a mastering-grade
        # gain target without an analysis pass. `peak` is normalised sample peak
        # (0..1), i.e. headroom = 1 - peak. Page items omit both, hence the _g.
        "replayGain": _g(track, "replayGain"),
        "peak": _g(track, "peak"),
    }


def cmd_search(query: str, limit: int):
    api = _api()
    res = api.get_search(query)
    items = getattr(res.tracks, "items", []) or []
    # Filter before slicing so non-streamable tracks don't eat into the limit.
    tracks = [_track_info(t) for t in items if getattr(t, "allowStreaming", True)][:limit]
    return {"tracks": tracks}


def cmd_track(track_id: str):
    api = _api()
    return {"track": _track_info(api.get_track(track_id))}


def cmd_radio(track_id: str, limit: int):
    api = _api()
    track = api.get_track(track_id)
    mixes = getattr(track, "mixes", None) or {}
    mix_id = mixes.get("TRACK_MIX") if isinstance(mixes, dict) else None
    if not mix_id:
        return {"tracks": []}
    items = api.get_mix_items(mix_id)
    out = []
    for it in getattr(items, "items", []) or []:
        # mix items wrap the track in .item (typed union); take track-like items.
        t = getattr(it, "item", it)
        if getattr(t, "duration", None) is not None and getattr(t, "title", None):
            out.append(_track_info(t))
        if len(out) >= limit:
            break
    return {"tracks": out}


def _url_expiry(url: str) -> int | None:
    """TIDAL signs segment URLs with a `token=<unix-ts>~<sig>` query parameter. The
    prefix is when the signature dies (observed: exactly 60 minutes out). Surfaced so
    the caller can refuse to bootstrap from a URL that would expire mid-track instead
    of discovering it as a stall."""
    try:
        from urllib.parse import parse_qs, urlparse

        token = parse_qs(urlparse(url).query).get("token", [""])[0]
        head = token.split("~", 1)[0]
        return int(head) if head.isdigit() else None
    except Exception:
        return None


def cmd_streamurl(track_id: str, quality: str):
    """A directly-playable URL for a track, for starting audio before the download
    finishes. ffmpeg can decode this URL as-is and the CDN honours HTTP ranges, so a
    player can also seek and restart on it.

    Only a single-resource (BTS) manifest qualifies. A DASH manifest is dozens of
    segments that additionally need a full-file ffmpeg remux, so it reports
    bootstrappable=false and the caller keeps waiting for the download — better a
    known wait than a stream that dies at the first segment boundary."""
    from tiddl.core.utils.parse import parse_track_stream

    api = _stream_api(quality)
    stream = api.get_track_stream(track_id, quality)
    # parse_track_stream only resolves the manifest — unlike get_track_stream_data it
    # fetches no audio, which is the whole point of this command.
    urls, ext = parse_track_stream(stream)
    single = len(urls) == 1
    return {
        "url": urls[0] if single else None,
        "bootstrappable": single,
        "reason": None if single else f"{len(urls)}-segment {stream.manifestMimeType} needs a remux",
        "expiresAt": _url_expiry(urls[0]) if single else None,
        "quality": stream.audioQuality,
        "ext": ext,
        "bitDepth": getattr(stream, "bitDepth", None),
        "sampleRate": getattr(stream, "sampleRate", None),
        "replayGain": getattr(stream, "trackReplayGain", None),
        "peak": getattr(stream, "trackPeakAmplitude", None),
    }


def cmd_download(track_id: str, out_path: str, quality: str):
    from tiddl.core.utils import get_track_stream_data

    api = _stream_api(quality)
    stream = api.get_track_stream(track_id, quality)
    data, ext = get_track_stream_data(stream)
    dest = Path(out_path)
    if dest.suffix != ext:
        dest = dest.with_suffix(ext)
    dest.parent.mkdir(parents=True, exist_ok=True)
    # Write to a sibling temp file, then atomically rename onto the final path, so an
    # interrupted download (e.g. the caller's kill-on-timeout) never leaves a
    # truncated file that the reuse check would later treat as a valid cache hit.
    tmp = dest.with_name(f".{dest.name}.part")
    tmp.write_bytes(data)
    os.replace(tmp, dest)

    # Hi-res arrives as FLAC inside an MP4/DASH container. Remux to raw .flac so the
    # rest of the engine keeps seeing one audio format; `-c copy`, so it is a
    # container swap, not a re-encode, and the samples are bit-identical.
    # extract_flac renames to .m4a instead when the payload turns out to be AAC.
    if ext == ".m4a":
        try:
            from tiddl.core.utils.ffmpeg import extract_flac, is_ffmpeg_installed

            if is_ffmpeg_installed():
                dest = extract_flac(dest)
                ext = dest.suffix
            else:
                # Not fatal: the caller's cache lookup accepts .m4a too.
                print(f"ffmpeg missing — leaving {dest.name} in its MP4 container", file=sys.stderr)
        except Exception as e:
            print(f"flac extraction failed ({type(e).__name__}: {e}) — keeping container", file=sys.stderr)

    return {
        "path": str(dest),
        "ext": ext,
        "quality": stream.audioQuality,
        "bitDepth": getattr(stream, "bitDepth", None),
        "sampleRate": getattr(stream, "sampleRate", None),
        # Stream-level ReplayGain is more precise than the track metadata's, and it
        # is the value that matches the exact master we just downloaded.
        "replayGain": getattr(stream, "trackReplayGain", None),
        "peak": getattr(stream, "trackPeakAmplitude", None),
    }


def _artist_info(a) -> dict:
    pic = _g(a, "picture")
    return {
        "id": str(_g(a, "id")),
        "name": _g(a, "name"),
        "picture": _cover_url(pic, 480) if pic else None,
        "popularity": _g(a, "popularity"),
    }


def _year(rd) -> int | None:
    """Release year from either a date/datetime (typed API) or an ISO string
    (page items give e.g. "2026-07-31")."""
    if not rd:
        return None
    try:
        return rd.year
    except Exception:
        pass
    try:
        return int(str(rd)[:4])
    except Exception:
        return None


def _album_info(al) -> dict:
    artist = _g(al, "artist")
    artists = _g(al, "artists") or []
    name = (
        _g(artist, "name")
        if artist and _g(artist, "name")
        else (_g(artists[0], "name") if artists and _g(artists[0], "name") else None)
    )
    return {
        "id": str(_g(al, "id")),
        "title": _g(al, "title"),
        "cover": _cover_url(_g(al, "cover")),
        "artist": name,
        "year": _year(_g(al, "releaseDate")),
        "trackCount": _g(al, "numberOfTracks"),
        "kind": (_g(al, "type") or "ALBUM").capitalize(),
    }


def _playlist_info(pl) -> dict:
    img = _g(pl, "squareImage") or _g(pl, "image")
    n = _g(pl, "numberOfTracks")
    return {
        "id": _g(pl, "uuid"),
        "title": _g(pl, "title"),
        "cover": _cover_url(img),
        "subtitle": _g(pl, "description") or (f"{n} Songs" if n else "Playlist"),
        "trackCount": n,
        "kind": "Playlist",
    }


def _mix_image(images) -> str | None:
    """A mix carries ready-made image URLs (not cover UUIDs), keyed by size."""
    if not isinstance(images, dict):
        return None
    for size in ("MEDIUM", "LARGE", "SMALL"):
        img = images.get(size)
        if isinstance(img, dict) and img.get("url"):
            return img["url"]
    return None


def _mix_info(mx) -> dict:
    """A TIDAL mix/radio station (Daily Discovery, Custom mixes, artist radio).
    Same card shape as a playlist, but resolved through get_mix_items — hence the
    distinct 'Mix' kind so the client routes playback to the mix endpoint."""
    return {
        "id": _g(mx, "id"),
        "title": _g(mx, "title"),
        "cover": _mix_image(_g(mx, "images")),
        "subtitle": _g(mx, "subTitle") or _g(mx, "shortSubtitle") or "Mix",
        "kind": "Mix",
    }


# ── home / discovery (TIDAL's own editorial + personalized pages) ──

# Which page module types we surface, and the result key each maps its items into.
# Mixes/videos/promotions are intentionally skipped — they need endpoints the rest
# of the app can't yet play (a mix isn't a playlist), so we stick to the three
# collection kinds the client already renders and can open.
_SECTION_KINDS = {
    "TRACK_LIST": ("tracks", _track_info),
    "ALBUM_LIST": ("albums", _album_info),
    "PLAYLIST_LIST": ("playlists", _playlist_info),
    "MIX_LIST": ("mixes", _mix_info),
}


def _section_from_module(module: dict, cap: int = 20) -> dict | None:
    """One page module -> a home section {title, kind, tracks|albums|playlists|mixes}.
    Returns None for module types we don't surface, or when it has no items."""
    mapping = _SECTION_KINDS.get(module.get("type"))
    if not mapping:
        return None
    key, mapper = mapping
    items = ((module.get("pagedList") or {}).get("items")) or []
    if key == "tracks":
        items = [it for it in items if _g(it, "allowStreaming", True)]
    mapped = [mapper(it) for it in items[:cap]]
    if not mapped:
        return None
    return {
        "title": module.get("title") or "",
        "kind": key,
        "tracks": mapped if key == "tracks" else [],
        "albums": mapped if key == "albums" else [],
        "playlists": mapped if key == "playlists" else [],
        "mixes": mapped if key == "mixes" else [],
    }


def _sections_from_page(page: dict, only: set | None = None) -> list:
    """Flatten a `pages/*` response into ordered home sections. `only` optionally
    restricts to certain module types (e.g. just personalized album shelves)."""
    out = []
    for row in page.get("rows") or []:
        for module in row.get("modules") or []:
            if only and module.get("type") not in only:
                continue
            sec = _section_from_module(module)
            if sec:
                out.append(sec)
    return out


def cmd_home() -> dict:
    """The start page: TIDAL's editorial home (The Hits, New Tracks, New Albums,
    editor playlists) plus, appended, the personalized shelves from the For You
    page — your custom mixes, radio stations and "Because you listened…" albums.
    All lossless, all playable through the album/playlist/mix/track surfaces.

    The two pages are independent, so they are fetched concurrently: run in series
    home paid the sum of both round trips, and it is the slowest command the UI
    waits on."""
    with ThreadPoolExecutor(max_workers=2, thread_name_prefix="home") as pool:
        main = pool.submit(_page, "pages/home")
        personal = pool.submit(_page, "pages/for_you")

        sections = _sections_from_page(main.result())
        try:
            sections.extend(_sections_from_page(personal.result(), only={"ALBUM_LIST", "MIX_LIST"}))
        except Exception:
            pass  # personalized shelves are a bonus — never fail home over them
    return {"sections": sections}


def cmd_credits(track_id: str) -> dict:
    """A track's credits, grouped by role — Producer, Composer, Lyricist, Mixing
    Engineer, … — exactly the TIDAL "Credits" panel. The endpoint returns a bare
    JSON list of {type, contributors:[{name,id}]}."""
    data = _page(f"tracks/{track_id}/credits", limit=30)
    out = []
    for entry in data or []:
        role = entry.get("type") if isinstance(entry, dict) else None
        names = [
            c.get("name")
            for c in (entry.get("contributors") or [])
            if isinstance(c, dict) and c.get("name")
        ]
        if role and names:
            out.append({"role": role, "names": names})
    return {"credits": out}


def cmd_mix(mix_id: str) -> dict:
    """A mix / radio station's tracks (Daily Discovery, Custom mixes, artist
    radio). Resolved through get_mix_items — the endpoint a mix id needs, distinct
    from playlists and albums."""
    api = _api()
    items = api.get_mix_items(mix_id)
    tracks = []
    for it in getattr(items, "items", []) or []:
        t = getattr(it, "item", it)
        if _g(t, "title") and _g(t, "duration") is not None and _g(t, "allowStreaming", True):
            tracks.append(_track_info(t))
    return {"mix": {"id": mix_id}, "tracks": tracks}


#: Promo-Bilder liegen nicht quadratisch vor — 1100x800 ist die größte Variante,
#: die die CDN für diese imageIds ausliefert (640x640 & Co. antworten mit 403).
PROMO_IMAGE_SIZE = "1100x800"


def _promo_url(image_id: str | None) -> str | None:
    """Featured-promotion image UUID -> CDN URL (wide, not square)."""
    if not image_id:
        return None
    return f"https://resources.tidal.com/images/{image_id.replace('-', '/')}/{PROMO_IMAGE_SIZE}.jpg"


#: TIDAL's promo item types -> what the client can open with them. Dropped:
#: EXTURL (a campaign web page) and ARTIST — neither has a destination in the
#: app, and a card that does nothing when clicked is worse than no card.
_PROMO_KINDS = {
    "ALBUM": "album",
    "PLAYLIST": "playlist",
    "MIX": "mix",
    "CATEGORY_PAGES": "page",
}


def cmd_explore() -> dict:
    """The explore directory: the editorial "Featured" carousel plus TIDAL's
    browsable categories — Genres, Moods & Activities (incl. "For DJs"), Decades
    — each a link to a page fetchable with `page`. Grouped as TIDAL groups them;
    the group without a title is TIDAL's footer row (New/Top/Videos/…)."""
    page = _page("pages/explore")
    groups = []
    featured = []
    for row in page.get("rows") or []:
        for module in row.get("modules") or []:
            kind = module.get("type")
            # Je nach Modultyp hängen die Einträge woanders: Link-Wolken unter
            # `pagedList.items` bzw. `links`, die Promos unter `items`.
            items = (
                ((module.get("pagedList") or {}).get("items"))
                or module.get("links")
                or module.get("items")
                or []
            )

            if kind == "FEATURED_PROMOTIONS":
                for item in items:
                    target = _PROMO_KINDS.get(item.get("type"))
                    if not target or not item.get("artifactId"):
                        continue
                    featured.append({
                        "header": item.get("header") or "",
                        "title": item.get("shortHeader") or "",
                        "subtitle": (item.get("shortSubHeader") or "").strip(),
                        "image": _promo_url(item.get("imageId")),
                        "kind": target,
                        "id": str(item.get("artifactId")),
                    })
                continue

            if kind not in ("PAGE_LINKS_CLOUD", "PAGE_LINKS"):
                continue
            cats = [
                {"title": link.get("title"), "path": link.get("apiPath"), "icon": link.get("icon")}
                for link in items
                if link.get("apiPath")
            ]
            if cats:
                groups.append({"title": module.get("title") or "", "categories": cats})
    return {"groups": groups, "featured": featured}


def cmd_page(api_path: str) -> dict:
    """Any TIDAL `pages/*` endpoint (a genre/mood/decade page) shaped into home
    sections. Restricted to the `pages/` namespace so a category path can't be
    turned into an arbitrary API call."""
    if not api_path.startswith("pages/") or ".." in api_path:
        raise HelperError(f"unsupported page path: {api_path}")
    page = _page(api_path)
    return {"title": page.get("title") or "", "sections": _sections_from_page(page)}


def _top_hit(th) -> dict | None:
    if not th:
        return None
    value, kind = getattr(th, "value", None), getattr(th, "type", None)
    if value is None:
        return None
    if kind == "ARTISTS":
        return {"kind": "artist", "artist": _artist_info(value)}
    if kind == "ALBUMS":
        return {"kind": "album", "album": _album_info(value)}
    if kind == "PLAYLISTS":
        return {"kind": "playlist", "playlist": _playlist_info(value)}
    if kind == "TRACKS":
        return {"kind": "track", "track": _track_info(value)}
    return None


def cmd_richsearch(query: str, limit: int):
    api = _api()
    res = api.get_search(query)
    tracks = [
        _track_info(t)
        for t in (getattr(res.tracks, "items", []) or [])
        if getattr(t, "allowStreaming", True)
    ][:limit]
    artists = [_artist_info(a) for a in (getattr(res.artists, "items", []) or [])[:12]]
    albums = [_album_info(al) for al in (getattr(res.albums, "items", []) or [])[:20]]
    playlists = [_playlist_info(p) for p in (getattr(res.playlists, "items", []) or [])[:20]]
    return {
        "topHit": _top_hit(getattr(res, "topHit", None)),
        "tracks": tracks,
        "artists": artists,
        "albums": albums,
        "playlists": playlists,
    }


def cmd_album(album_id: str):
    api = _api()
    album = api.get_album(album_id)
    items = api.get_album_items(album_id)
    tracks = []
    for it in getattr(items, "items", []) or []:
        t = getattr(it, "item", it)
        if getattr(t, "title", None) and getattr(t, "duration", None) is not None:
            tracks.append(_track_info(t))
    return {"album": _album_info(album), "tracks": tracks}


def cmd_artist(artist_id: str):
    api = _api()
    artist = api.get_artist(artist_id)
    albums = api.get_artist_albums(artist_id)
    alist = [_album_info(al) for al in (getattr(albums, "items", []) or [])[:24]]
    return {"artist": _artist_info(artist), "albums": alist}


FAVORITE_KINDS = ("tracks", "albums", "artists", "playlists")


def cmd_favorites(kind: str, limit: int):
    """The user's own TIDAL collection, newest first.

    tiddl's `get_favorites` hits `favorites/ids`, which returns bare id lists — one
    extra round trip per item to render anything. The `favorites/<kind>` endpoints
    return the full objects in one call, so we go there directly. Items arrive
    wrapped as {"created", "item"}; `created` is the date the user added it, which
    is the ordering the app wants."""
    kind = (kind or "tracks").lower()
    if kind not in FAVORITE_KINDS:
        raise HelperError(f"unknown favorites kind '{kind}' (expected {'/'.join(FAVORITE_KINDS)})")

    api = _api()
    data = _page(
        f"users/{api.user_id}/favorites/{kind}",
        expire_after=0,  # the user's own collection must never come from cache
        limit=max(1, min(limit, 100)),
        order="DATE",
        orderDirection="DESC",
    )

    mapper = {
        "tracks": _track_info,
        "albums": _album_info,
        "artists": _artist_info,
        "playlists": _playlist_info,
    }[kind]

    out = []
    for entry in data.get("items") or []:
        item = entry.get("item") if isinstance(entry, dict) else None
        if item is None:
            item = entry
        try:
            shaped = mapper(item)
        except Exception:
            continue  # one malformed entry must not lose the whole collection
        shaped["addedAt"] = (entry or {}).get("created") if isinstance(entry, dict) else None
        out.append(shaped)

    return {"kind": kind, "total": data.get("totalNumberOfItems"), "items": out}


def cmd_playlist(playlist_id: str):
    api = _api()
    pl = api.get_playlist(playlist_id)
    items = api.get_playlist_items(playlist_id)
    tracks = []
    for it in getattr(items, "items", []) or []:
        t = getattr(it, "item", it)
        if getattr(t, "title", None) and getattr(t, "duration", None) is not None:
            tracks.append(_track_info(t))
    return {"playlist": _playlist_info(pl), "tracks": tracks}


def cmd_lyrics(track_id: str):
    api = _api()
    try:
        ly = api.get_track_lyrics(track_id)
    except Exception:
        return {"synced": [], "plain": None}
    synced = []
    subtitles = getattr(ly, "subtitles", None)  # LRC-format synced lyrics
    if subtitles:
        import re

        for line in subtitles.splitlines():
            m = re.match(r"\[(\d+):(\d+(?:\.\d+)?)\](.*)", line)
            if m:
                mm, ss, text = int(m.group(1)), float(m.group(2)), m.group(3).strip()
                synced.append({"timeMs": int((mm * 60 + ss) * 1000), "text": text})
    return {"synced": synced, "plain": getattr(ly, "lyrics", None)}


def _dispatch(cmd: str, args: list) -> dict:
    """Route one command to its handler and return the result dict. `args` excludes
    the command itself. Shared by the argv one-shot path and the `serve` loop, so
    both speak exactly the same commands. Raises HelperError / IndexError on bad
    input; the callers format those."""
    if cmd == "ping":
        # Health check — needs no auth, so callers can verify the worker is alive
        # (and tests can exercise the transport without a TIDAL login). The optional
        # delay lets a test observe whether the serve loop actually overlaps
        # commands; without it every ping is instant and concurrency is unfalsifiable.
        if args:
            import time

            time.sleep(min(float(args[0]), 5.0))
        return {"pong": True}
    if cmd == "search":
        return cmd_search(args[0], int(args[1]) if len(args) > 1 else 20)
    if cmd == "richsearch":
        return cmd_richsearch(args[0], int(args[1]) if len(args) > 1 else 25)
    if cmd == "album":
        return cmd_album(args[0])
    if cmd == "artist":
        return cmd_artist(args[0])
    if cmd == "playlist":
        return cmd_playlist(args[0])
    if cmd == "track":
        return cmd_track(args[0])
    if cmd == "radio":
        return cmd_radio(args[0], int(args[1]) if len(args) > 1 else 20)
    if cmd == "download":
        return cmd_download(args[0], args[1], args[2] if len(args) > 2 else DEFAULT_QUALITY)
    if cmd == "lyrics":
        return cmd_lyrics(args[0])
    if cmd == "home":
        return cmd_home()
    if cmd == "mix":
        return cmd_mix(args[0])
    if cmd == "explore":
        return cmd_explore()
    if cmd == "page":
        return cmd_page(args[0])
    if cmd == "credits":
        return cmd_credits(args[0])
    if cmd == "favorites":
        return cmd_favorites(args[0] if args else "tracks", int(args[1]) if len(args) > 1 else 50)
    if cmd == "streamurl":
        return cmd_streamurl(args[0], args[1] if len(args) > 1 else DEFAULT_QUALITY)
    raise HelperError(f"unknown command: {cmd}")


def _serve():
    """Long-lived mode: read one JSON request per line from stdin
    ({"id", "cmd", "args"}) and write one JSON response per line to stdout
    ({"id", "result"} or {"id", "error"}). The TidalAPI session stays warm across
    requests, so callers skip the process/import cold-start each command.

    Framing is hardened: the real stdout is reserved for responses only, and
    sys.stdout is pointed at stderr so any stray print from tiddl or its deps can't
    corrupt the response stream. A failing command is reported and the loop
    continues — it never takes the worker down.

    Commands run on a small thread pool rather than inline. The caller correlates
    responses by id and pipelines requests, so serving them one at a time made a
    slow command block every fast one queued behind it (a ~600ms `home` ahead of a
    ~175ms `track` delayed it fourfold). Responses may now complete out of order,
    which the id framing already handles. The pool is deliberately small: TIDAL
    rate-limits bursts, and these calls are network-bound, not CPU-bound."""
    real_out = sys.stdout
    sys.stdout = sys.stderr

    emit_lock = threading.Lock()
    gone = threading.Event()

    def emit(obj: dict):
        with emit_lock:
            if gone.is_set():
                return
            try:
                real_out.write(json.dumps(obj) + "\n")
                real_out.flush()
            except (BrokenPipeError, ValueError):
                # The consumer (engine) went away — stop serving quietly.
                gone.set()

    def handle(rid, cmd, args):
        try:
            emit({"id": rid, "result": _dispatch(cmd, args)})
        except IndexError:
            emit({"id": rid, "error": "missing argument"})
        except HelperError as e:
            emit({"id": rid, "error": str(e)})
        except Exception as e:
            emit({"id": rid, "error": f"{type(e).__name__}: {e}"})

    with ThreadPoolExecutor(max_workers=SERVE_WORKERS, thread_name_prefix="tidal") as pool:
        for line in sys.stdin:
            if gone.is_set():
                break
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
            except Exception:
                continue  # non-JSON noise on the request channel — ignore the line
            rid = msg.get("id")
            pool.submit(handle, rid, msg.get("cmd"), msg.get("args") or [])
        # Leaving the `with` drains in-flight commands, so a shutdown mid-request
        # still answers it instead of dropping the caller's promise on the floor.


def main():
    args = sys.argv[1:]
    if not args:
        _fail("usage: tidal_helper.py <serve|search|track|radio|download|lyrics|...> ...")
    cmd = args[0]
    if cmd == "serve":
        _serve()
        return
    try:
        result = _dispatch(cmd, args[1:])
    except IndexError:
        _fail(f"missing argument for `{cmd}`")
    except HelperError as e:
        _fail(str(e))
    except SystemExit:
        raise
    except Exception as e:
        _fail(f"{type(e).__name__}: {e}")
    else:
        print(json.dumps(result))


if __name__ == "__main__":
    main()
