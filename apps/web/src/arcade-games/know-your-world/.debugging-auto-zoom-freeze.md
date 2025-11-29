# Debugging Auto Zoom Freeze Issue

## Problem Description

**Symptom:** Sometimes the auto zoom gets stuck at the current zoom level and never changes, even when moving the cursor to different regions.

**Frequency:** Intermittent (doesn't always happen)

## How Auto Zoom Works

### Call Chain

1. **Mouse Move** → `handleMouseMove()` in MapRenderer.tsx:959
2. **Region Detection** → `detectRegions()` via `useRegionDetection` hook
3. **Zoom Search** → `findOptimalZoom()` in adaptiveZoomSearch.ts:160
4. **Set Target** → `setTargetZoom(adaptiveZoom)` in MapRenderer.tsx:1104
5. **Animate** → `useMagnifierZoom` effect in useMagnifierZoom.ts:140

### Key State Flow

```
handleMouseMove()
  → detectRegions(cursorX, cursorY)
  → findOptimalZoom({ detectedRegions, ... })
  → setTargetZoom(adaptiveZoom)
  → useMagnifierZoom effect triggers
  → magnifierApi.start({ zoom: targetZoom })
```

## Potential Causes

### 1. React Spring Animation Paused

**Location:** `useMagnifierZoom.ts:209-213`

**Logic:**

```typescript
const shouldPause =
  currentIsAtThreshold && zoomIsAnimating && targetIsAtThreshold;

if (shouldPause) {
  console.log(
    "[useMagnifierZoom] ⏸️  Pausing at threshold - waiting for precision mode",
  );
  magnifierApi.pause();
}
```

**Hypothesis:** Animation gets paused and never resumes because:

- Both current and target zoom are at threshold
- Pointer lock is not active
- New target zoom is also at threshold
- `shouldPause` remains true indefinitely

**Debug Steps:**

1. Check console logs for "⏸️ Pausing at threshold" messages
2. Verify if pause happens just before freeze
3. Check if targetZoom is changing but spring is paused

### 2. setTargetZoom Not Being Called

**Location:** `MapRenderer.tsx:1104`

**Conditions required for setTargetZoom:**

- `shouldShow = hasSmallRegion` must be true (line 1010)
- `hasSmallRegion` requires detected region < 15px (line 1010)
- `findOptimalZoom()` must run successfully

**Hypothesis:** Detection stops finding small regions, so zoom never updates

**Debug Steps:**

1. Check if console logs show "SHOWING with zoom:" messages
2. Verify `hasSmallRegion` state when freeze occurs
3. Check if regions are still being detected

### 3. Effect Dependencies Not Triggering

**Location:** `useMagnifierZoom.ts:222-231`

**Dependencies:**

```typescript
}, [
  targetZoom,        // Changes when setTargetZoom called
  pointerLocked,     // Changes when pointer lock state changes
  viewBox,           // Should be stable
  threshold,         // Should be stable (20)
  containerRef,      // Should be stable
  svgRef,            // Should be stable
  magnifierApi,      // Should be stable
  magnifierSpring.zoom, // Spring value - might not trigger correctly?
])
```

**Hypothesis:** Effect not re-running when targetZoom changes

**Debug Steps:**

1. Add console.log at top of effect with all deps
2. Verify effect runs when targetZoom changes
3. Check if magnifierSpring.zoom dep causes issues

### 4. Race Condition in Pause/Resume Logic

**Location:** `useMagnifierZoom.ts:214-221`

**Logic:**

```typescript
} else {
  // Resume/update animation
  if (currentIsAtThreshold && !targetIsAtThreshold) {
    console.log('[useMagnifierZoom] ▶️  Resuming - target zoom is below threshold')
  }
  console.log('[useMagnifierZoom] 🎬 Starting/updating animation to:', targetZoom.toFixed(1))
  magnifierApi.start({ zoom: targetZoom })
}
```

**Hypothesis:** Race between pause() and start() calls leads to inconsistent state

**Debug Steps:**

1. Check timing of pause vs start calls in logs
2. Verify spring state when freeze occurs
3. Test if manually calling `.start()` unfreezes it

## Debug Logging Strategy

### What to Log When Freeze Occurs

1. **Mouse movement:**
   - Is handleMouseMove still being called?
   - What cursor position values?

2. **Region detection:**
   - Are regions still being detected?
   - What's the value of hasSmallRegion?
   - What's detectedSmallestSize?

3. **Zoom calculation:**
   - Is findOptimalZoom being called?
   - What zoom does it return?
   - Is setTargetZoom being called with new values?

4. **Spring state:**
   - What's currentZoom (magnifierSpring.zoom.get())?
   - What's targetZoom?
   - Is the spring paused?
   - What's currentIsAtThreshold and targetIsAtThreshold?

5. **Effect execution:**
   - Is the animation effect (line 140) running?
   - What are the dep values?
   - Is it hitting the pause branch or start branch?

## Instrumentation Plan

### Phase 1: Confirm Symptoms

Add debug logging to determine which layer is failing:

```typescript
// In MapRenderer.tsx handleMouseMove
console.log("[DEBUG FREEZE] Mouse move:", {
  cursorX,
  cursorY,
  hasSmallRegion,
  detectedSmallestSize,
});

// After findOptimalZoom call
console.log("[DEBUG FREEZE] Zoom search result:", {
  adaptiveZoom,
  wasCalled: true,
  willSetTarget: shouldShow,
});

// Before setTargetZoom
console.log("[DEBUG FREEZE] About to setTargetZoom:", adaptiveZoom);
```

### Phase 2: Instrument useMagnifierZoom

```typescript
// At start of animation effect
console.log("[DEBUG FREEZE] Animation effect running:", {
  currentZoom: magnifierSpring.zoom.get(),
  targetZoom,
  zoomIsAnimating,
  currentIsAtThreshold,
  targetIsAtThreshold,
  shouldPause,
  isPaused: magnifierApi.is("paused"), // If this API exists
});
```

### Phase 3: Add State Snapshot Function

Add keyboard shortcut to dump all relevant state when freeze is detected:

```typescript
// In MapRenderer
useEffect(
  () => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "d" && e.shiftKey) {
        console.log("[DEBUG SNAPSHOT]", {
          cursorPosition: cursorPositionRef.current,
          targetZoom,
          currentZoom: getCurrentZoom(),
          showMagnifier,
          hasSmallRegion,
          detectedSmallestSize: smallestRegionSize,
          pointerLocked,
          // Add more relevant state
        });
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  },
  [
    /* relevant deps */
  ],
);
```

## Testing Scenarios

1. **Move cursor slowly across small regions**
   - Does freeze happen at region boundaries?

2. **Move cursor quickly**
   - Does rapid movement trigger freeze?

3. **Enter/exit pointer lock mode**
   - Does freeze happen during mode transitions?

4. **Hover over regions at threshold zoom**
   - Does staying at capped zoom cause freeze?

5. **Check different map areas**
   - Does freeze happen more in certain locations?
   - Gibraltar (0.08px) vs larger regions?

## Expected Behaviors

### Normal Operation

1. Mouse moves → handleMouseMove called
2. Regions detected → findOptimalZoom called
3. New zoom calculated → setTargetZoom called
4. Effect runs → magnifierApi.start() called
5. Spring animates to new zoom

### At Threshold (Normal)

1. Zoom reaches threshold → shouldPause = true
2. Spring paused → waits for pointer lock
3. User clicks → pointer lock acquired
4. pointerLocked changes → effect runs
5. shouldPause = false → magnifierApi.start() called
6. Spring resumes to uncapped zoom

### Freeze State (Bug)

1. ❓ Something happens
2. ❓ Spring becomes permanently paused/stuck
3. ❓ Or setTargetZoom stops being called
4. ❓ Or effect stops running
5. Zoom never changes regardless of cursor movement

## Next Steps

1. Add Phase 1 instrumentation
2. Reproduce freeze
3. Analyze logs to identify failing layer
4. Add Phase 2/3 instrumentation as needed
5. Identify root cause
6. Implement fix
7. Verify fix doesn't break normal operation
