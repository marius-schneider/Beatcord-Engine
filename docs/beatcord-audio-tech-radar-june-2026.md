# Beatcord Audio Tech Radar - Juni 2026 Deep Dive

Stand: 2026-06-20  
Scope: Internet-Recherche, offizielle Docs, GitHub-Repos/Issues/Discussions, Package-Registry-Signale, oeffentliche Foren/Reddit, video-nahe Suchtreffer und lokaler Beatcord-/FFmpeg-Capability-Check. Private Chats oder geschlossene Discord-Server sind nicht einsehbar; oeffentliche Chat-Abbilder wie AnswerOverflow/GitHub/Reddit wurden als Praxis-Signale gewertet, nicht als alleinige Wahrheit.

## Executive Summary

Im Juni 2026 ist fuer Beatcord extrem viel moeglich, aber nicht mit einem einzelnen Tool. Die beste kostenlose High-End-Architektur ist ein Hybrid:

```text
Bun/TypeScript Voice Hotpath
  + custom FFmpeg 8.1.x Audio Build
  + Python/AI Offline Analysis Worker
  + Stem/UVR/Demucs Worker
  + persistent Track Sidecars
  + deterministic DJ Transition Brain
  + Discord Opus Output at channel ceiling
```

Die groessten Hebel:

1. Ein eigener FFmpeg-Build mit `libsoxr`, `librubberband`, `libopus`, optional `lv2`/`ladspa` und ggf. Whisper-Support.
2. Ein interner Float32-Mixbus statt frueher `s16le`-Summierung.
3. Offline-Analyse pro Track: Loudness, true peak, clipping, BPM, beatgrid, downbeats, phrase structure, key, energy, vocal density, bass density, cue points.
4. Stem-Separation als gecachter Ultra-Mode, nicht als blinder Live-Hotpath.
5. Bass-Management statt simplem Bassboost.
6. Discord/DAVE als harte Plattformbasis: Voice-Send muss aktuell bleiben; Voice-Receive ist 2026 durch DAVE besonders riskant.

## Was Beatcord lokal bereits hat

Gefunden:

- `/Users/marius/Workspace/Beatcord/Beatcord-Bot/bin/ffmpeg`
- `/Users/marius/Workspace/Beatcord/Beatcord-Bot/bin/yt-dlp`
- `/opt/homebrew/bin/ffmpeg`

Lokaler Stand:

- FFmpeg `8.1.2`, laut offizieller FFmpeg-Downloadseite am `2026-06-17` veroeffentlicht.
- yt-dlp `2026.06.09`.
- FFmpeg Build-Flags enthalten `--enable-libopus`, `--enable-gpl`, `--enable-version3`.
- FFmpeg Build-Flags enthalten nicht `--enable-libsoxr`, `--enable-librubberband`, `--enable-lv2`, `--enable-ladspa`.

Lokale wichtige Audio-Filter vorhanden:

- `loudnorm`
- `ebur128`
- `acrossover`
- `mcompand`
- `sidechaincompress`
- `adynamicequalizer`
- `apsyclip`
- `virtualbass`
- `arnndn`

Lokale Encoder:

- `libopus`
- `opus`
- `aac`
- `aac_at`

Interpretation:

Beatcord hat schon einen starken Audio-Werkzeugkasten. Fuer "Non Plus Ultra" fehlen aber genau die Bibliotheken, die man fuer hochwertige Tempo-/Pitch-Bearbeitung, Studio-Resampling und Plugin-Racks braucht.

## Plattform-Realitaet Discord 2026

### DAVE/E2EE ist Pflichtrealitaet

Discord sagt in seinem Mai-2026-Post, dass seit Anfang Maerz 2026 alle Voice-/Video-Calls, ausser Stage Channels, standardmaessig E2EE nutzen und Clients DAVE unterstuetzen muessen. Die Implementierung ist offen und auditiert.

Beatcord-Relevanz:

- `@discordjs/voice` aktuell halten.
- `@snazzah/davey` als DAVE-Dependency pruefen und im Start-Diagnostics-Report explizit anzeigen.
- Voice-Send ist Kernpfad. Voice-Receive fuer Voice Commands ist 2026 fragiler, weil Discord Receive nicht offiziell stabil dokumentiert ist und DAVE-Receive-Regressionen in Issues sichtbar waren.
- Voice Commands sollten Fallbacks haben: Text, Buttons, Slash Commands, Push-to-talk-Web-UI oder optionaler lokaler Audio-Input ausserhalb Discord.

### Discord-Bitrate bleibt die harte Qualitaetsdecke

Discord dokumentiert Voice-Channel-Bitrates:

- Normal: bis `96000`
- Boost Level 1: bis `128000`
- Boost Level 2: bis `256000`
- Boost Level 3 oder `VIP_REGIONS`: bis `384000`
- Stage Channels: bis `64000`

Beatcord-Relevanz:

- Beim Join Channel-Bitrate auslesen.
- Opus-Zielbitrate auf Channel-Ceiling setzen.
- In UI anzeigen: "HQ moeglich / Server boost fehlt / Stage channel ist begrenzt".
- Optional: Bot darf einen "Beatcord HQ" Voice Channel mit maximal erlaubter Bitrate anlegen, falls Rechte vorhanden.

### Opus bleibt richtig

Opus unterstuetzt laut offizieller Seite Musik und Sprache, 8-48 kHz Sampling, 2.5-60 ms Frame Sizes, Mono/Stereo und Bitraten von 6 bis 510 kb/s.

Beatcord-Relevanz:

- 48 kHz stereo ist korrekt.
- 20-ms-Frames bleiben sinnvoll fuer Discord.
- VBR + music signal + max complexity + Channel-Bitrate-Ceiling sind richtig.
- Interne Qualitaet bringt nur etwas, wenn der finale Opus-Encode nicht durch Clipping, Unterruns oder falsche Gain-Staging-Entscheidungen sabotiert wird.

## FFmpeg 2026 - Was wirklich wichtig ist

### Version

FFmpeg 8.1.2 "Hoare" ist am 2026-06-17 erschienen. Beatcords lokales FFmpeg ist damit praktisch topaktuell.

### Build wichtiger als Version

Fuer Beatcord ist nicht mehr "neueres FFmpeg" der erste Hebel, sondern "richtig gebautes FFmpeg".

Ziel-Build:

```text
--enable-gpl
--enable-version3
--enable-libopus
--enable-libsoxr
--enable-librubberband
--enable-lv2
--enable-ladspa
```

Optional fuer Zusatzfeatures:

```text
--enable-whisper
```

Falls Whisper-Filter im Build verfuegbar ist, kann man ASR/Voice-Command-Experimente direkt ueber FFmpeg denken. Fuer Produktions-Voice-Commands bleibt ein separater Whisper/whisper.cpp-Service oft einfacher kontrollierbar.

### FFmpeg-Filter, die Beatcord ausnutzen sollte

Schon vorhanden:

- `loudnorm`: zweipassige Loudness-Normalisierung.
- `ebur128`: Messung/Monitoring.
- `acrossover`: saubere Band-Splits fuer Bass/Mid/High.
- `mcompand`: Multiband-Dynamik.
- `sidechaincompress`: Voiceover-Ducking, Bassline-Ducking, Kick/Bass-Kontrolle.
- `adynamicequalizer`: dynamischer EQ.
- `apsyclip`/`asoftclip`: kontrolliertes Peak-Shaping vor Limiter.
- `alimiter`: Safety-Limiter.
- `virtualbass`: psychoakustischer Bass-Effekt, vorsichtig einsetzen.
- `arnndn`: RNN-Denoise, eher fuer Voice/Narrator als fuer Musik.

Fehlt im lokalen Build:

- `rubberband`: hochwertiges Time-Stretching/Pitch-Shifting.
- `soxr`: sehr hochwertiges Resampling.
- `lv2`/`ladspa`: Zugriff auf freie Studio-Plugins.

### FFmpeg-Architekturentscheidung

Kurzfristig:

- Aktuellen Build weiter nutzen.
- Audiofilter-Kette sauberer strukturieren.
- Capability-Check implementieren.

Ultra:

- Custom FFmpeg in `Beatcord-Bot/bin/ffmpeg-ultra`.
- `config.FFMPEG_PROFILE=standard|ultra`.
- Start-Diagnostics zeigen, ob Ultra aktiv ist.
- Tests schlagen fehl, wenn Ultra-Features erwartet werden und fehlen.

## DSP-Plugin-Welt: LV2/LADSPA/VST3

### LSP Plugins

LSP ist eine aktive Open-Source-Plugin-Sammlung. Die offizielle Seite listet CLAP, JACK, LADSPA, LV2, VST2/LinuxVST und VST3. LSP hatte 2026 noch Releases/Fixes.

Beatcord-Relevanz:

- Sehr spannend fuer Linux-Deployment und Offline-/Mastering-Rack.
- Kandidaten: Parametric EQ, dynamic processor, limiter, multiband compressor, sidechain tools, spectrum tools.
- Am besten ueber LV2 oder externen worker testen, nicht direkt blind im Voice-Hotpath.

### Calf Studio Gear

Calf bietet Compressor, Sidechain Compressor, Multiband Compressor, Deesser, Gate, Limiter, Multiband Limiter, Transient Designer und mehr. Calf ist aelter; Praxisforen weisen teils auf Phasen-/Crossover-Themen hin.

Beatcord-Relevanz:

- Als Experiment gut.
- Fuer "saubere Mastering-Pipeline" LSP/FFmpeg-native Filter priorisieren.
- Calf nicht ungemessen als finalen Bass-/Multiband-Master verwenden.

### Pedalboard

Spotify Pedalboard ist ein Python-Audio-Tool fuer Lesen, Schreiben, Rendering und Effekte. Es kann VST3 und Audio Units laden, bietet Compressor, Limiter, EQ/Filter, Reverb, PitchShift usw., und ist fuer Offline-Processing sehr interessant. Lizenz: GPL-3.0, also bewusst pruefen.

Beatcord-Relevanz:

- Sehr stark fuer Offline-Audio-Lab und A/B-Rendering.
- Nicht zwingend fuer Live-Discord-Hotpath.
- Gut fuer "render transition preview", "mastering preset bake", "dataset generation".

## Stem Separation und AI Audio 2026

### Status

Stem-Separation ist 2026 kein Gimmick mehr. DJ-Software wie VirtualDJ bewirbt Real-Time-Stems als Kernfeature; DJ.Studio beschreibt Stem-Workflows fuer busy transitions, acapella drops und breakdown stretching. Open Source ist nicht so integriert wie kommerzielle DJ-Apps, aber mit UVR/audio-separator/Demucs/MDX/Roformer praktisch nutzbar.

### Beste kostenlose Kandidaten

#### audio-separator

`audio-separator` ist 2026 der praktischste Headless-Kandidat fuer Beatcord:

- Python package + CLI.
- Nutzt UVR-Modelle.
- Unterstuetzt MDX-Net, VR Arch, Demucs und MDXC.
- Kann Instrumental/Vocals, Drums, Bass, Piano, Guitar usw. je nach Modell.
- Hat Docker, CUDA, CPU und Apple-Silicon/CoreML-Pfade.
- Kann Modelle listen/filtern und JSON ausgeben.
- Unterstuetzt Ensembling mehrerer Modelle.

Registry:

- PyPI JSON: `audio-separator 0.44.2`
- Lokale alte Python/Pip-Umgebung listet nur bis `0.18.0`, vermutlich wegen Python-Version/Resolver-Constraints.

Beatcord-Relevanz:

- Bester Einstieg fuer `stems-service`.
- Sidecar muss speichern: Modell, Version, SDR/Quality, Stem-Dateien, Artefakt-Score.
- Fuer beliebte Tracks vorrechnen, nicht bei jedem Play live.

#### UVR

Ultimate Vocal Remover ist weiterhin der praktische Modell-/Workflow-Hub. UVR v5.6 nennt u.a. Demucs-v1-v4- und MDX23C-Kompatibilitaet. GitHub-Discussions zeigen aber auch: AI-generierte Tracks wie Suno koennen trotz Ensembles deutliche Artefakte behalten.

Beatcord-Relevanz:

- Nie "Stem vorhanden" gleich "Stem gut" setzen.
- Quality Gate einfuehren.
- Bei Artefakten Fallback auf normalen Mix.

#### Demucs

Demucs v4/htdemucs bleibt ein wichtiger Standard fuer 4- oder 6-Stem-Separation, aber das Hauptrepo ist nicht mehr aktiv gepflegt.

Beatcord-Relevanz:

- Weiter nutzbar.
- Nicht als einziges Zukunftsfundament nehmen.
- Ueber `audio-separator` oder torchaudio pipeline kapseln.

#### MDX23C / Roformer / UVR Modelle

Die praktischen UVR-/audio-separator-Modelle sind 2026 wahrscheinlich relevanter als "nur Demucs". audio-separator listet z.B. Roformer-/MDXC-Modelle mit hohen SDR-Werten fuer Vocals/Instrumental.

Beatcord-Relevanz:

- Fuer Vocal/Instrumental eher MDXC/Roformer testen.
- Fuer Drums/Bass/Other Demucs/htdemucs_ft testen.
- Ensembling fuer Offline-Ultra-Mode erlauben.

### Was Beatcord mit Stems bauen kann

- Acapella von Track A ueber Instrumental/Drums von Track B.
- Drums-only bridge fuer BPM-Wechsel.
- Bassline von A ausblenden, Bassline von B erst am Drop rein.
- Vocal density detection: keine zwei vollen Vocals uebereinander.
- Karaoke/Instrumental Mode.
- Drop teaser: Vocal phrase als Sample vor Drop.
- Double-drop nur bei BPM/Key/Energy/Bass-Kompatibilitaet.
- Smart cleanup: outgoing drums/bass frueher runter, incoming groove frueher rein.

### Was Beatcord nicht tun sollte

- Keine permanenten Real-Time-Stems im Voice-Hotpath als Default.
- Keine schlechten Stem-Artefakte live erzwingen.
- Keine Stems ohne Modell-/Version-/Quality-Metadata cachen.
- Keine AI-Superresolution auf gute Quellen pauschal anwenden.

## Audio Enhancement / Restoration / Super-Resolution

### AudioSR

AudioSR ist ein MIT-lizenziertes Projekt fuer Audio Super-Resolution auf 48 kHz und kann niedrige Bandbreite aufwerten. Solche Modelle erzeugen aber neue Hochfrequenzinformationen, sie rekonstruieren nicht garantiert das Original.

Beatcord-Relevanz:

- Nur als Offline-Experiment fuer schlechte Quellen.
- Immer A/B, LUFS/TP/Spektrum und Blind-Listening testen.
- Nicht pauschal auf normale YouTube-Opus-Quellen anwenden.

### DeepFilterNet

DeepFilterNet ist ein Open-Source-Framework fuer full-band Speech Enhancement/Noise Suppression, mit Binary, Python, Rust-Teilen und LADSPA plugin.

Beatcord-Relevanz:

- Gut fuer Discord-Voice-Command-Input, Microphone/Narrator-Preprocessing, TTS cleanup.
- Nicht als Musik-Mastering-Filter verwenden, ausser bewusst getestet. Speech denoiser koennen Musik verzerren.

### FFmpeg Restoration

Vorhandene FFmpeg-Filter:

- `adeclick`
- `adeclip`
- `afftdn`
- `arnndn`
- `anlmdn`
- `dynaudnorm`
- `loudnorm`

Beatcord-Relevanz:

- Fuer schlechte User-Uploads/Voice/Clips gut.
- Fuer normale Musik nur sehr vorsichtig und offline.

## Music Information Retrieval und Analyse

### Essentia / essentia.js

Essentia ist eine der staerksten Open-Source-MIR-Bibliotheken: Key, BPM, beat tracking, loudness, spectral features, high-level descriptors, TensorFlow-Modelle. `essentia.js` laeuft laut Projekt im Browser und in Node.js und unterstuetzt real-time und offline audio analysis. Lizenz: AGPL-3.0 fuer `essentia.js`, also bewusst klaeren.

Beatcord-Relevanz:

- Fachlich sehr stark.
- Lizenz ist P1-Entscheidung.
- Wenn genutzt: als separater Analyse-Service mit klarer Lizenzdokumentation.

### librosa

`librosa 0.11.0` ist ein Standard-Python-Paket fuer Music/Audio Analysis und MIR-Building-Blocks.

Beatcord-Relevanz:

- Sehr gut fuer Offline-Features, Prototyping, beat/tempo/onset/segmentation.
- Nicht fuer harte Real-Time-Voice-Pipeline.

### aubio

`aubio 0.4.9` ist alt, aber stabil fuer onset, pitch, beat/tempo. Lizenz GPLv3.

Beatcord-Relevanz:

- Gut als Fallback/vergleichender Analyzer.
- Nicht blind alleiniger Beatgrid-Wahrheitstraeger.

### audioFlux

`audioFlux 0.1.9` ist eine C/Python-Bibliothek fuer Audio-/Musik-Analyse, Feature Extraction und Zeit-Frequenz-Analysen.

Beatcord-Relevanz:

- Interessant fuer Feature-Extraction und ML-Pipeline.
- Eher Research/Analysis Worker als Hotpath.

### libkeyfinder / keyfinder-cli

libkeyfinder ist eine C++-Library fuer musikalische Key Detection, heute im Mixxx-Umfeld relevant, GPLv3.

Beatcord-Relevanz:

- Gut fuer Harmonic Mixing/Camelot.
- Lizenz klaeren.
- Alternativ Essentia KeyExtractor oder eigene Krumhansl-Schmuckler/HPCP-Implementierung.

### madmom

madmom bleibt in MIR-Kreisen fuer Beat/Downbeat bekannt, ist aber package-seitig alt (`0.16.1`) und lizenz-/wartungsseitig vorsichtig zu behandeln.

Beatcord-Relevanz:

- Nur als Forschungsreferenz oder optionaler Analyzer.
- Nicht als Kernabhaengigkeit.

## JavaScript/WebAudio-Analyse

### Web Audio API / node-web-audio-api

MDN beschreibt Web Audio als modularen Audio-Routing-Graph fuer Quellen, Effekte, Visualisierung und Spatial Audio. `node-web-audio-api 2.0.0` bringt eine Web-Audio-API-Implementierung fuer Node.js auf Rust-Basis.

Beatcord-Relevanz:

- Gut fuer Visualizer, Browser-UI, Offline-Prototypen und isomorphe Analyse.
- Fuer den Voice-Hotpath bleibt FFmpeg/Float-DSP einfacher kontrollierbar.

### Meyda

`meyda 5.6.3` ist MIT und kann offline und real-time Audio Feature Extraction mit Web Audio.

Beatcord-Relevanz:

- Gut fuer Spektrum, MFCC, centroid, rolloff, chroma-nahe Visualizer/Features.
- Nicht ausreichend allein fuer DJ-Grade beatgrid/downbeat.

### realtime-bpm-analyzer / web-audio-beat-detector

- `realtime-bpm-analyzer 5.0.15`
- `web-audio-beat-detector 8.2.36`

Beatcord-Relevanz:

- Gut fuer UI/Browser/Realtime-Prototypen.
- Fuer automatische DJ-Transitions nicht allein vertrauen; Beatgrid braucht Offline-Analyse + Confidence.

## Auto-DJ und Transition Intelligence

### Was 2026 Standard wird

Praxisquellen und DJ-Software zeigen: moderne Automix-/DJ-Systeme bewegen sich weg von "Crossfade nach X Sekunden" hin zu:

- BPM/tempo matching.
- beat phase alignment.
- phrase alignment.
- key/harmonic mixing.
- energy curve.
- vocal-aware transitions.
- stem-aware cleanup.
- user-adjustable transition points.
- visual waveform/beat data.

Spotify/Apple/DJ.Studio/VirtualDJ zeigen dieselbe Richtung: Automix ist nicht mehr nur Fade, sondern Beatmatching, time-stretching, EQ/effects und waveform-/beat-datenbasierte Anpassung.

### Beatcord-Ziel

Beatcord sollte einen `transition-brain` bauen:

```text
inputs:
  track A sidecar
  track B sidecar
  guild mode
  crowd intent
  current energy
  channel bitrate / quality profile

outputs:
  transition type
  duration
  cue points
  deck gains
  EQ curves
  bass handover
  stem actions
  narrator cue
  confidence
```

### Transition-Algorithmen

Core:

- Equal-power phrase crossfade.
- Bass swap on phrase.
- Filter-out.
- Echo-out.
- Loop bridge.
- Brake/tape-stop.
- Spinback.
- Gate roll.
- Riser drop.

Ultra:

- Acapella teaser.
- Drum bridge.
- Vocal-over-instrumental.
- Double drop.
- Bassline-aware sidechain.
- Adaptive transition based on live short-term loudness/energy.

### Forum-Praxis-Signale

Reddit/Beatmatch-Praxis zum Low-EQ/Bass-Swap:

- Bass-Swaps sollten meist auf Phrase passieren.
- Zwei volle Basslines koennen sich ausloeschen oder zu laut addieren.
- Manchmal outgoing highpass + incoming bass ist besser als Kanal-Fader.
- Es gibt keine eine perfekte Technik; Material entscheidet.

DSP-Praxis zu Realtime Beat Detection:

- Realtime beat following ist schwieriger als es aussieht.
- Onset/transient detection + band-specific features + lock/follower ist robuster als simple RMS.
- Offline-Analyse kann als Teacher/Reference fuer eine spaetere Live-Follower-Logik dienen.

Beatcord-Relevanz:

- Offline first.
- Confidence immer speichern.
- Live-Follower nur als Korrektur, nicht als einzige Wahrheit.

## Package Radar

### Node/Bun/npm Kandidaten

| Package | Version laut npm latest | Lizenz | Beatcord-Nutzen | Bewertung |
|---|---:|---|---|---|
| `@discordjs/voice` | 0.19.2 | Apache-2.0 | Discord Voice API | Core |
| `@snazzah/davey` | 0.1.11 | MIT | DAVE/E2EE | Core |
| `@discordjs/opus` | 0.10.0 | MIT | Native Opus | Core |
| `prism-media` | 1.3.5 | Apache-2.0 | Media/Opus/PCM glue | Core/Legacy |
| `essentia.js` | 0.1.3 | AGPL-3.0 | MIR in JS/WASM | Strong, license review |
| `meyda` | 5.6.3 | MIT | Feature extraction | Useful |
| `web-audio-beat-detector` | 8.2.36 | MIT | Browser beat detection | Prototype/UI |
| `realtime-bpm-analyzer` | 5.0.15 | Apache-2.0 | WebAudio BPM stream/file | Prototype/UI |
| `music-tempo` | 1.0.3 | MIT | Beatroot-like tempo | Reference only |
| `webaudio-node` | 0.8.0 | ISC | Node WebAudio/WASM/SIMD | Prototype |
| `node-web-audio-api` | 2.0.0 | BSD-3-Clause | Rust WebAudio in Node | Prototype/analysis |
| `audio-decode` | 3.10.2 | MIT | Decode in JS/browser/node | Utility |
| `wav-decoder` | 1.3.0 | MIT | WAV decode | Utility |
| `opusscript` | 0.1.1 | MIT | JS Opus fallback | Avoid if native Opus works |

### Python/PyPI Kandidaten

| Package | Version-Signal | Lizenz | Beatcord-Nutzen | Bewertung |
|---|---:|---|---|---|
| `audio-separator` | PyPI JSON 0.44.2 | MIT | UVR/MDX/Demucs/MDXC stems | Core Ultra |
| `librosa` | 0.11.0 | ISC | MIR/offline analysis | Core analysis |
| `audioflux` | 0.1.9 | MIT | Feature extraction | Research/analysis |
| `demucs` | 4.0.1 | MIT | Source separation | Via wrapper |
| `pedalboard` | 0.9.23 | GPL-3.0 | Offline effects/VST3/AU | Powerful, license review |
| `torchaudio` | PyPI JSON 2.11.0; docs stable show maintenance note | BSD-style/PyTorch | ML audio/pipelines | Useful but maintenance transition |
| `deepfilternet` | 0.5.6 | MIT | Speech denoise | Voice input/narrator |
| `aubio` | 0.4.9 | GPLv3 | onset/tempo/pitch | Fallback, license review |
| `madmom` | 0.16.1 | BSD + CC BY-NC-SA parts | beat/downbeat reference | Avoid core |

## Lizenz- und Betriebsrisiken

Nicht alles, was kostenlos ist, ist lizenzleicht.

Besonders beachten:

- `essentia.js`: AGPL-3.0.
- `aubio`: GPLv3.
- `libkeyfinder`: GPLv3.
- `pedalboard`: GPL-3.0.
- Rubber Band: GPL/open source bzw. kommerzielle Lizenz fuer proprietaere Distribution.
- FFmpeg mit `--enable-gpl` kann Distributionspflichten veraendern.
- LV2/VST3-Plugins jeweils einzeln pruefen.

Empfehlung:

- Lizenzmatrix in `docs/licenses-audio-stack.md`.
- Alles mit AGPL/GPL als optionalen externen Worker kapseln, bis entschieden ist.
- Keine Rechtsberatung, aber technische Architektur sollte Lizenzwechsel ertragen.

## Zielarchitektur Juni 2026

### Hotpath

```text
Discord request / queue
  -> cached local source
  -> deck decode
  -> Float32 deck processing
  -> Float32 mixbus
  -> master bus
  -> final s16/Opus bridge
  -> @discordjs/voice + DAVE + Opus
```

Hotpath-Regeln:

- Keine heavy AI im 20-ms-Tick.
- Kein Netzwerk im 20-ms-Tick.
- Keine Stem-Separation im 20-ms-Tick.
- Keine dynamische Plugin-Ladung im 20-ms-Tick.
- Nur vorbereitete Daten und deterministische DSP-Kurven.

### Offline Analysis Worker

```text
downloaded track
  -> ffprobe metadata
  -> loudness/true peak/clipping
  -> BPM/beatgrid/downbeats
  -> key/camelot
  -> section detection
  -> energy/vocal/bass density curves
  -> cue/mix-in/mix-out candidates
  -> quality score
  -> sidecar json
```

### Stem Worker

```text
popular/cued track
  -> audio-separator model selection
  -> stems render
  -> stem loudness normalize
  -> artifact/bleed score
  -> cache stems
  -> mark usable transitions
```

### Audio Lab

```text
test tracks
  -> render variants
  -> measure LUFS/TP/clipping/spectral/stereo
  -> ABX listening notes
  -> recommended profile changes
```

## Konkrete "Alles rausholen" Features

### Audio Quality

- Float32 mixbus.
- SoXr resampling in Ultra FFmpeg.
- Dither only at integer boundaries.
- One final encode.
- True-peak-aware limiter.
- Underrun telemetry.
- Source quality score.

### Equalizer

- Guild EQ presets.
- Track-aware dynamic EQ.
- DJ isolator bands for transitions.
- Bass/mid/high curves per transition.
- Anti-harshness dynamic notch around 2.5-5 kHz when needed.

### Bass

- Subcut 25-30 Hz.
- Mono-compatible low-end under 90-120 Hz.
- Low-band dynamic EQ.
- Sidechain duck outgoing/incoming low band.
- Kick-aware bass handover.
- Bass boost only with limiter headroom and profile guard.

### Mixing

- Beatgrid + downbeat + phrase.
- Key/Camelot compatibility.
- Energy curve planning.
- Vocal density avoidance.
- Bass density avoidance.
- Stem-aware transitions.
- Transition confidence and fallback.

### Transitions

- Bass swap.
- Filter-out.
- Echo-out.
- Loop bridge.
- Brake.
- Spinback.
- Riser.
- Gate roll.
- Drum bridge.
- Acapella teaser.
- Double-drop with hard gates.

### Entertainment

- Live spectrum/waveform.
- "Why this transition" explainer.
- Crowd mode voting.
- Hype/chill/club/bass/night modes.
- DJ narrator sidechained into music.
- Highlight replay.
- Session energy report.

## Research Conclusions

### Highest ROI

1. Custom FFmpeg Ultra build.
2. Capability diagnostics.
3. Float32 mixbus.
4. Analysis sidecars.
5. Transition Brain 2.0.
6. `audio-separator` stem worker.
7. Audio Lab with A/B metrics.

### Medium ROI

- WebAudio/Meyda visualizer.
- DeepFilterNet for voice input.
- Pedalboard offline experiments.
- LSP plugin rack experiments.
- AudioSR restoration experiments.

### Low ROI / risky

- Real-time stems by default.
- AI superresolution on good sources.
- Relying on Discord voice receive for essential control.
- Heavy AGPL/GPL packages in core without license decision.
- Permanent aggressive stereo widening.
- Static "bass boost all tracks" mode.

## Recommended Next Tickets

1. `audio-runtime`: FFmpeg capability scanner.
2. `audio-lab`: render + metric harness for test tracks.
3. `analysis-sidecar`: JSON schema + versioning.
4. `float-mixbus`: internal Float32 frame engine.
5. `ultra-ffmpeg`: build script/profile for `libsoxr` and `librubberband`.
6. `stems-service`: audio-separator wrapper with model registry.
7. `transition-brain-v2`: phrase/key/energy/vocal/bass aware planner.
8. `mastering-rack-v2`: profile-based dynamic EQ/bass/limiter chain.
9. `discord-quality-panel`: bitrate/DAVE/Opus/underrun diagnostics in UI.
10. `license-matrix`: explicit audio dependency license doc.

## Sources

### Discord / Voice / Opus

- Discord E2EE May 2026: https://discord.com/blog/every-voice-and-video-call-on-discord-is-now-end-to-end-encrypted
- Discord Voice Connections: https://docs.discord.com/developers/topics/voice-connections
- Discord Channel Resource bitrate limits: https://docs.discord.com/developers/resources/channel
- DAVE Protocol: https://daveprotocol.com/
- Discord libdave: https://github.com/discord/libdave
- discord.js voice 0.19.2: https://discord.js.org/docs/packages/voice/0.19.2
- DAVE issue signal: https://github.com/discordjs/discord.js/issues/11419
- Opus: https://opus-codec.org/

### FFmpeg / DSP

- FFmpeg Download / 8.1.2: https://ffmpeg.org/download.html
- FFmpeg Filters: https://ffmpeg.org/ffmpeg-filters.html
- Rubber Band: https://breakfastquay.com/rubberband/
- libsoxr: https://github.com/chirlu/soxr
- LSP Plugins: https://lsp-plug.in/
- Calf Studio Gear: https://calf-studio-gear.org/
- Spotify Pedalboard: https://github.com/spotify/pedalboard

### Stems / AI Audio

- audio-separator: https://github.com/nomadkaraoke/python-audio-separator
- Ultimate Vocal Remover: https://github.com/Anjok07/ultimatevocalremovergui
- UVR discussion on AI-generated track artifacts: https://github.com/Anjok07/ultimatevocalremovergui/discussions/2253
- Demucs: https://github.com/facebookresearch/demucs
- AudioSR: https://github.com/haoheliu/versatile_audio_super_resolution
- DeepFilterNet: https://github.com/Rikorose/DeepFilterNet
- VirtualDJ Stems: https://virtualdj.com/stems/
- DJ.Studio 2026 stem guide: https://dj.studio/blog/evidence-based-guide-dj-stem-separation

### MIR / Analysis

- Essentia: https://essentia.upf.edu/
- Essentia.js: https://mtg.github.io/essentia.js/
- librosa 0.11 docs: https://librosa.org/doc/latest/index.html
- aubio docs: https://aubio.org/manual/latest/
- audioFlux: https://github.com/libAudioFlux/audioFlux
- libkeyfinder: https://github.com/mixxxdj/libkeyfinder
- keyfinder-cli: https://github.com/evanpurkhiser/keyfinder-cli
- torchaudio docs: https://docs.pytorch.org/audio/stable/index.html

### DJ / Forums / Video Leads

- Mixxx DJing manual: https://manual.mixxx.org/2.5/en/chapters/djing_with_mixxx.html
- Mixxx homepage: https://mixxx.org/
- Mixxx Auto DJ issue: https://github.com/mixxxdj/mixxx/issues/14067
- Reddit bass swap discussion: https://www.reddit.com/r/Beatmatch/comments/xfepc2/what_is_the_optimal_technique_for_swapping_low_eq/
- Reddit realtime beat detection discussion: https://www.reddit.com/r/DSP/comments/1g5zrz2/realtime_beat_detection/
- FFmpeg 8.0 video lead: https://www.youtube.com/watch?v=nP_Kaqwo2kU
- UVR5 tutorial video lead: https://www.youtube.com/watch?v=9kzlr6otFqU
- Mixxx 2.5 review/tutorial lead: https://www.youtube.com/watch?v=2RTp4M_IHeM

### Registry Signals Queried

- npm registry for `@discordjs/voice`, `@snazzah/davey`, `@discordjs/opus`, `prism-media`, `essentia.js`, `meyda`, `web-audio-beat-detector`, `realtime-bpm-analyzer`, `music-tempo`, `webaudio-node`, `node-web-audio-api`, `audio-decode`, `wav-decoder`, `opusscript`.
- PyPI JSON / pip index for `audio-separator`, `librosa`, `audioflux`, `demucs`, `pedalboard`, `torchaudio`, `deepfilternet`, `aubio`, `madmom`.
