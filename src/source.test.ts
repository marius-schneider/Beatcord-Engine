import { describe, expect, it } from "bun:test";

import {
    sourceAlbum,
    sourceArtist,
    sourceCredits,
    sourceExplore,
    sourceHome,
    sourceMix,
    sourcePage,
    sourcePlaylist,
    sourceSimilar,
    strictNote,
    tidalAlbumId,
    tidalEnabled,
    tidalPlaylistId,
    tidalStrict,
    tidalTrackId,
} from "./source";

// These run with TIDAL off (the default), which is exactly the case the router's
// guards exist for: every catalog call must degrade to an empty result instead of
// throwing or spawning the python helper. No test here may reach the network.

describe("native TIDAL track links", () => {
    it("reads the id out of the forms TIDAL's share sheet produces", () => {
        expect(tidalTrackId("https://tidal.com/track/12345")).toBe("12345");
        expect(tidalTrackId("https://tidal.com/browse/track/12345")).toBe("12345");
        expect(tidalTrackId("https://tidal.com/de/track/12345")).toBe("12345");
        expect(tidalTrackId("https://tidal.com/en-us/track/12345?u=1")).toBe("12345");
        expect(tidalTrackId("https://listen.tidal.com/track/12345")).toBe("12345");
        expect(tidalTrackId("https://www.tidal.com/browse/track/999")).toBe("999");
    });

    it("tells albums and playlists apart from tracks", () => {
        expect(tidalAlbumId("https://tidal.com/album/778")).toBe("778");
        expect(tidalAlbumId("https://tidal.com/de/browse/album/778?u=1")).toBe("778");
        expect(tidalAlbumId("https://tidal.com/track/778")).toBeNull();
        // Playlist ids are uuids, not numbers.
        expect(tidalPlaylistId("https://tidal.com/playlist/1c5d01ed-4f05-40c4-bd28-0f73099e8f1e")).toBe(
            "1c5d01ed-4f05-40c4-bd28-0f73099e8f1e",
        );
        expect(tidalPlaylistId("https://tidal.com/album/778")).toBeNull();
        expect(tidalPlaylistId("https://nottidal.com/playlist/1c5d01ed-4f05-40c4-bd28-0f73099e8f1e")).toBeNull();
    });

    it("ignores links that aren't a TIDAL track", () => {
        expect(tidalTrackId("https://tidal.com/album/12345")).toBeNull();
        expect(tidalTrackId("https://tidal.com/browse/playlist/abc")).toBeNull();
        expect(tidalTrackId("https://open.spotify.com/track/12345")).toBeNull();
        expect(tidalTrackId("https://youtube.com/watch?v=abc")).toBeNull();
        expect(tidalTrackId("not a url")).toBeNull();
        // A lookalike host must not match — this decides where audio comes from.
        expect(tidalTrackId("https://nottidal.com/track/12345")).toBeNull();
        expect(tidalTrackId("https://tidal.com.evil.test/track/12345")).toBeNull();
    });
});

describe("source router with TIDAL off", () => {
    it("reports TIDAL as disabled", () => {
        expect(tidalEnabled()).toBe(false);
    });

    it("is never strict while TIDAL is off — strict without a source would dead-end", () => {
        expect(tidalStrict()).toBe(false);
    });

    it("explains the empty results instead of leaving callers guessing", () => {
        expect(strictNote()).toContain("TIDAL_ENABLED");
    });

    it("returns an empty album rather than throwing", async () => {
        expect(await sourceAlbum("123")).toEqual({ album: null, tracks: [] });
    });

    it("returns an empty playlist rather than throwing", async () => {
        expect(await sourcePlaylist("abc")).toEqual({ playlist: null, tracks: [] });
    });

    it("returns an empty artist rather than throwing", async () => {
        expect(await sourceArtist("42")).toEqual({ artist: null, albums: [] });
    });

    it("degrades the discovery surfaces to empty feeds", async () => {
        expect(await sourceHome()).toEqual({ sections: [] });
        expect(await sourceExplore()).toEqual({ groups: [], featured: [] });
        expect(await sourcePage("/genre/techno")).toEqual({ title: "", sections: [] });
        expect(await sourceMix("mix-1")).toEqual({ tracks: [] });
        expect(await sourceSimilar("t-1")).toEqual({ tracks: [] });
        expect(await sourceCredits("t-1")).toEqual({ credits: [] });
    });
});
