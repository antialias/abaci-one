# Untangling Plan: useMagnifierTouch & usePrecisionMode

This document outlines a refactoring strategy to fully integrate the remaining hooks
while preserving all gameplay functionality.

## Problem Analysis

### 1. usePrecisionMode Circular Dependency

**Current design flaw**: `usePrecisionMode` was designed to internally call `usePointerLock`,
creating a dependency chain:

```
usePrecisionMode
  └─ needs currentZoom (to calculate isAtThreshold)
  └─ internally calls usePointerLock
       └─ provides pointerLocked
            └─ needed by useMagnifierZoom
                 └─ provides currentZoom
                      └─ needed by usePrecisionMode  ← CIRCULAR!
```

**Current MapRenderer workaround**: Uses `usePointerLock` directly, bypassing `usePrecisionMode`:
```typescript
// Lines 564-603 in MapRenderer.tsx
const canUsePrecisionMode = useCanUsePrecisionMode()
const { pointerLocked, ... } = usePointerLock({ containerRef, canUsePrecisionMode, ... })
const { targetZoom, getCurrentZoom, ... } = useMagnifierZoom({ ..., pointerLocked, ... })
```

### 2. useMagnifierTouch Tight Coupling

**Current touch handler structure** (~350 lines total):

| Section | Lines | Type | Description |
|---------|-------|------|-------------|
| Touch Start | 2785-2823 | Generic | Pinch/pan detection, state setup |
| Pinch Zoom | 2830-2845 | Generic | Two-finger zoom calculation |
| Pan Delta | 2847-2862 | Generic | Movement delta tracking |
| 1:1 Panning Math | 2864-2931 | Reusable | Viewport/magnifier coordinate transform |
| Region Detection | 2933-2943 | **Game** | detectRegions, setHoveredRegion |
| Hot/Cold Feedback | 2945-2971 | **Game** | checkHotCold for proximity hints |
| Auto-Zoom | 2973-2993 | **Game** | findOptimalZoom based on regions |
| Multiplayer Sync | 2995-3013 | **Game** | onCursorUpdate broadcast |
| Touch End State | 3040-3068 | Generic | Reset pinch/drag state |
| Tap-to-Select | 3071-3129 | **Game** | Region selection on tap |

**Problem**: Game-specific logic (~120 lines) is embedded inside touch handlers,
making `useMagnifierTouch` unusable as-is.

---

## Solution Architecture

### Phase A: Fix usePrecisionMode (Break the Circular Dependency)

**Strategy**: Split `usePrecisionMode` into two parts:
1. Keep `usePointerLock` as a standalone low-level hook
2. Create `usePrecisionCalculations` - a pure calculation hook that takes BOTH
   `pointerLocked` AND `currentZoom` as inputs

**New hook structure**:

```typescript
// usePrecisionCalculations.ts - NEW
interface UsePrecisionCalculationsOptions {
  containerRef: RefObject<HTMLDivElement>
  svgRef: RefObject<SVGSVGElement>
  viewBox: string
  currentZoom: number        // Input from useMagnifierZoom
  pointerLocked: boolean     // Input from usePointerLock
}

interface UsePrecisionCalculationsReturn {
  canUsePrecisionMode: boolean
  isAtThreshold: boolean
  screenPixelRatio: number
  shouldCapZoom: boolean
  maxZoomAtThreshold: number
}
```

**New dependency flow** (no cycles):

```
useCanUsePrecisionMode() → canUsePrecisionMode
         ↓
usePointerLock({ canUsePrecisionMode }) → pointerLocked
         ↓
useMagnifierZoom({ pointerLocked }) → currentZoom, setTargetZoom
         ↓
usePrecisionCalculations({ currentZoom, pointerLocked }) → isAtThreshold, shouldCapZoom
```

**Files to modify**:
- `features/precision/usePrecisionMode.ts` → Rename to `usePrecisionCalculations.ts`
- Remove internal `usePointerLock()` call
- Accept `pointerLocked` as input prop instead
- Update `features/precision/index.ts` exports

### Phase B: Decouple useMagnifierTouch with Event Callbacks

**Strategy**: Use an event-based architecture where the hook handles touch mechanics
and emits events for game logic to handle.

**New hook interface**:

```typescript
// useMagnifierTouch.ts - REVISED
interface MagnifierTouchEvents {
  // Called on each pan movement with new cursor position
  onCursorMove: (cursorPosition: { x: number; y: number }) => void

  // Called when pinch zoom changes
  onZoomChange: (newZoom: number) => void

  // Called when tap-to-select is detected (returns SVG coordinates)
  onTapSelect: (svgPosition: { x: number; y: number }) => void

  // Called when expansion should change (pinch triggers expand)
  onExpandChange?: (expanded: boolean) => void
}

interface UseMagnifierTouchOptions {
  // Required refs
  magnifierRef: RefObject<HTMLDivElement>
  containerRef: RefObject<HTMLDivElement>
  svgRef: RefObject<SVGSVGElement>

  // Magnifier state (from useMagnifierState)
  magnifierState: UseMagnifierStateReturn

  // Current state for calculations
  getCurrentZoom: () => number
  getCursorPosition: () => { x: number; y: number } | null

  // Viewport info for 1:1 panning
  viewBox: string
  isMagnifierExpanded: boolean

  // Limits
  maxZoom: number
  minZoom?: number

  // Event callbacks - game logic goes here
  events: MagnifierTouchEvents
}
```

**Usage in MapRenderer**:

```typescript
const magnifierTouch = useMagnifierTouch({
  magnifierRef,
  containerRef,
  svgRef,
  magnifierState,
  getCurrentZoom,
  getCursorPosition: () => cursorPositionRef.current,
  viewBox: mapData.viewBox,
  isMagnifierExpanded,
  maxZoom: MAX_ZOOM,
  events: {
    onCursorMove: (pos) => {
      // Update cursor state
      cursorPositionRef.current = pos
      setCursorPosition(pos)

      // Game-specific: region detection
      const { regionUnderCursor, detectedRegions, detectedSmallestSize } = detectRegions(pos.x, pos.y)
      if (regionUnderCursor !== hoveredRegion) setHoveredRegion(regionUnderCursor)

      // Game-specific: hot/cold feedback
      if (hotColdEnabledRef.current && currentPrompt) {
        checkHotCold({ cursorPosition: pos, ... })
      }

      // Game-specific: auto-zoom
      const zoomResult = findOptimalZoom({ detectedRegions, ... })
      setTargetZoom(zoomResult.zoom)

      // Game-specific: multiplayer sync
      if (onCursorUpdate) {
        onCursorUpdate(svgPosition, regionUnderCursor)
      }
    },
    onZoomChange: setTargetZoom,
    onTapSelect: (svgPos) => {
      const { regionUnderCursor } = detectRegions(svgPos.x, svgPos.y)
      if (regionUnderCursor) {
        handleRegionClickWithCelebration(regionUnderCursor, regionName)
      }
    },
    onExpandChange: setIsMagnifierExpanded,
  }
})
```

**What moves INTO the hook** (~150 lines):
- Touch state machine (pinch/pan/tap detection)
- 1:1 panning math (viewport calculations, touch multiplier)
- Coordinate transformations (screen → SVG)
- Pinch-to-zoom calculations

**What stays OUTSIDE via callbacks** (~120 lines):
- Region detection (detectRegions)
- Hot/cold feedback (checkHotCold)
- Auto-zoom calculation (findOptimalZoom)
- Multiplayer cursor sync (onCursorUpdate)
- Tap-to-select handling (handleRegionClickWithCelebration)

---

## Implementation Phases

### Phase A: usePrecisionCalculations ✅ COMPLETE (Fully Integrated)

**A.1** Create `usePrecisionCalculations` hook: ✅
```
features/precision/usePrecisionCalculations.ts
```
- Copy calculation logic from usePrecisionMode
- Remove internal usePointerLock call
- Accept pointerLocked as input prop
- Accept currentZoom as input prop
- Return: isAtThreshold, shouldCapZoom, maxZoomAtThreshold, screenPixelRatio

**A.2** Update precision feature exports: ✅
```
features/precision/index.ts
```
- Export usePrecisionCalculations
- Keep usePrecisionMode as deprecated alias (optional)

**A.3** Integrate in MapRenderer: ✅
- Keep existing usePointerLock + useMagnifierZoom calls
- Add usePrecisionCalculations after useMagnifierZoom
- Use isAtThreshold, shouldCapZoom from new hook
- Remove duplicated threshold calculations

**A.4** Type-check and test ✅

**Actual integration results:**
- **Scrim overlay**: Replaced ~35 line IIFE with `precisionCalcs.isAtThreshold`
- **Filter effect**: Replaced ~30 line IIFE with `precisionCalcs.isAtThreshold`
- **Pixel grid**: Replaced screenPixelRatio calculation with `precisionCalcs.screenPixelRatio`

**Cannot replace (uses different zoom values):**
- Auto-zoom capping: Uses `adaptiveZoom`, not `targetZoom`
- Zoom label: Uses animated `z` value from spring (needs animation interpolation)

### Phase B-Conservative: 1:1 Panning Math Extraction ✅ COMPLETE

Instead of the full hook refactor, we extracted the reusable panning math:

**Created**: `features/magnifier/panningMath.ts`

**Exported utilities:**
- `calculateViewportScale()` - SVG scaling to fit container
- `calculateMagnifierScale()` - content scaling within magnifier
- `calculateTouchMultiplier()` - 1:1 panning multiplier
- `applyPanDelta()` - apply touch delta with multiplier
- `clampToSvgBounds()` - constrain cursor to SVG bounds
- `parseViewBoxDimensions()` - parse SVG viewBox string

**Integration in MapRenderer:**
- Replaced ~50 lines of inline panning math in touch handler
- Uses `calculateTouchMultiplier()` and `applyPanDelta()`

**Benefits:**
- Testable utility functions
- Clear documentation of the math
- No breaking changes to touch handler structure
- Lower risk than full refactor

---

### Phase B-Full: useMagnifierTouch Refactor (DEFERRED - 4-5 hours)

**B.1** Define event types and interface:
```
features/magnifier/types.ts
```
- MagnifierTouchEvents interface
- UseMagnifierTouchOptions interface (revised)

**B.2** Refactor useMagnifierTouch hook:
```
features/magnifier/useMagnifierTouch.ts
```

Split into internal functions:
- `calculatePanDelta()` - touch delta calculation
- `calculate1To1Movement()` - 1:1 panning math
- `screenToSvgCoordinates()` - coordinate transform
- `handleTouchStart()` - with event emission
- `handleTouchMove()` - calls onCursorMove with calculated position
- `handleTouchEnd()` - calls onTapSelect when appropriate

**B.3** Create game callback adapter:
```
features/magnifier/useMagnifierGameCallbacks.ts
```

A convenience hook that creates the event callbacks for MapRenderer:
```typescript
interface UseMagnifierGameCallbacksOptions {
  detectRegions: (x: number, y: number) => DetectedRegions
  checkHotCold: (params: HotColdParams) => void
  findOptimalZoom: (params: ZoomParams) => ZoomResult
  onCursorUpdate?: (pos: SvgPosition, regionId: string | null) => void
  handleRegionClick: (regionId: string, regionName: string) => void
  // ... other game state
}

// Returns MagnifierTouchEvents ready to pass to useMagnifierTouch
export function useMagnifierGameCallbacks(options: UseMagnifierGameCallbacksOptions): MagnifierTouchEvents
```

**B.4** Integrate in MapRenderer:
```typescript
// Option 1: Direct inline callbacks (shown in Solution Architecture)
// Option 2: Use adapter hook
const gameCallbacks = useMagnifierGameCallbacks({
  detectRegions,
  checkHotCold,
  findOptimalZoom,
  onCursorUpdate,
  handleRegionClickWithCelebration,
})

const magnifierTouch = useMagnifierTouch({
  magnifierRef,
  // ...
  events: gameCallbacks,
})
```

**B.5** Update magnifier element:
```typescript
<div
  ref={magnifierRef}
  {...magnifierTouch.handlers}  // Spread touch handlers
  // ... rest of props
>
```

**B.6** Type-check and test thoroughly

---

## Risk Mitigation

### High-Risk Areas

1. **1:1 Panning Math**: Complex coordinate transforms.
   - Mitigation: Extract with unit tests, test on multiple device sizes

2. **Touch State Machine**: Edge cases in pinch-to-pan transitions
   - Mitigation: Keep existing logic, just restructure

3. **Tap vs Drag Detection**: 5px threshold, timing
   - Mitigation: Preserve existing constants and logic

### Testing Checklist

- [ ] Single-finger pan updates cursor position correctly
- [ ] 1:1 panning feels natural (content moves with finger)
- [ ] Pinch-to-zoom changes zoom smoothly
- [ ] Pinch auto-expands magnifier
- [ ] Tap (no movement) selects region under tap point
- [ ] Hot/cold feedback updates during pan
- [ ] Auto-zoom adjusts based on regions at cursor
- [ ] Multiplayer cursor syncs during pan
- [ ] Transition from pinch to pan works
- [ ] Transition from pan to pinch works

---

## Expected Outcomes

### Line Count Impact

| File | Before | After | Change |
|------|--------|-------|--------|
| MapRenderer.tsx | 5,338 | ~5,100 | -238 |
| useMagnifierTouch.ts | 307 | ~250 | -57 (callbacks out) |
| usePrecisionCalculations.ts | N/A | ~80 | +80 (new) |
| useMagnifierGameCallbacks.ts | N/A | ~100 | +100 (new) |

**Net effect**: MapRenderer reduced by ~240 lines, logic properly encapsulated.

### Architecture Benefits

1. **Testable**: Touch mechanics can be unit tested without game state
2. **Reusable**: useMagnifierTouch could be used in other games
3. **Maintainable**: Game logic changes don't require touching touch handlers
4. **Debuggable**: Clear separation of concerns makes issues easier to locate

---

## Alternative Approaches Considered

### A. Keep inline handlers, extract utilities
- Pros: Lower risk, minimal restructuring
- Cons: Doesn't solve the coupling problem, touch handlers stay in MapRenderer

### B. Full MagnifierProvider context
- Pros: Most elegant abstraction
- Cons: Overkill for current needs, performance overhead of context

### C. Custom events / EventEmitter pattern
- Pros: Maximum decoupling
- Cons: Over-engineering, harder to trace data flow

**Chosen approach (callbacks)**: Best balance of decoupling, testability, and implementation effort.

---

## Timeline

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| A: usePrecisionCalculations | 2-3 hours | None |
| B.1-B.2: Hook refactor | 2-3 hours | Phase A complete |
| B.3-B.6: Integration | 2 hours | B.1-B.2 complete |
| Testing & fixes | 1-2 hours | All phases complete |

**Total: 7-10 hours**
