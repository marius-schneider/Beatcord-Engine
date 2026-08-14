import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createLogger } from "./logger";
import { parseTransitionTelemetryJsonl } from "./transition-analyzer";
import { buildTransitionFeedbackProfile, type TransitionFeedbackProfile } from "./transition-candidates";

const log = createLogger("TransitionFeedback");

export interface TransitionFeedbackStoreOptions {
    enabled: boolean;
    path: string;
    minRecords: number;
    refreshMs: number;
}

export class TransitionFeedbackStore {
    #enabled: boolean;
    #path: string;
    #minRecords: number;
    #refreshMs: number;
    #nextRefreshMs = 0;
    #cached: TransitionFeedbackProfile | null = null;
    #loading: Promise<TransitionFeedbackProfile | null> | null = null;

    constructor(options: TransitionFeedbackStoreOptions) {
        this.#enabled = options.enabled;
        this.#path = resolve(process.cwd(), options.path);
        this.#minRecords = options.minRecords;
        this.#refreshMs = Math.max(5_000, options.refreshMs);
    }

    async profile(): Promise<TransitionFeedbackProfile | null> {
        if (!this.#enabled) return null;
        const now = Date.now();
        if (now < this.#nextRefreshMs) return this.#cached;
        if (this.#loading) return this.#cached ?? (await this.#loading);

        this.#nextRefreshMs = now + this.#refreshMs;
        this.#loading = this.#load().finally(() => {
            this.#loading = null;
        });
        return this.#cached ?? (await this.#loading);
    }

    async #load(): Promise<TransitionFeedbackProfile | null> {
        if (!existsSync(this.#path)) {
            this.#cached = null;
            return null;
        }
        try {
            const parsed = parseTransitionTelemetryJsonl(await readFile(this.#path, "utf8"));
            if (parsed.skipped) log.warn(`ignored ${parsed.skipped} bad telemetry line(s) in ${this.#path}`);
            this.#cached = buildTransitionFeedbackProfile(parsed.records, { minRecords: this.#minRecords });
            return this.#cached;
        } catch (err) {
            log.warn(`load failed: ${(err as Error).message}`);
            return this.#cached;
        }
    }
}
