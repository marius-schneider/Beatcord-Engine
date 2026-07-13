import { expect, test } from "bun:test";

import { parseCommand } from "./voice-commands";

test("requires the wake-word — plain speech is ignored", () => {
    expect(parseCommand("skip this song")).toBeNull();
    expect(parseCommand("I think we should pause")).toBeNull();
    expect(parseCommand("")).toBeNull();
    expect(parseCommand("hey dj")).toBeNull(); // wake-word alone → nothing
});

test("recognises simple playback commands after the wake-word", () => {
    expect(parseCommand("Hey DJ, skip")).toEqual({ kind: "skip" });
    expect(parseCommand("hey dj pause")).toEqual({ kind: "pause" });
    expect(parseCommand("Hey DJ, resume")).toEqual({ kind: "resume" });
    expect(parseCommand("hey dj stop")).toEqual({ kind: "stop" });
    expect(parseCommand("Hey DJ loop")).toEqual({ kind: "loop" });
});

test("tolerates whisper's casing + trailing punctuation", () => {
    expect(parseCommand("Hey DJ, Skip!")).toEqual({ kind: "skip" });
    expect(parseCommand("HEY DJ. STOP.")).toEqual({ kind: "stop" });
    expect(parseCommand("hey dj... shuffle?")).toEqual({ kind: "shuffle" });
});

test("tolerates a leading politeness filler", () => {
    expect(parseCommand("Hey DJ, please skip")).toEqual({ kind: "skip" });
    expect(parseCommand("Hey DJ, can you pause")).toEqual({ kind: "pause" });
    expect(parseCommand("Hey DJ bitte weiter")).toEqual({ kind: "resume" });
});

test("German synonyms map to the same commands", () => {
    expect(parseCommand("Hey DJ, überspringen")).toEqual({ kind: "skip" });
    expect(parseCommand("Hey DJ, lauter")).toEqual({ kind: "volumeUp" });
    expect(parseCommand("Hey DJ, leiser")).toEqual({ kind: "volumeDown" });
    expect(parseCommand("Hey DJ, zurück")).toEqual({ kind: "previous" });
});

test("volume up/down both directions", () => {
    expect(parseCommand("Hey DJ, louder")).toEqual({ kind: "volumeUp" });
    expect(parseCommand("Hey DJ, turn it up")).toEqual({ kind: "volumeUp" });
    expect(parseCommand("Hey DJ, quieter")).toEqual({ kind: "volumeDown" });
    expect(parseCommand("Hey DJ, turn it down")).toEqual({ kind: "volumeDown" });
});

test("specific phrases beat general ones (clear queue, now playing)", () => {
    expect(parseCommand("Hey DJ, clear queue")).toEqual({ kind: "clear" });
    expect(parseCommand("Hey DJ, clear the queue")).toEqual({ kind: "clear" });
    expect(parseCommand("Hey DJ, what's playing")).toEqual({ kind: "nowPlaying" });
    expect(parseCommand("Hey DJ, was läuft gerade")).toEqual({ kind: "nowPlaying" });
});

test("'play <query>' captures the rest of the phrase as the search query", () => {
    expect(parseCommand("Hey DJ, play daft punk one more time")).toEqual({
        kind: "play",
        query: "daft punk one more time",
    });
    expect(parseCommand("Hey DJ, spiel cro traum")).toEqual({ kind: "play", query: "cro traum" });
    expect(parseCommand("Hey DJ, put on some lofi")).toEqual({ kind: "play", query: "some lofi" });
});

test("'play' with no query falls back to resume (don't search for nothing)", () => {
    expect(parseCommand("Hey DJ, play")).toEqual({ kind: "resume" });
});

test("a custom wake-word is honoured", () => {
    expect(parseCommand("computer skip", "computer")).toEqual({ kind: "skip" });
    // A phrase whose opening doesn't resemble the configured core word is ignored.
    expect(parseCommand("banana skip", "computer")).toBeNull();
});

test("the address word is interchangeable (hey/yo/ey all reach the DJ)", () => {
    // The distinctive part is the core ("dj"); a mis-heard/varied "hey" still matches.
    expect(parseCommand("yo dj skip", "hey dj")).toEqual({ kind: "skip" });
    expect(parseCommand("ey dj pause", "hey dj")).toEqual({ kind: "pause" });
});

test("unknown command after the wake-word → null (ignored, no false action)", () => {
    expect(parseCommand("Hey DJ, do a barrel roll")).toBeNull();
    expect(parseCommand("Hey DJ, what time is it")).toBeNull();
});

test("fuzzy-matches STT-mangled command words", () => {
    // How whisper actually mis-hears these (observed live / via TTS).
    expect(parseCommand("Hey DJ Paws")).toEqual({ kind: "pause" });
    expect(parseCommand("Hey DJ UberSpringian")).toEqual({ kind: "skip" }); // "überspringen"
    expect(parseCommand("hey dj überspringen")).toEqual({ kind: "skip" });
});

test("fuzzy fallback still rejects genuinely unrelated words", () => {
    expect(parseCommand("Hey DJ banana telephone")).toBeNull();
    expect(parseCommand("Hey DJ the weather today")).toBeNull();
});

test("German play phrasing with the verb late/at the end", () => {
    // Whisper transcribes natural German word order; the verb isn't leading.
    expect(parseCommand("Hey DJ, kannst du Coldplay spielen?")).toEqual({ kind: "play", query: "coldplay" });
    expect(parseCommand("Hey DJ, ich spiele Higher Power")).toEqual({ kind: "play", query: "higher power" });
    // "X von Y" (X by Y) collapses into one query.
    expect(parseCommand("Hey DJ, spiele Higher Power von Coldplay")).toEqual({
        kind: "play",
        query: "higher power coldplay",
    });
});

test("rejects spelled-out letter-salad transcripts (no false command)", () => {
    // STT sometimes hears a name spelled out → a run of single letters. Must never
    // trip a prefix match (this was a real false "previous"/play trigger).
    expect(parseCommand("E-D-J, L-E-A-R-V-U-T.")).toBeNull();
    expect(parseCommand("A, D, J, Gip.")).toBeNull();
    expect(parseCommand("A B J B")).toBeNull();
});
