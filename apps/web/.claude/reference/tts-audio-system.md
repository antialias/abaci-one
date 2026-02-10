# TTS Audio System

## Overview

The app plays audio via a **voice chain** (pregenerated OpenAI mp3 > browser `SpeechSynthesis` fallback). All audio is declared via **clip IDs** with optional `say` (i18n text map) and `tone` (voice-actor directions). Clips are collected at runtime, persisted to the database, and generated on-demand from the admin panel.

---

## Clip ID Modes

### 1. Explicit ID

Use for clips with **stable, fixed content per ID**. The clip ID is a human-readable string used as the mp3 filename.

```typescript
useTTS('tutorial-welcome', {
  tone: 'Warmly greeting a child.',
  say: { en: 'Welcome to the tutorial!' },
})
```

**Use for**: numbers, operators, tutorial steps, feedback phrases — any clip where the text is known at code time and never changes.

### 2. Hash-based ID

Use when **content varies at runtime**. The system computes a deterministic clip ID from a hash of the canonical say text + tone. Format: `h-{8 hex chars}`.

```typescript
useTTS({
  say: { en: dynamicText },
  tone: 'Patiently guiding a child.',
})
```

**Use for**: coach hints, dynamic instructions, user-generated content — any clip where the say text varies at runtime.

---

## How the Hash Works

- `computeClipHash(say, tone)` computes FNV-1a 32-bit hash of `resolveCanonicalText(say) + '\0' + tone`
- `resolveCanonicalText` picks: `say['en-US']` > `say['en']` > first value > `''`
- Adding lower-priority translations (e.g., `es`, `ja`) does **not** change the hash
- Different tone or different canonical text = different hash = different mp3 file

---

## `useTTS` API

```typescript
// Explicit clip ID
const speak = useTTS('feedback-correct', {
  tone: 'Warmly congratulating a child.',
  say: { en: 'Correct!' },
})

// Hash-based (omit clip ID)
const speak = useTTS({
  say: { en: dynamicText },
  tone: 'Patiently guiding a child.',
})

// Array of clip IDs (multi-segment)
const speak = useTTS(['number-5', 'operator-plus', 'number-3'], {
  tone: 'math-dictation',
})

// speak() returns Promise<void>, resolves when audio finishes
await speak()
```

No `useMemo` needed — the hook is internally stable via content serialization.

### Speak function overrides

The returned function accepts optional `(overrideInput?, overrideConfig?)` so it can double as a reusable speaker within a component:

```typescript
// Set up shared defaults (tone), then speak different content ad-hoc
const speak = useTTS({ tone: 'tutorial-instruction' })

speak()                                  // plays hook defaults
speak({ say: { en: 'Dynamic text' } })   // inherits tone from hook
speak('other-clip')                       // explicit clip, inherits tone
speak('other-clip', { tone: 'custom' })   // overrides everything
```

### Default inheritance (merge order)

When `speak()` is called with overrides, config values merge weakest-to-strongest:

1. **Implicit config** — tone/say extracted from the hook's input segment
2. **Hook config** — explicit second arg to `useTTS(input, config)`
3. **Speak config** — second arg to `speak(input, config)`

Segment-level fields (tone/say directly on the override input segment) take final precedence via `resolveSegment`.

**Example**: tone set on a hook segment is inherited by speak overrides:

```typescript
const speak = useTTS({ say: { en: 'default' }, tone: 'friendly' })

// This inherits tone 'friendly' — it comes from the hook's input segment:
speak({ say: { en: 'one-off text' } })

// This overrides tone via speak config:
speak({ say: { en: 'urgent text' } }, { tone: 'urgent' })
```

### Registration

The hook registers its own input on render (for pre-collection). Override clips passed to `speak()` are registered at call time by the manager — they appear in the collection once played.

### `useAudioManager()`

Reactive state hook for the audio system.

| Property | Type | Description |
|----------|------|-------------|
| `isEnabled` | `boolean` | Whether audio help is turned on globally |
| `isPlaying` | `boolean` | Whether any audio is currently playing |
| `volume` | `number` | Current volume (0-1) |
| `stop()` | `() => void` | Stop any current playback |
| `setEnabled(b)` | `(boolean) => void` | Toggle audio on/off |
| `setVolume(v)` | `(number) => void` | Set volume 0-1 |

---

## Collection & Generation Pipeline

1. `register()` collects clips in memory with play counts
2. `flush()` sends to server on page unload (via `sendBeacon`)
3. Server stores in `tts_collected_clips` + `tts_collected_clip_say` tables
4. Admin generates mp3s via OpenAI TTS, stored as `{clipId}.mp3` in `data/audio/{voice}/`
5. Manifest endpoint lists available mp3s for voice chain matching at boot

---

## Clobber Protection

- **Hash-based clips** are content-addressed — different content = different hash = no clobber
- **Explicit-ID clips** must have fixed content per ID
- `console.warn` fires if an explicit ID is re-registered with different canonical text
- Admin panel shows "hash" badge on auto-generated clip IDs

---

## Key Files

| File | Role |
|------|------|
| `src/hooks/useTTS.ts` | Primary hook — declare a clip, get a speak function |
| `src/hooks/useAudioManager.ts` | Reactive state — `isEnabled`, `isPlaying`, `volume`, `stop()` |
| `src/lib/audio/TtsAudioManager.ts` | Core engine — voice chain, mp3 playback, browser TTS, collection |
| `src/lib/audio/clipHash.ts` | `resolveCanonicalText`, `computeClipHash`, `isHashClipId` |
| `src/lib/audio/numberToClipIds.ts` | `42` → `['number-4', 'number-2']` (clip ID array) |
| `src/lib/audio/termsToClipIds.ts` | `[5, 3]` → `['number-5', 'operator-plus', 'number-3']` |
| `src/lib/audio/buildFeedbackClipIds.ts` | Correct/incorrect feedback clip ID arrays |
| `src/lib/audio/toneDirections.ts` | Shared tone string constants |
| `src/lib/audio/audioManifest.ts` | Static manifest of known clip IDs and their text |
| `src/contexts/AudioManagerContext.tsx` | React context — singleton manager, boot-time manifest loading |

---

## Reference Implementations

| Hook | Location | Pattern |
|------|----------|---------|
| `usePracticeAudioHelp` | `src/components/practice/hooks/` | Explicit clip ID arrays for math problems |
| `useTutorialAudioHelp` | `src/components/tutorial/hooks/` | Explicit clip IDs for tutorial steps |
| CoachBar | `src/components/tutorial/CoachBar/` | Hash-based for dynamic coach hints |

---

## Patterns

### Auto-play on state change

```typescript
const prevRef = useRef<string>('')
useEffect(() => {
  if (!currentText || currentText === prevRef.current) return
  prevRef.current = currentText
  sayIt()
}, [currentText, sayIt])
```

### Always clean up on unmount

```typescript
const { stop } = useAudioManager()
useEffect(() => () => stop(), [stop])
```

### Hash-based dynamic content

```typescript
// Reactive — re-registers and gets a new speak identity when text changes
const speak = useTTS(
  text ? { say: { en: text }, tone: MY_TONE } : ''
)
```

### Shared tone, ad-hoc content

```typescript
// Hook sets the tone once; speak() provides content at call time
const speak = useTTS({ tone: INSTRUCTION_TONE })

function handleHint(hint: string) {
  speak({ say: { en: hint } })  // inherits tone from hook
}
```

---

## Common Mistakes

- **Bypassing the manager** with raw `speechSynthesis` — skips voice chain, won't collect
- **Forgetting to stop on unmount** — audio continues after component unmounts
- **Unstable tone strings** — if the tone changes every render, each render creates a new clip. Keep tones as module-level constants.
- **Using explicit IDs for dynamic content** — causes clobber. Use hash-based IDs instead.
