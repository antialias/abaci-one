# MapRenderer Refactoring Plan

## Current State: 5,252 lines, 82 hooks, 11 JSX IIFEs

This document outlines a phased approach to reduce MapRenderer complexity while improving
performance, maintainability, and debuggability.

---

## Phase 1: Quick Wins (Low Risk, High Impact)

### 1.1 Memoize ViewBox Parsing

**Problem:** `displayViewBox.split(' ').map(Number)` appears 12+ times in render path.

**Solution:** Create memoized parsed viewBox:

```typescript
// In MapRenderer, after displayViewBox useMemo
const parsedViewBox = useMemo(() => {
  const parts = displayViewBox.split(' ').map(Number)
  return {
    x: parts[0] || 0,
    y: parts[1] || 0,
    width: parts[2] || 1000,
    height: parts[3] || 500,
  }
}, [displayViewBox])
```

**Impact:** Eliminates 12+ redundant string parsing operations per render.

---

### 1.2 Extract Pulsing Animation Utility

**Problem:** Three nearly identical animation loops (give-up, hint, celebration).

**Current pattern (repeated 3x):**
```typescript
const animate = () => {
  const elapsed = Date.now() - startTime
  const progress = Math.min(elapsed / duration, 1)
  const pulseProgress = Math.sin(progress * Math.PI * pulses * 2) * 0.5 + 0.5
  setFlashProgress(pulseProgress)
  if (progress < 1) {
    requestAnimationFrame(animate)
  }
}
```

**Solution:** Create `features/animations/usePulsingAnimation.ts`:

```typescript
interface UsePulsingAnimationOptions {
  duration: number
  pulses: number
  onProgress: (progress: number) => void
  onComplete?: () => void
}

export function usePulsingAnimation() {
  const start = useCallback((options: UsePulsingAnimationOptions) => {
    // Single implementation of animation loop
  }, [])

  const cancel = useCallback(() => { ... }, [])

  return { start, cancel }
}
```

**Impact:** Removes ~150 lines of duplicate code, single place to fix animation bugs.

---

### 1.3 Wrap Large Event Handlers in useCallback

**Problem:** `handleMouseMove` (496 lines) recreated every render.

**Solution:**
```typescript
const handleMouseMove = useCallback((event: MouseEvent) => {
  // ... existing logic
}, [/* stable dependencies */])
```

**Caveat:** Need to audit dependencies carefully. Consider extracting sub-functions first.

**Impact:** Prevents unnecessary event listener reattachment, reduces GC pressure.

---

## Phase 2: Component Extraction (Medium Risk, High Impact)

### 2.1 Extract MagnifierOverlay Component

**Current:** Lines 3896-5090 (~1,200 lines) as inline IIFE.

**New structure:**
```
features/magnifier/
├── components/
│   ├── MagnifierOverlay.tsx      # Main overlay container
│   ├── MagnifierContent.tsx      # SVG content inside magnifier
│   ├── MagnifierDebug.tsx        # Debug visualizations
│   └── index.ts
```

**Props interface:**
```typescript
interface MagnifierOverlayProps {
  // Position
  position: { x: number; y: number }
  targetPosition: { top: number; left: number }

  // Zoom state
  zoom: number
  isExpanded: boolean

  // Cursor/region state
  cursorSvgPosition: { x: number; y: number }
  hoveredRegion: string | null

  // Map data
  parsedViewBox: ParsedViewBox
  mapSvgContent: string
  regions: Region[]

  // Callbacks
  onRegionClick: (regionId: string) => void
  onExpandChange: (expanded: boolean) => void

  // Style
  isDark: boolean
  heatStyle?: HeatStyle
}
```

**Impact:** MapRenderer drops to ~4,000 lines, magnifier becomes independently testable.

---

### 2.2 Extract CustomCursor Component

**Current:** Lines 3673-3807 embedded in JSX.

**New component:**
```typescript
// features/cursor/CustomCursor.tsx
interface CustomCursorProps {
  position: { x: number; y: number }
  rotation: number
  heatStyle?: HeatStyle
  regionLabel?: string
  flagEmoji?: string
  visible: boolean
}
```

**Impact:** ~135 lines extracted, reusable for other games.

---

### 2.3 Extract HeatCrosshair Component

**Problem:** Compass tick marks duplicated at lines 3708-3726 and 3853-3871.

**Solution:**
```typescript
// features/cursor/HeatCrosshair.tsx
interface HeatCrosshairProps {
  size: number
  heatStyle: HeatStyle
  showCompass: boolean
}

// Reusable compass component
function CompassTicks({ radius, heatStyle }: { radius: number; heatStyle: HeatStyle }) {
  const angles = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]
  return (
    <>
      {angles.map(angle => {
        const isCardinal = angle % 90 === 0
        // ... tick rendering
      })}
    </>
  )
}
```

**Impact:** Eliminates duplication, single source for compass styling.

---

### 2.4 Extract RegionPath Component

**Current:** Lines 3258-3400, complex map with 5+ conditional glows.

**New component:**
```typescript
// components/RegionPath.tsx
interface RegionPathProps {
  region: MapRegion
  state: 'normal' | 'hovered' | 'found' | 'revealing' | 'hinting' | 'celebrating'
  glowProgress?: number
  onClick: () => void
  onHover: (hovering: boolean) => void
}
```

**Benefits:**
- Each region becomes a memoizable unit
- Glow logic consolidated
- Easier to add new region states

---

## Phase 3: Hook Consolidation (Medium Risk, Medium Impact)

### 3.1 Create useAnimationController Hook

**Consolidates:** Give-up, hint, and celebration animations.

```typescript
// features/animations/useAnimationController.ts
interface AnimationController {
  // Give-up reveal
  giveUpProgress: number
  isGiveUpAnimating: boolean
  startGiveUpReveal: (targetRegion: Region) => void

  // Hint
  hintProgress: number
  isHintAnimating: boolean
  startHint: (targetRegion: Region) => void

  // Celebration
  celebrationProgress: number
  isCelebrating: boolean
  startCelebration: (region: Region) => void

  // Shared
  cancelAll: () => void
}

export function useAnimationController(options: AnimationOptions): AnimationController
```

**Impact:** Consolidates ~300 lines of animation state management.

---

### 3.2 Create useMouseInteraction Hook

**Problem:** `handleMouseMove` is 496 lines handling multiple concerns.

**Split into:**
```typescript
// hooks/useMouseInteraction.ts
interface UseMouseInteractionOptions {
  containerRef: RefObject<HTMLDivElement>
  svgRef: RefObject<SVGSVGElement>
  enabled: boolean
  onCursorMove: (position: Position) => void
  onDragStart: () => void
  onDragEnd: () => void
  onRegionHover: (regionId: string | null) => void
}
```

**Sub-hooks:**
- `usePointerLockCursor` - precision mode cursor interpolation
- `useDragDetection` - distinguish click vs drag
- `useBoundaryDampening` - edge behavior for cursor

**Impact:** Breaks 496-line function into focused, testable pieces.

---

### 3.3 Consolidate Magnifier State

**Current scattered state:**
```typescript
// Lines 649-676, 713-715, 1436-1495
const [showMagnifier, setShowMagnifier] = useState(false)
const [targetOpacity, setTargetOpacity] = useState(0)
const [isMagnifierDragging, setIsMagnifierDragging] = useState(false)
const [isPinching, setIsPinching] = useState(false)
const [isMagnifierExpanded, setIsMagnifierExpanded] = useState(false)
// ... 15+ more magnifier-related states
```

**Solution:** Expand existing `useMagnifierState` to include ALL magnifier state:

```typescript
const magnifier = useMagnifierState({
  initialExpanded: false,
  initialZoom: MIN_ZOOM,
})

// Returns everything:
magnifier.show()
magnifier.hide()
magnifier.position // { x, y }
magnifier.zoom // current zoom
magnifier.isExpanded
magnifier.isDragging
// etc.
```

---

## Phase 4: Performance Optimizations

### 4.1 Cache Region Elements

**Problem:** `querySelector` in hot path (line 2317).

**Solution:**
```typescript
// Build region element map once
const regionElementsRef = useRef<Map<string, SVGPathElement>>(new Map())

useEffect(() => {
  if (!svgRef.current) return
  const regions = svgRef.current.querySelectorAll('[data-region-id]')
  regions.forEach(el => {
    regionElementsRef.current.set(el.getAttribute('data-region-id')!, el as SVGPathElement)
  })
}, [mapData])

// In hot path:
const regionElement = regionElementsRef.current.get(regionId)
```

**Impact:** Eliminates DOM queries on every mouse move.

---

### 4.2 Debounce/Throttle Hot Path Calculations

**Problem:** Full region detection on every mouse move.

**Solution:**
```typescript
const throttledDetectRegions = useMemo(
  () => throttle((x: number, y: number) => {
    const result = detectRegions(x, y)
    setHoveredRegion(result.regionUnderCursor)
  }, 16), // ~60fps
  [detectRegions]
)
```

**Impact:** Reduces calculation frequency without visible lag.

---

### 4.3 Use CSS Containment

**Add to magnifier container:**
```css
.magnifier-overlay {
  contain: layout style paint;
  will-change: transform;
}
```

**Impact:** Browser can optimize repaints, isolate layout calculations.

---

### 4.4 Virtualize Debug Overlays

**Problem:** Debug bounding boxes render ALL regions even when off-screen.

**Solution:** Only render debug boxes for regions in current viewport:

```typescript
const visibleDebugBoxes = useMemo(() => {
  if (!effectiveShowDebugBoundingBoxes) return []
  return debugBoundingBoxes.filter(bbox =>
    isInViewport(bbox, parsedViewBox, zoom)
  )
}, [debugBoundingBoxes, parsedViewBox, zoom, effectiveShowDebugBoundingBoxes])
```

---

## Phase 5: Architecture Improvements

### 5.1 Introduce Render Sections Pattern

**Split return JSX into clearly named sections:**

```typescript
return (
  <div ref={containerRef} className={containerStyles}>
    {/* Section 1: Base Map */}
    <MapSvgLayer
      mapData={mapData}
      regions={regions}
      onRegionClick={handleRegionClick}
    />

    {/* Section 2: Cursor & Crosshairs */}
    <CursorLayer
      position={cursorPosition}
      heatStyle={heatStyle}
      visible={showCustomCursor}
    />

    {/* Section 3: Magnifier */}
    <MagnifierLayer
      {...magnifierProps}
    />

    {/* Section 4: Multiplayer Cursors */}
    <MultiplayerCursors
      players={otherPlayerCursors}
      metadata={playerMetadata}
    />

    {/* Section 5: Debug (dev only) */}
    {process.env.NODE_ENV === 'development' && (
      <DebugLayer {...debugProps} />
    )}

    {/* Section 6: Celebrations */}
    <CelebrationOverlay {...celebrationProps} />
  </div>
)
```

**Impact:** Clear mental model, easier to find code, natural extraction boundaries.

---

### 5.2 Create MapRendererContext

**For deeply nested components that need shared state:**

```typescript
const MapRendererContext = createContext<{
  parsedViewBox: ParsedViewBox
  zoom: number
  cursorPosition: Position
  isDark: boolean
  // Stable callbacks
  detectRegions: (x: number, y: number) => DetectionResult
}>()
```

**Eliminates prop drilling through 4+ component levels.**

---

## Implementation Priority

| Phase | Effort | Risk | Impact | Order |
|-------|--------|------|--------|-------|
| 1.1 ViewBox memoization | 30min | Low | Medium | 1 |
| 1.2 Pulsing animation | 2hr | Low | High | 2 |
| 1.3 useCallback handlers | 1hr | Medium | Medium | 3 |
| 2.1 MagnifierOverlay | 4hr | Medium | High | 4 |
| 2.2 CustomCursor | 1hr | Low | Medium | 5 |
| 2.3 HeatCrosshair | 1hr | Low | Low | 6 |
| 2.4 RegionPath | 2hr | Medium | Medium | 7 |
| 3.1 Animation controller | 3hr | Medium | Medium | 8 |
| 3.2 Mouse interaction | 4hr | High | High | 9 |
| 4.1-4.4 Performance | 2hr | Low | Medium | 10 |
| 5.1-5.2 Architecture | 3hr | Medium | High | 11 |

---

## Expected Outcomes

After full implementation:

| Metric | Before | After |
|--------|--------|-------|
| MapRenderer lines | 5,252 | ~2,500 |
| Hook calls in MapRenderer | 82 | ~40 |
| JSX IIFEs | 11 | 0-2 |
| Duplicated animation code | 3x | 1x |
| ViewBox parsing per render | 12+ | 1 |
| Independently testable units | 1 | 8+ |

---

## Testing Strategy

For each extraction:

1. **Before:** Capture current behavior with manual testing
2. **Extract:** Move code to new location
3. **Integrate:** Import and use new component/hook
4. **Verify:** Same behavior, no regressions
5. **Type-check:** `npm run type-check`
6. **Document:** Update this plan with completion status

---

## Notes

- Start with Phase 1 items - they're low risk and build confidence
- Phase 2.1 (MagnifierOverlay) is the biggest win - prioritize it
- Phase 3.2 (mouse interaction) is highest risk - save for last
- Performance optimizations (Phase 4) can be done incrementally
- Architecture changes (Phase 5) require the earlier phases first
