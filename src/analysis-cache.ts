import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { config } from "./config";
import { createLogger } from "./logger";

const log = createLogger("analysis-cache");

export const ANALYSIS_CACHE_VERSION = 1 as const;
export const ANALYSIS_PIPELINE_VERSION = "analysis-cache-v1";

export type AnalysisComponentName =
    | "loudness"
    | "beatGrid"
    | "genre"
    | "structure"
    | "trackProfile"
    | "stemQuality"
    | "vocalActivity";

export interface AnalyzerDescriptor {
    analyzerVersion: string;
    modelVersion?: string;
    parameters?: unknown;
}

export interface AnalysisCacheComponent<T = unknown> {
    analyzerVersion: string;
    modelVersion?: string;
    parameterHash: string;
    createdAt: number;
    value: T;
}

export interface AnalysisCacheEntry {
    version: typeof ANALYSIS_CACHE_VERSION;
    analyzerVersion: typeof ANALYSIS_PIPELINE_VERSION;
    trackHash: string;
    trackId: string;
    createdAt: number;
    updatedAt: number;
    components: Partial<Record<AnalysisComponentName, AnalysisCacheComponent>>;
}

export interface AnalysisCacheOptions {
    directory?: string;
    now?: () => number;
}

function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .filter(([, item]) => item !== undefined)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, item]) => [key, canonical(item)]),
        );
    }
    if (typeof value === "number" && !Number.isFinite(value)) return String(value);
    return value;
}

function sha256(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

export function fingerprintAnalyzerParameters(parameters: unknown): string {
    return `sha256-${sha256(JSON.stringify(canonical(parameters)) ?? "undefined")}`;
}

export function analyzerFingerprint(descriptor: AnalyzerDescriptor): string {
    return fingerprintAnalyzerParameters({
        analyzerVersion: descriptor.analyzerVersion,
        modelVersion: descriptor.modelVersion ?? null,
        parameters: descriptor.parameters ?? null,
    });
}

export async function hashTrackFile(filePath: string): Promise<string> {
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(filePath)) hash.update(chunk as Buffer);
    return `sha256-${hash.digest("hex")}`;
}

function validComponent(value: unknown): value is AnalysisCacheComponent {
    if (typeof value !== "object" || value === null) return false;
    const component = value as Partial<AnalysisCacheComponent>;
    return (
        typeof component.analyzerVersion === "string" &&
        typeof component.parameterHash === "string" &&
        typeof component.createdAt === "number" &&
        Number.isFinite(component.createdAt) &&
        "value" in component
    );
}

function validEntry(value: unknown): value is AnalysisCacheEntry {
    if (typeof value !== "object" || value === null) return false;
    const entry = value as Partial<AnalysisCacheEntry>;
    return (
        entry.version === ANALYSIS_CACHE_VERSION &&
        entry.analyzerVersion === ANALYSIS_PIPELINE_VERSION &&
        typeof entry.trackHash === "string" &&
        /^sha256-[a-f0-9]{64}$/.test(entry.trackHash) &&
        typeof entry.trackId === "string" &&
        typeof entry.createdAt === "number" &&
        typeof entry.updatedAt === "number" &&
        typeof entry.components === "object" &&
        entry.components !== null &&
        Object.values(entry.components).every(validComponent)
    );
}

export function componentIsCurrent(
    component: AnalysisCacheComponent | undefined,
    descriptor: AnalyzerDescriptor,
): boolean {
    return (
        !!component &&
        component.analyzerVersion === descriptor.analyzerVersion &&
        component.modelVersion === descriptor.modelVersion &&
        component.parameterHash === fingerprintAnalyzerParameters(descriptor.parameters ?? null)
    );
}

export class AnalysisCache {
    readonly directory: string;
    #now: () => number;
    #writes = new Map<string, Promise<void>>();

    constructor(options: AnalysisCacheOptions = {}) {
        this.directory = resolve(options.directory ?? config.ANALYSIS_CACHE_DIR);
        this.#now = options.now ?? Date.now;
    }

    #path(trackHash: string): string {
        if (!/^sha256-[a-f0-9]{64}$/.test(trackHash)) throw new Error("invalid track hash");
        return resolve(this.directory, `${trackHash.slice(7)}.json`);
    }

    async #read(trackHash: string): Promise<AnalysisCacheEntry | null> {
        try {
            const value = JSON.parse(await readFile(this.#path(trackHash), "utf8")) as unknown;
            if (!validEntry(value) || value.trackHash !== trackHash) return null;
            return value;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !(error instanceof SyntaxError)) {
                log.debug(`analysis cache read failed: ${(error as Error).message}`);
            }
            return null;
        }
    }

    async load(trackHash: string): Promise<AnalysisCacheEntry | null> {
        await this.#writes.get(trackHash);
        return this.#read(trackHash);
    }

    get<T>(
        entry: AnalysisCacheEntry | null | undefined,
        name: AnalysisComponentName,
        descriptor: AnalyzerDescriptor,
    ): T | undefined {
        const component = entry?.components[name];
        if (!component || !componentIsCurrent(component, descriptor)) return undefined;
        return component.value as T;
    }

    set<T>(
        trackHash: string,
        trackId: string,
        name: AnalysisComponentName,
        descriptor: AnalyzerDescriptor,
        value: T,
    ): Promise<void> {
        const previous = this.#writes.get(trackHash) ?? Promise.resolve();
        const next = previous
            .catch(() => {})
            .then(async () => {
                const now = this.#now();
                const existing = await this.#read(trackHash);
                const entry: AnalysisCacheEntry = existing ?? {
                    version: ANALYSIS_CACHE_VERSION,
                    analyzerVersion: ANALYSIS_PIPELINE_VERSION,
                    trackHash,
                    trackId,
                    createdAt: now,
                    updatedAt: now,
                    components: {},
                };
                entry.trackId = trackId;
                entry.updatedAt = now;
                entry.components[name] = {
                    analyzerVersion: descriptor.analyzerVersion,
                    ...(descriptor.modelVersion ? { modelVersion: descriptor.modelVersion } : {}),
                    parameterHash: fingerprintAnalyzerParameters(descriptor.parameters ?? null),
                    createdAt: now,
                    value,
                };
                await mkdir(this.directory, { recursive: true });
                const target = this.#path(trackHash);
                const temporary = `${target}.${process.pid}.${now}.tmp`;
                await writeFile(temporary, `${JSON.stringify(entry)}\n`, "utf8");
                await rename(temporary, target);
            })
            .catch((error) => log.warn(`analysis cache write failed: ${(error as Error).message}`))
            .finally(() => {
                if (this.#writes.get(trackHash) === next) this.#writes.delete(trackHash);
            });
        this.#writes.set(trackHash, next);
        return next;
    }

    async drain(): Promise<void> {
        await Promise.all(this.#writes.values());
    }
}
