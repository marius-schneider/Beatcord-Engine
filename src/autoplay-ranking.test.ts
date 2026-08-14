import { expect, test } from "bun:test";
import { rankByCoherence } from "./autoplay-ranking";
import type { TrackInfo } from "./ytdlp";

function track(over: Partial<TrackInfo> = {}): TrackInfo {
    return {
        id: Math.random().toString(36).slice(2),
        title: "Some Song",
        url: "u",
        durationMs: 180_000,
        uploader: null,
        thumbnail: null,
        ...over,
    };
}

test("same-genre candidates rank above off-genre ones", () => {
    const seed = track({ title: "Deep House Anthem", durationMs: 200_000 });
    const sameGenre = track({ id: "same", title: "Techno Banger" });
    const offGenre = track({ id: "off", title: "Acoustic Ballad Piano" });

    const ranked = rankByCoherence(seed, [offGenre, sameGenre]);
    expect(ranked[0]!.id).toBe("same"); // edm seed → edm candidate wins despite input order
});

test("similar-length candidates rank above wildly-different ones", () => {
    const seed = track({ title: "Pop Hit", durationMs: 180_000 });
    const similar = track({ id: "similar", title: "Pop Tune", durationMs: 190_000 });
    const marathon = track({ id: "marathon", title: "Pop Tune", durationMs: 3_600_000 }); // 1h loop

    const ranked = rankByCoherence(seed, [marathon, similar]);
    expect(ranked[0]!.id).toBe("similar");
    expect(ranked[1]!.id).toBe("marathon");
});

test("genre alone cannot outweigh substantially better runtime continuity", () => {
    const seed = track({ title: "Lofi Chill Beats", durationMs: 150_000 });
    // Same genre but long; vs. off-genre but same length.
    const sameGenreLong = track({ id: "g", title: "Lofi Study Mix", durationMs: 600_000 });
    const offGenreSameLen = track({ id: "l", title: "Heavy Metal Riff", durationMs: 150_000 });

    const ranked = rankByCoherence(seed, [offGenreSameLen, sameGenreLong]);
    expect(ranked[0]!.id).toBe("l");
});

test("tempo compatibility complements rather than replaces other signals", () => {
    const seed = track({ title: "House Seed", bpm: 128, durationMs: 180_000 });
    const compatible = track({ id: "tempo", title: "Unknown Groove", bpm: 64, durationMs: 180_000 });
    const unrelated = track({ id: "other", title: "Unknown Groove", bpm: 105, durationMs: 180_000 });

    expect(rankByCoherence(seed, [unrelated, compatible])[0]!.id).toBe("tempo");
});

test("stable: equal scores keep the original (YouTube) order", () => {
    const seed = track({ title: "Mystery", uploader: null, durationMs: 0 }); // unknown genre, no duration
    const a = track({ id: "a", title: "First", durationMs: 0 });
    const b = track({ id: "b", title: "Second", durationMs: 0 });

    const ranked = rankByCoherence(seed, [a, b]);
    expect(ranked.map((t) => t.id)).toEqual(["a", "b"]);
});

test("returns a new array without mutating the input", () => {
    const seed = track({ title: "House Track" });
    const input = [track({ id: "x", title: "Acoustic" }), track({ id: "y", title: "Techno House" })];
    const before = input.map((t) => t.id);
    rankByCoherence(seed, input);
    expect(input.map((t) => t.id)).toEqual(before); // input order untouched
});
