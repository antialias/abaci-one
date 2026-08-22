# @tidepool/karaoke-player

Portable React karaoke playback for Tidepool applications. The package owns
audio playback, word-level highlighting, seeking, auto-scroll, and the
`compact`, `full`, and `row` display variants. Hosts own data fetching and pass
the audio URL, canonical lyric sections, and optional raw alignment JSON.

## Install

```sh
pnpm add @tidepool/karaoke-player
```

Import the generated, prefixed Panda stylesheet once in the host application:

```ts
import "@tidepool/karaoke-player/styles.css";
```

## Use

```tsx
import { KaraokePlayer } from "@tidepool/karaoke-player";

<KaraokePlayer
  audioSrc="/api/tracks/arrival/audio"
  title="Arrival"
  variant="full"
  theme="dark"
  lyrics={[
    {
      name: "Verse 1",
      lines: ["The circuit remembers every hand on the wire"],
      durationMs: 12000,
    },
  ]}
  alignment={rawElevenLabsAlignment}
/>;
```

`alignment` accepts the raw object returned by ElevenLabs. The normalizer
recognizes detailed music `words_timestamps`, parallel TTS-style arrays, and
common nested metadata shapes. Missing alignment degrades to readable static
lyrics; an empty lyric list is explicitly labeled as an instrumental track.

## Theming

`theme` accepts `auto`, `light`, or `dark`. Hosts may override these variables
on the component with `style` or a custom class:

- `--karaoke-bg`
- `--karaoke-surface`
- `--karaoke-border`
- `--karaoke-text`
- `--karaoke-muted`
- `--karaoke-faint`
- `--karaoke-accent`
- `--karaoke-accent-strong`
- `--karaoke-accent-soft`
- `--karaoke-note-bg`
- `--karaoke-note`
- `--karaoke-font`
- `--karaoke-display-font`

React and React DOM are peers with the supported range `>=18 <20`.
