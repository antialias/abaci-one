# Number Line Guided Experiences

How constant demos (e, pi, tau, phi) and the prime tour work, and how to create new ones.

---

## Architecture Overview

Three layers drive every guided experience:

```
Layer 3: Overlay Renderer        reads revealProgress → draws on canvas
Layer 2: Orchestrator Hook       drives revealProgress (or virtualTimeMs)
Layer 1: Shared Utilities        viewport animation, TTS sequencing, timing
```

**Constant demos** use all three layers. **Prime tour stops** use layers 1 and 3 (the tour hook is its own orchestrator).

---

## Shared Utilities (Layer 1)

### `viewportAnimation.ts`

Pure functions, no React. Used by both constant demos and prime tour.

| Export | Purpose |
|--------|---------|
| `lerpViewport(src, tgt, elapsed, durationMs, state)` | Ease-out cubic interpolation (linear center, log zoom). Mutates `state`. |
| `snapViewport(tgt, state)` | Snap viewport exactly to target. |
| `computeViewportDeviation(current, target)` | Combined center + zoom drift metric. Threshold ~0.4-0.5 triggers fade-out. |
| `easeOutCubic(t)` | Clamped ease-out cubic easing. |
| `FADE_IN_MS` (400) | Overlay fade-in duration. |
| `FADE_OUT_MS` (600) | Overlay fade-out duration. |
| `SUBTITLE_TOP_OFFSET` (16) | Subtitle y-offset when anchored to top (during narration). |
| `SUBTITLE_BOTTOM_OFFSET` (64) | Subtitle y-offset when anchored to bottom (default). |

### `useNarrationSequencer.ts`

Reusable TTS segment sequencer hook. Handles the dual-gate pattern: advance to the next segment only when **both** TTS playback **and** `animationDurationMs` have elapsed.

```typescript
interface SequencerSegment {
  ttsText: string
  ttsTone?: string                // override per-segment
  animationDurationMs: number     // minimum wall-clock time for this segment
}

interface SequencerTickResult {
  segmentIndex: number            // which segment is playing
  animFrac: number                // 0-1 progress within current segment
  virtualTimeMs: number           // cumulative time across all segments
  allDone: boolean                // true when every segment has completed
}

// API:
const { start, tick, stop } = useNarrationSequencer()
start(segments, tone)       // begin from segment 0, speaks immediately
tick(speedMultiplier?)      // call each frame; returns SequencerTickResult | null
stop()                      // cancel TTS, deactivate
```

**Key behavior:** When audio is disabled, `speak()` resolves instantly, so gating depends solely on `animationDurationMs`. This gives a paced silent demo instead of racing through.

---

## Constant Demos (Layer 2 + 3)

### How revealProgress works

Every constant demo is driven by a single `revealProgress` value (0.0 to 1.0). This value controls:
- What the overlay renderer draws (which visual phase is active)
- How far along the narration is

The **demo state machine** in `useConstantDemo` manages the lifecycle:

```
idle → animating → presenting → fading → idle
```

During `animating`, the viewport flies to the target and `revealProgress` advances from 0 to 1. The **narration hook** (`useConstantDemoNarration`) takes over progress control by calling `setRevealProgress()` every frame, which pauses the default 15s auto-play.

### Files involved in a constant demo

For a constant called `foo`:

| File | Role |
|------|------|
| `fooDemo.ts` | Overlay renderer + viewport function. Reads `revealProgress`, draws on canvas. |
| `fooDemoNarration.ts` | Pure data: segments array + TTS tone string. |
| `useConstantDemo.ts` | State machine (shared by all demos). Register `foo` here. |
| `useConstantDemoNarration.ts` | Orchestrator (shared). Maps sequencer output to `revealProgress`. |
| `NumberLine.tsx` | Wiring: imports, config map, draw calls, event handlers. |

---

## Creating a New Constant Demo

### Step 1: Create the overlay renderer (`fooDemo.ts`)

This file exports two things:

```typescript
// 1. Viewport function — where to point the camera
export function fooDemoViewport(cssWidth: number, cssHeight: number) {
  return {
    center: FOO_VALUE / 2,      // center of the number line view
    pixelsPerUnit: cssWidth / 4  // zoom level
  }
}

// 2. Overlay renderer — draws the visualization
export function renderFooOverlay(
  ctx: CanvasRenderingContext2D,
  state: NumberLineState,
  cssWidth: number,
  cssHeight: number,
  isDark: boolean,
  revealProgress: number,   // 0-1, the main input
  opacity: number           // 0-1, for fade in/out
): void {
  ctx.globalAlpha = opacity

  // Use mapRange to convert global progress to phase-local 0-1
  const introP = mapRange(revealProgress, 0.00, 0.15)
  const mainP  = mapRange(revealProgress, 0.15, 0.80)
  const labelP = mapRange(revealProgress, 0.80, 1.00)

  if (introP > 0) { /* draw intro phase */ }
  if (mainP > 0)  { /* draw main phase */ }
  if (labelP > 0) { /* draw labels */ }

  ctx.globalAlpha = 1
}

function mapRange(v: number, start: number, end: number): number {
  if (v <= start) return 0
  if (v >= end) return 1
  return (v - start) / (end - start)
}
```

### Step 2: Create the narration data (`fooDemoNarration.ts`)

Pure data file, no React:

```typescript
import type { DemoNarrationSegment } from './useConstantDemoNarration'

export const FOO_DEMO_TONE =
  'You are a warm, encouraging guide for a really smart 5-year-old. ' +
  'Use everyday objects kids know. Be full of wonder.'

export const FOO_DEMO_SEGMENTS: DemoNarrationSegment[] = [
  {
    ttsText: 'Look at this! ...',
    startProgress: 0.00,
    endProgress: 0.15,
    animationDurationMs: 6000,
  },
  {
    ttsText: 'Now watch what happens ...',
    startProgress: 0.15,
    endProgress: 0.45,
    animationDurationMs: 7000,
  },
  // ... more segments ...
  {
    ttsText: 'And that number is called foo!',
    startProgress: 0.90,
    endProgress: 1.00,
    animationDurationMs: 6000,
  },
]
```

**Rules for segments:**
- `endProgress` of segment N **must equal** `startProgress` of segment N+1 (no gaps or overlaps)
- First segment starts at 0.00, last segment ends at 1.00
- `animationDurationMs` is the **minimum** time for that segment — if TTS takes longer, it waits
- Total duration across all segments should be 30-70 seconds
- Give important conceptual segments more progress range and longer duration
- Keep TTS text short enough for a 5-year-old's attention span (~2-4 sentences per segment)

**Tone guidelines:**
- Always specify the audience: "for a really smart 5-year-old"
- Ground in concrete objects kids know (cookies, wheels, plants, toys)
- Specify emotional register (warm, excited, amazed, gentle)
- Per-segment `ttsTone` overrides are available but rarely needed

### Step 3: Register in `useConstantDemo.ts`

Two changes:

```typescript
// 1. Add to DEMO_AVAILABLE set
export const DEMO_AVAILABLE = new Set(['phi', 'pi', 'tau', 'e', 'foo'])

// 2. Add viewport case in startDemo
import { fooDemoViewport } from './fooDemo'
// ...
} else if (constantId === 'foo') {
  target = fooDemoViewport(cssWidth, cssHeight)
}
```

### Step 4: Wire up in `NumberLine.tsx`

Four changes:

```typescript
// 1. Import narration data
import { FOO_DEMO_SEGMENTS, FOO_DEMO_TONE } from './constants/demos/fooDemoNarration'

// 2. Import overlay renderer
import { renderFooOverlay } from './constants/demos/fooDemo'

// 3. Add to NARRATION_CONFIGS (module-level, before the component)
const NARRATION_CONFIGS: Record<string, DemoNarrationConfig> = {
  e:   { segments: E_DEMO_SEGMENTS, tone: E_DEMO_TONE },
  pi:  { segments: PI_DEMO_SEGMENTS, tone: PI_DEMO_TONE },
  tau: { segments: TAU_DEMO_SEGMENTS, tone: TAU_DEMO_TONE },
  phi: { segments: PHI_DEMO_SEGMENTS, tone: PHI_DEMO_TONE },
  foo: { segments: FOO_DEMO_SEGMENTS, tone: FOO_DEMO_TONE },  // <-- add
}

// 4. Call renderer in draw() alongside the others (~line 466)
if (ds.phase !== 'idle' && ds.constantId === 'foo') {
  renderFooOverlay(
    ctx, stateRef.current, cssWidth, cssHeight,
    resolvedTheme === 'dark', ds.revealProgress, ds.opacity
  )
}
```

Everything else (narration auto-start, scrubber stop, demo reset) is already handled generically.

### Step 5: Register the constant itself

The number line renders constants from a data array. Ensure `foo` is listed there with its numeric value so it appears as a marker on the line. The `constantId` used everywhere must match the `id` in that array.

---

## Prime Tour

The prime tour uses a different orchestration pattern: instead of sweeping `revealProgress`, it flies between **stops** and uses `virtualTimeMs` to drive time-based overlays (like the sieve animation).

### State machine

```
idle → flying → dwelling → flying → ... → fading → idle
```

### Tour stop structure (`primeTourStops.ts`)

```typescript
interface PrimeTourStop {
  id: string                                    // unique key
  viewport: { center: number; pixelsPerUnit: number }  // camera target
  blurb: string                                 // short text shown in UI
  ttsText: string                               // full narration (fallback for non-segmented)
  ttsTone: string                               // voice direction
  hoverValue?: number                           // force-hover this prime
  highlightValues?: number[]                    // immediately highlight these
  highlightPhases?: HighlightPhase[]            // time-phased highlighting
  narrationSegments?: NarrationSegment[]        // segmented TTS (uses sequencer)
  minDwellMs: number                            // minimum time at this stop
  autoAdvance: boolean                          // auto-advance when narration finishes
}
```

### Adding a new tour stop

Add an entry to `PRIME_TOUR_STOPS` array in `primeTourStops.ts`:

```typescript
{
  id: 'twin-primes',
  viewport: { center: 30, pixelsPerUnit: 15 },
  blurb: 'Twin primes are pairs that differ by exactly 2!',
  ttsText: 'Look at these special pairs...',
  ttsTone: TOUR_TONE,
  highlightValues: [11, 13, 17, 19, 29, 31],
  narrationSegments: [
    {
      ttsText: 'See these two primes right next to each other?',
      animationDurationMs: 5000,
    },
    {
      ttsText: 'They are called twin primes — they differ by just two!',
      animationDurationMs: 5000,
    },
  ],
  highlightPhases: [
    { delayMs: 0, values: [11, 13] },
    { delayMs: 5000, values: [17, 19, 29, 31] },
  ],
  minDwellMs: 10000,
  autoAdvance: true,
}
```

**Key differences from constant demos:**
- No `startProgress`/`endProgress` — segments are time-based only
- `highlightPhases` uses `delayMs` from dwell start (driven by `virtualTimeMs` from sequencer)
- `narrationSegments` is optional — if absent, uses single `ttsText` with legacy speak pattern
- Tour stop ordering matters — the tour plays stops in array order

### Segmented vs non-segmented stops

**Segmented** (recommended for complex stops): `narrationSegments` array present. Uses `useNarrationSequencer` for dual-gated advancement. `virtualTimeMs` pauses between segments while waiting for TTS.

**Non-segmented** (simple stops): Only `ttsText`. Uses a single TTS call. `virtualTimeMs` = wall-clock dwell time (no pausing).

---

## How Narration Drives Progress (Constant Demos)

```
useConstantDemoNarration          useNarrationSequencer
       |                                  |
  startNarration(constantId)              |
       |                                  |
       +------ seqStart(segments, tone) --+
       |                                  |
  [RAF loop]                              |
       |                                  |
       +------ seqTick() ----------------+
       |       returns { segmentIndex,    |
       |         animFrac, allDone }      |
       |                                  |
  seg = segments[segmentIndex]            |
  progress = seg.startProgress            |
    + (seg.endProgress - seg.startProgress) * animFrac
       |
  setRevealProgress(progress)
       |
  useConstantDemo receives progress,
  sets isPaused=true (disables 15s auto-play)
       |
  draw() reads demoState.revealProgress
       |
  renderFooOverlay(... revealProgress ...)
```

---

## Checklist for New Demos

- [ ] Overlay renderer reads `revealProgress` and draws phases via `mapRange()`
- [ ] Viewport function returns `{ center, pixelsPerUnit }` for ideal framing
- [ ] Narration segments: boundaries align (no gaps), first starts at 0, last ends at 1
- [ ] Total animation duration is 30-70 seconds
- [ ] Registered in `DEMO_AVAILABLE` set and viewport switch in `useConstantDemo.ts`
- [ ] Added to `NARRATION_CONFIGS` in `NumberLine.tsx`
- [ ] Overlay render call added to `draw()` in `NumberLine.tsx`
- [ ] Tone is specific: audience, metaphors, emotional register
- [ ] TypeScript passes: `npx tsc --noEmit`
