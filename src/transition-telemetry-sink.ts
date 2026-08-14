import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createLogger } from "./logger";
import {
    buildTransitionTelemetryRecord,
    type TransitionTelemetryInput,
    type TransitionTelemetryRecord,
} from "./transition-telemetry";

const log = createLogger("TransitionTelemetry");

export interface TransitionTelemetrySinkOptions {
    enabled: boolean;
    path: string;
}

export class TransitionTelemetrySink {
    #enabled: boolean;
    #path: string;

    constructor(options: TransitionTelemetrySinkOptions) {
        this.#enabled = options.enabled;
        this.#path = resolve(process.cwd(), options.path);
    }

    async record(input: TransitionTelemetryInput): Promise<TransitionTelemetryRecord | null> {
        if (!this.#enabled) return null;
        const record = buildTransitionTelemetryRecord(input);
        try {
            await mkdir(dirname(this.#path), { recursive: true });
            await appendFile(this.#path, `${JSON.stringify(record)}\n`, "utf8");
        } catch (err) {
            log.warn(`write failed: ${(err as Error).message}`);
        }
        return record;
    }
}
