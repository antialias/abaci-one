# TTS Audio System Integration Guide

## Overview

The app has a text-to-speech system that:
1. **Plays audio** for the user via a voice chain: pre-generated OpenAI mp3s first, browser `SpeechSynthesis` as fallback
2. **Collects (text, tone) pairs** at runtime and persists them to the database
3. **Enables admin generation** of high-quality OpenAI TTS mp3s for any collected pair

The system is designed so you **declare** what text should be spoken and with what tone. The playback path, voice selection, and pre-generation pipeline are handled automatically.

---

## Architecture

```
useTTS(text, { tone })          ← Declare a speakable utterance (hook)
  └→ manager.register(text, tone)   ← Collects the pair for future generation
  └→ returns speak()                ← Stable callback to trigger playback

manager.speak(text, tone)       ← Playback engine
  └→ voice chain lookup             ← Check pre-generated mp3s first
  └→ browser SpeechSynthesis        ← Fallback if no mp3 exists

manager.flush()                 ← Sends collected pairs to DB (on page unload)
```

### Key Files

| File | Role |
|------|------|
| `src/hooks/useTTS.ts` | Primary hook — declare a (text, tone) utterance, get a speak function |
| `src/hooks/useAudioManager.ts` | Reactive state — `isEnabled`, `isPlaying`, `volume`, `stop()` |
| `src/lib/audio/TtsAudioManager.ts` | Core engine — voice chain, mp3 playback, browser TTS, collection |
| `src/contexts/AudioManagerContext.tsx` | React context — singleton manager, boot-time manifest loading |
| `src/lib/audio/termsToSentence.ts` | Helper — converts `[5, 3]` → `"five plus three"` |
| `src/lib/audio/buildFeedbackText.ts` | Helper — correct/incorrect feedback sentences |
| `src/lib/audio/numberToEnglish.ts` | Helper — `42` → `"forty two"` |

---

## How to Add TTS to a Feature

### Step 1: Create a feature-specific audio hook

Create a hook in your feature's `hooks/` directory. This hook owns:
- The **text construction** (what to say)
- The **tone strings** (how to say it)
- The **auto-play logic** (when to say it)
- **Cleanup** (stop on unmount)

```typescript
// src/components/my-feature/hooks/useMyFeatureAudioHelp.ts
'use client'

import { useEffect, useRef } from 'react'
import { useTTS } from '@/hooks/useTTS'
import { useAudioManager } from '@/hooks/useAudioManager'

// Tone strings are freeform — they become the OpenAI `instructions` param
// when mp3s are generated. Write them as voice-actor directions.
const INSTRUCTION_TONE =
  'Patiently guiding a young child. Clear, slow, friendly.'
const CELEBRATION_TONE =
  'Warmly congratulating a child. Genuinely encouraging and happy.'

interface UseMyFeatureAudioHelpOptions {
  currentStep: string
  isComplete: boolean
}

export function useMyFeatureAudioHelp({
  currentStep,
  isComplete,
}: UseMyFeatureAudioHelpOptions) {
  const { isEnabled, stop } = useAudioManager()

  // Declare utterances — each useTTS call registers the pair for collection
  const sayInstruction = useTTS(currentStep, { tone: INSTRUCTION_TONE })
  const sayCelebration = useTTS(
    isComplete ? 'Well done!' : '',
    { tone: CELEBRATION_TONE },
  )

  // Auto-play when step changes
  const prevStepRef = useRef<string>('')
  useEffect(() => {
    if (!isEnabled || !currentStep || currentStep === prevStepRef.current) return
    prevStepRef.current = currentStep
    sayInstruction()
  }, [isEnabled, currentStep, sayInstruction])

  // Auto-play celebration on completion
  useEffect(() => {
    if (!isEnabled || !isComplete) return
    sayCelebration()
  }, [isEnabled, isComplete, sayCelebration])

  // Stop audio on unmount
  useEffect(() => {
    return () => stop()
  }, [stop])

  // Expose replay for UI buttons
  return { replay: sayInstruction }
}
```

### Step 2: Use the hook in your component

```typescript
import { useMyFeatureAudioHelp } from './hooks/useMyFeatureAudioHelp'
import { useAudioManager } from '@/hooks/useAudioManager'

function MyFeature() {
  const { isEnabled, isPlaying } = useAudioManager()
  const { replay } = useMyFeatureAudioHelp({
    currentStep: 'Tap the bead to move it up',
    isComplete: false,
  })

  return (
    <div>
      {isEnabled && (
        <button onClick={replay} disabled={isPlaying}>
          {isPlaying ? 'Speaking...' : 'Replay'}
        </button>
      )}
    </div>
  )
}
```

### Step 3: There is no step 3

That's it. The system handles everything else:
- **Collection**: The `(text, tone)` pairs are automatically registered and flushed to the DB
- **Pre-generation**: An admin can generate mp3s for collected pairs in `/admin/audio`
- **Playback upgrade**: Once mp3s exist, the voice chain automatically uses them instead of browser TTS

---

## API Reference

### `useTTS(text, { tone })`

The primary hook. Call it at the top level of your component (it's a hook).

```typescript
const speak = useTTS('Hello world', { tone: 'Friendly and warm.' })

// speak() returns Promise<void>, resolves when audio finishes
await speak()
```

- **`text`**: The words to speak. Empty string skips registration.
- **`tone`**: Freeform voice-direction string. This becomes the OpenAI `instructions` parameter when generating mp3s. Write it like stage directions for a voice actor.
- **Returns**: A stable `() => Promise<void>` callback (safe for useEffect deps).

**Important**: `useTTS` can be called multiple times in the same component. Each call declares a separate utterance. The text and tone can be dynamic (derived from props/state).

### `useAudioManager()`

Reactive state hook for the audio system.

```typescript
const { isEnabled, isPlaying, volume, stop, setEnabled, setVolume } = useAudioManager()
```

| Property | Type | Description |
|----------|------|-------------|
| `isEnabled` | `boolean` | Whether audio help is turned on globally |
| `isPlaying` | `boolean` | Whether any audio is currently playing |
| `volume` | `number` | Current volume (0–1) |
| `stop()` | `() => void` | Stop any current playback |
| `setEnabled(b)` | `(boolean) => void` | Toggle audio on/off (persists to localStorage) |
| `setVolume(v)` | `(number) => void` | Set volume 0–1 (persists to localStorage) |

---

## Tone Strings

Tones are freeform strings that describe **how** the text should be spoken. They serve two purposes:
1. **Collection key**: Combined with the text, they form the unique identity of a clip
2. **Generation instructions**: Passed directly to OpenAI's `instructions` parameter

### Guidelines

- Write them as voice-actor stage directions
- Be specific about emotion, pace, and audience
- Keep them **stable** — changing a tone string creates a new clip (old mp3s won't match)
- Reuse the same tone constant across related utterances

### Examples from the codebase

```typescript
// Math problem reading
'Speaking clearly and steadily, reading a math problem to a young child. Pause slightly between each number and operator.'

// Celebration
'Warmly congratulating a child. Genuinely encouraging and happy.'

// Gentle correction
'Gently guiding a child after a wrong answer. Kind, not disappointed.'

// Tutorial instruction
'Patiently guiding a young child through an abacus tutorial. Clear, slow, friendly.'
```

### Anti-patterns

```typescript
// BAD: Too vague — OpenAI won't know what voice to use
'Read this text'

// BAD: Tone changes per render — creates new clips every time
`Speaking ${mood === 'happy' ? 'happily' : 'sadly'}`
// GOOD: Use two separate useTTS calls with stable tones
const sayHappy = useTTS(text, { tone: HAPPY_TONE })
const saySad = useTTS(text, { tone: SAD_TONE })
```

---

## Patterns

### Auto-play on state change

Use a ref to track the previous value and only play when it changes:

```typescript
const prevRef = useRef<string>('')
useEffect(() => {
  if (!currentText || currentText === prevRef.current) return
  prevRef.current = currentText
  sayIt()
}, [currentText, sayIt])
```

### One-shot playback (play once, don't repeat)

```typescript
const playedRef = useRef(false)
useEffect(() => {
  if (!shouldPlay || playedRef.current) return
  playedRef.current = true
  sayIt()
}, [shouldPlay, sayIt])

// Reset when the trigger resets
useEffect(() => {
  if (!shouldPlay) playedRef.current = false
}, [shouldPlay])
```

### Multiple utterances per step (sequential)

```typescript
// DON'T await in sequence — just call the one you want
// speak() stops the previous utterance before starting
const sayStep1 = useTTS('First, look at the abacus', { tone: INST })
const sayStep2 = useTTS('Now tap the bead', { tone: INST })

// Play whichever is appropriate
if (step === 0) sayStep1()
if (step === 1) sayStep2()
```

### Conditional text (dynamic)

```typescript
// Text can be dynamic — the hook re-registers when it changes
const text = useMemo(
  () => (terms ? termsToSentence(terms) : ''),
  [terms],
)
const sayProblem = useTTS(text, { tone: MATH_TONE })
```

### Always clean up on unmount

```typescript
const { stop } = useAudioManager()
useEffect(() => {
  return () => stop()
}, [stop])
```

---

## Common Mistakes

### Bypassing the manager with raw `speechSynthesis`

```typescript
// BAD — skips voice chain, won't use pre-generated audio, won't collect the clip
speechSynthesis.speak(new SpeechSynthesisUtterance(text))

// GOOD — goes through the manager
const say = useTTS(text, { tone: MY_TONE })
say()
```

### Forgetting to stop on unmount

If your component unmounts while audio is playing, the audio continues. Always add the cleanup effect.

### Using unstable tone strings

If the tone string changes every render, each render creates a new (text, tone) pair. Keep tone strings as module-level constants.

---

## Existing Feature Hooks (Reference Implementations)

| Hook | Location | What it does |
|------|----------|-------------|
| `usePracticeAudioHelp` | `src/components/practice/hooks/` | Reads math problems aloud, plays correct/incorrect feedback |
| `useTutorialAudioHelp` | `src/components/tutorial/hooks/` | Speaks tutorial step instructions |

When adding TTS to a new feature, follow the structure of `usePracticeAudioHelp` — it's the most complete example (dynamic text, multiple tones, auto-play, replay, cleanup).
