# Region Found Celebration Plan

## Problem

When a user correctly clicks on a region, the game immediately transitions to the next region with no celebration. Kids deserve positive reinforcement for correct answers!

## Current Flow

```
User clicks region → onRegionClick(id, name)
                    → Provider.clickRegion()
                    → Validator: isCorrect?
                       → Add to regionsFound
                       → Set next currentPrompt
                    → State updates
                    → MapRenderer re-renders with new prompt
```

The transition is instant - no pause, no celebration, no feedback.

## User Requirements

1. ✅ Gold flash effect on found region
2. ✅ Confetti burst
3. ✅ Responsive to HOW they found it:
   - **Fast find** → Quick, snappy celebration (reward speed)
   - **Hard-earned find** → Bigger, more satisfying celebration (acknowledge effort)
4. ✅ Sound effect (NOT speech synthesis - that's for hot/cold)
5. ✅ Block advancement until celebration completes (map gets cluttered)
6. ❌ No streaks for now

---

## Celebration Types

### 1. Lightning Find ⚡ (< 3 seconds)

Kid knew exactly where to look - reward the speed!

- **Flash**: Quick, bright gold pulse (400ms)
- **Confetti**: Fast, sparkly burst (small particles, quick fade)
- **Sound**: Quick "ding!" or sparkle
- **Duration**: ~800ms total

### 2. Standard Find ✨ (3-15 seconds, direct path)

Normal discovery - celebrate appropriately

- **Flash**: Smooth gold pulse (600ms)
- **Confetti**: Medium burst with gravity fall
- **Sound**: Pleasant chime
- **Duration**: ~1.2 seconds total

### 3. Hard-Earned Find 💪 (searched extensively)

Kid really worked for it - acknowledge the effort!

- **Flash**: Warm, satisfying glow (800ms)
- **Confetti**: Big celebration! More particles, longer duration
- **Sound**: Triumphant fanfare/chord
- **Duration**: ~1.8 seconds total
- **Extra**: Maybe show encouraging text "You found it!"

---

## Detecting Celebration Type

### Data Available from Hot/Cold System

The `useHotColdFeedback` hook already tracks:

```typescript
interface PathEntry {
  x: number
  y: number
  timestamp: number
  distance: number  // Distance to target at this point
}

// In HotColdState:
history: PathEntry[]           // Circular buffer of recent positions
totalDistanceChange: number    // Cumulative movement toward/away from target
minDistanceSinceLastFeedback   // Got close then moved away?
```

### Metrics for Effort Detection

```typescript
interface SearchMetrics {
  // Time
  timeToFind: number; // ms from prompt start to correct click

  // Distance traveled
  totalCursorDistance: number; // Total pixels cursor moved (from history)
  straightLineDistance: number; // Direct path would have been
  searchEfficiency: number; // straight / total (1.0 = perfect, <0.3 = searched hard)

  // Direction changes
  directionReversals: number; // How many times changed direction toward/away

  // Near misses
  nearMissCount: number; // Times got within CLOSE threshold then moved away
  overshotCount: number; // Times passed the target

  // Zone transitions
  zoneTransitions: number; // warming→cooling→warming transitions
}
```

### Classification Logic

```typescript
function classifyCelebration(
  metrics: SearchMetrics,
): "lightning" | "standard" | "hard-earned" {
  // Lightning: Fast and direct
  if (metrics.timeToFind < 3000 && metrics.searchEfficiency > 0.7) {
    return "lightning";
  }

  // Hard-earned: Any of these indicate real effort
  if (
    metrics.timeToFind > 20000 || // Took a while
    metrics.searchEfficiency < 0.3 || // Wandered a lot
    metrics.directionReversals > 10 || // Lots of back-and-forth
    metrics.nearMissCount > 2 || // Got close multiple times
    metrics.overshotCount > 1 // Passed it more than once
  ) {
    return "hard-earned";
  }

  return "standard";
}
```

---

## New Flow with Celebration

```
User clicks region → onRegionClick(id, name)
                    → MapRenderer intercepts (is correct?)
                       → YES: Start celebration
                              - Calculate celebration type from search metrics
                              - Show flash + confetti + sound
                              - Block further clicks
                              - After animation complete:
                                → Call actual clickRegion()
                                → Advance to next prompt
                       → NO: Normal wrong-answer handling
```

### Key Change: Delay State Update

Instead of immediately calling `clickRegion` and advancing, we:

1. Detect correct click locally in MapRenderer
2. Start celebration animation
3. Block input during celebration
4. Only AFTER celebration completes, send the click to the server/validator

This ensures the map doesn't clutter with the next prompt while celebrating.

---

## State Additions

### Provider Context (client-side only)

```typescript
// Add to Provider.tsx context
interface CelebrationState {
  regionId: string;
  regionName: string;
  type: "lightning" | "standard" | "hard-earned";
  startTime: number;
}

const [celebration, setCelebration] = useState<CelebrationState | null>(null);
```

### Expose Search Metrics from Hot/Cold Hook

```typescript
// Add to useHotColdFeedback return value
export function useHotColdFeedback(...) {
  // ... existing code ...

  // New: expose metrics for celebration classification
  const getSearchMetrics = useCallback((): SearchMetrics => {
    const state = stateRef.current
    const entries = getRecentEntries(state, HISTORY_LENGTH)
      .filter((e): e is PathEntry => e !== null)

    // Calculate metrics from history...
    return {
      timeToFind: /* time since prompt started */,
      totalCursorDistance: /* sum of distances between consecutive points */,
      straightLineDistance: /* first point to target */,
      searchEfficiency: /* straight / total */,
      directionReversals: /* count sign changes in distance delta */,
      nearMissCount: /* count entries with distance < CLOSE */,
      overshotCount: /* from existing detection */,
      zoneTransitions: /* count zone changes */,
    }
  }, [])

  return {
    checkPosition,
    reset,
    isSpeaking,
    lastFeedbackType,
    getSearchMetrics,  // NEW
  }
}
```

---

## Sound Effects

### Options for Sound Generation

1. **Web Audio API** - Generate tones programmatically (no files needed)
2. **Audio files** - Pre-recorded sounds (more polished, adds to bundle)
3. **Tone.js library** - Rich audio synthesis (adds dependency)

**Recommendation**: Web Audio API for MVP (no deps, small)

### Sound Design

```typescript
// useCelebrationSound.ts
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playLightningSound() {
  // Quick sparkle: high frequency, fast decay
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(1200, audioContext.currentTime);
  osc.frequency.exponentialRampToValueAtTime(
    2400,
    audioContext.currentTime + 0.1,
  );

  gain.gain.setValueAtTime(0.3, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

  osc.connect(gain).connect(audioContext.destination);
  osc.start();
  osc.stop(audioContext.currentTime + 0.2);
}

function playStandardSound() {
  // Pleasant chime: medium frequency, gentle decay
  // Two-note chord for warmth
}

function playHardEarnedSound() {
  // Triumphant: ascending notes, longer sustain
  // Maybe C-E-G chord arpeggio
}
```

---

## Visual Components

### 1. Gold Flash Effect

```typescript
// In MapRenderer, for the found region path
const isFlashing = celebration?.regionId === region.id

// Animated fill using react-spring
const flashSpring = useSpring({
  glow: isFlashing ? 1 : 0,
  config: {
    duration: celebration?.type === 'lightning' ? 400
            : celebration?.type === 'hard-earned' ? 800
            : 600
  },
})

// SVG path style
style={{
  fill: flashSpring.glow.to(g =>
    g > 0 ? `rgba(251, 191, 36, ${0.5 + g * 0.5})` : normalFill
  ),
  filter: flashSpring.glow.to(g =>
    g > 0 ? `drop-shadow(0 0 ${g * 15}px rgba(251, 191, 36, 0.8))` : 'none'
  ),
}}
```

### 2. Confetti Component

```typescript
// components/Confetti.tsx
interface ConfettiProps {
  type: "lightning" | "standard" | "hard-earned";
  origin: { x: number; y: number }; // Screen coordinates
  onComplete: () => void;
}

const CONFETTI_CONFIG = {
  lightning: { count: 12, duration: 600, spread: 60 },
  standard: { count: 20, duration: 1000, spread: 90 },
  "hard-earned": { count: 35, duration: 1500, spread: 120 },
};

function Confetti({ type, origin, onComplete }: ConfettiProps) {
  const config = CONFETTI_CONFIG[type];

  // Generate particles with random directions, colors, sizes
  // Use CSS animations for performance
  // Call onComplete when last particle finishes
}
```

### 3. Celebration Overlay

```typescript
// components/CelebrationOverlay.tsx
interface CelebrationOverlayProps {
  celebration: CelebrationState
  regionCenter: { x: number; y: number }
  onComplete: () => void
}

function CelebrationOverlay({ celebration, regionCenter, onComplete }: CelebrationOverlayProps) {
  const [phase, setPhase] = useState<'active' | 'complete'>('active')

  // Track when all animations complete
  const handleConfettiComplete = useCallback(() => {
    setPhase('complete')
    onComplete()
  }, [onComplete])

  return (
    <div className={css({ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1000 })}>
      <Confetti
        type={celebration.type}
        origin={regionCenter}
        onComplete={handleConfettiComplete}
      />

      {celebration.type === 'hard-earned' && (
        <EncouragingText regionName={celebration.regionName} />
      )}
    </div>
  )
}
```

---

## Files to Create/Modify

### New Files

1. **`hooks/useCelebrationSound.ts`** - Web Audio API sound effects
2. **`hooks/useSearchMetrics.ts`** - Extract metrics from hot/cold history
3. **`components/Confetti.tsx`** - CSS confetti particles
4. **`components/CelebrationOverlay.tsx`** - Orchestrates celebration

### Modified Files

1. **`Provider.tsx`** - Add celebration state to context
2. **`hooks/useHotColdFeedback.ts`** - Expose `getSearchMetrics()` method
3. **`MapRenderer.tsx`** - Intercept correct clicks, trigger celebration, delay advancement

---

## Implementation Order

### Phase 1: Infrastructure

1. Add `celebration` state to Provider context
2. Add `promptStartTime` tracking (when each region prompt begins)
3. Modify `useHotColdFeedback` to expose `getSearchMetrics()`

### Phase 2: Classification

4. Create `useSearchMetrics` hook to calculate metrics
5. Implement `classifyCelebration()` function
6. Test metric calculation with various search patterns

### Phase 3: Visuals

7. Create `Confetti` component with CSS animations
8. Add gold flash effect to MapRenderer (react-spring)
9. Create `CelebrationOverlay` to orchestrate

### Phase 4: Audio

10. Create `useCelebrationSound` hook with Web Audio API
11. Implement three sound types (lightning, standard, hard-earned)
12. Wire up sounds to celebration types

### Phase 5: Integration

13. Intercept correct clicks in MapRenderer
14. Block advancement during celebration
15. Call `clickRegion` only after celebration completes

### Phase 6: Polish

16. Add `prefers-reduced-motion` support
17. Test on mobile (performance, touch)
18. Fine-tune timing and particle counts

---

## Accessibility

1. **Reduced Motion**: `@media (prefers-reduced-motion: reduce)`
   - Skip confetti entirely
   - Use simple color change instead of flash
   - Sound still plays (audio is separate preference)

2. **Sound Preferences**: Respect system mute / browser audio block
   - Don't crash if AudioContext is blocked
   - Degrade gracefully

---

## Performance Budget

- Confetti particles: Max 35 (hard-earned), CSS-animated
- Flash effect: Single react-spring animation
- Sound: Single Web Audio oscillator (or two for chords)
- No canvas, no heavy libraries

---

## Timing Summary

| Type           | Flash | Confetti | Sound | Total Block |
| -------------- | ----- | -------- | ----- | ----------- |
| Lightning ⚡   | 400ms | 600ms    | 200ms | 600ms       |
| Standard ✨    | 600ms | 1000ms   | 400ms | 1000ms      |
| Hard-earned 💪 | 800ms | 1500ms   | 600ms | 1500ms      |
