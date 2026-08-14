/** Minimal inline-volume control (the @discordjs/voice VolumeTransformer, or an adapter). */
export interface VolumeControl {
    setVolume(v: number): void;
    readonly volume: number;
}

/**
 * Drives the soft volume ramps (start/stop/pause/skip fades). It rides on whatever
 * inline {@link VolumeControl} is currently active — resolved fresh each tick via the
 * `control` getter — so it works identically for the normal resource and the automix
 * mix-deck adapter, and survives the control changing mid-fade.
 *
 * Click-free: linear-in-volume is fine for these short fades. One fade at a time; a
 * new fade (or {@link cancel}) settles the previous fade's promise so awaiting callers
 * never hang (an un-resolved await here would wedge the player's #busy guard).
 */
export class VolumeFader {
    /** One Discord frame. */
    static readonly STEP_MS = 20;

    #timer: ReturnType<typeof setInterval> | null = null;
    #resolve: (() => void) | null = null;

    /** @param control Returns the *current* volume control, or null if nothing is playing. */
    constructor(private readonly control: () => VolumeControl | null) {}

    /**
     * Ramp to `target` over `ms`, resolving when done. Cancels any in-flight ramp
     * first. Resolves immediately if nothing is playing or the delta is negligible.
     */
    fadeTo(target: number, ms: number): Promise<void> {
        this.cancel();
        const vol = this.control();
        if (!vol) return Promise.resolve();

        const steps = Math.max(1, Math.round(ms / VolumeFader.STEP_MS));
        const from = vol.volume;
        const delta = target - from;
        if (Math.abs(delta) < 1e-3) {
            vol.setVolume(target);
            return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
            this.#resolve = resolve;
            let i = 0;
            this.#timer = setInterval(() => {
                i++;
                const v = i >= steps ? target : from + (delta * i) / steps;
                this.control()?.setVolume(v);
                if (i >= steps) this.cancel(); // clears timer + resolves the promise
            }, VolumeFader.STEP_MS);
        });
    }

    /** Stop any in-flight ramp and settle its promise (so its awaiter doesn't hang). */
    cancel(): void {
        if (this.#timer) {
            clearInterval(this.#timer);
            this.#timer = null;
        }
        if (this.#resolve) {
            const resolve = this.#resolve;
            this.#resolve = null;
            resolve();
        }
    }
}
