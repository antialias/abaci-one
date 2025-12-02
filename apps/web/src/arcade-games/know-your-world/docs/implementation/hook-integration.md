# Pointer Lock & Zoom Hooks Integration Plan

## Overview

This document outlines the plan for integrating `usePointerLock` and `useMagnifierZoom` hooks into MapRenderer. These integrations are complex because the hooks manage tightly coupled state that's currently embedded throughout the component.

## Current State Analysis

### MapRenderer State (Lines 186-226)

**Zoom-related state:**

- `targetZoom` - Target zoom level (may be capped)
- `targetOpacity` - Fade in/out opacity
- `targetTop/targetLeft` - Magnifier positioning
- `uncappedAdaptiveZoomRef` - Stores uncapped zoom for pointer lock transitions
- `showMagnifier` - Whether magnifier is visible

**Pointer Lock-related state:**

- `pointerLocked` - Boolean indicating lock state
- `cursorPositionRef` - Container-relative cursor position
- `initialCapturePositionRef` - Saved position when lock acquired
- `isReleasingPointerLock` - Flag for release animation
- `cursorSquish` - Cursor distortion at boundaries

**Shared state:**

- `smallestRegionSize` - For adaptive cursor dampening (used by both systems)

### Hook State

**`useMagnifierZoom` manages:**

- `targetZoom` - Target zoom level
- `uncappedAdaptiveZoomRef` - Uncapped zoom reference
- Spring animation for zoom
- Pause/resume at threshold
- Zoom recalculation on pointer lock changes

**`usePointerLock` manages:**

- `pointerLocked` - Boolean state
- Event listeners (pointerlockchange, pointerlockerror)
- Callbacks: `onLockAcquired`, `onLockReleased`

## Key Challenges

### 1. State Overlap

**Problem:** Both MapRenderer and `useMagnifierZoom` manage:

- `targetZoom` state
- `uncappedAdaptiveZoomRef`
- Zoom animation logic
- Pointer lock awareness

**Impact:** Can't simply replace one with the other without coordinating state.

### 2. Multiple Spring Properties

**Problem:** MapRenderer animates 5 properties together:

- `zoom` (handled by useMagnifierZoom)
- `opacity` (fade in/out)
- `top`/`left` (positioning)
- `movementMultiplier` (cursor dampening)

**Impact:** `useMagnifierZoom` only handles zoom spring. Other properties need separate management.

### 3. Pointer Lock Callbacks Are Complex

**Problem:** MapRenderer's pointer lock event handler does:

- Saves initial cursor position
- Resets cursor squish
- Recalculates and caps zoom on release
- Updates target zoom to uncapped value on acquisition

**Impact:** `usePointerLock` provides simple callbacks, but MapRenderer needs deep integration with zoom logic.

### 4. Zoom Recalculation Logic

**Problem:** MapRenderer has ~70 lines of zoom recalculation logic (lines 265-340) that:

- Checks if refs are available
- Calculates screen pixel ratio
- Determines if capping is needed
- Updates target zoom appropriately

**Impact:** This logic is duplicated in `useMagnifierZoom` but with subtle differences.

## Integration Strategy

### Option A: Incremental Integration (Recommended)

Integrate hooks gradually, starting with the simplest pieces.

**Phase 1: Integrate usePointerLock (Simple)**

**Steps:**

1. Add `usePointerLock` hook initialization
2. Use hook's `pointerLocked` state instead of local state
3. Implement `onLockAcquired` callback to handle:
   - Save initial cursor position
   - Reset cursor squish
4. Implement `onLockReleased` callback to handle:
   - Reset cursor squish
   - Reset release animation flag
   - Trigger zoom recalculation (keep inline for now)
5. Remove local `pointerLocked` state
6. Remove pointer lock event listeners from MapRenderer
7. Update `handleContainerClick` to use hook's `requestPointerLock()`

**Lines to remove:** ~120 lines (event listeners + handler)
**Lines to add:** ~40 lines (hook initialization + callbacks)
**Net reduction:** ~80 lines

**Phase 2: Integrate useMagnifierZoom (Complex)**

**Steps:**

1. Split MapRenderer's spring into two:
   - Use `useMagnifierZoom` for zoom animation
   - Keep local spring for opacity/position/movementMultiplier
2. Replace `targetZoom` state with hook's `targetZoom`
3. Replace `uncappedAdaptiveZoomRef` with hook's ref
4. Remove inline zoom recalculation logic (hook handles it)
5. Update all `setTargetZoom` calls to use hook's setter
6. Coordinate animation pausing between hook and local spring

**Complexity:** High - requires careful coordination of two separate springs

**Lines to remove:** ~150 lines (zoom effect, recalculation logic)
**Lines to add:** ~30 lines (hook initialization)
**Net reduction:** ~120 lines

**Total Reduction:** ~200 lines (-9%)

### Option B: Redesign Hooks to Match MapRenderer

Instead of forcing MapRenderer to use the existing hooks, redesign the hooks to match MapRenderer's actual needs.

**useMagnifierSystem hook** - All-in-one hook that manages:

- Zoom state and animation
- Pointer lock state and events
- Opacity/position animation
- Cursor position tracking
- Movement multiplier calculation

**Pros:**

- Better encapsulation
- Single source of truth
- Cleaner component code

**Cons:**

- Requires rewriting hooks
- More complex hook
- Takes more time

**Estimated line reduction:** ~250 lines (-12%)

### Option C: Keep Current Architecture

Recognize that the remaining hooks aren't a good fit and leave them as reference implementations.

**Pros:**

- No risk of breaking working code
- Already achieved 11.6% reduction
- Hooks serve as documentation

**Cons:**

- Leaves 200+ lines of complex logic in component
- Missed opportunity for further cleanup

## Detailed Integration Plan (Option A)

### Phase 1: usePointerLock Integration

**1. Add hook import and initialization:**

```typescript
import { usePointerLock } from "../hooks/usePointerLock";

// Inside component, after containerRef
const { pointerLocked, requestPointerLock, exitPointerLock } = usePointerLock({
  containerRef,
  onLockAcquired: () => {
    // Save initial cursor position
    if (cursorPositionRef.current) {
      initialCapturePositionRef.current = { ...cursorPositionRef.current };
      console.log(
        "[Pointer Lock] 📍 Saved initial capture position:",
        initialCapturePositionRef.current,
      );
    }

    // Update target zoom to uncapped value
    if (uncappedAdaptiveZoomRef.current !== null) {
      console.log(
        `[Pointer Lock] Updating target zoom to uncapped value: ${uncappedAdaptiveZoomRef.current.toFixed(1)}×`,
      );
      setTargetZoom(uncappedAdaptiveZoomRef.current);
    }
  },
  onLockReleased: () => {
    console.log(
      "[Pointer Lock] 🔓 RELEASED - Starting cleanup and zoom recalculation",
    );

    // Reset cursor squish
    setCursorSquish({ x: 1, y: 1 });
    setIsReleasingPointerLock(false);

    // Recalculate zoom with capping (keep inline for now)
    if (
      uncappedAdaptiveZoomRef.current !== null &&
      containerRef.current &&
      svgRef.current
    ) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const svgRect = svgRef.current.getBoundingClientRect();
      const magnifierWidth = containerRect.width * 0.5;
      const viewBoxParts = mapData.viewBox.split(" ").map(Number);
      const viewBoxWidth = viewBoxParts[2];

      if (viewBoxWidth && !Number.isNaN(viewBoxWidth)) {
        const uncappedZoom = uncappedAdaptiveZoomRef.current;
        const screenPixelRatio = calculateScreenPixelRatio({
          magnifierWidth,
          viewBoxWidth,
          svgWidth: svgRect.width,
          zoom: uncappedZoom,
        });

        if (isAboveThreshold(screenPixelRatio, PRECISION_MODE_THRESHOLD)) {
          const maxZoom = calculateMaxZoomAtThreshold(
            PRECISION_MODE_THRESHOLD,
            magnifierWidth,
            svgRect.width,
          );
          const cappedZoom = Math.min(uncappedZoom, maxZoom);
          console.log(
            `[Pointer Lock] ✅ Capping zoom: ${uncappedZoom.toFixed(1)}× → ${cappedZoom.toFixed(1)}×`,
          );
          setTargetZoom(cappedZoom);
        }
      }
    }
  },
});
```

**2. Remove local state and event listeners:**

Delete lines 203, 245-368 (pointer lock state + event listeners)

**3. Update handleContainerClick:**

```typescript
const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
  if (!pointerLocked && containerRef.current) {
    requestPointerLock();
    console.log("[Pointer Lock] 🔒 Silently requested (user clicked map)");
  }
};
```

**4. Test thoroughly:**

- Pointer lock activates on click
- Cursor position saved correctly
- Zoom updates to uncapped on acquisition
- Zoom recalculates with capping on release
- Escape key releases lock

### Phase 2: useMagnifierZoom Integration (After Phase 1 Complete)

**1. Add hook import and initialization:**

```typescript
import { useMagnifierZoom } from "../hooks/useMagnifierZoom";

// Replace targetZoom state and uncappedAdaptiveZoomRef
const {
  targetZoom,
  setTargetZoom,
  zoomSpring,
  getCurrentZoom,
  uncappedAdaptiveZoomRef,
} = useMagnifierZoom({
  containerRef,
  svgRef,
  viewBox: mapData.viewBox,
  threshold: PRECISION_MODE_THRESHOLD,
  pointerLocked,
  initialZoom: 10,
});
```

**2. Create separate spring for other properties:**

```typescript
const [magnifierSpring, magnifierApi] = useSpring(
  () => ({
    opacity: targetOpacity,
    top: targetTop,
    left: targetLeft,
    movementMultiplier: getMovementMultiplier(smallestRegionSize),
    config: (key) => {
      if (key === "opacity") {
        return targetOpacity === 1 ? { duration: 100 } : { duration: 1000 };
      }
      if (key === "movementMultiplier") {
        return { tension: 180, friction: 26 };
      }
      return { tension: 200, friction: 25 }; // position
    },
  }),
  [targetOpacity, targetTop, targetLeft, smallestRegionSize],
);
```

**3. Remove zoom recalculation from onLockReleased:**

The hook now handles zoom recalculation automatically.

**4. Remove zoom animation effect:**

Delete lines 476-577 (zoom effect with pause/resume logic).

**5. Update rendering to use both springs:**

```typescript
<animated.div
  style={{
    zoom: zoomSpring, // From useMagnifierZoom
    opacity: magnifierSpring.opacity, // From local spring
    top: magnifierSpring.top,
    left: magnifierSpring.left,
    // ...
  }}
>
```

**6. Test thoroughly:**

- Zoom animates smoothly
- Animation pauses at threshold
- Pointer lock resumes animation
- Opacity/position still animate correctly
- Movement multiplier updates

## Risk Assessment

**Low Risk:**

- Phase 1 (usePointerLock integration) - Well-defined boundaries, simple callbacks

**Medium Risk:**

- Coordinating two separate springs (zoom vs. position/opacity)
- Ensuring animation synchronization

**High Risk:**

- Phase 2 subtle differences in zoom calculation logic
- Race conditions between hook effects and component effects

## Testing Checklist

After each phase:

- [ ] Magnifier appears when hovering over small regions
- [ ] Magnifier disappears when moving away
- [ ] Zoom adapts to region size correctly
- [ ] Pointer lock activates on click
- [ ] Zoom caps at threshold when not locked
- [ ] Zoom uncaps when pointer lock activates
- [ ] Animation pauses at threshold
- [ ] Animation resumes when lock activates
- [ ] Escape key releases pointer lock
- [ ] Zoom recalculates and animates on lock release
- [ ] Cursor speed dampening works (Gibraltar ultra-slow)
- [ ] No console errors or warnings
- [ ] TypeScript compiles without errors

## Recommendation

**Start with Phase 1 (usePointerLock integration):**

- Lower risk
- Clear benefits (~80 line reduction)
- Tests the integration approach
- Can stop here if Phase 2 proves too complex

**Evaluate Phase 2 after Phase 1:**

- If Phase 1 goes smoothly, proceed with Phase 2
- If issues arise, consider Option C (keep current architecture)

## Next Steps

1. Create a new branch: `refactor/integrate-pointer-lock-hook`
2. Implement Phase 1 integration
3. Test thoroughly
4. Commit and review
5. Decide whether to proceed with Phase 2

## Files to Modify

**Phase 1:**

- `components/MapRenderer.tsx` - Add hook, remove event listeners

**Phase 2:**

- `components/MapRenderer.tsx` - Add zoom hook, split spring, remove effects

**Phase 2 (if redesigning):**

- Create new `hooks/useMagnifierSystem.ts`
- Deprecate `hooks/usePointerLock.ts` and `hooks/useMagnifierZoom.ts`
