import { describe, expect, test } from "bun:test";
import {
    availabilityAwareUtility,
    buildSessionMemory,
    carSessionPermissions,
    connectivityRoute,
    DRIVING_MODE,
    type ExperienceLyricTimeline,
    fairKaraokeQueue,
    hapticEvent,
    karaokeMode,
    karaokeStemMix,
    lyricsAtPresentationTime,
    MEMORY_SURFACES,
    memoryRetrieval,
    type SessionMemory,
    socialMemoryRecap,
    TV_EXPERIENCE_SURFACE,
    userOwnedMemoryLabel,
    validateLyricTimeline,
    WATCH_CONTROLS,
    watchCrowdRemote,
} from "./mobility-karaoke-memory";

const lyrics: ExperienceLyricTimeline = {
    lines: [{ start: 0, end: 5, text: "Hello" }],
    words: [{ start: 0, end: 1, text: "Hello", lineIndex: 0 }],
    language: "en",
    translations: [{ language: "de", lines: [{ start: 0, end: 5, text: "Hallo" }] }],
    confidence: 0.9,
};
const memory: SessionMemory = {
    date: "Friday",
    duration: 222,
    participants: 5,
    tracks: ["x", "x", "y"],
    discoveries: ["z"],
    reactions: 20,
    peakMoments: ["X chorus"],
    favoriteTransitions: ["X→Y"],
    title: "Friday Night",
};
describe("mobility, karaoke and memory", () => {
    test("keeps driving voice-first and distraction-optimized", () => {
        expect(DRIVING_MODE).toEqual({
            interaction: "voice-first",
            largeControls: true,
            waveformEditor: false,
            complexQueueManipulation: false,
            attentionHeavyVisuals: false,
        });
        expect(carSessionPermissions("driver-host", true)).toMatchObject({
            voiceRequests: true,
            playbackControl: false,
            safetyPolicyOwner: true,
            deepTouchWorkflow: false,
        });
    });
    test("lets passenger controls follow driver safety policy", () => {
        expect(carSessionPermissions("passenger-controller", true)).toMatchObject({
            playbackControl: true,
            safetyPolicyOwner: false,
        });
        expect(carSessionPermissions("passenger-requester", true).playbackControl).toBe(false);
    });
    test("raises cached tracks when connectivity is degrading", () => {
        expect(availabilityAwareUtility(0.7, 1, true, 0.2)).toBeCloseTo(0.9);
        expect(
            connectivityRoute(
                [
                    { id: "great-cloud", utility: 0.9, availabilityConfidence: 0.5, cached: false },
                    { id: "cached", utility: 0.75, availabilityConfidence: 1, cached: true },
                ],
                0.2,
            ),
        ).toBe("cached");
    });
    test("keeps watch controls glanceable and crowd-capable", () => {
        expect(WATCH_CONTROLS).toHaveLength(5);
        expect(watchCrowdRemote(true)).toEqual({ actions: ["fire-reaction", "love", "skip-vote"], glanceable: true });
    });
    test("makes haptics configurable and reduced-motion compatible", () => {
        expect(hapticEvent("drop", { enabled: true, reducedMotion: true })).toEqual({
            emit: true,
            pattern: "subtle",
            configurable: true,
        });
    });
    test("uses TV for lyrics, visuals, crowd, art and journey", () => {
        expect(TV_EXPERIENCE_SURFACE).toEqual(["lyrics", "visuals", "crowd", "album-art", "session-journey"]);
    });
    test("treats lyrics as validated timed media", () => {
        expect(validateLyricTimeline(lyrics)).toEqual({ valid: true, timedMedia: true, failures: [] });
        expect(validateLyricTimeline({ ...lyrics, lines: [{ start: 5, end: 2, text: "bad" }] }).valid).toBe(false);
    });
    test("aligns original and translation to audio presentation clock", () => {
        expect(lyricsAtPresentationTime(lyrics, 1, "both", "de")).toEqual({
            original: "Hello",
            translation: "Hallo",
            alignedToAudioClock: true,
        });
    });
    test("separates lead/backing vocal control while preserving instrumental", () => {
        expect(
            karaokeStemMix({ leadVocalDb: -100, backingVocalsDb: -3, leadAvailable: true, backingAvailable: true }),
        ).toEqual({ leadVocalDb: -60, backingVocalsDb: -3, instrumentalPreserved: true });
    });
    test("rotates singers, prevents duplicates and favors prepared requests", () => {
        const queue = fairKaraokeQueue(
            [
                { singerId: "recent", trackId: "a", prepared: true },
                { singerId: "new", trackId: "b", prepared: true },
                { singerId: "other", trackId: "b", prepared: false },
            ],
            ["recent"],
        );
        expect(queue.map((item) => item.singerId)).toEqual(["new", "recent"]);
    });
    test("keeps party karaoke forgiving and pitch judgment in practice only", () => {
        expect(karaokeMode("party")).toEqual({
            pitchVisualization: false,
            timingFeedback: false,
            judgment: "none",
            forgiving: true,
        });
        expect(karaokeMode("practice").judgment).toBe("training-only");
    });
    test("stores meaningful memory moments without surveillance events", () => {
        const result = buildSessionMemory(memory, ["Mia skipped at 22:13"]);
        expect(result.surveillanceEventsStored).toBe(false);
        expect(result.tracks).toEqual(["x", "y"]);
        expect(result.meaningfulMomentCount).toBe(3);
    });
    test("creates social recaps and retrieves memories as future context", () => {
        expect(socialMemoryRecap(memory).title).toBe("Friday Night");
        expect(memoryRetrieval("chorus", [memory])).toEqual([memory]);
    });
    test("keeps labels user-owned and supports more than annual recaps", () => {
        expect(userOwnedMemoryLabel(memory, "Summer Drive", "Our Trip").title).toBe("Our Trip");
        expect(userOwnedMemoryLabel(memory, "Summer Drive", null).title).toBeUndefined();
        expect(MEMORY_SURFACES).toHaveLength(7);
    });
});
