# Beatcord Audio Excellence Konzept 2026

Stand: 2026-06-20  
Ziel: Aus Beatcord einen maximal guten Discord-Musik-/DJ-/Entertainment-Bot bauen, ohne kostenpflichtige Tools. Ressourcenverbrauch ist nachrangig; Klang, Uebergaenge, Stabilitaet und Show-Faktor haben Prioritaet.

## Kurzfazit

Das absolute Limit setzt Discord Voice: 48 kHz Opus, Voice-Channel-Bitrate, Paketverlust und Client-Wiedergabe. Innerhalb dieser Grenze kann Beatcord aber deutlich naeher an ein "Club-Automix-System" heran: bessere Quellen, ein 32-bit-float Mixbus, Offline-Analyse pro Track, Stem-/Phrase-/Key-/Beatgrid-Wissen, hochwertige Time-Stretch/Pitch-Shift-Tools, genre- und situationsabhaengiges Mastering, und eine DJ-Entscheidungslogik, die nicht nur crossfadet, sondern musikalisch mixt.

Die wichtigste Architekturentscheidung:

> Beatcord sollte nicht versuchen, jeden Track "lauter und bassiger" zu machen. Beatcord sollte jeden Track verstehen, vorbereiten und dann kontrolliert in einen sauberen Masterbus mischen.

## Lokale Ist-Lage

- `Beatcord-Bot/bin/ffmpeg` existiert und ist FFmpeg `8.1.2`.
- `Beatcord-Bot/bin/yt-dlp` existiert und ist `2026.06.09`.
- Das vorhandene FFmpeg ist modern, aber nicht maximal ausgebaut: `--enable-libopus` ist vorhanden, `libsoxr`, `librubberband`, `lv2` und `ladspa` fehlen im aktuellen Build.
- Vorhandene FFmpeg-Filter sind trotzdem stark: `loudnorm`, `ebur128`, `acrossover`, `mcompand`, `acompressor`, `sidechaincompress`, `adynamicequalizer`, `firequalizer`, `anequalizer`, `apsyclip`, `asoftclip`, `alimiter`, `virtualbass`, `crossfeed`, `stereotools`, `haas`, `deesser`, `afftdn`.
- Beatcord nutzt bereits 48 kHz, stereo, 20-ms-Frames, Loudnorm, Safety-Limiter, Opus-Encoder-CTLs, Bitrate-Tuning bis Discord-Channel-Ceiling und DJ-Transition-Logik.
- Der groesste Qualitaetssprung liegt deshalb nicht in einem einzelnen Bass-Filter, sondern in einer neuen High-End-Audio-Pipeline.

## Harte Realitaeten

1. Discord bleibt der Engpass.
   Normale Voice-Channels gehen laut Discord-Dokumentation bis 96 kbps; Boost-Level erhoehen den Voice-Channel-Ceiling bis 128, 256 oder 384 kbps. Beatcord kann intern besser werden, aber der letzte Schritt ist immer Discord Opus.

2. Opus ist sehr gut, aber kein Lossless-System.
   Opus ist fuer interaktive Musik/Sprache gebaut, arbeitet bis 48 kHz Fullband und unterstuetzt sehr breite Bitraten. Fuer Musik sind saubere Pegel, Headroom und ein einziger finaler Encode wichtiger als extreme interne Bitraten.

3. "Mehr Bass" ist nicht automatisch besser.
   Bass frisst Headroom, triggert Limiter, verschmiert Crossfades und kann auf kleinen Lautsprechern schlechter klingen. Der High-End-Weg ist Bass-Management: Subbass kontrollieren, Low-End mono halten, Basslinien in Uebergaengen tauschen, dynamisch ducken und nur dann anheben, wenn Material und Modus passen.

4. Kostenlose Tools koennen Lizenzpflichten haben.
   Rubber Band ist frei nutzbar, aber GPL fuer Open-Source-Distribution beziehungsweise kommerzielle Lizenz fuer proprietaere Distribution. Essentia ist AGPL/proprietary dual-licensed. Demucs ist MIT, aber das Haupt-Repo ist nicht mehr aktiv maintained. Das ist keine Rechtsberatung, aber muss bewusst dokumentiert werden.

## Gold Signal Chain

Die Ziel-Pipeline sollte so aussehen:

```text
Quelle
  -> Download/Cache Original
  -> Offline-Analyse Sidecar
  -> Decode zu f32le 48 kHz stereo
  -> pro Deck: Trim, Loudness-Gain, Tempo/Key, EQ, FX, Stems
  -> 32-bit-float Mixbus mit Headroom
  -> Masterbus: Bass-Management, Dynamic EQ, Glue, Stereo, Limiter
  -> genau ein finaler Opus-Encode fuer Discord
```

### 1. Source Layer

Ziel: Das beste verfuegbare Ausgangsmaterial bekommen und unnoetige Lossy-Kaskaden vermeiden.

Empfehlungen:

- Native Opus bevorzugen, wenn Quelle und Mixing-Pfad es erlauben.
- Wenn gemixt, gefiltert oder analysiert wird: einmal sauber decodieren, intern float verarbeiten, am Ende einmal nach Opus encoden.
- `yt-dlp` auf Nightly/Master-Pfad aktuell halten, weil Stable laut yt-dlp-Projekt bei schnell brechenden Extractors oft hinterherhinkt.
- Pro Track nicht nur `.opus` cachen, sondern auch Sidecars:
  - `track.analysis.json`
  - `track.loudness.json`
  - `track.beatgrid.json`
  - `track.sections.json`
  - `track.stems.index.json`
  - `track.quality.json`
- Schlechte Quellen aktiv erkennen:
  - sehr niedrige echte Bandbreite
  - Clipping
  - Mono-Fake-Stereo
  - zu kurze/komische Uploads
  - Live-/Radio-Endlosstreams
  - laute Intros/Outros ohne Musik

### 2. Decode und Resampling

Aktuell arbeitet Beatcord am Ende mit `s16le`. Fuer maximale Qualitaet sollte der interne Mixbus auf `f32le` umgestellt werden.

Ziel:

- Decode: `f32le`, 48 kHz, stereo.
- Interne Summierung: Float32 mit mindestens 9 dB Headroom.
- Erst ganz am Ende auf das Format gehen, das `@discordjs/voice`/Opus braucht.
- Dither nur an Integer-Grenzen verwenden, nicht zwischen Float-Prozessstufen.

Toolchain:

- Kurzfristig: vorhandenes FFmpeg mit `aresample=resampler=swr:filter_size=256`.
- High-End: eigenes kostenloses FFmpeg-Build mit `--enable-libsoxr`.
- Fuer Tempo/Key: eigenes FFmpeg-Build mit `--enable-librubberband`.
- Fuer Plugin-DSP: eigenes FFmpeg-Build mit `--enable-lv2` und optional `--enable-ladspa`.

Beispiel-Zielbuild:

```text
--enable-gpl
--enable-version3
--enable-libopus
--enable-libsoxr
--enable-librubberband
--enable-lv2
--enable-ladspa
```

Wichtig: Diese Flags koennen die Lizenz-/Distributionssituation veraendern. Fuer Eigenbetrieb ist das meist einfacher als fuer verteilte Binaries.

### 3. Loudness und Headroom

Beatcord macht bereits zweipassiges `loudnorm` mit Ziel `-14 LUFS`, `-1.5 dBTP`, `LRA=11`. Das ist fuer Musik/Discord ein guter Entertainment-Startpunkt.

Upgrade:

- Offline pro Track messen:
  - Integrated LUFS
  - True Peak
  - Loudness Range
  - Short-term loudness curve
  - Crest factor
  - Clipping count
  - ReplayGain-kompatible Werte
- Nicht alles dynamisch normalisieren. Besser:
  - Track-Gain linear anwenden.
  - Masterbus-Limiter als Sicherheitsnetz.
  - Bei DJ-Blends vorher Headroom schaffen.
- Zielprofile einfuehren:
  - `clean`: -16 LUFS, weniger Limiting
  - `party`: -14 LUFS, kontrolliert punchy
  - `club`: -12 bis -13 LUFS, staerkerer Limiter, aber nur mit gutem True-Peak-Schutz
  - `late-night`: -18 LUFS, weniger Bass/Transienten

### 4. Masterbus

Der Masterbus ist die zentrale Klanginstanz. Alles, was "Beatcord klingt hochwertig" ausmacht, passiert hier kontrolliert.

Empfohlene Kette:

```text
Input gain staging
  -> DC blocker / highpass 20-30 Hz
  -> Bass management
  -> Dynamic EQ / multiband control
  -> Gentle glue compression
  -> Stereo safety
  -> Psychoacoustic bass / exciter optional
  -> Soft clipper
  -> True-peak limiter
  -> Opus encode
```

Kostenlose FFmpeg-Filter, die dafuer relevant sind:

- `highpass`, `lowpass`, `bass`, `treble`, `equalizer`, `anequalizer`, `firequalizer`
- `acrossover`, `mcompand`, `acompressor`, `sidechaincompress`
- `adynamicequalizer`, `adrc`
- `virtualbass`, `asubboost`, `aexciter`
- `crossfeed`, `stereotools`, `extrastereo`, `haas`
- `asoftclip`, `apsyclip`, `alimiter`
- `ebur128`, `loudnorm`, `astats`, `aspectralstats`

Mastering-Regeln:

- Bass unter 90-120 Hz mono-kompatibel halten.
- Keine permanente extreme Stereo-Widening-Kette. Widening nach Genre und nur mit Korrelationscheck.
- Limiter nicht als Lautmacher missbrauchen. Erst Headroom, dann Limiter.
- Subbass unter 25-30 Hz entfernen. Discord-User hoeren davon wenig, aber der Limiter reagiert darauf.
- Pro Guild A/B-Modus anbieten: `clean`, `warm`, `club`, `bass`, `radio`, `night`.

### 5. Equalizer

Beatcord sollte drei EQ-Ebenen bekommen:

1. User-/Guild-EQ
   Presets und manuelle Bander, z.B. Bass, Warmth, Presence, Air.

2. DJ-EQ
   Automatische 3- oder 4-Band-Isolator-Logik fuer Transitions.

3. Dynamic EQ
   Situativ gegen Matsch, harshness, zischende Vocals und Bass-Kollisionen.

Konkrete Presets:

- `club`: +1.5 dB 80 Hz, -1 dB 250 Hz, +1 dB 8-10 kHz, Glue.
- `bass-safe`: Subcut 25 Hz, Low-Shelf +2 dB 75-90 Hz, Limiter-Headroom extra.
- `voice-over`: 2-4 kHz Musik leicht ducken, Sidechain auf DJ-Voice.
- `headphones`: Crossfeed leicht, keine harte Haas-Breite.
- `phone-speaker`: Subbass cut, 120-180 Hz leicht staerken, Presence anheben.

### 6. Bass als eigenes System

Fuer "Bass, der gut knallt" braucht Beatcord ein Bass-Subsystem statt eines Bass-Sliders.

Bausteine:

- Low-band split via `acrossover` oder eigener Float-DSP.
- Bassline-Detection aus Spektrum und Stem/Beatgrid.
- Low-end mono unter 100 Hz.
- Subsonic highpass bei 25-30 Hz.
- Dynamic low shelf statt statischer Bassboost.
- Sidechain-Ducking zwischen outgoing und incoming Low-Band.
- Kick-aware transient hold: Kick bleibt vorne, Bass wird darunter geordnet.
- "Bass swap" in Transitions: outgoing low band raus, incoming low band erst am Drop rein.

DJ-Regel:

> Nie zwei volle Basslines gleichzeitig laufen lassen, ausser der Planner weiss, dass sie harmonisch und rhythmisch kompatibel sind.

### 7. Tempo, Key und Time-Stretch

Aktuell ist `atempo` der pragmatische Weg. Fuer High-End-DJ-Mixing sollte Rubber Band verwendet werden.

Ziel:

- BPM/Beatgrid pro Track offline bestimmen.
- Key/Camelot-Key bestimmen.
- Tempo-Anpassung mit Rubber Band statt einfachem `atempo`, wenn Pitch/Tempo unabhaengig bleiben sollen.
- Keylock fuer kleine Tempoaenderungen.
- Pitch-Shift nur musikalisch erlauben:
  - +/- 1 Halbton sehr gut nutzbar
  - +/- 2 Halbtone mit Vorsicht
  - groessere Shifts nur fuer Effekt/Mashup
- Formant-Erhalt fuer Vocal-/Acapella-Material, wenn Rubber Band verfuegbar.

Transition-Entscheidung:

- Wenn BPM-Differenz klein ist: beatmatchen.
- Wenn BPM-Differenz mittel ist: kurzer phrase-aligned mix oder loop bridge.
- Wenn BPM-Differenz gross ist: echo out, brake, spinback, cut, riser, narrator drop.

### 8. Offline-Analyse

Das ist der groesste Hebel. Beatcord soll einen Track nicht erst beim Abspielen verstehen.

Analyse-Sidecar:

```json
{
  "version": 1,
  "audio": {
    "durationSec": 0,
    "sampleRate": 48000,
    "channels": 2,
    "integratedLufs": -14.2,
    "truePeakDbtp": -1.1,
    "lra": 7.4,
    "clippingScore": 0,
    "spectralBandwidth": 0
  },
  "music": {
    "bpm": 128,
    "beatgrid": [],
    "downbeats": [],
    "key": "8A",
    "energyCurve": [],
    "sections": [],
    "vocalDensityCurve": [],
    "bassDensityCurve": []
  },
  "dj": {
    "introStart": 0,
    "mixIn": 16.0,
    "firstDrop": 64.0,
    "outroStart": 180.0,
    "mixOut": 196.0,
    "recommendedTransitions": []
  }
}
```

Kostenlose Analyse-Tools:

- Essentia: sehr stark fuer BPM, Key, Loudness, Spektrum, Segmentation, Mood/Descriptors. Lizenz beachten.
- aubio: Onsets, Beat/Tempo, Pitch, spectral tools.
- FFmpeg: `ebur128`, `loudnorm`, `astats`, `aspectralstats`, `silencedetect`.
- Demucs/UVR: Stem-Separation fuer Vocals, Drums, Bass, Other.
- Eigene Heuristiken: Energy curve, phrase grid, vocal density, transition confidence.

Analyse-Prioritaeten:

1. Loudness/true peak/quality score.
2. BPM + beatgrid + downbeat confidence.
3. Intro/outro/mix-in/mix-out.
4. Energy curve und first drop.
5. Key/Camelot.
6. Vocal density und bass density.
7. Stems nur fuer beliebte/gecachte Tracks oder wenn "Ultra Mode" aktiv ist.

### 9. Stems und Mashup-Modus

Wenn Ressourcen egal sind, sind Stems das groesste Show-Feature.

Kostenlose Optionen:

- Demucs `htdemucs_ft` fuer hoehere Qualitaet, aber langsamer.
- Demucs mit `--shifts` und Overlap fuer bessere Separation.
- UVR/MDX-Ensembles fuer Vocal-/Instrumental-Isolation.

Moegliche Features:

- Acapella vom alten Track ueber Beat vom neuen Track.
- Drum-only bridge fuer saubere BPM-Wechsel.
- Bassline rausziehen, wenn zwei Tracks kollidieren.
- Vocal-free intro/outro generieren.
- "Drop swap": Drums/Bass von Track B unter Vocal von Track A.
- Karaoke/Instrumental-Modus.
- DJ-Narrator spricht ueber ein automatisch geducktes Instrumental.

Risiko:

- Stems koennen Artefakte erzeugen. Deshalb immer Confidence/Quality speichern und nur bei gutem Ergebnis live verwenden.

### 10. Transition Brain

Beatcord sollte einen Transition Planner bekommen, der wie ein DJ denkt:

- Phrase alignment: 8/16/32 Bars.
- Beat alignment: Kicks nicht gegeneinander flam'en lassen.
- Harmonic mixing: Camelot-kompatible Keys bevorzugen.
- Energy management: nicht zufaellig von Peak zu Breakdown stolpern.
- Vocal conflict: zwei Vocals gleichzeitig vermeiden.
- Bass handover: nur eine Hauptbassline.
- Genre-aware: EDM anders als Hip-Hop, Pop anders als Chill.
- User intent: "mehr hype", "sanft", "hart cutten", "radio", "club".

Transition-Typen:

- `clean_equal_power`: unauffaelliger Standard.
- `bass_swap`: Club-Standard, Bass von A raus, Bass von B am Drop rein.
- `filter_out`: outgoing highpass/lowpass sweep.
- `echo_out`: A als Echo-Tail, B startet sauber.
- `riser_drop`: Build-up noise + Drop.
- `gate_roll`: rhythmische Gate-/Roll-Ueberleitung.
- `spinback`: Effektwechsel bei grosser BPM-/Key-Differenz.
- `brake`: Tape-stop in den naechsten Track.
- `loop_bridge`: 1/2/4-Bar Loop zum Beatmatching.
- `acapella_overlay`: Vocal-Stem ueber Instrumental/Intro.
- `drum_bridge`: Drum-Stem als neutrales rhythmisches Bett.
- `double_drop`: nur wenn BPM/Key/Energy/Bass passen.

Entscheidungslogik:

```text
if beatgrid_confidence high and bpm_delta small:
    phrase-aligned bass_swap/filter mix
else if key compatible and vocal_density low:
    longer harmonic blend
else if bpm_delta medium:
    loop_bridge or echo_out
else:
    effect cut: spinback/brake/riser/narrator drop
```

### 11. Discord-Ausgabe

Beatcord sollte die Voice-Channel-Grenzen aktiv nutzen und sichtbar machen.

Massnahmen:

- Channel-Bitrate beim Join auslesen und als Opus-Ziel setzen.
- Wenn Bot Rechte hat: optional einen "Beatcord HQ"-Channel mit maximal erlaubter Guild-Bitrate anlegen/anbieten.
- In Now-Playing/Diagnostics anzeigen:
  - Channel bitrate
  - Opus target bitrate
  - Encoder backend
  - DAVE/E2EE readiness
  - packet loss / reconnect events
- `@discordjs/voice` aktuell halten.
- `@discordjs/opus` bevorzugen.
- Crypto/DAVE-Dependencies beim Start loggen.
- 20-ms-Frame-Cadence stabil halten.
- Prebuffer und Backpressure respektieren.
- Unterruns als Audio-Fehler messen, nicht nur loggen.

### 12. Entertainment Layer

Wenn das Ziel "Entertainment System" ist, gehoert Audio-Intelligenz auch in die Show.

Features:

- Live-Waveform und Spektrum im Now-Playing.
- "Warum dieser Uebergang?" anzeigen: BPM, Key, Energy, Transition-Typ.
- DJ-Narrator mit Sidechain-Ducking.
- Crowd-Kommandos:
  - "mehr bass"
  - "hype mode"
  - "chill"
  - "drop incoming"
  - "keine vocals"
  - "smooth transitions"
- Automix-Profile:
  - `Radio`
  - `Club`
  - `Festival`
  - `Afterhour`
  - `Bass`
  - `Karaoke`
  - `Discovery`
- Highlight-Replay: letzte 30-60 Sekunden Mix als Clip speichern.
- Mix-Report nach Session: beste Drops, meistgehoerte Tracks, Energieverlauf.

## Konkrete Module

### `audio-runtime`

Verantwortung:

- FFmpeg Capability Check.
- Feature-Flags fuer `soxr`, `rubberband`, `lv2`, `ladspa`, `libopus`.
- Saubere Fehlermeldungen und Fallbacks.

Output:

```ts
{
  ffmpegVersion: "8.1.2",
  hasLibSoxr: false,
  hasRubberband: false,
  hasLv2: false,
  hasLadspa: false,
  filters: Set<string>
}
```

### `analysis-worker`

Verantwortung:

- Offline-Analyse pro Track.
- Sidecar schreiben.
- Versionierung und Reanalyse bei Pipeline-Aenderungen.
- CPU/GPU intensive Tasks getrennt vom Voice-Hotpath.

### `quality-scorer`

Verantwortung:

- Quelle bewerten.
- Warnen oder bessere Alternative suchen.
- Track nicht blind abspielen, wenn er technisch schlecht ist.

Scores:

- `sourceConfidence`
- `loudnessHealth`
- `clipRisk`
- `spectralHealth`
- `transitionReadiness`

### `float-mixbus`

Verantwortung:

- Interne Summierung in Float32.
- Deck-Gains, EQ, Crossfades, FX.
- Export zu finalem PCM/Opus-Pfad.

Warum:

- Weniger Quantisierungsfehler.
- Mehr Headroom.
- Sauberere Summierung bei 2-4 Decks, Stems, Voiceover und FX.

### `mastering-rack`

Verantwortung:

- Masterbus-Kette pro Guild/Profil.
- Dynamic EQ, Bass Management, Limiter.
- Telemetrie: gain reduction, peak, LUFS short-term.

### `transition-brain`

Verantwortung:

- Track A/B anhand Analyse vergleichen.
- Transition-Typ, Laenge, Cue-Punkte, FX-Kurve planen.
- Fallback bei niedriger Beatgrid-/Key-Confidence.

### `stems-service`

Verantwortung:

- Demucs/UVR optional ausfuehren.
- Stems cachen.
- Artefakt-Score berechnen.
- Nur gute Stems fuer Live-Mixing freigeben.

## FFmpeg Filtergraph-Ideen

### Clean Playback

```text
loudnorm=I=-14:TP=-1.5:LRA=11:...:linear=true,
highpass=f=25,
crossfeed=strength=0.12,
alimiter=limit=0.97:level=false:attack=5:release=50,
aresample=48000:resampler=soxr:precision=28:dither_method=triangular_hp
```

### Club Master

```text
highpass=f=28,
acompressor=threshold=-18dB:ratio=2:attack=15:release=220:makeup=1.5,
bass=g=1.5:f=85,
treble=g=1.0:f=9000,
apsyclip=level=0.98,
alimiter=limit=0.96:level=false:attack=3:release=70
```

### Bass-Safe Mode

```text
highpass=f=30,
bass=g=2.0:f=80,
adynamicequalizer=threshold=0.2:dfrequency=90:dqfactor=1:tfrequency=90:tqfactor=1:ratio=2,
alimiter=limit=0.94:level=false
```

### Voice-Over Ducking

```text
sidechaincompress=threshold=0.02:ratio=8:attack=20:release=250
```

### Beatmatched Tempo With Rubber Band

```text
rubberband=tempo=1.03125:transients=crisp:phase=laminar:pitchq=quality
```

Nur verfuegbar, wenn FFmpeg mit `--enable-librubberband` gebaut wurde.

## Prioritaetenplan

### Phase 1 - Foundation

- FFmpeg Capability Check implementieren.
- Dokumentieren, welcher FFmpeg-Build fuer "Ultra Mode" noetig ist.
- Unterruns, clipping, limiter activity und opus bitrate als Telemetrie loggen.
- Voice-Channel-Bitrate sichtbar machen.

### Phase 2 - Float Pipeline

- Internen Mixbus von `s16le` auf Float32 umstellen.
- Headroom-Policy einfuehren.
- Erst am finalen Ausgang quantisieren/encoden.
- Regression-Suite mit Test-Tracks und objektiven Metriken.

### Phase 3 - Analyse Sidecars

- Track-Analyse-Worker bauen.
- Loudness, true peak, clipping, BPM, beatgrid, key, sections speichern.
- Analyse-Versionierung.
- Queue/Planner nur noch mit Sidecar-Infos planen, Fallback wenn Analyse fehlt.

### Phase 4 - Mastering Rack

- Profile: `clean`, `party`, `club`, `bass`, `night`.
- Dynamic EQ und Bass-Management.
- Pro Guild A/B-Schalter.
- Objective metrics plus User-Feedback speichern.

### Phase 5 - Transition Brain 2.0

- Phrase-aware Planner.
- Key-/Energy-/Vocal-density-aware Transitions.
- Loop bridge, echo out, brake, riser, bass swap.
- Automatische Transition-Erklaerung fuer UI/Narrator.

### Phase 6 - Stems / Ultra Mode

- Demucs/UVR Worker.
- Stem Cache.
- Vocal-/Drum-/Bass-aware Transitions.
- Acapella overlay, drum bridge, double drop.
- Stem Quality Gate, damit Artefakte nicht live peinlich werden.

### Phase 7 - Entertainment System

- Live-Spectrum/Waveform.
- Crowd commands.
- Mix reports.
- Highlight replay.
- Session energy curve.

## Messung und QA

Nicht nach Gefuehl allein optimieren. Ein High-End-Audiobot braucht eine kleine Testbank.

Testset:

- 10 EDM tracks
- 10 Hip-Hop tracks
- 10 Pop tracks
- 10 Rock/Metal tracks
- 10 Chill/Lo-Fi tracks
- 10 problematische Tracks: leise, clipped, mono, altes Master, stark komprimiert

Metriken:

- Integrated LUFS
- Short-term LUFS Verlauf
- True Peak
- Clipping count
- Limiter gain reduction
- Spectral centroid/bandwidth
- Bass energy 30-120 Hz
- Stereo correlation
- Underruns
- Opus bitrate actually applied
- Packet/reconnect events

A/B-Vergleiche:

- current pipeline vs float pipeline
- swr vs soxr
- atempo vs rubberband
- no mastering vs clean/club/bass
- normal transition vs phrase-aware transition
- no stems vs stems transition

## Wichtigste Entscheidungen

1. Baue einen Ultra-FFmpeg-Build.
   Ohne `libsoxr` und `librubberband` bleibt Beatcord unter seinen Moeglichkeiten.

2. Stelle den Mixbus auf Float32 um.
   Das ist die Grundlage fuer echtes Multi-Deck-/Stem-/FX-Mixing.

3. Mache Analyse offline und persistent.
   Gute Uebergaenge entstehen aus Wissen ueber BPM, Phrase, Key, Energy, Vocals und Bass.

4. Behandle Bass als intelligentes Subsystem.
   Bassboost ist ein Effekt; Bass-Management ist Qualitaet.

5. Nutze Stems nur mit Quality Gate.
   Gute Stems sind spektakulaer, schlechte Stems ruinieren den Mix.

6. Miss alles.
   Ein Entertainment-System muss klingen, aber auch debugbar sein.

## Relevante Quellen

- Discord Voice Connections: https://docs.discord.com/developers/topics/voice-connections
- Discord Channel Bitrate Limits: https://docs.discord.com/developers/resources/channel
- Discord DAVE/E2EE Rollout: https://discord.com/blog/bringing-dave-to-all-discord-platforms
- discord.js voice 0.19.2: https://discord.js.org/docs/packages/voice/0.19.2
- discord.js Voice Guide: https://discordjs.guide/voice
- Opus Codec: https://opus-codec.org/
- RFC 6716 Opus: https://datatracker.ietf.org/doc/html/rfc6716
- FFmpeg Filters: https://ffmpeg.org/ffmpeg-filters.html
- FFmpeg Formats/HLS: https://ffmpeg.org/ffmpeg-formats.html#hls-2
- EBU R128 Loudness Recommendation: https://tech.ebu.ch/publications/r128/
- Rubber Band Library: https://breakfastquay.com/rubberband/
- SoX Resampler libsoxr: https://github.com/chirlu/soxr
- Essentia: https://essentia.upf.edu/
- aubio: https://aubio.org/manual/latest/
- Mixxx DJ Manual: https://manual.mixxx.org/2.5/en/chapters/djing_with_mixxx.html
- Demucs: https://github.com/facebookresearch/demucs
- Ultimate Vocal Remover: https://github.com/anjok07/ultimatevocalremovergui
- yt-dlp: https://github.com/yt-dlp/yt-dlp
