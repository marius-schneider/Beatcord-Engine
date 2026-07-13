# Beatcord-Engine (`@beatcord/engine`)

The shared, platform-neutral audio core for Beatcord. **No Discord, no HTTP** lives
here — this is the part both consumers wrap:

- **Beatcord-Server** wraps it for HTTP / WebSocket sync / HLS mix.
- **Beatcord-Bot** wraps it for Discord voice.

## What's inside

- **Sourcing** — yt-dlp resolve/search/radio/playlist/album + Spotify/Apple mirror
  (`ytdlp.ts`, `mirror.ts`)
- **PCM pipeline** — ffmpeg decode/encode + format constants (`pcm.ts`, `constants.ts`)
- **Mixing / beatmatching** — the beatmatched crossfade mixer + mix station +
  transition planner (`mixer.ts`, `mixStation.ts`, `transition-planner.ts`, `beat-math.ts`)
- **Analysis (DSP)** — beatgrid, key (incl. essentia), tempo, genre, loudness, spectral,
  EQ, mastering
- **Stems / voice / narration** — Demucs stems, Piper TTS, whisper STT, DJ narrator,
  voice commands
- **Metadata / lyrics / cache** — track metadata, lyrics, bounded caches

## Usage

This package is consumed locally via a `file:` dependency, e.g. in the server/bot
`package.json`:

```json
"dependencies": { "@beatcord/engine": "file:../Beatcord-Engine" }
```

Import the root for the curated surface, or a submodule directly:

```ts
import { resolveQuery, MixStation, createLogger } from "@beatcord/engine";
import { detectTempo } from "@beatcord/engine/tempo";
```

When a consumer runs `bun build --compile`, the engine source is bundled into the
resulting binary — no separate install on the deploy host.

## Config

`engineSchema` / `loadEngineConfig()` (`src/config.ts`) define the engine's env fields
(external tools, cache, automix/mastering/stems/narrator/whisper). Consumers **extend**
this schema with their own fields (the server adds `PORT`/`HOST`/`APPLE_*`; the bot adds
`DISCORD_*`/`STATE_DB`/…). Unknown env keys are stripped, so one `.env` can be shared.

## Test

```sh
bun install
bun test
```
