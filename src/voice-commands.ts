/**
 * Voice-command parser: turns a transcribed utterance ("Hey Beatcord, play daft
 * punk") into a typed {@link VoiceCommand}. Pure and deterministic so it's fully
 * unit-testable without any audio — the {@link VoiceListener} feeds it whisper's
 * output and dispatches the result to the player.
 *
 * Robust to how speech-to-text actually behaves: arbitrary casing, trailing
 * punctuation, filler around the wake-word, and German/English synonyms for each
 * action. A phrase that doesn't start with the wake-word (or matches no command)
 * returns null and is silently ignored.
 */

/** A recognised spoken command. */
export type VoiceCommand =
    | { kind: "skip" }
    | { kind: "pause" }
    | { kind: "resume" }
    | { kind: "stop" }
    | { kind: "loop" }
    | { kind: "shuffle" }
    | { kind: "previous" }
    | { kind: "clear" }
    | { kind: "nowPlaying" }
    | { kind: "volumeUp" }
    | { kind: "volumeDown" }
    | { kind: "play"; query: string };

/**
 * Keyword tables. Each command lists trigger phrases (English + German); the first
 * one that appears as a leading token-sequence of the (wake-word-stripped) text
 * wins. Longer/more-specific phrases are matched before shorter ones so e.g.
 * "clear queue" beats a bare "clear" and "play" doesn't swallow "previous".
 */
const SIMPLE_COMMANDS: { kind: Exclude<VoiceCommand, { kind: "play" }>["kind"]; phrases: string[] }[] = [
    // Multi-word / specific first.
    {
        kind: "clear",
        phrases: ["clear queue", "clear the queue", "queue leeren", "lösch die queue", "warteschlange leeren"],
    },
    {
        kind: "nowPlaying",
        phrases: [
            "what's playing",
            "whats playing",
            "now playing",
            "what is playing",
            "was läuft",
            "was läuft gerade",
            "welcher song",
        ],
    },
    { kind: "previous", phrases: ["previous", "go back", "last song", "zurück", "vorheriger", "letzter song"] },
    { kind: "shuffle", phrases: ["shuffle", "mischen", "durchmischen"] },
    { kind: "resume", phrases: ["resume", "unpause", "continue", "weiter", "weiterspielen", "fortsetzen"] },
    // "paws"/"pose" are how Whisper commonly mis-hears "pause".
    { kind: "pause", phrases: ["pause", "paws", "pose", "hold on", "pausiere", "anhalten", "stopp mal"] },
    { kind: "stop", phrases: ["stop", "stop playing", "stopp", "aufhören", "beenden"] },
    { kind: "loop", phrases: ["loop", "repeat", "wiederholen", "wiederholung"] },
    {
        kind: "skip",
        phrases: [
            "skip",
            "next",
            "next song",
            "next track",
            "skip this",
            "überspringen",
            "nächster",
            "nächster song",
            "weiter skippen",
        ],
    },
    { kind: "volumeUp", phrases: ["louder", "volume up", "turn it up", "lauter", "mach lauter"] },
    // "lizer"/"lyzer" are how whisper commonly renders "leiser".
    {
        kind: "volumeDown",
        phrases: ["quieter", "volume down", "turn it down", "softer", "leiser", "lizer", "lyzer", "mach leiser"],
    },
];

/** "play <query>" triggers — the rest of the phrase becomes the search query. */
const PLAY_TRIGGERS = ["play", "put on", "queue up", "spiel", "spiele", "spiel mal", "leg auf"];

/** Lowercase, strip punctuation, collapse whitespace. */
function normalise(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s']/gu, " ") // drop punctuation (keep letters/digits/apostrophe)
        .replace(/\s{2,}/g, " ")
        .trim();
}

/** Levenshtein edit distance between two short strings. */
function editDistance(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    let cur = new Array<number>(n + 1);
    for (let i = 1; i <= m; i++) {
        cur[0] = i;
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
        }
        [prev, cur] = [cur, prev];
    }
    return prev[n]!;
}

/** Similarity in [0,1] (1 = identical), normalised by the longer length. */
function similarity(a: string, b: string): number {
    const longer = Math.max(a.length, b.length);
    return longer === 0 ? 1 : 1 - editDistance(a, b) / longer;
}

/** Fillers that may sit between the wake-word and the command. */
const FILLER = /^(please|bitte|can you|could you|kannst du)\s+/u;

/**
 * Strip the wake-word from the front of a normalised phrase, FUZZILY — speech-to-text
 * mangles a coined name like "beatcord" into near-homophones ("bit code", "beat cord",
 * "bit caught", "be talked"). So instead of an exact prefix match, we test whether the
 * phrase's leading 1–3 words collapse to something close enough to the wake-word.
 * Returns the remaining command text, or null if the opening doesn't resemble it.
 */
function stripWakeWord(normText: string, wakeWord: string): string | null {
    // The wake-word's DISTINCTIVE part is the last token (the name: "dj", "beatcord").
    // A leading address word ("hey"/"yo"/…) is optional and often mis-heard or dropped,
    // so we match the core token on its own AND the full phrase, taking the better.
    const full = normalise(wakeWord).replace(/\s+/g, "");
    const tokens = normalise(wakeWord).split(" ");
    const core = tokens.at(-1)!; // "dj"
    const hasLead = tokens.length > 1; // wake-word includes a "hey"-style prefix
    if (!full) return null;

    const words = normText.split(" ");
    const maxLead = Math.min(4, words.length);
    let bestEnd = -1;
    let bestSim = 0;
    for (let take = 1; take <= maxLead; take++) {
        // (a) whole leading run vs the full wake-word ("heydj").
        const simFull = similarity(words.slice(0, take).join(""), full);
        // (b) the core name alone, allowing ONE optional short address word before it
        // ("yo dj", "ey dj", "hey dj") — that first word may be anything ≤3 chars.
        let simCore = similarity(words.slice(0, take).join(""), core);
        if (hasLead && take >= 2 && words[0]!.length <= 3) {
            simCore = Math.max(simCore, similarity(words.slice(1, take).join(""), core));
        }
        const sim = Math.max(simFull, simCore);
        if (sim > bestSim) {
            bestSim = sim;
            bestEnd = take;
        }
    }
    // 0.7: the core name is a real word now (Whisper transcribes it cleanly), so we can
    // be strict — well clear of unrelated speech, which scores far lower.
    if (bestSim < 0.7 || bestEnd < 0) return null;

    let rest = words.slice(bestEnd).join(" ").trim();
    rest = rest.replace(FILLER, ""); // "…please skip" / "…bitte skip"
    return rest;
}

/** Does `text` begin with `phrase` as whole words? */
function startsWithPhrase(text: string, phrase: string): boolean {
    return text === phrase || text.startsWith(phrase + " ");
}

/**
 * Parse a transcribed utterance into a command. `wakeWord` defaults to the configured
 * trigger. Returns null when the phrase isn't addressed to the bot or matches nothing.
 */
export function parseCommand(text: string, wakeWord = "hey dj"): VoiceCommand | null {
    const norm = normalise(text);
    if (!norm) return null;

    const rest = stripWakeWord(norm, wakeWord);
    if (rest === null || rest === "") return null;

    // Reject spelled-out / letter-salad transcripts ("E-D-J, L-E-A-R-V-U-T" → "l e a
    // r v u t"): when STT hears a name spelled letter by letter it produces a run of
    // single-character tokens, which would otherwise trip prefix matches. A command
    // always has at least one real (≥2-char) word.
    const realWords = rest.split(" ").filter((w) => w.length >= 2);
    if (realWords.length === 0) return null;

    // "play <query>" — take everything after the trigger as the search query.
    for (const trig of PLAY_TRIGGERS) {
        if (startsWithPhrase(rest, trig)) {
            const query = cleanQuery(rest.slice(trig.length));
            if (query) return { kind: "play", query };
            // "play" with nothing after it → treat as resume (a natural fallback).
            return { kind: "resume" };
        }
    }

    // German play phrasing puts the verb anywhere ("ich spiele X", "kannst du X
    // spielen?", "spiele X von Y"). Detect a spiel-verb token and take the rest as
    // the query — stripping leading politeness ("kannst du", "ich") and the trailing
    // verb when it's sentence-final.
    const play = germanPlay(rest);
    if (play) return play;

    // Simple commands — first matching leading phrase wins (table is ordered specific→general).
    for (const { kind, phrases } of SIMPLE_COMMANDS) {
        for (const p of phrases) {
            if (startsWithPhrase(rest, p)) return { kind } as VoiceCommand;
        }
    }

    // Fuzzy fallback: STT mangles command words too ("pause"→"paws", "überspringen"
    // →"uberspringian", "lauter"→"lotter"). Score the command text against every
    // phrase and take the best, IF it's clearly close — so an accent or a near-miss
    // still triggers, without firing on genuinely unrelated words.
    return fuzzyCommand(rest);
}

/** German "play" verb forms whisper produces ("spiel", "spiele", "spielen", "spielt"). */
const GERMAN_PLAY = /\b(spiel|spiele|spielen|spielt|spiel\s*mal)\b/;
/** Leading politeness/subject before a German play request. */
const GERMAN_PLAY_LEAD = /^(kannst du|kann ich|ich|bitte|mal)\s+/;

/**
 * Tidy a spoken search query: drop a trailing sentence-final verb ("… spielen"),
 * collapse "X von Y" → "X Y" (Whisper's German for "X by Y"), trim filler.
 */
function cleanQuery(raw: string): string {
    return raw
        .replace(GERMAN_PLAY, " ") // a verb that slipped into the query span
        .replace(/\bvon\b/g, " ") // "higher power von coldplay" → "higher power coldplay"
        .replace(/\bund\b/g, " ") // mis-heard "von" as "und"
        .replace(/\s{2,}/g, " ")
        .trim();
}

/**
 * Recognise German "play" phrasings where the verb isn't leading: "ich spiele X",
 * "kannst du X spielen", "spiele X von Y". Returns a play command with the cleaned
 * query, or null if there's no spiel-verb (so non-play German speech is ignored).
 */
function germanPlay(rest: string): VoiceCommand | null {
    if (!GERMAN_PLAY.test(rest)) return null;
    const query = cleanQuery(rest.replace(GERMAN_PLAY_LEAD, ""));
    return query ? { kind: "play", query } : { kind: "resume" };
}

/**
 * Best fuzzy match of `rest`'s leading word(s) against the command phrase table.
 * Returns the command when it clears a high bar, else null. Two ways to match:
 *  - PREFIX: the spoken word starts with (or is started by) the command word, for
 *    STT padding like "skipper"→"skip" or "lauder"→"laut(er)".
 *  - SIMILARITY ≥ 0.72: near-homophones like "uberspringian"≈"überspringen".
 * Compared space-stripped so "uber springian" ≈ "überspringen".
 */
function fuzzyCommand(rest: string): VoiceCommand | null {
    const words = rest.split(" ");
    let best: { kind: VoiceCommand["kind"]; score: number } | null = null;
    for (const { kind, phrases } of SIMPLE_COMMANDS) {
        for (const p of phrases) {
            const pWords = p.split(" ").length;
            const lead = words.slice(0, pWords).join("").replace(/'/g, "");
            const target = p.replace(/\s+/g, "").replace(/'/g, "");
            if (!lead || !target) continue;
            let score = similarity(lead, target);
            // Prefix either way: "skipper"⊃"skip", and a clipped "laut"⊂"lauter".
            // Both sides must be ≥4 chars so a 1–2-letter fragment ("le") can't claim
            // a longer phrase ("leg auf") — that's how letter-salad transcripts slipped through.
            if (target.length >= 4 && lead.length >= 4 && (lead.startsWith(target) || target.startsWith(lead))) {
                score = Math.max(score, 0.9);
            }
            if (!best || score > best.score) best = { kind, score };
        }
    }
    return best && best.score >= 0.72 ? ({ kind: best.kind } as VoiceCommand) : null;
}
