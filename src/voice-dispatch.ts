import type { VoiceCommand } from "./voice-commands";

/** The volume nudge applied by the "louder"/"quieter" spoken commands. */
export const VOICE_VOLUME_STEP = 0.2;

/**
 * The player actions a spoken command can trigger. Deliberately narrow — only what the
 * voice commands actually need — so the command→action mapping is explicit and the
 * player stays the sole owner of how each action is implemented.
 */
export interface VoiceCommandActions {
    skip(): Promise<unknown>;
    pause(): Promise<unknown>;
    resume(): Promise<unknown>;
    stop(): void;
    toggleLoop(): unknown;
    shuffle(): void;
    previous(): Promise<unknown>;
    clearQueue(): void;
    /** Current linear volume, for the relative louder/quieter nudges. */
    readonly volume: number;
    setVolume(v: number): Promise<unknown>;
    /** Refresh the now-playing card (the "what's playing" command). */
    refreshNowPlaying(): void;
    play(query: string): Promise<unknown>;
}

/**
 * Map a parsed {@link VoiceCommand} onto the matching player action. Pure routing —
 * no error handling or UI refresh (the caller owns those), so it's unit-testable in
 * isolation from the player.
 */
export async function runVoiceCommand(cmd: VoiceCommand, actions: VoiceCommandActions): Promise<void> {
    switch (cmd.kind) {
        case "skip":
            await actions.skip();
            break;
        case "pause":
            await actions.pause();
            break;
        case "resume":
            await actions.resume();
            break;
        case "stop":
            actions.stop();
            break;
        case "loop":
            actions.toggleLoop();
            break;
        case "shuffle":
            actions.shuffle();
            break;
        case "previous":
            await actions.previous();
            break;
        case "clear":
            actions.clearQueue();
            break;
        case "volumeUp":
            await actions.setVolume(actions.volume + VOICE_VOLUME_STEP);
            break;
        case "volumeDown":
            await actions.setVolume(actions.volume - VOICE_VOLUME_STEP);
            break;
        case "nowPlaying":
            actions.refreshNowPlaying();
            break;
        case "play":
            await actions.play(cmd.query);
            break;
    }
}
