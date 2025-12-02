# Magnifier Outline Fix Plan

## The Bug

The dotted outline on the main map that shows the magnified region no longer matches what's actually visible in the magnifier. This happened because:

1. **Magnifier container dimensions became responsive** (commit 5920cb4):
   - Landscape: 1/3 width × 1/2 height
   - Portrait: 1/2 width × 1/3 height

2. **The magnifier viewBox still uses map-based aspect ratio**:
   ```typescript
   // Current - MapRenderer.tsx lines 3017-3018
   const magnifiedWidth = viewBoxWidth / zoom   // e.g., 1000/10 = 100
   const magnifiedHeight = viewBoxHeight / zoom // e.g., 500/10 = 50 (2:1 ratio)
   ```
   This creates a viewBox with the map's aspect ratio (e.g., 2:1 for world map).

3. **The outline uses the same calculation**:
   ```typescript
   // Current - MapRenderer.tsx lines 2578-2586
   width = viewBoxWidth / zoom
   height = viewBoxHeight / zoom
   ```

4. **Aspect ratio mismatch causes letterboxing**: The magnifier container might be 1/3w × 1/2h (taller), but the viewBox is 2:1 (wider). With default `preserveAspectRatio="xMidYMid meet"`, the SVG scales to fit with letterboxing. The outline shows the viewBox dimensions, but the magnifier container appears a different shape.

## Visual Explanation

```
Screen in landscape mode:
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   Map (2:1 aspect ratio like world map)                 │
│   ┌───────────────────────────────────────────────────┐ │
│   │           ┌─────┐                                 │ │
│   │           │ A   │ ← Outline shows 2:1 ratio       │ │
│   │           └─────┘   (viewBoxWidth/zoom × height)  │ │
│   │                                                   │ │
│   └───────────────────────────────────────────────────┘ │
│                                                         │
│   Magnifier container (1/3w × 1/2h = different ratio)   │
│   ┌─────────────────┐                                   │
│   │ ┌─────────────┐ │                                   │
│   │ │ Letter-     │ │ ← Map content (2:1)               │
│   │ │  boxing     │ │   with letterboxing               │
│   │ └─────────────┘ │                                   │
│   │                 │                                   │
│   └─────────────────┘                                   │
│                                                         │
│   The outline A shows the map content inside the        │
│   magnifier, NOT the magnifier shape. User sees         │
│   magnifier shape doesn't match outline shape.          │
└─────────────────────────────────────────────────────────┘
```

## The Solution

**Change the magnifier viewBox to match the container's aspect ratio.**

Instead of letterboxing, make the magnifier show exactly what its container shape suggests. This means:
1. Calculate magnifier container aspect ratio
2. Adjust the magnified viewBox dimensions to match
3. Use the same adjusted dimensions for the outline

### How It Works

Given:
- Magnifier container: `magnifierWidth × magnifierHeight` (from `getMagnifierDimensions`)
- Base magnified region: `viewBoxWidth/zoom × viewBoxHeight/zoom`
- Container aspect ratio: `CA = magnifierWidth / magnifierHeight`
- ViewBox aspect ratio: `VA = viewBoxWidth / viewBoxHeight`

Calculate the adjusted viewBox that fills the container:
```typescript
// Start with zoom-based dimensions
const baseWidth = viewBoxWidth / zoom
const baseHeight = viewBoxHeight / zoom

// Container aspect ratio
const containerAspect = magnifierWidth / magnifierHeight
const viewBoxAspect = baseWidth / baseHeight

let adjustedWidth, adjustedHeight

if (containerAspect > viewBoxAspect) {
  // Container is wider than viewBox - expand width to match
  adjustedHeight = baseHeight
  adjustedWidth = baseHeight * containerAspect
} else {
  // Container is taller than viewBox - expand height to match
  adjustedWidth = baseWidth
  adjustedHeight = baseWidth / containerAspect
}
```

This gives us a viewBox that:
- Has the same aspect ratio as the magnifier container
- Is centered on the same point
- Shows a slightly larger region (no letterboxing)

## Files to Modify

### 1. Create shared utility: `utils/magnifierDimensions.ts`

Move the constants and function from MapRenderer:

```typescript
export const MAGNIFIER_SIZE_SMALL = 1 / 3
export const MAGNIFIER_SIZE_LARGE = 1 / 2

export function getMagnifierDimensions(containerWidth: number, containerHeight: number) {
  const isLandscape = containerWidth > containerHeight
  return {
    width: containerWidth * (isLandscape ? MAGNIFIER_SIZE_SMALL : MAGNIFIER_SIZE_LARGE),
    height: containerHeight * (isLandscape ? MAGNIFIER_SIZE_LARGE : MAGNIFIER_SIZE_SMALL),
  }
}

/**
 * Calculate the magnified viewBox dimensions that match the magnifier container's aspect ratio.
 * This eliminates letterboxing by expanding the viewBox to fill the container.
 */
export function getAdjustedMagnifiedDimensions(
  viewBoxWidth: number,
  viewBoxHeight: number,
  zoom: number,
  containerWidth: number,
  containerHeight: number
) {
  const { width: magWidth, height: magHeight } = getMagnifierDimensions(containerWidth, containerHeight)

  const baseWidth = viewBoxWidth / zoom
  const baseHeight = viewBoxHeight / zoom

  const containerAspect = magWidth / magHeight
  const viewBoxAspect = baseWidth / baseHeight

  if (containerAspect > viewBoxAspect) {
    // Container is wider - expand width
    return {
      width: baseHeight * containerAspect,
      height: baseHeight,
    }
  } else {
    // Container is taller - expand height
    return {
      width: baseWidth,
      height: baseWidth / containerAspect,
    }
  }
}
```

### 2. Update `MapRenderer.tsx`

#### Import from new utility:
```typescript
import {
  getMagnifierDimensions,
  getAdjustedMagnifiedDimensions,
  MAGNIFIER_SIZE_SMALL,
  MAGNIFIER_SIZE_LARGE,
} from '../utils/magnifierDimensions'
```

#### Update magnifier viewBox (lines 3017-3024):
```typescript
// OLD:
const magnifiedWidth = viewBoxWidth / zoom
const magnifiedHeight = viewBoxHeight / zoom

// NEW:
const { width: magnifiedWidth, height: magnifiedHeight } = getAdjustedMagnifiedDimensions(
  viewBoxWidth,
  viewBoxHeight,
  zoom,
  containerRect.width,
  containerRect.height
)
```

#### Update outline dimensions (lines 2578-2586):
```typescript
// Same calculation as magnifier viewBox
width={zoomSpring.to((zoom: number) => {
  const containerRect = containerRef.current!.getBoundingClientRect()
  const viewBoxParts = displayViewBox.split(' ').map(Number)
  const viewBoxWidth = viewBoxParts[2] || 1000
  const viewBoxHeight = viewBoxParts[3] || 1000

  const { width } = getAdjustedMagnifiedDimensions(
    viewBoxWidth,
    viewBoxHeight,
    zoom,
    containerRect.width,
    containerRect.height
  )
  return width
})}

height={zoomSpring.to((zoom: number) => {
  // ... same pattern
  const { height } = getAdjustedMagnifiedDimensions(...)
  return height
})}
```

### 3. Update `useMagnifierZoom.ts`

Replace hardcoded `0.5` with actual dimensions:

```typescript
import { getMagnifierDimensions } from '../utils/magnifierDimensions'

// Line 94, 138, 163 - replace:
// const magnifierWidth = containerRect.width * 0.5
// with:
const { width: magnifierWidth } = getMagnifierDimensions(
  containerRect.width,
  containerRect.height
)
```

## Summary

| Component | Current Behavior | After Fix |
|-----------|-----------------|-----------|
| Magnifier container | Responsive (1/3×1/2 or 1/2×1/3) | No change |
| Magnifier viewBox | Fixed 2:1 ratio → letterboxing | Matches container aspect ratio |
| Outline | Fixed 2:1 ratio | Matches container aspect ratio |
| Zoom calculation | Wrong (uses 0.5) | Correct (uses actual dimensions) |

### Implementation Order
1. Create `utils/magnifierDimensions.ts` with shared functions
2. Update `MapRenderer.tsx` imports and remove local copies of constants/function
3. Update magnifier viewBox calculation
4. Update outline calculation
5. Update `useMagnifierZoom.ts` to use correct magnifier width
6. Test in both landscape and portrait orientations
