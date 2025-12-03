# Magnifier Incremental Extraction Plan

## Current Structure Analysis

The magnifier-related code spans lines 3820-4568 (~750 lines) plus additional debug visualizations.

### Main Magnifier IIFE (lines 3821-4313, ~490 lines)

```
{(() => {  // 3821
  // Container setup: size calculations, expanded state
  return (
    <animated.div>  // 3842 - touch handlers, spring positioning
      <animated.svg>  // 3894 - viewBox calculation
        <rect />  // 3951-3957 - sea background (simple)
        <MagnifierRegions />  // 3960-3978 - ✅ ALREADY EXTRACTED

        {/* Crosshair IIFE */}  // 3981-4013 - wraps MagnifierCrosshair
        {(() => { /* coord calc */ return <MagnifierCrosshair /> })()}

        {/* Pixel Grid IIFE */}  // 4017-4052 - wraps MagnifierPixelGrid
        {(() => { /* coord calc */ return <MagnifierPixelGrid /> })()}

        {/* Debug bounding boxes (SVG) */}  // 4055-4082
        {debugBoundingBoxes.map(bbox => <rect />)}

      </animated.svg>

      {/* Debug bbox labels (HTML) */}  // 4087-4205 - animated.div with spring callbacks
      {debugBoundingBoxes.map(bbox => <animated.div />)}

      {/* Magnifier label */}  // 4207-4280 - zoom display with spring
      <animated.div>{zoomSpring.to(() => '...')}</animated.div>

      {/* Scrim overlay */}  // 4282-4295 - simple div
      <div />

      <MagnifierControls />  // 4298-4310 - ✅ ALREADY EXTRACTED

    </animated.div>
  )
})()}
```

### Zoom Lines IIFE (lines 4316-4568, ~250 lines)

Completely separate from magnifier. Renders bezier connection lines between indicator box and magnifier corners.

```
{(() => {  // 4316
  // Corner calculations, bezier path generation
  // Line visibility filtering
  // Color/gradient definitions
  return (
    <svg data-element="zoom-lines">
      <defs>...</defs>
      <g>{/* glow layer */}</g>
      <g>{/* main lines */}</g>
      <g>{/* corner dots */}</g>
      <style>{/* animation keyframes */}</style>
    </svg>
  )
})()}
```

---

## Extraction Priority (Lowest Risk First)

### Step 1: ZoomLines Component ⭐ HIGHEST PRIORITY

**Location:** Lines 4316-4568 (~250 lines)
**Risk:** LOW
**Dependencies:** No react-spring animated values, only regular computed values

**New file:** `features/magnifier/ZoomLines.tsx`

```typescript
export interface ZoomLinesProps {
  // Visibility
  visible: boolean
  opacity: number

  // Positions
  cursorPosition: { x: number; y: number }
  magnifierPosition: { top: number; left: number }
  magnifierDimensions: { width: number; height: number }

  // Map info
  parsedViewBox: { x: number; y: number; width: number; height: number }
  svgRect: DOMRect
  containerRect: DOMRect

  // Zoom
  currentZoom: number
  highZoomThreshold: number

  // Style
  isDark: boolean

  // Config
  safeZoneMargins: { top: number; left: number; right: number; bottom: number }
}

export function ZoomLines({ ... }: ZoomLinesProps) {
  // All the bezier calculation logic
  // SVG rendering
}
```

**Impact:** Removes ~250 lines from MapRenderer

---

### Step 2: MagnifierLabel Component

**Location:** Lines 4207-4280 (~75 lines)
**Risk:** MEDIUM (uses `zoomSpring.to()` for text content)

**New file:** `features/magnifier/MagnifierLabel.tsx`

```typescript
export interface MagnifierLabelProps {
  // Animated value (passed through)
  zoomSpring: SpringValue<number>
  movementMultiplier: SpringValue<number>

  // State
  pointerLocked: boolean
  canUsePrecisionMode: boolean

  // Refs for calculations
  containerRef: RefObject<HTMLDivElement>
  svgRef: RefObject<SVGSVGElement>

  // Computed values
  parsedViewBox: ParsedViewBox

  // Config
  precisionModeThreshold: number
  showDebugInfo: boolean
  isDark: boolean

  // Callbacks
  onRequestPointerLock: () => void
}
```

**Complexity:** Uses `zoomSpring.to()` callback for dynamic text content. The spring must be passed as a prop since react-spring interpolations work best at component boundaries.

---

### Step 3: MagnifierDebugBoxes Component

**Location:** Lines 4055-4082 (SVG rects) + 4087-4205 (HTML labels)
**Risk:** SVG part is LOW, HTML labels are MEDIUM

Split into two parts:

#### 3a. SVG Debug Boxes (LOW RISK)

Simple map over bounding boxes to render colored rects.

```typescript
export interface MagnifierDebugBoxesSvgProps {
  debugBoundingBoxes: DebugBoundingBox[]
  visible: boolean
}
```

#### 3b. HTML Debug Labels (MEDIUM RISK)

Uses `zoomSpring.to()` for positioning. This is the trickiest part because the callbacks capture refs and do complex coordinate transformations.

**Option A:** Pass all computed values as props (breaks real-time sync with spring)
**Option B:** Pass spring + refs + parsedViewBox (maintains sync but complex interface)

---

### Step 4: Fold Coordinate Calculations into Existing Components

**Location:** Crosshair IIFE (3981-4013), Pixel Grid IIFE (4017-4052)
**Risk:** LOW

Currently these IIFEs exist just to calculate `cursorSvgX`, `cursorSvgY` before calling the extracted components.

**Solution:** Add optional `refs` prop to MagnifierCrosshair and MagnifierPixelGrid that lets them calculate coordinates internally.

```typescript
// Current pattern:
{(() => {
  const cursorSvgX = /* calculation */
  const cursorSvgY = /* calculation */
  return <MagnifierCrosshair cursorSvgX={cursorSvgX} cursorSvgY={cursorSvgY} />
})()}

// New pattern (coordinates computed inside):
<MagnifierCrosshair
  containerRef={containerRef}
  svgRef={svgRef}
  cursorPosition={cursorPosition}
  parsedViewBox={parsedViewBox}
/>
```

This eliminates ~70 lines of IIFE wrappers.

---

## Implementation Order

| Step | Component | Lines Removed | Risk | Complexity |
|------|-----------|---------------|------|------------|
| 1 | ZoomLines | ~250 | Low | New component, clean interface |
| 2 | MagnifierLabel | ~75 | Medium | Pass spring as prop |
| 3a | MagnifierDebugBoxesSvg | ~30 | Low | Simple rect mapping |
| 3b | MagnifierDebugLabels | ~120 | Medium | Spring callbacks for positioning |
| 4 | Fold coord calcs | ~70 | Low | Modify existing components |

**Total potential reduction:** ~545 lines (73% of magnifier code)

---

## Step 1 Implementation Details

### ZoomLines Props Design

```typescript
interface ZoomLinesProps {
  // Core visibility
  show: boolean
  opacity: number

  // Cursor and magnifier positions (screen coordinates)
  cursorPosition: { x: number; y: number }
  magnifierPosition: { top: number; left: number }

  // Dimensions
  magnifierWidth: number
  magnifierHeight: number
  leftoverWidth: number
  leftoverHeight: number

  // ViewBox (for indicator calculations)
  parsedViewBox: ParsedViewBox
  currentZoom: number

  // For SVG-to-screen conversion
  viewport: {
    scale: number
    letterboxX: number
    letterboxY: number
  }
  svgOffset: { x: number; y: number }

  // Style
  isDark: boolean
  highZoomThreshold: number
}
```

### Key Functions to Move

1. `linePassesThroughRect()` - collision detection
2. `createBezierPath()` - bezier curve generation
3. Corner pair filtering logic
4. Color/gradient determination

### Testing Strategy

1. Extract component with exact same logic
2. Visual regression: lines should appear identical
3. Verify animation still works (keyframes)
4. Test at various zoom levels and cursor positions

---

## Notes

- **Spring Handling:** When passing react-spring values to child components, pass the `SpringValue` object itself, not a derived value. The child can call `.to()` for interpolation.

- **Ref Access:** Components that need ref access for measurements should receive the refs as props. Using context could add complexity without benefit.

- **Memoization:** All new components should use `memo()` with appropriate comparison functions since they receive refs and springs.

---

## Next Steps

1. Create `ZoomLines.tsx` with props interface
2. Move all zoom line logic from IIFE to component
3. Replace IIFE with `<ZoomLines {...props} />`
4. Run type-check and verify visually
5. Proceed to MagnifierLabel
