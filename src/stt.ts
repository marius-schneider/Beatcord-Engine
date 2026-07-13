import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config } from "./config";
import { createLogger } from "./logger";

/**
 * Speech-to-text via **whisper.cpp** (`whisper-cli`) — local, free, no API key, and
 * the same binary on macOS (Metal) and Linux (CPU). We spawn it per utterance on a
 * 16kHz mono WAV and read the plain transcript from stdout.
 *
 * Everything is **best-effort**: a missing binary/model, a spawn failure, or a
 * timeout resolves to "" so the {@link VoiceListener} simply ignores that phrase.
 * Voice-commands never affect playback.
 */

const log = createLogger("STT");

const whisperPath = resolve(process.cwd(), config.WHISPER_PATH);
const modelPath = resolve(process.cwd(), config.WHISPER_MODEL);
// VAD model: enabled only if the file is actually present (graceful degrade).
const vadModelPath = config.WHISPER_VAD_MODEL ? resolve(process.cwd(), config.WHISPER_VAD_MODEL) : "";
const vadAvailable = vadModelPath !== "" && existsSync(vadModelPath);
if (config.WHISPER_VAD_MODEL && !vadAvailable) {
    log.warn(`VAD model not found (${config.WHISPER_VAD_MODEL}) — transcribing without VAD (more hallucinations).`);
}

/** Give up on a single transcription after this long (short clips finish in <1s). */
const STT_TIMEOUT_MS = 8000;
/** Cap concurrent whisper processes so a busy channel can't fork-bomb the CPU. */
const MAX_CONCURRENT = 2;
let active = 0;

/** Whether the STT binary + model are present (checked once, cached). */
let availability: boolean | null = null;
export function sttAvailable(): boolean {
    if (availability === null) {
        availability = existsSync(whisperPath) && existsSync(modelPath);
        if (!availability) {
            log.warn(
                `Voice commands disabled: whisper-cli or model not found ` +
                    `(${config.WHISPER_PATH}, ${config.WHISPER_MODEL}). Run scripts/setup-whisper.sh.`,
            );
        }
    }
    return availability;
}

/**
 * whisper.cpp prints bracketed noise tokens for non-speech ([BLANK_AUDIO], music,
 * etc.) and the occasional log line. Strip those and collapse whitespace so the
 * parser sees just the spoken words.
 */
function cleanTranscript(raw: string): string {
    return raw
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("whisper_") && !l.startsWith("["))
        .join(" ")
        .replace(/\([^)]*\)/g, " ") // (sounds), (music)
        .replace(/\s{2,}/g, " ")
        .trim();
}

/**
 * Transcribe a 16kHz mono WAV file to text, or "" on any failure / when STT isn't
 * available. Honours a small concurrency cap (over-cap calls resolve to "").
 */
export async function transcribe(wavPath: string, lang = config.WHISPER_LANG): Promise<string> {
    if (!sttAvailable()) return "";
    if (active >= MAX_CONCURRENT) {
        log.debug("STT busy — dropping utterance.");
        return "";
    }
    active++;
    try {
        return await new Promise<string>((res) => {
            const args = [
                "-m",
                modelPath,
                "-f",
                wavPath,
                "-nt", // no timestamps — just the text
                "-np", // no progress prints
                "-l",
                lang, // fixed language ≫ auto on short clips
            ];
            // VAD: transcribe only detected speech, dropping the silence/breath that
            // makes Whisper hallucinate "Vielen Dank"/"Amen". speech-pad keeps short
            // commands ("skip") from being clipped at the edges.
            if (vadAvailable) {
                args.push("--vad", "-vm", vadModelPath, "-vspd", "200", "-vp", "100");
            }
            const proc = spawn(whisperPath, args, { stdio: ["ignore", "pipe", "pipe"] });
            const out: Buffer[] = [];
            const timer = setTimeout(() => proc.kill("SIGKILL"), STT_TIMEOUT_MS);
            proc.stdout.on("data", (c: Buffer) => out.push(c));
            proc.stderr.on("data", (d: Buffer) => {
                const m = d.toString().trim();
                if (m) log.debug(`whisper: ${m}`);
            });
            proc.on("error", (e) => {
                clearTimeout(timer);
                log.debug(`whisper spawn failed: ${(e as Error).message}`);
                res("");
            });
            proc.on("close", () => {
                clearTimeout(timer);
                res(cleanTranscript(Buffer.concat(out).toString("utf8")));
            });
        });
    } finally {
        active--;
    }
}
