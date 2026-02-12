# TTS Audio System

## What This Is

The app speaks to kids — reading math problems, giving feedback, guiding tutorials. Under the hood there's a **voice chain** that tries multiple audio sources in order until one works:

```
pregenerated mp3 → on-demand generate → browser speech → subtitles
```

Every utterance is declared with a **clip ID**, optional **say** text (what to speak), and optional **tone** (how to speak it). The system collects clips at runtime, persists them to a database, and generates high-quality OpenAI TTS mp3s either ahead of time from the admin panel or on-the-fly during playback.

---

## The Voice Chain

The voice chain is the central concept. It's an ordered list of audio sources the system tries in sequence for every clip. Each source either plays successfully or the system moves on to the next.

**Example chain**: `nova → generate → browser-tts → subtitle`

| Source | What it does | When it works |
|--------|-------------|--------------|
| **Pregenerated** | Plays `data/audio/{voice}/{clipId}.mp3` from disk | When the mp3 has been generated ahead of time |
| **Custom** | Plays a microphone-recorded mp3 from disk | When someone recorded a custom clip |
| **Generate** | Calls OpenAI on-the-fly, plays the result, caches it to disk | When an API key is configured and OpenAI is reachable |
| **Browser TTS** | Uses the browser's built-in `speechSynthesis` | When the browser has voices loaded and user has interacted |
| **Subtitle** | Shows the text on screen for a calculated reading time | Always works (last resort) |

The chain is configured per-deployment in `/admin/audio` and stored in the database. Every voice source is a class with a `canGenerate()` method and a polymorphic `generate()` method — so adding a new source type (e.g. Asterisk phone call) means adding one class.

### How Generate Works

When the `generate` entry runs, it looks back at the chain log to find which voices *above it* had a missing clip and can generate on-demand. It picks the first one, calls `source.generate(clipId, text, tone)` → gets a blob → plays it. If there are other missed voices, it fires off background generation for them too so future plays are instant.

The voice classes decide for themselves whether they can generate:
- `PregeneratedVoice.canGenerate()` → `true` (calls OpenAI)
- `CustomVoice.canGenerate()` → `false` (not yet — future hook for Asterisk etc.)

### VoiceSource Class Hierarchy

```
VoiceSource (abstract)
├── PregeneratedVoice  — name, canGenerate=true,  generate() calls OpenAI
├── CustomVoice        — name, canGenerate=false   (future: Asterisk, etc.)
├── BrowserTtsVoice    — no name, uses Web Speech API
├── SubtitleVoice      — no name, shows text on screen
└── GenerateVoice      — meta-entry that reads the chain log
```

The serializable form (`VoiceSourceData`) is a plain discriminated union used for DB storage, API responses, and UI state. `hydrateVoiceChain()` converts it to class instances inside TtsAudioManager.

---

## Clip IDs

Every utterance has a clip ID. This is the filename (minus `.mp3`) on disk, the key in the database, and the cache key in memory.

### Explicit IDs

For clips with **fixed, known content** — numbers, operators, tutorial steps, feedback phrases.

```typescript
useTTS('tutorial-welcome', {
  tone: 'Warmly greeting a child.',
  say: { en: 'Welcome to the tutorial!' },
})
```

The clip ID is a human-readable string. The mp3 is `data/audio/nova/tutorial-welcome.mp3`.

### Hash-based IDs

For clips with **dynamic content** — coach hints, user-facing messages that vary at runtime.

```typescript
useTTS({
  say: { en: dynamicText },
  tone: 'Patiently guiding a child.',
})
```

The system computes a deterministic ID: `h-{8 hex chars}` from FNV-1a hash of the canonical text + tone. Different text or different tone = different clip ID = different mp3. Adding non-English translations doesn't change the hash (only `en-US` > `en` > first value matters).

### Static Clip Registry

Pre-known clips are registered at module scope in `src/lib/audio/clips/`:

```typescript
// clips/numbers.ts
audioClip('number-5', 'five', 'math-dictation')
audioClip('number-42', 'forty two', 'math-dictation')

// clips/feedback.ts
audioClip('feedback-correct', 'Correct!', 'celebration')
```

These build the **audio manifest** — the complete list of static clips the system knows about, with their text and tone.

---

## Using TTS in Components

### `useTTS(input, config?)` → speak function

The main hook. Declare what you want to say, get back a function that plays it.

```typescript
// Explicit clip
const speak = useTTS('feedback-correct', {
  tone: 'Warmly congratulating a child.',
  say: { en: 'Correct!' },
})

// Hash-based (dynamic text)
const speak = useTTS({
  say: { en: dynamicText },
  tone: 'Patiently guiding a child.',
})

// Multi-segment (reads a math problem)
const speak = useTTS(['number-5', 'operator-plus', 'number-3'], {
  tone: 'math-dictation',
})

await speak() // plays, returns when done
```

No `useMemo` needed — the hook uses content-based serialization internally.

**Override at call time** — the returned function accepts optional overrides:

```typescript
const speak = useTTS({ tone: 'tutorial-instruction' })

speak()                                  // plays hook defaults
speak({ say: { en: 'Dynamic text' } })   // inherits tone
speak('other-clip')                       // explicit clip, inherits tone
speak('other-clip', { tone: 'custom' })   // overrides everything
```

**Config merge order** (weakest → strongest):
1. Implicit config — tone/say from the hook's input segment
2. Hook config — second arg to `useTTS(input, config)`
3. Speak config — second arg to `speak(input, config)`

### `useAudioManager()` → reactive state

Control panel for the audio system.

| Property / Method | Type | What it does |
|-------------------|------|-------------|
| `isEnabled` | `boolean` | Is audio help on? |
| `isPlaying` | `boolean` | Is something playing right now? |
| `volume` | `number` | Current volume (0–1) |
| `subtitleText` | `string \| null` | Text of the active subtitle (or null) |
| `subtitleDurationMs` | `number` | How long the current subtitle will display |
| `subtitleDurationMultiplier` | `number` | Speed multiplier for subtitle timing |
| `subtitleBottomOffset` | `number` | Bottom offset in pixels |
| `subtitleAnchor` | `'top' \| 'bottom'` | Subtitle position |
| `stop()` | `() => void` | Stop everything |
| `setEnabled(b)` | `(boolean) => void` | Toggle audio (persists to localStorage) |
| `setVolume(v)` | `(number) => void` | Set volume (persists to localStorage) |
| `dismissSubtitle()` | `() => void` | Dismiss current subtitle early |
| `setSubtitleDurationMultiplier(m)` | `(number) => void` | Adjust subtitle speed (persists) |
| `setSubtitleBottomOffset(px)` | `(number) => void` | Adjust subtitle position |
| `setSubtitleAnchor(a)` | `(SubtitleAnchor) => void` | Top or bottom |

Settings are persisted to localStorage under `audio-help-enabled`, `audio-help-volume`, `audio-subtitle-speed`.

---

## Collection & Generation Pipeline

This is how clips go from "first spoken in a browser" to "cached mp3 on disk":

```
 Component                    Browser                     Server                     Disk
    │                            │                           │                         │
    │  useTTS('clip-id')         │                           │                         │
    │──register()───────────────►│                           │                         │
    │                            │                           │                         │
    │  speak()                   │                           │                         │
    │──playOneSegment()─────────►│                           │                         │
    │                            │  (chain: nova → generate) │                         │
    │                            │  no mp3 on disk?          │                         │
    │                            │──POST /generate-clip─────►│──OpenAI TTS API────────►│
    │                            │◄─────────audio blob───────│◄─────mp3 bytes──────────│
    │                            │  play blob + cache clipId │  save to data/audio/    │
    │                            │                           │                         │
    │  (page unload)             │                           │                         │
    │──flush()──────────────────►│──POST /collected-clips───►│  upsert to DB           │
    │                            │                           │  (clip, say, playCount) │
```

### Step by step

1. **Register** — `useTTS()` calls `manager.register()` on render. The clip, its text, and its tone are stored in an in-memory collection.

2. **Play** — `speak()` resolves the segment and walks the voice chain. If a pregenerated mp3 exists, it plays immediately. If not and `generate` is in the chain, it calls the voice's `generate()` method (which hits `/api/audio/generate-clip`), plays the result, and caches the clip ID so next time it plays from disk.

3. **Collect** — On page visibility change or unload, `flush()` sends all played clips to `POST /api/audio/collected-clips`, which upserts them into the `tts_collected_clips` and `tts_collected_clip_say` tables.

4. **Batch generate** — From `/admin/audio`, an admin can trigger batch generation for any voice. This runs a background task that iterates collected clips, calls OpenAI TTS for each, and saves mp3s to disk.

5. **Manifest** — On app boot, `AudioManagerContext` fetches the voice chain config and then loads a manifest of which clip IDs have mp3s on disk for each voice. This populates the in-memory cache so `playOneSegment` knows instantly whether to try a disk source or skip to the next chain entry.

### On-demand vs batch generation

| | On-demand (`generate` in chain) | Batch (admin panel) |
|---|---|---|
| **When** | During playback, when a clip is missing | Admin triggers manually |
| **Latency** | User waits ~1–2s for OpenAI response | Runs in background |
| **Scope** | One clip at a time | All missing clips for a voice |
| **Where called** | `PregeneratedVoice.generate()` → `POST /api/audio/generate-clip` | Background task → direct OpenAI API |
| **Both save to** | `data/audio/{voice}/{clipId}.mp3` | Same |

---

## The Chain Attempt Log

`playOneSegment()` maintains a log of what each chain entry did before it. Every entry appends on failure:

```typescript
type ChainAttemptOutcome = 'no-clip' | 'play-error' | 'unavailable' | 'skipped'

interface ChainAttempt {
  source: VoiceSource
  outcome: ChainAttemptOutcome
}
```

On success, the function returns immediately (no log entry). The `generate` entry reads this log to find which voices had `no-clip` and `canGenerate()`. Future remediation entries could read the log for other strategies.

---

## Clobber Protection

- **Hash-based clips** are content-addressed — different content = different hash = impossible to clobber
- **Explicit-ID clips** must have fixed content per ID
- `console.warn` fires if an explicit ID is re-registered with different canonical text
- Admin panel shows a "hash" badge on auto-generated clip IDs

---

## Admin Panel (`/admin/audio`)

The admin page at `/admin/audio` is the control center for the TTS system. It has these sections:

### Voice Chain Editor
Configure the fallback order. Drag entries up/down, add/remove sources. Options include all OpenAI voices (with per-voice generation progress bars), browser TTS, subtitles, auto-generate, and custom voices. Save persists to DB.

### TTS Test Panel
Type text, pick a tone, hit Speak. Shows the resolved clip ID, fallback text, which voice chain entry will serve it, and per-voice availability (checkmarks/Xs). You can generate clips for specific voices and preview different voice renderings.

### Collected Clips Management
Browse all runtime-collected clips sorted by play count. See per-voice generation status. Trigger batch generation. Deactivate, reactivate, or delete individual clips. Deactivated clips are moved to `data/audio/{voice}/.deactivated/` rather than deleted.

### Clip Recording
Record custom voice clips via microphone. Select audio input device, see live mic level, record and save clips under a custom voice name.

---

## File Map

### Core engine

| File | What it does |
|------|-------------|
| `src/lib/audio/TtsAudioManager.ts` | The brain — voice chain playback, collection, subtitles, browser TTS |
| `src/lib/audio/voiceSource.ts` | `VoiceSourceData` (serializable union) + class hierarchy with polymorphic `generate()` |
| `src/lib/audio/clipHash.ts` | `computeClipHash()`, `resolveCanonicalText()`, `isHashClipId()` |
| `src/lib/audio/audioClipRegistry.ts` | `audioClip()` registration, `getClipMeta()` lookup |
| `src/lib/audio/audioManifest.ts` | Builds manifest from registry: `AUDIO_MANIFEST`, `AUDIO_MANIFEST_MAP` |
| `src/lib/audio/voices.ts` | Voice provider/model config (OpenAI tts-1: alloy, ash, nova, onyx, etc.) |
| `src/lib/audio/toneDirections.ts` | Detailed voice-actor directions per `AudioTone` type |

### React integration

| File | What it does |
|------|-------------|
| `src/hooks/useTTS.ts` | Declare a clip, get a speak function with inherited defaults |
| `src/hooks/useAudioManager.ts` | Reactive state via `useSyncExternalStore` — enabled, volume, subtitle, stop |
| `src/contexts/AudioManagerContext.tsx` | Provider — singleton manager, boot-time manifest loading, flush on unload |
| `src/components/audio/SubtitleOverlay.tsx` | Subtitle pill with progress bar, speed controls, dismiss-on-tap |

### Text-to-clip-ID converters

| File | What it does |
|------|-------------|
| `src/lib/audio/numberToEnglish.ts` | `42` → `"forty two"` |
| `src/lib/audio/numberToClipIds.ts` | `42` → `['number-40', 'number-2']` |
| `src/lib/audio/termsToSentence.ts` | `[5, 3]` → `"five plus three"` |
| `src/lib/audio/termsToClipIds.ts` | `[5, 3]` → `['number-5', 'operator-plus', 'number-3']` |
| `src/lib/audio/buildFeedbackText.ts` | Correct/incorrect → feedback sentence |
| `src/lib/audio/buildFeedbackClipIds.ts` | Correct/incorrect → clip ID array |

### Static clip definitions

| File | Clips |
|------|-------|
| `src/lib/audio/clips/numbers.ts` | Numbers 0–20, tens 30–90, hundred, thousand |
| `src/lib/audio/clips/operators.ts` | Plus, minus |
| `src/lib/audio/clips/feedback.ts` | Correct!, Great Job!, streak milestones, The answer is… |
| `src/lib/audio/clips/tutorial.ts` | Welcome, Look at the abacus, Move the bead… |
| `src/lib/audio/clips/assistance.ts` | General help prompts |
| `src/lib/audio/clips/practice.ts` | Practice session clips |
| `src/lib/audio/clips/index.ts` | Barrel import + `PRELOAD_CLIP_IDS` list |

### API routes

| Route | Method | What it does |
|-------|--------|-------------|
| `/api/audio/clips/[voice]/[clipId]` | GET | Serve mp3 from disk (static or collected, mp3 or webm) |
| `/api/audio/generate-clip` | POST | On-demand OpenAI TTS: generate, cache to disk, return audio |
| `/api/audio/collected-clips` | POST | Upsert collected clips to DB (play counts, say text) |
| `/api/audio/collected-clips` | GET | Fetch all collected clips (optional `?voice=` for generation status) |
| `/api/audio/collected-clips/manifest` | GET | Lightweight: which clip IDs have mp3s for `?voices=nova,onyx` |
| `/api/settings/voice-chain` | GET/PATCH | Read/write the voice chain config |
| `/api/admin/audio` | GET | Audio status: per-voice clip counts, total collected |
| `/api/admin/audio/generate` | POST | Trigger batch generation for static clips |
| `/api/admin/audio/generate-collected` | POST | Trigger batch generation for collected clips |
| `/api/admin/audio/preview` | POST | One-off voice preview (doesn't save to disk) |

### Database tables

| Table | Purpose |
|-------|---------|
| `tts_collected_clips` | Runtime-observed clips: id, tone, playCount, firstSeenAt, lastSeenAt |
| `tts_collected_clip_say` | Per-locale text for collected clips: (clipId, locale) → text |
| `app_settings.voiceChain` | JSON string of the voice chain config |

### Storage on disk

| Location | What's there |
|----------|-------------|
| `data/audio/{voice}/{clipId}.mp3` | Generated or pregenerated clips |
| `data/audio/{voice}/cc-{clipId}.mp3` | Collected clips (legacy prefix) |
| `data/audio/{voice}/.deactivated/` | Deactivated clips (hidden, not deleted) |

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
const speak = useTTS(
  text ? { say: { en: text }, tone: MY_TONE } : ''
)
```

### Shared tone, ad-hoc content

```typescript
const speak = useTTS({ tone: INSTRUCTION_TONE })

function handleHint(hint: string) {
  speak({ say: { en: hint } })  // inherits tone from hook
}
```

### One-shot (play once, don't repeat)

```typescript
const playedRef = useRef(false)
useEffect(() => {
  if (!shouldPlay || playedRef.current) return
  playedRef.current = true
  sayIt()
}, [shouldPlay, sayIt])

useEffect(() => {
  if (!shouldPlay) playedRef.current = false
}, [shouldPlay])
```

---

## Common Mistakes

- **Bypassing the manager** with raw `speechSynthesis` — skips voice chain, won't collect
- **Forgetting to stop on unmount** — audio continues after component unmounts
- **Unstable tone strings** — if the tone changes every render, each render creates a new clip. Keep tones as module-level constants.
- **Using explicit IDs for dynamic content** — causes clobber. Use hash-based IDs instead.
- **Calling `speak()` unconditionally in render** — guard with refs and `isEnabled`

---

## Reference Implementations

| Hook | Location | Pattern |
|------|----------|---------|
| `usePracticeAudioHelp` | `src/components/practice/hooks/` | Explicit clip ID arrays for math problems — the most complete example |
| `useTutorialAudioHelp` | `src/components/tutorial/hooks/` | Explicit clip IDs for tutorial steps |
| CoachBar | `src/components/tutorial/CoachBar/` | Hash-based for dynamic coach hints |
