import { Readable } from "node:stream";
import {
    CHANNELS,
    DISCORD_FRAME_BYTES,
    FLOAT_BYTES_PER_SAMPLE,
    FLOAT_FRAME_BYTES,
    FLOAT_SAMPLE_FRAME_BYTES,
    FRAME_MS,
    PCM_MAX,
    PCM_MIN,
    SAMPLE_FRAME_BYTES,
    SAMPLE_RATE,
    SAMPLES_PER_FRAME,
    tempoStretchFilter,
} from "./constants";
import { Deck } from "./deck";
import { bandGains, createBandState, createHpState, highpass, splitBands } from "./eq";
import { createLogger } from "./logger";
import type { TransitionType } from "./transition-planner";

const log = createLogger("Mixer");

export interface MixDeckEvents {
    /** Fired when a deck transition completes and a deck slot is free. */
    onTransitionEnd?: () => void;
    /** Fired when there's nothing left to play. */
    onEmpty?: () => void;
}

/**
 * A {@link Readable} that emits a continuous 48kHz/stereo/s16le PCM stream by
 * playing one deck and, on request, beat-aligned crossfading into a second deck
 * by summing their samples with complementary fade gains. Sample-accurate
 * float summation + one final limiter/quantizer avoids the clicks/pops that naive
 * stream mixing and repeated s16 clamps cause.
 *
 * The single long-lived stream means the @discordjs/voice AudioPlayer never goes
 * Idle between tracks — so transitions are seamless and skip just swaps decks.
 */
export class MixDeck extends Readable {
    #a: Deck | null = null;
    #b: Deck | null = null;
    // Reusable float scratch buffers for the hot mix path (no per-frame allocation);
    // the only Int16 view left here is the final Discord s16 output frame.
    #scratchA = Buffer.alloc(FLOAT_FRAME_BYTES);
    #scratchB = Buffer.alloc(FLOAT_FRAME_BYTES);
    #out = Buffer.alloc(DISCORD_FRAME_BYTES);
    #viewA = new Float32Array(this.#scratchA.buffer, this.#scratchA.byteOffset, SAMPLES_PER_FRAME * CHANNELS);
    #viewB = new Float32Array(this.#scratchB.buffer, this.#scratchB.byteOffset, SAMPLES_PER_FRAME * CHANNELS);
    #viewOut = new Int16Array(this.#out.buffer, this.#out.byteOffset, SAMPLES_PER_FRAME * CHANNELS);
    #floatOut = new Float32Array(SAMPLES_PER_FRAME * CHANNELS);
    /** Crossfade progress in frames, and total frames, when fading. */
    #fadeFrame = 0;
    #fadeTotalFrames = 0;
    #fading = false;
    #events: MixDeckEvents;
    /** Equal-power (true) vs linear (false) fade curve. */
    #equalPower = true;

    #clock: ReturnType<typeof setTimeout> | null = null;
    /** Wall-clock time the next frame is due (drift-compensated pacing). */
    #nextFrameAt = 0;
    /** When all decks drained, we let one more empty frame flush then end. */
    #endRequested = false;
    /** Grace ticks before declaring start-up failure (ffmpeg cold start). */
    #warmupTicks = 0;
    /** Frames of real audio emitted for the CURRENT primary track (reset on swap). */
    #framesPlayed = 0;

    /** True playback position of the current track in seconds (from emitted audio). */
    get playedSec(): number {
        return (this.#framesPlayed * FRAME_MS) / 1000;
    }

    constructor(events: MixDeckEvents = {}) {
        super({ highWaterMark: DISCORD_FRAME_BYTES * 10 });
        this.#events = events;
    }

    /** Load the first deck and start the paced clock. `loudnorm` = optional gain filter. */
    loadPrimary(filePath: string, startSec = 0, loudnorm?: string): void {
        this.#a?.destroy();
        this.#a = new Deck(filePath, startSec, loudnorm ? [loudnorm] : []);
        this.#warmupTicks = 0;
        this.#endRequested = false;
        this.#framesPlayed = Math.round((startSec * 1000) / FRAME_MS);
        this.#startClock();
    }

    /** True if a crossfade can start (primary loaded, no fade in progress). */
    get canTransition(): boolean {
        return this.#a != null && !this.#fading && !this.#rendered;
    }

    /** Whether to apply the 3-band EQ transition during the crossfade. */
    #eqSweep = false;
    /** The active transition style for the current fade. */
    #transition: TransitionType = "blend";
    // 3-band EQ filter state: per source (A/B) per channel (0/1).
    #bandA0 = createBandState();
    #bandA1 = createBandState();
    #bandB0 = createBandState();
    #bandB1 = createBandState();
    // High-pass sweep state for the "filter" transition (outgoing deck A, per channel).
    #hpA0 = createHpState();
    #hpA1 = createHpState();
    /** Frame offset where deck B began (its beat-aligned intro), for position math. */
    #bStartFrames = 0;
    /** Current track's beat length (s), so gate/echo lock to the tempo. */
    #beatSec = 0.5;
    /** Stereo delay line for the "echo" transition (feedback ring buffer for deck A). */
    #echoBuf: Float32Array | null = null;
    #echoPos = 0;
    #ditherSeed = 0xdecafbad;
    // Rolling buffer of the last ~1s of emitted output, so a spinback can replay it
    // backwards. Always maintained while playing (cheap copy per frame).
    #recent = new Int16Array(SAMPLE_RATE * CHANNELS); // ~1s stereo
    #recentPos = 0;
    #recentFilled = 0;
    // Active spinback: when set, the tick emits reversed `#recent` instead of mixing,
    // until it finishes, then swaps in the pending deck. `startFrames` = the pending
    // deck's file offset, so the position counter is correct after the swap.
    #spinback: { read: number; speed: number; pending: Deck; startFrames: number } | null = null;
    // Acapella layer: the OUTGOING track's isolated vocal stem, played over the
    // incoming track during/after a crossfade so A's vocal sings over B's beat (the
    // classic acapella-out move). It fades out over `#acaTotal` frames. Independent
    // of the A/B crossfade decks — purely additive, like the narrator voice-over.
    #acapella: { deck: Deck; frame: number; total: number } | null = null;
    // Active beat-repeat roll: loops a short slice of `#recent`, the loop getting
    // shorter (faster repeats) until it cuts to the pending deck.
    #roll: { start: number; len: number; pos: number; framesLeft: number; pending: Deck; startFrames: number } | null =
        null;
    // Offline-rendered transition segment: play a pre-rendered A→B bridge, while the
    // real B deck warms at the exact point where that segment ends.
    #rendered: { deck: Deck; pending: Deck; startFrames: number } | null = null;

    // ── Output gain (volume) ──
    // Folded into the mix loop instead of @discordjs/voice's inlineVolume: prism's
    // VolumeTransformer costs per-sample Buffer method calls + a concat and two
    // slices per chunk, and it HARD-clips at full scale — at volume 2.0 (this bot's
    // max) that's audible crackle. Here it rides the Int16 views we already touch
    // and peaks go through the same tanh soft-knee as everything else.
    #gain = 1;

    /** Output volume (0–2). Replaces the resource's inlineVolume for the mix stream. */
    setGain(v: number): void {
        this.#gain = Math.min(Math.max(v, 0), 2);
    }

    get gain(): number {
        return this.#gain;
    }

    /** Scale a frame by the output gain (no-op at unity). */
    #applyGain(view: Int16Array): void {
        const g = this.#gain;
        if (g === 1) return;
        for (let i = 0; i < view.length; i++) view[i] = clamp(view[i]! * g);
    }

    /**
     * Layer the outgoing track's vocal stem over the mix (the acapella-out move).
     * `vocalStemFile` is A's isolated vocals; `startSec` is the beat-aligned point in
     * that stem matching where A currently is; `holdSec` is how long it sings over B
     * before fading out. The normal crossfade into B (its instrumental) runs
     * separately via startCrossfade — this just adds A's voice on top.
     */
    acapella(vocalStemFile: string, startSec: number, holdSec: number, loudnorm?: string): void {
        this.#acapella?.deck.destroy();
        const total = Math.max(1, Math.round((holdSec * 1000) / FRAME_MS));
        this.#acapella = {
            deck: new Deck(vocalStemFile, startSec, incomingFilters(loudnorm)),
            frame: 0,
            total,
        };
    }

    /** Mix the acapella vocal layer into a built float frame (in place), fading it out. */
    #applyAcapella(view: Float32Array): void {
        const aca = this.#acapella;
        if (!aca) return;
        const got = aca.deck.readFloatInto(this.#scratchAca);
        if (got > 0) {
            const v = this.#viewAca;
            // Equal-power fade-out across the hold window so the vocal recedes as B
            // establishes itself, instead of cutting off mid-word.
            const t = Math.min(1, aca.frame / aca.total);
            const gain = Math.cos((t * Math.PI) / 2); // 1 → 0, equal-power
            const n = Math.min(view.length, (got / FLOAT_BYTES_PER_SAMPLE) | 0);
            for (let i = 0; i < n; i++) view[i] = view[i]! + v[i]! * gain;
        }
        aca.frame++;
        if (aca.frame >= aca.total || aca.deck.drained) {
            aca.deck.destroy();
            this.#acapella = null;
        }
    }

    #scratchAca = Buffer.alloc(FLOAT_FRAME_BYTES);
    #viewAca = new Float32Array(this.#scratchAca.buffer, this.#scratchAca.byteOffset, SAMPLES_PER_FRAME * CHANNELS);

    // ── DJ-Narrator voice-over ──
    // A short TTS clip (48k/stereo/s16, interleaved) the DJ "speaks" OVER the music.
    // While it plays the music ducks under it; both are summed (clamped) into the
    // same frame, so narration rides the one long-lived stream — no second player.
    #voiceOver: Int16Array | null = null;
    #voicePos = 0; // sample index into #voiceOver
    /** Smoothed duck gain on the music: 1 = full, → DUCK_GAIN while speaking. */
    #duck = 1;

    /**
     * Speak a TTS clip over the music. `pcm` is 48kHz/stereo/s16le. Replaces any
     * clip already playing (the latest big-moment line wins). Best-effort: a too-
     * short/empty buffer is ignored.
     */
    speak(pcm: Buffer): void {
        if (pcm.length < SAMPLE_FRAME_BYTES) return;
        const samples = pcm.length >> 1; // whole Int16 samples (drop any odd byte)
        // Int16Array needs a 2-byte-aligned offset. Buffers from Buffer.concat are
        // aligned, but copy defensively if a pooled buffer hands us an odd offset.
        this.#voiceOver =
            pcm.byteOffset % 2 === 0
                ? new Int16Array(pcm.buffer, pcm.byteOffset, samples)
                : new Int16Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + samples * 2));
        this.#voicePos = 0;
    }

    /** True while a narration clip is being spoken over the music. */
    get speaking(): boolean {
        return this.#voiceOver != null;
    }

    /**
     * Mix the active voice-over into a freshly-built float music frame, in place. Ducks
     * the music under the voice (smoothly, to avoid a level "jump"), sums the two,
     * and leaves the final limiter/quantizer to the frame boundary. Advances the clip; clears it (and lets the duck ease back to
     * full) when it's fully spoken. No-op when nothing is being spoken.
     */
    #applyVoiceOver(view: Float32Array): void {
        const vo = this.#voiceOver;
        // Ease the duck toward its target every frame (1 when idle, DUCK_GAIN while
        // speaking) — a per-frame glide, so the music dips/returns without a click.
        this.#duck = duckStep(this.#duck, vo ? DUCK_GAIN : 1);
        // Fully back up and nothing to speak → idle frame, leave the music bit-exact.
        if (!vo && this.#duck === 1) return;

        const duck = this.#duck;
        for (let i = 0; i < SAMPLES_PER_FRAME; i++) {
            const l = i * CHANNELS;
            const r = l + 1;
            let outL = view[l]! * duck;
            let outR = view[r]! * duck;
            if (vo && this.#voicePos + CHANNELS <= vo.length) {
                outL += vo[this.#voicePos]!;
                outR += vo[this.#voicePos + 1]!;
                this.#voicePos += CHANNELS;
            }
            view[l] = outL;
            view[r] = outR;
        }

        // Clip fully spoken → drop it; the duck eases back to 1 over the next frames.
        if (vo && this.#voicePos + CHANNELS > vo.length) this.#voiceOver = null;
    }

    /**
     * Begin a beat-aligned crossfade into `filePath` over `fadeSec`.
     *  - `startSec`: where to start the incoming track (beat-aligned intro).
     *  - `eqSweep`:  use the 3-band DJ transition (highs→mids→lows).
     *  - `tempoRatio`: time-stretch the incoming track to match the current tempo
     *    (e.g. 0.94 = play B 6% slower so its beats line up). 1 = no change.
     */
    // ── Deck pre-warming ──
    // Spawning the incoming deck at fire time costs ~30-50ms (ffmpeg start + first
    // frames + tick quantization) — during which the fade runs against SILENCE, so
    // the incoming track's beats land late by exactly that latency: an audible kick
    // "flam" on a beat-matched blend, defeating the precise bar-line firing. The
    // beatmatch controller knows the transition seconds ahead, so it pre-spawns the
    // deck here; by fire time it's primed and bar 1 lands ON the bar line.
    #prepared: { key: string; deck: Deck } | null = null;

    /** Pre-spawn the incoming deck so it's primed when the transition fires. */
    prepareNext(filePath: string, startSec = 0, tempoRatio = 1, loudnorm?: string): void {
        const filters = incomingFilters(loudnorm, tempoRatio);
        const key = deckKey(filePath, startSec, filters);
        if (this.#prepared?.key === key) return; // already warming this exact deck
        this.#prepared?.deck.destroy();
        this.#prepared = { key, deck: new Deck(filePath, startSec, filters) };
    }

    /** Drop a prepared deck that won't be used (skip/stop raced the transition). */
    discardPrepared(): void {
        this.#prepared?.deck.destroy();
        this.#prepared = null;
    }

    #discardRendered(): void {
        this.#rendered?.deck.destroy();
        this.#rendered?.pending.destroy();
        this.#rendered = null;
    }

    /** Consume the prepared deck if it matches; discard a stale mismatch. */
    #takePrepared(key: string): Deck | null {
        if (this.#prepared?.key === key) {
            const deck = this.#prepared.deck;
            this.#prepared = null;
            log.debug(`Using pre-warmed deck ${deck.id} (primed=${deck.primed}).`);
            return deck;
        }
        this.discardPrepared();
        return null;
    }

    startCrossfade(
        filePath: string,
        fadeSec: number,
        startSec = 0,
        eqSweep = false,
        tempoRatio = 1,
        loudnorm?: string,
        transition: TransitionType = "blend",
        beatSec = 0.5,
        barAtPlaySec?: number,
    ): void {
        if (!this.canTransition) return;
        this.#discardRendered();
        // Normalize first (on the source), then tempo-stretch — loudnorm wants the
        // original timeline. The Deck appends the final 48kHz resample afterward.
        // When stretching, the intro offset also stretches: ffmpeg's -ss is applied
        // pre-filter, so the start position stays correct.
        const filters = incomingFilters(loudnorm, tempoRatio);
        this.#b = this.#takePrepared(deckKey(filePath, startSec, filters)) ?? new Deck(filePath, startSec, filters);
        // Sample-align the bar lines: the deck starts B_PRE_ROLL_SEC before its bar;
        // trim exactly enough that B's bar lands ON the outgoing track's bar line
        // (instead of a constant 20–40ms-late kick "flam" across the whole blend).
        let trimSec = 0;
        if (barAtPlaySec !== undefined) {
            trimSec = alignTrimSec(this.playedSec, barAtPlaySec);
            const trimFrames = Math.round(trimSec * SAMPLE_RATE);
            if (trimFrames > 0) {
                this.#b.discardLeadingFrames(trimFrames);
                log.debug(`Bar-align trim: ${(trimSec * 1000).toFixed(1)}ms off deck ${this.#b.id}.`);
            }
        }
        // Fade length measured in 20ms frames.
        this.#fadeTotalFrames = Math.max(1, Math.round((fadeSec * 1000) / FRAME_MS));
        this.#fadeFrame = 0;
        this.#fading = true;
        this.#transition = transition;
        this.#beatSec = beatSec > 0 ? beatSec : 0.5;
        // A "cut" only EQ-swaps if asked; it's mainly a near-instant fade. "filter"
        // and "blend" use the bass-swap EQ when eqSweep is set.
        this.#eqSweep = eqSweep && transition !== "fade";
        this.#bandA0 = createBandState();
        this.#bandA1 = createBandState();
        this.#bandB0 = createBandState();
        this.#bandB1 = createBandState();
        this.#hpA0 = createHpState();
        this.#hpA1 = createHpState();
        // Echo: a beat-synced delay line (3/4 of a beat = a dotted feel) sounds
        // intentional, not random. Clamped to a sane range if the BPM is odd.
        if (transition === "echo") {
            const delaySec = Math.min(0.6, Math.max(0.2, beatSec * 0.75));
            const delaySamples = Math.round(SAMPLE_RATE * delaySec) * CHANNELS;
            this.#echoBuf = new Float32Array(delaySamples);
            this.#echoPos = 0;
        } else {
            this.#echoBuf = null;
        }
        // Position baseline for when B becomes the primary, in the PLAYBACK timeline
        // (playedSec counts emitted audio): with tempo scale r, file position `startSec`
        // is heard at startSec/r — and the bar-align trim shifted the origin too.
        // Using raw file time here put the NEXT transition off by seconds whenever
        // tempo-sync had stretched this deck.
        this.#bStartFrames = Math.round(((startSec / tempoRatio + trimSec) * 1000) / FRAME_MS);
    }

    /**
     * Replace the live mix with a pre-rendered transition bridge, then continue with
     * the real incoming track at `resumeStartSec`. Best used by Automix prefetch when
     * the offline render finished before the transition point; otherwise use the
     * normal live transition methods.
     */
    startRenderedTransition(
        renderedFilePath: string,
        nextFilePath: string,
        resumeStartSec: number,
        tempoRatio = 1,
        loudnorm?: string,
    ): void {
        if (!this.#a || this.#rendered) return;
        const filters = incomingFilters(loudnorm, tempoRatio);
        const rendered = new Deck(renderedFilePath, 0, []);
        const pending = new Deck(nextFilePath, resumeStartSec, filters);
        this.#a.destroy();
        this.#b?.destroy();
        this.#b = null;
        this.discardPrepared();
        this.#acapella?.deck.destroy();
        this.#acapella = null;
        this.#fading = false;
        this.#spinback = null;
        this.#roll = null;
        this.#a = rendered;
        this.#rendered = {
            deck: rendered,
            pending,
            startFrames: Math.round(((resumeStartSec / tempoRatio) * 1000) / FRAME_MS),
        };
        this.#warmupTicks = 0;
        this.#framesPlayed = 0;
        this.#startClock();
    }

    /** Hard-skip: drop both decks and start `filePath` immediately. */
    skipTo(filePath: string, startSec = 0, loudnorm?: string): void {
        this.#a?.destroy();
        this.#b?.destroy();
        this.#b = null;
        this.discardPrepared(); // a pre-warmed transition deck is now stale
        this.#discardRendered();
        this.#acapella?.deck.destroy(); // a skip cuts any acapella layer short
        this.#acapella = null;
        this.#fading = false;
        this.#a = new Deck(filePath, startSec, loudnorm ? [loudnorm] : []);
        this.#warmupTicks = 0;
        this.#framesPlayed = Math.round((startSec * 1000) / FRAME_MS);
        this.#startClock();
    }

    /**
     * Spinback transition: play the recently-emitted audio BACKWARDS with a quick
     * slowdown (the "brake" effect), then hard-cut into `filePath`. High-impact, used
     * for big drops. Loads the incoming deck now; the tick runs the reverse phase.
     */
    spinback(filePath: string, startSec = 0, loudnorm?: string): void {
        if (!this.#a || this.#spinback) return;
        this.#discardRendered();
        const filters = incomingFilters(loudnorm);
        const pending =
            this.#takePrepared(deckKey(filePath, startSec, filters)) ?? new Deck(filePath, startSec, filters);
        // Start reading from the most recent sample and walk backwards.
        const last = (this.#recentPos - CHANNELS + this.#recent.length) % this.#recent.length;
        this.#spinback = { read: last, speed: 1, pending, startFrames: Math.round((startSec * 1000) / FRAME_MS) };
        this.#b?.destroy();
        this.#b = null;
        this.#fading = false;
        this.#startClock();
    }

    /**
     * Beat-repeat roll: loop the last `beatSec` of emitted audio, halving the loop
     * length a few times so the repeats speed up, then hard-cut into `filePath`.
     * The classic "stutter build" into the next track.
     */
    roll(filePath: string, beatSec: number, startSec = 0, loudnorm?: string): void {
        if (!this.#a || this.#roll || this.#spinback) return;
        this.#discardRendered();
        const filters = incomingFilters(loudnorm);
        const pending =
            this.#takePrepared(deckKey(filePath, startSec, filters)) ?? new Deck(filePath, startSec, filters);
        const len = Math.max(SAMPLES_PER_FRAME * CHANNELS, Math.round(beatSec * SAMPLE_RATE) * CHANNELS);
        // Loop the most recent `len` samples.
        const start = (((this.#recentPos - len) % this.#recent.length) + this.#recent.length) % this.#recent.length;
        // Run the roll for ~1 beat total of real time (so it reads as a fill).
        const framesLeft = Math.max(8, Math.round((beatSec * 1000) / FRAME_MS));
        this.#roll = { start, len, pos: 0, framesLeft, pending, startFrames: Math.round((startSec * 1000) / FRAME_MS) };
        this.#b?.destroy();
        this.#b = null;
        this.#fading = false;
        this.#startClock();
    }

    /** Copy a 20ms output frame into the rolling recent-output ring buffer. */
    #captureRecent(view: ArrayLike<number>): void {
        const buf = this.#recent;
        const n = view.length;
        for (let i = 0; i < n; i++) {
            buf[this.#recentPos] = clamp(view[i]!);
            this.#recentPos = (this.#recentPos + 1) % buf.length;
        }
        this.#recentFilled = Math.min(this.#recentFilled + n, buf.length);
    }

    #nextDither(): number {
        this.#ditherSeed = (Math.imul(this.#ditherSeed, 1664525) + 1013904223) >>> 0;
        const a = this.#ditherSeed / 0x1_0000_0000;
        this.#ditherSeed = (Math.imul(this.#ditherSeed, 1664525) + 1013904223) >>> 0;
        const b = this.#ditherSeed / 0x1_0000_0000;
        return a - b;
    }

    #finalizeFloatFrame(src: Float32Array, gain: number, dst: Int16Array): void {
        for (let i = 0; i < src.length; i++) {
            const v = src[i]! * gain;
            const dither = v !== Math.trunc(v) && Math.abs(v) < KNEE_THRESH ? this.#nextDither() : 0;
            dst[i] = finalizeFloatSample(v, dither);
        }
    }

    /**
     * Emit one frame of the spinback: read `#recent` backwards at a falling speed so
     * the pitch drops like a record braking. Returns true when the brake has slowed
     * to a stop (time to cut to the new track).
     */
    #emitSpinbackFrame(): boolean {
        const sb = this.#spinback!;
        const buf = this.#recent;
        const vo = this.#viewOut;
        const frames = buf.length / CHANNELS;
        for (let i = 0; i < SAMPLES_PER_FRAME; i++) {
            // Linear interpolation between the two nearest sample-frames — as the
            // speed drops below 1, nearest-neighbour reads would hold samples and
            // alias (gritty); interpolating makes the pitch glide smoothly.
            const f0 = Math.floor(sb.read);
            const frac = sb.read - f0;
            const i0 = ((f0 % frames) + frames) % frames;
            const i1 = (i0 + 1) % frames;
            const a0 = i0 * CHANNELS;
            const a1 = i1 * CHANNELS;
            vo[i * CHANNELS] = (buf[a0]! * (1 - frac) + buf[a1]! * frac) | 0;
            vo[i * CHANNELS + 1] = (buf[a0 + 1]! * (1 - frac) + buf[a1 + 1]! * frac) | 0;
            // Walk backwards by `speed` frames; ease the speed toward 0 (the brake).
            sb.read -= sb.speed;
            sb.speed *= 0.9988; // ~0.6s to slow to a near-stop
        }
        this.#applyGain(vo);
        this.push(Buffer.from(this.#out));
        // Done when nearly stopped or we've consumed all the buffered history.
        return sb.speed < 0.06;
    }

    /**
     * Emit one frame of the beat-repeat roll: loop the captured slice forward,
     * halving its length every few frames so the repeats speed up. Returns true
     * when the roll's time budget is spent (cut to the new track).
     */
    #emitRollFrame(): boolean {
        const r = this.#roll!;
        const buf = this.#recent;
        const vo = this.#viewOut;
        // Crossfade the loop seam: near the loop end, blend in the loop start so the
        // repeat doesn't click where the waveform jumps. ~3ms window in samples.
        const xfade = Math.min(CHANNELS * 144, r.len >> 2); // ≤ a quarter of the loop
        for (let i = 0; i < SAMPLES_PER_FRAME; i++) {
            const p = r.pos % r.len;
            const read = (idx: number) => {
                const j = (((r.start + idx) % buf.length) + buf.length) % buf.length;
                return j - (j % CHANNELS);
            };
            const base = read(p);
            let l = buf[base]!;
            let rr = buf[base + 1]!;
            // In the seam window, mix the tail with the loop's beginning.
            if (xfade > 0 && p >= r.len - xfade) {
                const g = (r.len - p) / xfade; // 1 → 0 across the window
                const head = read(p - (r.len - xfade));
                l = (l * g + buf[head]! * (1 - g)) | 0;
                rr = (rr * g + buf[head + 1]! * (1 - g)) | 0;
            }
            vo[i * CHANNELS] = l;
            vo[i * CHANNELS + 1] = rr;
            r.pos += CHANNELS;
        }
        r.framesLeft--;
        // Every ~6 frames, halve the loop length (repeats get twice as fast), down to
        // an eighth of a beat — the accelerating stutter.
        if (r.framesLeft % 6 === 0 && r.len > SAMPLES_PER_FRAME * CHANNELS) {
            r.len = Math.max(SAMPLES_PER_FRAME * CHANNELS, Math.floor(r.len / 2));
            r.pos = 0;
        }
        this.#applyGain(vo);
        this.push(Buffer.from(this.#out));
        return r.framesLeft <= 0;
    }

    // ── Paced clock: emit exactly one 20ms Discord frame per tick ──
    //
    // setInterval(20ms) is not honoured precisely and its error accumulates: over a
    // few minutes the stream drifts off real time and Discord's jitter buffer slowly
    // starves or overflows, which is heard as periodic glitches. Instead we target
    // absolute frame deadlines with a self-rescheduling timeout and compensate for
    // any lateness, so the long-run rate stays exactly 50 frames/s.

    #startClock(): void {
        if (this.#clock) return;
        this.#nextFrameAt = Date.now() + FRAME_MS;
        this.#scheduleTick();
    }

    #scheduleTick(): void {
        const delay = Math.max(0, this.#nextFrameAt - Date.now());
        this.#clock = setTimeout(() => this.#tick(), delay);
    }

    #stopClock(): void {
        if (this.#clock) clearTimeout(this.#clock);
        this.#clock = null;
    }

    #tick(): void {
        this.#clock = null;

        // Spinback phase: emit the recent output played BACKWARDS with a slowdown,
        // then swap in the pending deck and resume normal playback.
        if (this.#spinback || this.#roll) {
            const done = this.#spinback ? this.#emitSpinbackFrame() : this.#emitRollFrame();
            if (done) {
                const fx = (this.#spinback ?? this.#roll)!;
                this.#spinback = null;
                this.#roll = null;
                this.#a?.destroy();
                this.#b?.destroy();
                this.#b = null;
                this.#fading = false;
                this.#a = fx.pending;
                this.#warmupTicks = 0;
                // The pending deck starts at its beat-aligned intro, NOT at 0:00.
                // Resetting to 0 made the next transition wait for a position the
                // file never reaches → the deck drained → the whole mix stopped.
                this.#framesPlayed = fx.startFrames;
            }
            this.#nextFrameAt += FRAME_MS;
            const now2 = Date.now();
            if (this.#nextFrameAt < now2 - FRAME_MS) this.#nextFrameAt = now2 + FRAME_MS;
            this.#scheduleTick();
            return;
        }

        const a = this.#a;
        if (!a) return;

        if (this.#rendered && a === this.#rendered.deck && a.drained) {
            const rendered = this.#rendered;
            rendered.deck.destroy();
            this.#a = rendered.pending;
            this.#rendered = null;
            this.#warmupTicks = 0;
            this.#framesPlayed = rendered.startFrames;
            this.#events.onTransitionEnd?.();
            this.#nextFrameAt += FRAME_MS;
            const now2 = Date.now();
            if (this.#nextFrameAt < now2 - FRAME_MS) this.#nextFrameAt = now2 + FRAME_MS;
            this.#scheduleTick();
            return;
        }

        // End-of-stream: primary drained and not fading.
        if (a.drained && !this.#fading) {
            this.#endRequested = true;
            this.#stopClock();
            this.#events.onEmpty?.();
            this.push(null);
            return;
        }

        // During warm-up, ffmpeg may not have produced bytes yet. Emit silence for
        // a few ticks (keeps the stream alive) rather than racing or ending early.
        const oneFrameSamples = SAMPLES_PER_FRAME;
        const mixed = this.#mixDiscordFrame(oneFrameSamples);
        if (!mixed) {
            this.#warmupTicks++;
            if (this.#warmupTicks > 250) {
                // ~5s with no audio at all → give up on this deck.
                log.warn(`Deck ${a.id} produced no audio; ending.`);
                this.#stopClock();
                this.#events.onEmpty?.();
                this.push(null);
                return;
            }
        } else {
            this.#warmupTicks = 0;
            this.#framesPlayed++; // count only real (non-silent) audio frames
            const mix = this.#floatOut;
            // Acapella layer: the previous track's vocal over the new beat (additive).
            if (this.#acapella) this.#applyAcapella(mix);
            // DJ narration rides on top: duck the music and sum in the voice clip
            // (in place, before capturing for spinbacks so the replay matches output).
            if (this.#voiceOver || this.#duck < 1) this.#applyVoiceOver(mix);
            this.#captureRecent(mix); // keep a rolling pre-volume buffer for spinbacks
            this.#finalizeFloatFrame(mix, this.#gain, this.#viewOut); // volume + limiter + quantize last
        }
        // The scratch frame is reused next tick, so hand the consumer its own copy.
        // (Silence is immutable and shared, so it can be pushed directly.)
        const ok = this.push(mixed ? Buffer.from(this.#out) : SILENCE_DISCORD_FRAME);
        // Respect backpressure: if the consumer's buffer is full, stop the clock and
        // wait for _read() (Node calls it when the consumer wants more). Pushing past
        // a `false` return breaks the readable signal — the root cause of stalled audio.
        if (!ok) {
            this.#stopClock();
            return;
        }

        // Advance the deadline by exactly one frame and schedule the next tick
        // relative to it (drift-compensated). If we fell so far behind that the next
        // deadline is already in the past, snap forward rather than firing a burst of
        // catch-up ticks that would overflow the consumer.
        this.#nextFrameAt += FRAME_MS;
        const now = Date.now();
        if (this.#nextFrameAt < now - FRAME_MS) this.#nextFrameAt = now + FRAME_MS;
        this.#scheduleTick();
    }

    /** Build one full 20ms float frame (960 stereo samples), mixing/fading as needed. */
    #mixDiscordFrame(samples: number): boolean {
        const a = this.#a!;
        const need = samples * FLOAT_SAMPLE_FRAME_BYTES;
        const fo = this.#floatOut;

        if (!this.#fading) {
            // Hold off until the deck has a cushion of audio buffered (or has ended)
            // — reading on the very first byte risks an underrun a frame later. A
            // transient mid-track underrun (buffered, not drained) also yields
            // silence, but the deep readable buffer means that's vanishingly rare.
            if (!a.primed && !a.drained) return false;
            if (a.available === 0) return false;
            // Read into the input scratch buffer; smoothly ramp any
            // shortfall down to zero instead of a hard cut (avoids an end-of-data
            // click — only relevant on the very last partial frame of a track).
            const got = a.readFloatInto(this.#scratchA);
            if (got === 0) return false;
            if (got < need) rampTailToZero(this.#viewA, got / FLOAT_SAMPLE_FRAME_BYTES);
            fo.set(this.#viewA);
            return true;
        }

        // Crossfading: mix A and B sample-by-sample with complementary gains.
        const b = this.#b!;
        if (a.available === 0 && b.available === 0 && !a.drained && !b.drained) {
            return false; // both warming up
        }

        const gotA = a.readFloatInto(this.#scratchA);
        const gotB = b.readFloatInto(this.#scratchB);
        if (gotA === 0 && gotB === 0) return false;
        // Ramp shortfalls to zero rather than a hard zero-fill so a deck running a
        // hair dry mid-fade doesn't inject a click into the blend.
        if (gotA < need) rampTailToZero(this.#viewA, gotA / FLOAT_SAMPLE_FRAME_BYTES);
        if (gotB < need) rampTailToZero(this.#viewB, gotB / FLOAT_SAMPLE_FRAME_BYTES);

        const va = this.#viewA;
        const vb = this.#viewB;
        const total = this.#fadeTotalFrames;
        const baseFrame = this.#fadeFrame;
        const eq = this.#eqSweep;
        const equalPower = this.#equalPower;
        const filter = this.#transition === "filter";
        const echo = this.#transition === "echo";
        const bassdrop = this.#transition === "bassdrop";
        const gate = this.#transition === "gate";
        const riser = this.#transition === "riser";
        const echoBuf = this.#echoBuf;
        const echoLen = echoBuf?.length ?? 0;
        // Gate: mute deck A on a beat-locked 1/8-note rhythm (half a beat per cycle),
        // measured in samples for sample-accurate, click-free gating.
        const gateCycleSamples = Math.max(SAMPLES_PER_FRAME, Math.round(SAMPLE_RATE * this.#beatSec * 0.5));

        for (let i = 0; i < samples; i++) {
            const t = (baseFrame + i / samples) / total;
            const tc = t > 1 ? 1 : t;
            const idx = i * CHANNELS;

            if (riser) {
                // Build-up: A plays under a rising filtered-noise swell until ~85% (the
                // build), then over a short window the noise+A fall away and B "drops"
                // in. The drop is a quick crossfade (not an instant flip) → no click.
                const build = Math.min(1, tc / 0.85);
                // dropMix: 0 before the drop → 1 just after; ramps over ~tc 0.85→0.89.
                const dropMix = tc <= 0.85 ? 0 : tc >= 0.89 ? 1 : (tc - 0.85) / 0.04;
                const noise = (Math.random() * 2 - 1) * PCM_MAX;
                const cutoff = 200 + build * build * 6000;
                const nL = highpass(noise, cutoff, this.#hpA0);
                const nR = highpass(noise, cutoff, this.#hpA1);
                const noiseGain = (1 - dropMix) * build * build * 0.5; // swell, then gone
                const gA = (1 - dropMix) * (Math.cos((build * Math.PI) / 2) * 0.7 + 0.3);
                const gB = dropMix; // B swells in over the drop window
                fo[idx] = va[idx]! * gA + nL * noiseGain + vb[idx]! * gB;
                fo[idx + 1] = va[idx + 1]! * gA + nR * noiseGain + vb[idx + 1]! * gB;
            } else if (gate) {
                // Rhythmic gate on A, fading out; B fades in underneath. Phase is
                // SAMPLE-accurate (not just per-frame) and the gate edges are softened
                // with a short raised-cosine ramp so the open/close doesn't click.
                const samplePos = baseFrame * SAMPLES_PER_FRAME + i;
                const phase = (samplePos % gateCycleSamples) / gateCycleSamples;
                const open = gateEnvelope(phase); // 0..1, soft edges, ~50% duty
                const gA = Math.cos((tc * Math.PI) / 2) * open;
                const gB = Math.sin((tc * Math.PI) / 2);
                fo[idx] = va[idx]! * gA + vb[idx]! * gB;
                fo[idx + 1] = va[idx + 1]! * gA + vb[idx + 1]! * gB;
            } else if (echo && echoBuf) {
                // Echo-tail out: deck A's dry level fades fast, while it feeds a delay
                // line with feedback that rings out over the fade. Deck B fades in
                // underneath. The line stores only A's INPUT (fed by a fading send) so
                // the feedback can't self-oscillate or clip — the tail decays cleanly.
                const dryA = Math.cos((tc * Math.PI) / 2) ** 2; // fade A's dry signal out
                const gB = Math.sin((tc * Math.PI) / 2);
                const send = 1 - tc; // less new signal enters the echo as we cross over
                const fb = 0.5; // feedback < 1 → bounded, decaying repeats
                for (let ch = 0; ch < CHANNELS; ch++) {
                    const j = idx + ch;
                    const delayed = echoBuf[this.#echoPos]!;
                    // Feed a FADING send of A into the float line + bounded feedback.
                    // `send` decaying + fb<1 keeps the tail from pumping.
                    echoBuf[this.#echoPos] = va[j]! * send + delayed * fb;
                    this.#echoPos = (this.#echoPos + 1) % echoLen;
                    // Output = dry A (fading) + the echo tail + incoming B.
                    fo[j] = va[j]! * dryA + delayed + vb[j]! * gB;
                }
            } else if (bassdrop) {
                // Bass-drop: B layers in its highs+mids over A, but its BASS is held
                // back until the drop (~60% through), then the bass swaps A→B. The swap
                // ramps over a short window (not an instant flip) so it doesn't click.
                const gA = Math.cos((tc * Math.PI) / 2);
                const gB = Math.sin((tc * Math.PI) / 2);
                // bassMix: 0 = A owns the bass, 1 = B owns it. Smooth around tc=0.6.
                const bassMix = tc <= 0.58 ? 0 : tc >= 0.62 ? 1 : (tc - 0.58) / 0.04;
                const aBassGain = 1 - bassMix;
                const bBassGain = bassMix;
                for (let ch = 0; ch < CHANNELS; ch++) {
                    const j = idx + ch;
                    const [aLo, aMi, aHi] = splitBands(va[j]!, ch === 0 ? this.#bandA0 : this.#bandA1);
                    const [bLo, bMi, bHi] = splitBands(vb[j]!, ch === 0 ? this.#bandB0 : this.#bandB1);
                    const aOut = (aMi + aHi + aLo * aBassGain) * gA;
                    const bOut = (bMi + bHi + bLo * bBassGain) * gB;
                    fo[j] = aOut + bOut;
                }
            } else if (filter) {
                // Filter transition: sweep a high-pass UP on the outgoing track so its
                // bass (then mids) drop away, while the incoming track fades in — the
                // classic DJ "filter out". Cutoff rises 20Hz → ~3.5kHz across the fade.
                const cutoff = 20 + tc * tc * 3480; // ease-in so the bass leaves first
                const aL = highpass(va[idx]!, cutoff, this.#hpA0);
                const aR = highpass(va[idx + 1]!, cutoff, this.#hpA1);
                const gA = Math.cos((tc * Math.PI) / 2); // fade the filtered A out
                const gB = Math.sin((tc * Math.PI) / 2); // fade B in
                fo[idx] = aL * gA + vb[idx]! * gB;
                fo[idx + 1] = aR * gA + vb[idx + 1]! * gB;
            } else if (eq) {
                // Professional 3-band transition: split both tracks into low/mid/high
                // and cross-blend each band on its own curve (highs first, then mids,
                // then lows) — the "bass swap" that avoids muddy bassline clashes.
                const g = bandGains(tc);
                // Left
                const [aLoL, aMiL, aHiL] = splitBands(va[idx]!, this.#bandA0);
                const [bLoL, bMiL, bHiL] = splitBands(vb[idx]!, this.#bandB0);
                fo[idx] = aLoL * g.a[0] + aMiL * g.a[1] + aHiL * g.a[2] + bLoL * g.b[0] + bMiL * g.b[1] + bHiL * g.b[2];
                // Right
                const [aLoR, aMiR, aHiR] = splitBands(va[idx + 1]!, this.#bandA1);
                const [bLoR, bMiR, bHiR] = splitBands(vb[idx + 1]!, this.#bandB1);
                fo[idx + 1] =
                    aLoR * g.a[0] + aMiR * g.a[1] + aHiR * g.a[2] + bLoR * g.b[0] + bMiR * g.b[1] + bHiR * g.b[2];
            } else {
                // Plain equal-power crossfade (blend/fade/cut without EQ).
                const gA = equalPower ? Math.cos((tc * Math.PI) / 2) : 1 - tc;
                const gB = equalPower ? Math.sin((tc * Math.PI) / 2) : tc;
                fo[idx] = va[idx]! * gA + vb[idx]! * gB;
                fo[idx + 1] = va[idx + 1]! * gA + vb[idx + 1]! * gB;
            }
        }

        this.#fadeFrame++;
        if (this.#fadeFrame >= this.#fadeTotalFrames) {
            a.destroy();
            this.#a = b;
            this.#b = null;
            this.#fading = false;
            // B has been playing throughout the blend, starting at its intro offset.
            this.#framesPlayed = this.#bStartFrames + this.#fadeTotalFrames;
            this.#events.onTransitionEnd?.();
        }
        return true;
    }

    /** Stop all decks and end the stream. */
    close(): void {
        this.#stopClock();
        this.#a?.destroy();
        this.#b?.destroy();
        this.#a = this.#b = null;
        this.discardPrepared();
        this.#discardRendered();
        this.#acapella?.deck.destroy();
        this.#acapella = null;
        if (!this.destroyed) this.destroy();
    }

    override _read(): void {
        // The consumer (e.g. @discordjs/voice in pull mode) wants more data. If the
        // clock was paused for backpressure, restart it to resume real-time pacing.
        // We only restart while a deck is active and the stream hasn't ended.
        if (!this.#clock && this.#a && !this.#endRequested) this.#startClock();
    }
}

const SILENCE_DISCORD_FRAME = Buffer.alloc(DISCORD_FRAME_BYTES);

/**
 * How far BEFORE its bar line the incoming deck starts (output seconds). The fire
 * moment lands 0–20ms past the outgoing track's bar line (frame quantization), so
 * the incoming deck needs at least that much lead to trim away — leaving its bar
 * exactly ON the line. 50ms covers the worst case with margin.
 */
export const B_PRE_ROLL_SEC = 0.05;

/**
 * Output-seconds to trim from the incoming deck so its bar line coincides with the
 * outgoing track's (sample-accurate, instead of a constant 20–40ms-late "flam"):
 * the next mixed frame starts at `playedSec`, the bar line was at `barAtPlaySec`,
 * and the incoming stream carries `preRollSec` of lead before its own bar.
 * Exported for unit tests.
 */
export function alignTrimSec(playedSec: number, barAtPlaySec: number, preRollSec = B_PRE_ROLL_SEC): number {
    const trim = playedSec - barAtPlaySec + preRollSec;
    return Math.min(0.2, Math.max(0, trim));
}

/** Pre-resample filter chain for an INCOMING deck (loudness gain, then stretch). */
function incomingFilters(loudnorm?: string, tempoRatio = 1): string[] {
    const filters: string[] = [];
    if (loudnorm) filters.push(loudnorm);
    const tempoFilter = tempoStretchFilter(tempoRatio);
    if (tempoFilter) filters.push(tempoFilter);
    return filters;
}

/** Identity of a deck spawn — a prepared deck is only reused on an exact match. */
function deckKey(filePath: string, startSec: number, filters: string[]): string {
    return `${filePath}|${startSec.toFixed(3)}|${filters.join(",")}`;
}

/** Music level while the DJ is speaking over it (≈ -10 dB), so the voice is clear. */
const DUCK_GAIN = 0.32;
/** Per-frame glide toward the duck target (≈40ms in/out at 50fps) — click-free. */
const DUCK_EASE = 0.5;

/**
 * One frame of the duck-gain glide: ease `current` toward `target` (exponential),
 * snapping exactly to 1 once it's effectively back up so idle frames stay bit-exact.
 * Exported (with {@link clamp}) so the voice-over mix math is unit-testable without
 * spawning ffmpeg.
 */
export function duckStep(current: number, target: number): number {
    const next = current + (target - current) * DUCK_EASE;
    return target === 1 && next > 0.999 ? 1 : next;
}

/** Above this fraction of full-scale, the soft knee starts bending peaks. */
const SOFT_KNEE = 0.85;
const KNEE_THRESH = PCM_MAX * SOFT_KNEE; // ~27852
/** Headroom between the knee and full-scale that the knee compresses into. */
const KNEE_RANGE = PCM_MAX - KNEE_THRESH;

function boundPcm(v: number): number {
    return v > PCM_MAX ? PCM_MAX : v < PCM_MIN ? PCM_MIN : v;
}

function softLimitSample(v: number): number {
    if (!Number.isFinite(v)) return 0;
    const mag = v < 0 ? -v : v;
    if (mag <= KNEE_THRESH) return v;
    const sign = v < 0 ? -1 : 1;
    const over = (mag - KNEE_THRESH) / KNEE_RANGE; // 0 at knee, grows past it
    // tanh maps [0,∞) → [0,1): the more it's over, the more it's compressed,
    // asymptotically approaching full-scale but never exceeding it.
    return sign * (KNEE_THRESH + KNEE_RANGE * Math.tanh(over));
}

export function finalizeFloatSample(v: number, dither = 0): number {
    return boundPcm(Math.round(softLimitSample(v) + dither));
}

/**
 * Soft-limiting replacement for a hard clamp. Summing two tracks during a
 * crossfade can push transient peaks past full-scale; hard-clipping them adds a
 * harsh buzz/crackle. Instead we leave everything below {@link SOFT_KNEE} of
 * full-scale bit-exact and smoothly round off only the peaks above it (a tanh-ish
 * knee), so loud blends stay clean instead of clipping. Still bounded to s16.
 */
export function clamp(v: number): number {
    return finalizeFloatSample(v);
}

/**
 * Soft-edged rhythmic gate envelope for a cycle phase in [0,1): ~50% duty, but the
 * open→closed and closed→open edges ramp over a short window (raised-cosine) so the
 * gate doesn't click. Open for the first ~half, closed for the rest.
 */
const GATE_EDGE = 0.08; // fraction of the cycle spent ramping each edge
function gateEnvelope(phase: number): number {
    if (phase < GATE_EDGE) return 0.5 - 0.5 * Math.cos((phase / GATE_EDGE) * Math.PI); // ramp up
    if (phase < 0.5 - GATE_EDGE) return 1; // open
    if (phase < 0.5) return 0.5 + 0.5 * Math.cos(((phase - (0.5 - GATE_EDGE)) / GATE_EDGE) * Math.PI); // ramp down
    return 0; // closed
}

/** Number of stereo sample-frames to fade over when a read comes up short. */
const RAMP_FRAMES = 48; // 1ms @48kHz — inaudible as a fade, but kills the click

/**
 * A read produced `filledFrames` of the {@link SAMPLES_PER_FRAME} we needed. Fade
 * the last few real samples down to zero and zero the rest, so the buffer ends on
 * a clean zero crossing instead of snapping from a non-zero sample straight to 0
 * (which clicks). Operates on the interleaved stereo PCM view in place.
 */
function rampTailToZero(view: Float32Array | Int16Array, filledFrames: number): void {
    const rampStart = Math.max(0, filledFrames - RAMP_FRAMES);
    for (let f = rampStart; f < filledFrames; f++) {
        const g = (filledFrames - f) / (filledFrames - rampStart); // 1 → ~0
        const idx = f * CHANNELS;
        view[idx] = view[idx]! * g;
        view[idx + 1] = view[idx + 1]! * g;
    }
    // Zero everything past the real data.
    view.fill(0, filledFrames * CHANNELS);
}
