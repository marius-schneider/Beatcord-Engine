import { expect, test } from "bun:test";
import type { VoiceCommand } from "./voice-commands";
import { runVoiceCommand, VOICE_VOLUME_STEP, type VoiceCommandActions } from "./voice-dispatch";

/** A spy actions object that records every call. */
function spyActions(volume = 1) {
    const calls: string[] = [];
    let setTo: number | null = null;
    let playedQuery: string | null = null;
    const actions: VoiceCommandActions = {
        skip: async () => void calls.push("skip"),
        pause: async () => void calls.push("pause"),
        resume: async () => void calls.push("resume"),
        stop: () => void calls.push("stop"),
        toggleLoop: () => void calls.push("loop"),
        shuffle: () => void calls.push("shuffle"),
        previous: async () => void calls.push("previous"),
        clearQueue: () => void calls.push("clear"),
        volume,
        setVolume: async (v) => {
            calls.push("setVolume");
            setTo = v;
        },
        refreshNowPlaying: () => void calls.push("nowPlaying"),
        play: async (q) => {
            calls.push("play");
            playedQuery = q;
        },
    };
    return {
        actions,
        calls,
        get setTo() {
            return setTo;
        },
        get playedQuery() {
            return playedQuery;
        },
    };
}

const simpleCases: [VoiceCommand, string][] = [
    [{ kind: "skip" }, "skip"],
    [{ kind: "pause" }, "pause"],
    [{ kind: "resume" }, "resume"],
    [{ kind: "stop" }, "stop"],
    [{ kind: "loop" }, "loop"],
    [{ kind: "shuffle" }, "shuffle"],
    [{ kind: "previous" }, "previous"],
    [{ kind: "clear" }, "clear"],
    [{ kind: "nowPlaying" }, "nowPlaying"],
];

for (const [cmd, expected] of simpleCases) {
    test(`"${cmd.kind}" routes to ${expected}`, async () => {
        const s = spyActions();
        await runVoiceCommand(cmd, s.actions);
        expect(s.calls).toEqual([expected]);
    });
}

test("volumeUp nudges the current volume up by one step", async () => {
    const s = spyActions(1);
    await runVoiceCommand({ kind: "volumeUp" }, s.actions);
    expect(s.calls).toEqual(["setVolume"]);
    expect(s.setTo).toBeCloseTo(1 + VOICE_VOLUME_STEP);
});

test("volumeDown nudges the current volume down by one step", async () => {
    const s = spyActions(0.5);
    await runVoiceCommand({ kind: "volumeDown" }, s.actions);
    expect(s.setTo).toBeCloseTo(0.5 - VOICE_VOLUME_STEP);
});

test("play forwards the spoken query verbatim", async () => {
    const s = spyActions();
    await runVoiceCommand({ kind: "play", query: "daft punk" }, s.actions);
    expect(s.calls).toEqual(["play"]);
    expect(s.playedQuery).toBe("daft punk");
});
