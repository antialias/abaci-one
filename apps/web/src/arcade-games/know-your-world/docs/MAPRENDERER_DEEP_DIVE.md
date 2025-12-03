# MapRenderer Deep Dive Analysis

**Last Updated:** December 2024

## Current State: 3593 lines (was 4679)

### Progress So Far
- ✅ CompassCrosshair extracted (~80 lines)
- ✅ MapRendererContext created and integrated
- ✅ HotColdDebugPanel extracted (~93 lines)
- ✅ SafeZoneDebugPanel extracted (~150 lines)
- ✅ CursorOverlay extracted (~104 lines)
- ✅ hotColdStyles utilities extracted (~234 lines)
- ✅ RegionLayer extracted (~119 lines)
- ✅ OtherPlayerCursors extracted (~148 lines) - `features/multiplayer/`
- ✅ DebugAutoZoomPanel extracted (~128 lines) - `features/debug/`
- ✅ useUserPreferences hook extracted (~43 lines) - `features/user-preferences/`

**Total reduction: 1086 lines (23.2%)**

### Hook/State Explosion

| Hook Type | Count | Problem |
|-----------|-------|---------|
| useState | 27 | Fragmented state, hard to track relationships |
| useRef | 30 | Many are for coordination between effects |
| useCallback | 25 | Mostly to prevent effect re-runs |
| useEffect | 25 | Many interdependent, hard to reason about |
| useMemo | 9 | Could be more |
| Props | ~28 | Way too many - prop drilling nightmare |

### Code Distribution (approximate)

| Section | Lines | % |
|---------|-------|---|
| Imports | 63 | 1% |
| Utility functions (heat colors, etc) | 260 | 6% |
| Types/Interfaces | 100 | 2% |
| Component body (hooks/state/effects) | 2650 | 57% |
| JSX return | 1600 | 34% |

---

## Root Causes

### 1. **No Domain Separation**

Everything is in one component:
- Map rendering (SVG regions, paths, glows)
- Magnifier system (overlay, zoom, position)
- Cursor system (custom cursor, compass crosshair)
- Hot/cold feedback system
- Pointer lock / precision mode
- Touch gestures (pinch, pan, drag)
- Debug visualizations
- Network multiplayer cursors
- Celebration/hint/give-up animations

### 2. **Duplicated JSX**

The compass crosshair appears **TWICE** (lines 3616-3671 AND 3761-3816):
- Once in the custom cursor
- Once in the heat crosshair overlay

### 3. **Prop Drilling**

Many values are passed through multiple layers:
```
MapRenderer props → computed values → child components → grandchildren
```

Example: `parsedViewBox` is computed once but passed to 6+ places.

### 4. **No Context for Shared State**

These values are used in 5+ places each:
- `parsedViewBox`
- `cursorPosition`
- `containerRef` / `svgRef`
- `isDark`
- `pointerLocked`
- `SAFE_ZONE_MARGINS`
- Zoom-related values

Each needs to be prop-drilled to every component.

### 5. **Effects Doing Too Much**

Many useEffects are 30-80+ lines handling multiple concerns:
- Line 1543: 87 lines (touch gesture handling)
- Line 1454: 43 lines (rotation animation)
- Line 1200: 34 lines (viewBox calculation)

---

## Proposal: Feature-Based Architecture

### Phase 1: Create MapRendererContext

Extract shared state into a context to eliminate prop drilling:

```typescript
interface MapRendererContextValue {
  // Refs
  containerRef: RefObject<HTMLDivElement>
  svgRef: RefObject<SVGSVGElement>

  // Computed values
  parsedViewBox: { x: number; y: number; width: number; height: number }
  containerRect: DOMRect | null
  svgRect: DOMRect | null

  // Cursor
  cursorPosition: { x: number; y: number } | null
  setCursorPosition: (pos: { x: number; y: number } | null) => void
  cursorSvgCoords: { x: number; y: number } | null  // computed

  // Theme
  isDark: boolean

  // Layout
  safeZoneMargins: SafeZoneMargins
  leftoverDimensions: { width: number; height: number }

  // Precision mode
  pointerLocked: boolean
  canUsePrecisionMode: boolean
  precisionCalcs: PrecisionCalculations
}
```

**Impact:** Eliminates 10+ prop passes per component

### Phase 2: Extract Visual Systems as Features

#### 2a. Custom Cursor Feature (~200 lines)
```
features/cursor/
  ├── CursorOverlay.tsx       # Main cursor + label
  ├── CompassCrosshair.tsx    # The rotating compass (SHARED)
  └── useCursorVisibility.ts  # Show/hide logic
```

#### 2b. Heat Crosshair Feature (~150 lines)
```
features/heat-crosshair/
  ├── HeatCrosshairOverlay.tsx
  └── useHeatAnimation.ts     # Rotation spring
```

Both use the SAME `CompassCrosshair` component! Currently duplicated.

#### 2c. Region Rendering Feature (~500 lines)
```
features/regions/
  ├── RegionLayer.tsx         # All region paths
  ├── RegionGlows.tsx         # Glow effects (hint, celebration, etc)
  ├── RegionPath.tsx          # Single region
  └── useRegionStyles.ts      # Color/stroke computation
```

#### 2d. Debug Visualizations Feature (~400 lines)
```
features/debug/
  ├── DebugPanel.tsx          # Container for all debug
  ├── AutoZoomDebug.tsx       # Detection visualization
  ├── HotColdDebugPanel.tsx   # Hot/cold state debug
  ├── SafeZoneDebug.tsx       # Safe zone rectangles
  └── BoundingBoxDebug.tsx    # Bounding box labels on map
```

### Phase 3: Consolidate Related State

#### 3a. Cursor State Machine
Replace 5+ separate states with one:

```typescript
type CursorState =
  | { mode: 'hidden' }
  | { mode: 'normal'; position: Point }
  | { mode: 'dragging'; startPosition: Point; currentPosition: Point }
  | { mode: 'locked'; initialPosition: Point }

const [cursorState, dispatch] = useReducer(cursorReducer, { mode: 'hidden' })
```

#### 3b. Magnifier State Machine
Already partially done with `useMagnifierState`, but could be expanded:

```typescript
type MagnifierState =
  | { mode: 'hidden' }
  | { mode: 'visible'; position: Point; zoom: number }
  | { mode: 'dragging'; ... }
  | { mode: 'pinching'; ... }
  | { mode: 'expanded'; ... }
```

### Phase 4: Extract Event Handlers

The 87-line touch handling useEffect should become:

```typescript
// features/touch/useTouchGestures.ts
export function useTouchGestures(options: TouchGestureOptions) {
  // All touch logic here
  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  }
}
```

---

## Priority Order

| Priority | Task | Lines Saved | Complexity |
|----------|------|-------------|------------|
| 1 | Create MapRendererContext | -0 (enables others) | Medium |
| 2 | Extract CompassCrosshair (dedupe) | -80 | Low |
| 3 | Extract debug panels | -400 | Low |
| 4 | Extract RegionLayer | -300 | Medium |
| 5 | Extract CursorOverlay | -200 | Medium |
| 6 | Consolidate cursor state | -100 | Medium |
| 7 | Extract touch gestures | -150 | High |

**Estimated total reduction:** 1200+ lines (to ~3400 lines)

---

## Quick Wins (No Architecture Change)

### 1. Extract CompassCrosshair component
Currently appears twice. Extract to shared component.
**Saves: ~80 lines**

### 2. Extract debug panels
AutoZoomDebug, HotColdDebugPanel, SafeZoneDebug are self-contained.
**Saves: ~400 lines**

### 3. Extract utility functions to files
`getHeatBorderColors`, `getHeatLevel`, `getRotationSpeed`, etc. (~260 lines at top)
**Saves: ~200 lines in MapRenderer** (moved to utils)

---

## Context vs Props Trade-offs

### When to use Context:
- Value used in 3+ deeply nested components
- Value changes infrequently
- Value is "ambient" (theme, refs, config)

### When to keep as Props:
- Value changes frequently (animations)
- Value is specific to one subtree
- Need explicit dependency tracking

### Recommendation:
Create **MapRendererContext** for:
- `containerRef`, `svgRef`
- `parsedViewBox`
- `isDark`
- `safeZoneMargins`
- `pointerLocked`

Keep as props:
- Spring values (animations)
- Cursor position (changes 60fps)
- Component-specific callbacks

---

## Next Steps

1. **Start with context** - Create MapRendererContext with refs and computed values
2. **Extract CompassCrosshair** - Immediate deduplication win
3. **Extract debug features** - Low risk, high reward
4. **Tackle RegionLayer** - Complex but well-bounded

Want me to start with any of these?

---

## Updated Analysis (December 2024)

### Current Breakdown

| Section | Lines | % of Total |
|---------|-------|------------|
| Imports | 71 | 1.8% |
| Constants/Types | 146 | 3.7% |
| **Component Logic** | **2681** | **68.5%** |
| **JSX Return** | **1014** | **25.9%** |

### Remaining Hook Count (117 total!)

| Hook Type | Count |
|-----------|-------|
| useState | 26 |
| useRef | 29 |
| useCallback | 24 |
| useMemo | 9 |
| useEffect | 24 |
| useSpring | 5 |

### The Monster Functions Still In There

| Function | Lines | What It Does |
|----------|-------|--------------|
| `handleMouseMove` | **494** | Cursor tracking, magnifier updates, hover detection, hot/cold, auto-zoom |
| `handleMapTouchMove` | **205** | Mobile equivalent of above |
| `handleMagnifierTouchMove` | **199** | Magnifier drag/pinch handling |
| `handleMagnifierTouchEnd` | **104** | Tap detection, region selection |

### Biggest Remaining Opportunities

#### 1. **OtherPlayerCursors Component** (160 lines → ~15 lines)
Lines 3720-3879 render other players' cursors. This is completely self-contained and just needs cursor positions + player info.

#### 2. **DebugAutoZoomPanel Component** (138 lines → ~15 lines)
Lines 3566-3703 render the auto-zoom detection visualization. Only needed when debug mode is on.

#### 3. **useMapInteraction Hook** (~800 lines → single hook call)
Consolidate all these into one hook:
- `handleMouseDown`, `handleMouseUp`, `handleMouseMove`, `handleMouseLeave`
- `handleMapTouchStart`, `handleMapTouchMove`, `handleMapTouchEnd`
- `handleMagnifierTouchStart`, `handleMagnifierTouchMove`, `handleMagnifierTouchEnd`
- All the refs: `cursorPositionRef`, `desktopDragStartRef`, `mapTouchStartRef`, etc.
- All the state: `isDesktopMapDragging`, `isMobileMapDragging`, `shiftPressed`, etc.

This would be the biggest single win.

#### 4. **useUserPreferences Hook** (~100 lines → single hook call)
All the localStorage-persisted settings:
- `autoSpeak`, `withAccent`, `autoHint`, `hotColdEnabled`
- Their setters and toggle handlers

#### 5. **useCelebration Hook** (~150 lines → single hook call)
- `celebrationFlashProgress`, `pendingCelebrationClick`, `savedButtonPosition`
- `handleCelebrationComplete`, `handleRegionClickWithCelebration`, `getCelebrationRegionCenter`
- Related refs and effects

#### 6. **MagnifierContainer Component** (271 lines → ~30 lines)
Lines 3278-3548. The magnifier is already using extracted components internally but the container JSX is still inline.

### Recommended Priority

1. ~~**OtherPlayerCursors** - 5 min, -145 lines~~ ✅ DONE (-148 lines)
2. ~~**DebugAutoZoomPanel** - 10 min, -123 lines~~ ✅ DONE (-128 lines)
3. ~~**useUserPreferences** - 15 min, -90 lines~~ ✅ DONE (-43 lines)
4. **useCelebration** - SKIPPED (too intertwined with click handling, puzzle piece animation, assistance levels)
5. **useMapInteraction** - 2 hours, -600 lines (biggest impact but most complex) - FUTURE WORK

### Target Architecture

After all extractions, MapRenderer should be ~800 lines:
- ~70 lines imports
- ~50 lines types/interfaces
- ~200 lines hook calls and simple computed values
- ~50 lines event handler wiring
- ~400 lines JSX (just component composition)

The **logic** lives in hooks. The **rendering** lives in feature components. MapRenderer just **orchestrates**.
