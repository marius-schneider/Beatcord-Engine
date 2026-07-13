import { createLogger } from "./logger";
import type { MixDeck } from "./mixer";
import {
    type NarratorEvent,
    type NarratorLang,
    type NarratorStyle,
    type PhraseContext,
    pickPhrase,
} from "./narrator-phrases";
import { type SpeechParams, synthSpeech } from "./tts";

/**
 * The DJ Narrator: turns "big moment" events (a drop, a bold transition, the set
 * starting, the queue drying up) into spoken lines mixed over the music. It picks a
 * phrase for the guild's language + style, synthesizes it via Piper, and hands the
 * PCM to the {@link MixDeck} to speak over the (ducked) music.
 *
 * Everything is **best-effort and non-blocking**: announcing never awaits in the
 * audio path, and if TTS is unavailable the call simply produces no sound. A short
 * per-instance cooldown enforces the "max ~0-1 announcement per song" rule so the
 * DJ stays out of the way.
 */

const log = createLogger("Narrator");

export interface NarratorConfig {
    lang: NarratorLang;
    style: NarratorStyle;
}

/** Minimum gap between two spoken lines (ms) — keeps the DJ from over-talking. */
const COOLDOWN_MS = 8000;

/**
 * Delivery (speech params) per style + event. The "energetic" baseline is in
 * {@link synthSpeech}; here we shape it further: the chill persona speaks slower
 * and calmer everywhere, and the low-energy events (queue nudges) ease off the
 * gas regardless of style so they don't sound like a hype moment.
 */
function delivery(style: NarratorStyle, event: NarratorEvent): SpeechParams {
    // Chill DJ: slower, smoother, less variation across the board.
    if (style === "chill") return { lengthScale: 0.98, noiseScale: 0.7, noiseWScale: 0.85 };
    // Pro/Radio: composed — a touch slower and less "shouty" than club/meme.
    const composed = style === "pro" || style === "radio";
    // Queue nudges aren't hype: drop the energy a notch for every style.
    if (event === "queueLow" || event === "queueEmpty") {
        return { lengthScale: composed ? 0.95 : 0.9, noiseScale: 0.75 };
    }
    if (composed) return { lengthScale: 0.9, noiseScale: 0.8 };
    // Club/Meme on a big moment → use the energetic default (undefined = preset).
    return {};
}

export class DjNarrator {
    #deck: MixDeck;
    #cfg: NarratorConfig;
    #lastSpokeAt = 0;
    /** Rotates phrase choice across a set so the same event doesn't repeat verbatim. */
    #rotation = 0;

    constructor(deck: MixDeck, cfg: NarratorConfig) {
        this.#deck = deck;
        this.#cfg = cfg;
    }

    /** Update the live language/style (e.g. when /settings changes mid-session). */
    configure(cfg: Partial<NarratorConfig>): void {
        this.#cfg = { ...this.#cfg, ...cfg };
    }

    /**
     * Announce an event. Picks a phrase, synthesizes it, and speaks it over the
     * music — fire-and-forget. Respects the cooldown (returns quietly if too soon)
     * unless `force` is set (used for `start`, which should always greet the set).
     */
    announce(event: NarratorEvent, ctx: PhraseContext = {}, force = false): void {
        const now = Date.now();
        if (!force && now - this.#lastSpokeAt < COOLDOWN_MS) return;

        const line = pickPhrase(this.#cfg.lang, this.#cfg.style, event, ctx, this.#rotation++);
        if (!line) return;
        this.#lastSpokeAt = now; // reserve the slot now so two events don't both fire

        void synthSpeech(this.#cfg.lang, line, delivery(this.#cfg.style, event))
            .then((pcm) => {
                if (pcm) {
                    this.#deck.speak(pcm);
                    log.debug(`[${event}] "${line}"`);
                }
            })
            .catch((e) => log.debug(`announce failed: ${(e as Error).message}`));
    }
}
