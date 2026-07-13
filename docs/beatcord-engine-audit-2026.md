# Beatcord Engine Audit 2026

Stand: 2026-06-20  
Scope: `Beatcord-Engine/src/*.ts`, lokale Engine-Dependencies, Bot-Integrationskante zu Discord Voice.

## Kurzfazit

Die Engine ist insgesamt in gutem Zustand: TypeScript strict ist aktiv, Tests laufen gruen, der Mixer beachtet Backpressure, arbeitet mit festen 20-ms-Frames, soft-limitiert Summenpeaks und trennt die Plattformlogik sauber von Discord/HTTP. Die groessten Hebel liegen nicht in kleinen DSP-Tweaks, sondern in Produktionsrobustheit: Prozess-Timeouts, HLS-Lifecycle, Worker-Fehler, Lizenz-/Dependency-Bewusstsein und ein paar konkrete Parser-/UX-Kanten.

Verifikation:

- `bun test src`: 85 Tests bestanden.
- `bun run typecheck`: bestanden.
- `bun run lint`: bestanden, aber 2 Biome-Hinweise.
- `bun audit`: keine Vulnerabilities.
- `Beatcord-Bot/src/audio/*` sind fuer die Engine-Kernmodule groesstenteils Re-Export-Stubs auf `@beatcord/engine`, also keine echte Drift-Kopie.

## Wichtigste Findings

| Prioritaet | Bereich | Finding | Empfehlung |
|---|---|---|---|
| P1 | yt-dlp/Prozesse | `runYtdlp()` und `searchStream()` haben keinen harten Prozess-Timeout/Abort. Ein haengender yt-dlp-Prozess kann Semaphore-Slots blockieren und Queue/Prefetch wedgen. | Gemeinsamen `spawnWithTimeout()` Wrapper mit Kill, stderr/stdout Drain, Exit-Code und optionalem Caller-Abort einfuehren. |
| P1 | HLS/MixStation | `#startFfmpeg()` resolved nach 15s auch ohne Playlist und ueberwacht `ffmpeg`-Close nicht. HLS kann still tot sein. | Ready-Promise bei fruehem Exit rejecten, `close`/`error` verdrahten, Health-State expose'n, optional Restart-Policy. |
| P1 | Beatgrid Worker | Worker-`error` wird nur geloggt; in-flight Jobs koennen fuer immer pending bleiben und der Worker bleibt busy. | Per-Job Timeout, `messageerror`/`error` als Job-Resolution `null`, defekten Worker ersetzen, `closeBeatGridPool()` pending Jobs aufloesen. |
| P1 | Lizenz | `essentia.js` ist lokal als `AGPL-3.0` deklariert. Fuer einen oeffentlich betriebenen Server/Bot ist das bewusst zu klaeren. | Lizenzentscheidung dokumentieren; ggf. optionalen separaten Analyse-Service, Ersatzbibliothek oder kommerzielle/kompatible Loesung pruefen. Keine Rechtsberatung. |
| P2 | Voice Parser | `hey dj spiel mal Daft Punk` wird als Query `mal daft punk` erkannt, weil `spiel` vor `spiel mal` steht. | `PLAY_TRIGGERS` nach Laenge sortieren oder `spiel mal` vor `spiel` ziehen; Regressionstest ergaenzen. |
| P2 | Config API | `loadEngineConfig()` ruft in einer Library `process.exit(1)` auf. Das macht Import-Failure schwer testbar und kann Consumer hart beenden. | `parseEngineConfig(env)` werfen lassen, CLI/Consumer entscheiden ueber Exit. |
| P2 | HLS Segmentformat | HLS-Muxer erzeugt standardmaessig MPEG-TS-Segmente, Code benennt sie aber `seg_%05d.aac`. Das kann MIME/Client-Verhalten stoeren. | Fuer MPEG-TS `.ts` verwenden oder explizit `-hls_segment_type fmp4` plus `.m4s`/Init-Datei. |
| P2 | yt-dlp Stream | `searchStream()` liest `stderr` erst nach stdout-Ende. Bei viel stderr kann ein Child-Prozess blockieren. | stderr parallel sammeln/drainen wie in `runYtdlp()`. |
| P2 | Analyse Memory/CPU | Beatgrid startet pro Job mehrere ffmpeg-Decodes parallel (`samples`, Intro, Outro). Bei Pool=2 kann das kurzfristig CPU/RAM pushen. | Ein dekodiertes Analysefenster/Envelope wiederverwenden oder globale Analyse-Semaphore fuer ffmpeg-Decodes. |
| P2 | Essentia WASM | `key-essentia.ts` und `descriptors.ts` laden je eine eigene Essentia-Instanz. | Gemeinsames `essentia-runtime.ts` Singleton. |
| P3 | Lint | Biome meldet `voice-commands.ts:168` Template Literal und `beat-math.ts:83` Optional Chain. | Kleiner Cleanup, kein Verhaltensthema. |

## File-by-file Notizen

| Datei | Status | Notizen |
|---|---|---|
| `src/config.ts` | Review | Starke Zod-Basis. Risiko: `process.exit(1)` bei Import/Parse-Fehler (`loadEngineConfig`, Zeilen 76-83). |
| `src/constants.ts` | OK | 48 kHz/stereo/20 ms passt zu Discord/Opus. `aresample` + Limiter sind sinnvoll. |
| `src/index.ts` | OK | Saubere Export-Flaeche; Import von `config` bleibt wegen Side-Effect relevant. |
| `src/logger.ts` | OK | Testabdeckung vorhanden; nur ANSI/Highlighting. |
| `src/bounded-cache.ts` | OK | LRU+TTL simpel und getestet. |
| `src/cache.ts` | Review | LRU via mtime ist pragmatisch. Bei mehreren Prozessen kann paralleles Evicting race'n; `keep` schuetzt nur den aktuellen Aufruf. |
| `src/semaphore.ts` | OK | Simpel, getestet. Optional: Queue-Cancel/Timeout fuer abbrechbare yt-dlp-Jobs. |
| `src/ytdlp.ts` | Review | Gute Concurrency-Grenze und yt-dlp-Kommando-Probing. Risiken: kein harter Prozess-Timeout (`runYtdlp`, 217-242), `searchStream` stderr erst am Ende (517-541), Suchranking bestraft `remix/extended mix` pauschal (251-263), obwohl das fuer DJ-Use oft gewuenscht ist. |
| `src/mirror.ts` | OK/Review | Fetch-Timeouts vorhanden. Spotify-Embed-Scraping bleibt fragil; Odesli-Fallback ist gut. |
| `src/pcm.ts` | OK | Plattformneutraler PCM-Builder. Caller muss ffmpeg-Prozess sicher killen; kein eigenes Timeout. |
| `src/deck.ts` | OK/Review | Speicherfreundliche Chunk-Queue und Priming. `SIGKILL` sofort ist robust, aber fuer Cleanup hart. |
| `src/mixer.ts` | Stark | Gute Pacing-/Backpressure-Arbeit (`push()` wird beachtet), Soft-Knee, EQ-/FX-Moves, Prewarm. Testabdeckung fuer Duck/Clamp vorhanden; Integrationstests fuer Spinback/Roll/Backpressure waeren wertvoll. |
| `src/mixStation.ts` | Review | HLS-Sink ist der groesste offene Server-Pfad: keine Crossfade-Scheduling-Logik trotz Kommentar, Ready kann false-positive sein, Segmentextension `.aac` bei HLS-default MPEG-TS. |
| `src/beatgrid.ts` | Review | Worker-Pool ist richtig fuer Audio-Stabilitaet. Risiken: Worker-Fehler haengen Jobs; mehrere parallele ffmpeg-Decodes pro Analyse; `POOL_SIZE=2` ist fix statt config. |
| `src/beatgrid-worker.ts` | OK/Review | Try/catch antwortet auf normale Analysefehler. Prozess-/Worker-Absturz muss im Pool behandelt werden. |
| `src/beat-math.ts` | OK | Gute Phrase-/Bar-Logik, Tests vorhanden. Nur Biome Optional-Chain-Hinweis. |
| `src/transition-planner.ts` | Gut | DJ-Logik ist nachvollziehbar und getestet. Verbesserung: Konfigurierbare Profile fuer "original radio" vs "club/extended mix"; aktuell Heuristiken hart codiert. |
| `src/eq.ts` | OK | One-pole EQ ist billig und fuer Transitions ausreichend. Kein Issue. |
| `src/key.ts` | OK/Review | Eigene FFT ist sauber, aber fallback Key-Detection bleibt heuristic. Gut, dass Essentia primaer ist. |
| `src/key-essentia.ts` | Review | WASM-Vektoren werden geloescht. Gemeinsam mit `descriptors.ts` Singleton zentralisieren. |
| `src/descriptors.ts` | Review | Gleiche Essentia-Dopplung; Docs weisen auf evolving API hin. |
| `src/tempo.ts` | OK/Review | Aubio-Fallback gut. Lizenz der eigentlichen aubio-Basis bewusst dokumentieren; `aubiojs` Package selbst enthaelt MIT-Lizenzdatei. |
| `src/spectral.ts` | OK | Wird in `analyseSpectrum` teils dupliziert/integriert; als separates Export-Modul trotzdem sinnvoll. |
| `src/genre.ts` | OK/Review | Coarse Genre-Heuristik ist bewusst konservativ. Mehr Telemetrie/Offline-Auswertung wuerde Schwellen kalibrieren. |
| `src/loudness.ts` | Review | Gute zweipassige Loudnorm-Idee. `persist()` ist sync und schreibt nicht atomar; `CACHE_DIR` wird hier nicht erstellt. |
| `src/mastering.ts` | Review | Subtile Presets; Gefahr ist subjektiver Klang. Empfehlung: A/B-Schalter pro Guild und Telemetrie/Feedback. |
| `src/stems.ts` | Review | Best-effort, Concurrency=1, Timeout vorhanden. Demucs-Repo ist archiviert; langfristig alternativen Stem-Backend-Pfad planen. |
| `src/stt.ts` | OK/Review | Timeout/Concurrency vorhanden. Exit-Code wird nicht ausgewertet; nach Timeout kann theoretisch partial stdout als Text zurueckkommen. |
| `src/tts.ts` | OK/Review | Fetch-Timeout, Cache und Clip-Cap vorhanden. `wavToPcm()` hat keinen ffmpeg-Timeout; kleiner Robustheits-Fix. |
| `src/narrator.ts` | OK | Cooldown + fire-and-forget sauber. Event-Dedupe bei TTS-Fehler reserviert Slot, ist gewollt ruhig. |
| `src/narrator-phrases.ts` | OK | Tests decken Platzhalter/Rotation ab. |
| `src/voice-commands.ts` | Bug | Trigger-Reihenfolge fuer `spiel mal` fehlerhaft; Biome Template-Hinweis. |
| `src/lyrics.ts` | OK/Review | Fetch-Timeouts und Cache vorhanden. In-Memory-Cache ist unbounded; bei Langlaeufern besser `BoundedCache`. |
| `src/trackmeta.ts` | OK | Titelbereinigung getestet. |
| Tests | Gut/Gap | Viele pure Algorithmen getestet. Fehlend: Prozessfehler, Worker-Absturz, HLS-Startup/Exit, yt-dlp Timeout, Voice-Parser `spiel mal`. |

## 2026 Best Practices und Relevanz

### Discord.js / Discord Voice

- Discord Voice Gateway v8 ist der aktuelle Bezugspunkt; Discord dokumentiert v8 als empfohlen und mit gepuffertem Resume. Fuer eigene Voice-Implementierungen sind `seq_ack`, Resume und neue Encryption-Modes relevant. Quelle: https://docs.discord.com/developers/topics/voice-connections
- Discord hat DAVE/E2EE fuer Audio/Video-Kommunikation ab 2026 als Pflichtbereich beschrieben. Fuer Beatcord heisst das: Bot-Wrapper und `@discordjs/voice` aktuell halten, Dependency-Report regelmaessig loggen, DAVE-Support im Deploy pruefen. Quelle: https://discord.js.org/docs/packages/voice/0.19.2
- `@discordjs/voice` 0.19.2 verlangt Node.js 22.12.0 oder neuer und listet optionale Dependencies fuer Opus, Encryption und FFmpeg. Beatcord-Bot nutzt Bun; beim Compile/Deploy trotzdem sicherstellen, dass die Voice-Library-Anforderungen praktisch erfuellt sind. Quelle: https://discord.js.org/docs/packages/voice/0.19.2
- Audio Receive ist in `@discordjs/voice` als nicht stabil garantiert, weil Discord es nicht dokumentiert. Alles rund um Voice-Commands/STT sollte als best-effort bleiben und nie Playback blockieren. Quelle: https://discord.js.org/docs/packages/voice/0.19.2

### Opus / PCM / FFmpeg

- Opus ist weiterhin passend fuer interaktive Musik/Voice: 48 kHz fullband, Stereo, variable Bitrate und niedrige Latenz sind offizielle Kernfeatures. Quelle: https://opus-codec.org/
- libopus 1.6.1 wurde im Januar 2026 veroeffentlicht; pruefen, welche libopus-Version das gebundelte FFmpeg und `@discordjs/opus` effektiv nutzen. Quelle: https://opus-codec.org/
- FFmpeg `atempo` ist fuer Beatcords aktuelle +/-8%-Tempo-Sync-Range unkritisch; erst >2x muesste man laut FFmpeg mehrere `atempo`-Filter chainen. Quelle: https://ffmpeg.org/ffmpeg-filters.html
- FFmpeg HLS defaultet auf MPEG-TS-Segmente und `.ts`-Beispiele; fuer `.aac`-Namen besser Format explizit machen oder Extension korrigieren. Quelle: https://ffmpeg.org/ffmpeg-formats.html#hls-2
- Node-Streams: Backpressure ist entscheidend. Der Mixer macht hier schon das Richtige, weil `push()` Rueckgabewert beachtet wird. Quelle: https://nodejs.org/learn/modules/backpressuring-in-streams

### yt-dlp

- yt-dlp weist selbst darauf hin, dass `stable` durch Plattformaenderungen schnell "stale" sein kann und empfiehlt `nightly` fuer regelmaessige Nutzer. Beatcord sollte `scripts/update-ytdlp.ts`/Deploy so behandeln, dass kurzfristige Extractor-Fixes schnell ausgerollt werden koennen. Quelle: https://github.com/yt-dlp/yt-dlp#update
- Die vorhandenen Retry-/Socket-Optionen im Download sind gut; trotzdem braucht die Node/Bun-Seite einen Prozess-Deadline, weil ein Netzwerk-Timeout nicht alle Haengerklassen abdeckt.

### DJ Mixing / Automix

- Beatmatching besteht aus Tempo-Matching plus Beat-Phase-Alignment; Mixxx betont, dass korrekter BPM-Wert und korrektes Beatgrid Voraussetzung fuer automatische Syncs sind. Beatcords Worker-Pool/Beatgrid-Fokus ist damit genau am richtigen Hebel. Quelle: https://manual.mixxx.org/2.5/en/chapters/djing_with_mixxx.html
- Mixxx nennt Half-/Double-BPM-Sync explizit; Beatcords `tempoMatchRatio()` faltet half/double-time bereits sinnvoll. Quelle: https://manual.mixxx.org/2.5/en/chapters/djing_with_mixxx.html
- Harmonic Mixing plus Key Lock ist Standard-DJ-Technik. Beatcord hat Camelot-Scoring und tempo-stretching, sollte aber Pitch-/Keylock-Artefakte bei `atempo`/FFmpeg im Ohr behalten. Quelle: https://manual.mixxx.org/2.5/en/chapters/djing_with_mixxx.html
- Intro/Outro-Cues sind fuer Auto-DJ wichtig; Beatcords `detectIntro()` und `detectMusicalEnd()` gehen in diese Richtung. Mixxx markiert first/last sound anhand Pegel; Beatcord nutzt RMS-Huellen, sollte aber die Schwellen mit echten Sets evaluieren. Quelle: https://manual.mixxx.org/2.5/en/chapters/djing_with_mixxx.html
- Stems/Acapella-Moves sind technologisch sinnvoll, aber Demucs upstream ist seit 2025 archiviert. Den Backend-Pfad optional halten und Alternativen evaluieren. Quelle: https://github.com/facebookresearch/demucs

## Konkrete naechste Schritte

1. `voice-commands.ts` Bug fixen: `spiel mal` vor `spiel`, Test ergaenzen.
2. Gemeinsamen Process-Runner fuer yt-dlp/ffmpeg/whisper/piper-transcode bauen: Timeout, stderr-drain, exit-code, Kill, strukturierte Logs.
3. `MixStation` HLS-Hardening: Ready rejecten bei ffmpeg-Exit, Segmentextension korrigieren, Health-State testen.
4. Beatgrid-Pool robuster machen: Worker-Timeout, Crash-Recovery, config fuer Poolgroesse.
5. Essentia zentralisieren und Lizenzentscheidung dokumentieren.
6. Tests fuer Prozess-/HLS-/Worker-Fehlerpfade ergaenzen.

## Quellen

- Discord Voice Docs: https://docs.discord.com/developers/topics/voice-connections
- discord.js Voice Package Docs: https://discord.js.org/docs/packages/voice/0.19.2
- discord.js Voice Guide: https://discordjs.guide/voice
- FFmpeg Filters: https://ffmpeg.org/ffmpeg-filters.html
- FFmpeg HLS Muxer: https://ffmpeg.org/ffmpeg-formats.html#hls-2
- yt-dlp Update/Release Channels: https://github.com/yt-dlp/yt-dlp#update
- Opus Codec: https://opus-codec.org/
- Node.js Stream Backpressure: https://nodejs.org/learn/modules/backpressuring-in-streams
- Mixxx DJing Manual: https://manual.mixxx.org/2.5/en/chapters/djing_with_mixxx.html
- Mixxx Library/Search Manual: https://manual.mixxx.org/2.5/en/chapters/library.html
- Essentia.js: https://mtg.github.io/essentia.js/
- Demucs: https://github.com/facebookresearch/demucs
