/**
 * The DJ Narrator's phrase bank: what the bot *says* at the "big moments" of a set
 * (a drop, a bold transition, the set starting, the queue running dry). A human DJ
 * doesn't talk over every blend — they speak when something happens — so we only
 * narrate a handful of events and otherwise stay out of the music's way.
 *
 * Phrases form a matrix `lang × style × event → string[]`, each pool holding a few
 * variants so repeated events don't sound like a stuck record. {@link pickPhrase}
 * fills the `{title}` / `{artist}` / `{bpm}` / `{key}` placeholders with real grid
 * data and rotates deterministically (keyed off a seed) so the choice is stable per
 * track-pair rather than random per render.
 */

/** Spoken language (must match the loaded Piper voice model). */
export type NarratorLang = "de" | "en";

/** DJ persona — picks the *tone* of the phrasing. */
export type NarratorStyle = "club" | "radio" | "chill" | "meme" | "pro";

/**
 * The "big moments" worth speaking on. Deliberately NOT every transition — normal
 * blends stay silent (max ~0-1 announcement per song).
 */
export type NarratorEvent =
    /** The set/mix is starting (first track). */
    | "start"
    /** A high-energy drop / bass-drop transition is landing. */
    | "drop"
    /** A bold, attention-grabbing move (spinback, hard cut). */
    | "bigTransition"
    /** The queue is nearly empty — nudge for more tracks. */
    | "queueLow"
    /** The queue is empty — the set is winding down. */
    | "queueEmpty";

/** Data available to fill placeholders in a phrase. */
export interface PhraseContext {
    /** Clean song title of the *incoming* track (no junk). */
    title?: string | undefined;
    /** Real artist of the incoming track, if known. */
    artist?: string | null | undefined;
    /** Folded BPM of the incoming track, if analysed. */
    bpm?: number | undefined;
    /** Camelot key of the incoming track, if analysed. */
    key?: string | undefined;
}

type Pools = Record<NarratorEvent, string[]>;
type StylePools = Record<NarratorStyle, Pools>;
type LangPools = Record<NarratorLang, StylePools>;

// ── German ──────────────────────────────────────────────────────────────────
const DE: StylePools = {
    club: {
        start: [
            "Wir gehen rein, der Mix startet!",
            "DJ-Mode aktiviert — lehnt euch zurück!",
            "Queue geladen, wir starten!",
        ],
        drop: ["Jetzt kommt der Drop!", "Festhalten — der Bass kommt!", "Und jetzt hoch mit der Energie!"],
        bigTransition: ["Sauberer Wechsel!", "Nächster Track kommt rein!", "Wir ziehen rüber — {title}!"],
        queueLow: ["Letzte Tracks in der Liste.", "Die Queue wird leer — schickt Nachschub."],
        queueEmpty: ["Queue leer. Schickt mir neue Tracks.", "Das war der Mix. Wer hat noch Wünsche?"],
    },
    radio: {
        start: ["Ihr hört den Auto-DJ. Wir starten den Mix.", "Willkommen — als Nächstes läuft eure Queue."],
        drop: ["Und jetzt etwas mehr Druck.", "Wir heben die Energie an."],
        bigTransition: ["Als Nächstes: {title} von {artist}.", "Weiter geht's mit {title}."],
        queueLow: ["Die Playlist neigt sich dem Ende.", "Letzter Song in der Liste."],
        queueEmpty: ["Die Queue ist leer. Danke fürs Zuhören.", "Das war's vorerst — schickt neue Wünsche."],
    },
    chill: {
        start: ["Ich halte den Vibe entspannt. Los geht's.", "Wir starten smooth."],
        drop: ["Jetzt wird's etwas energetischer.", "Ein bisschen mehr Bewegung."],
        bigTransition: ["Sanfter Übergang zu {title}.", "Wir bleiben smooth — weiter mit {title}."],
        queueLow: ["Bald brauche ich neue Tracks.", "Die Liste wird kürzer."],
        queueEmpty: ["Queue leer — wir machen Pause.", "Das war der entspannte Teil."],
    },
    meme: {
        start: ["Yo Chat, wir sind live!", "Okay, ich regel den Abend — festhalten!"],
        drop: ["Chat, der nächste Drop wird wild!", "Festhalten Brüder, jetzt wird's ernst!", "Das wird gefährlich!"],
        bigTransition: [
            "Bruder, der Übergang war clean!",
            "Okay, wer hat {title} requested?",
            "Nächster Track — lass laufen!",
        ],
        queueLow: ["Chat, die Queue stirbt. Schickt was.", "Gleich leer — bewegt euch."],
        queueEmpty: ["Queue leer. Ihr habt einen Job: Songs schicken.", "Es ist still geworden, Chat."],
    },
    pro: {
        start: ["Mix gestartet. Übernehme die Übergänge.", "Auto-DJ aktiv. Transitions laufen."],
        drop: ["Energielevel wird angehoben.", "Drop wird eingeleitet."],
        bigTransition: ["Transition vorbereitet: {title}.", "Nächster Track wird synchronisiert."],
        queueLow: ["Queue fast leer.", "Letzter Track in der Warteschlange."],
        queueEmpty: ["Queue leer. Warte auf neue Tracks.", "Wiedergabeliste abgearbeitet."],
    },
};

// ── English ─────────────────────────────────────────────────────────────────
const EN: StylePools = {
    club: {
        start: ["Let's get into it — the mix is live!", "DJ mode on, sit back!", "Queue loaded, here we go!"],
        drop: ["Here comes the drop!", "Hold tight — bass incoming!", "Now turn it up!"],
        bigTransition: ["Clean switch!", "Next track coming in!", "Pulling it over — {title}!"],
        queueLow: ["Last few in the queue.", "Queue's running low — send more."],
        queueEmpty: ["Queue's empty. Send me new tracks.", "That's the mix. Who's got requests?"],
    },
    radio: {
        start: ["You're on the auto DJ. Starting the mix.", "Welcome — your queue is up next."],
        drop: ["And now, a little more push.", "Lifting the energy."],
        bigTransition: ["Up next: {title} by {artist}.", "Rolling on with {title}."],
        queueLow: ["The playlist's winding down.", "Last song on the list."],
        queueEmpty: ["The queue is empty. Thanks for listening.", "That's it for now — send new requests."],
    },
    chill: {
        start: ["Keeping the vibe easy. Here we go.", "Starting it smooth."],
        drop: ["Picking up the energy a touch.", "A little more movement now."],
        bigTransition: ["Easy transition into {title}.", "Staying smooth — on to {title}."],
        queueLow: ["I'll need new tracks soon.", "The list is getting short."],
        queueEmpty: ["Queue's empty — taking a break.", "That was the mellow stretch."],
    },
    meme: {
        start: ["Yo chat, we're live!", "Okay, I run the night now — hold on!"],
        drop: ["Chat, this next drop goes hard!", "Hold on, it's about to get serious!", "This is gonna be dangerous!"],
        bigTransition: ["Bro, that transition was clean!", "Okay, who requested {title}?", "Next one — let it ride!"],
        queueLow: ["Chat, the queue is dying. Send something.", "Almost empty — move it."],
        queueEmpty: ["Queue's empty. Your job: send songs.", "It got quiet, chat."],
    },
    pro: {
        start: ["Mix started. Handling the transitions.", "Auto DJ active. Transitions running."],
        drop: ["Raising the energy level.", "Initiating the drop."],
        bigTransition: ["Transition prepared: {title}.", "Next track syncing."],
        queueLow: ["Queue nearly empty.", "Last track in the queue."],
        queueEmpty: ["Queue empty. Awaiting new tracks.", "Playlist complete."],
    },
};

const PHRASES: LangPools = { de: DE, en: EN };

/** Fill `{title}`/`{artist}`/`{bpm}`/`{key}` in a template from the context. */
function fill(template: string, ctx: PhraseContext): string {
    return (
        template
            .replaceAll("{title}", ctx.title ?? "")
            .replaceAll("{artist}", ctx.artist ?? "")
            .replaceAll("{bpm}", ctx.bpm ? String(Math.round(ctx.bpm)) : "")
            .replaceAll("{key}", ctx.key ?? "")
            // Collapse any space left by an empty placeholder, tidy stray punctuation.
            .replace(/\s{2,}/g, " ")
            .replace(/\s+([.,!?])/g, "$1")
            .trim()
    );
}

/**
 * Pick a spoken line for an event. `seed` makes the choice deterministic (stable
 * per track-pair instead of random per render) while still rotating across a set.
 * Returns null when a pool is empty (caller should then simply stay silent).
 */
export function pickPhrase(
    lang: NarratorLang,
    style: NarratorStyle,
    event: NarratorEvent,
    ctx: PhraseContext = {},
    seed = 0,
): string | null {
    const pool = PHRASES[lang]?.[style]?.[event];
    if (!pool || pool.length === 0) return null;
    const idx = ((seed % pool.length) + pool.length) % pool.length;
    return fill(pool[idx]!, ctx);
}
