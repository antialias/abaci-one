# Fit Crop with Fill - Implementation Plan

## Goal

Instead of strictly cropping to the custom viewBox, we want to:
1. **Guarantee** the custom crop region is fully visible and centered
2. **Fill** any remaining viewport space with more of the map (no letterboxing)
3. **Stay** within the original map's bounds

## Current Behavior

```
┌─────────────────────────────────────────┐
│           Container (wide)              │
│  ┌─────────────────────┐                │
│  │                     │   Letterbox    │
│  │   Cropped Europe    │   (wasted)     │
│  │                     │                │
│  └─────────────────────┘                │
└─────────────────────────────────────────┘
```

## Desired Behavior

```
┌─────────────────────────────────────────┐
│           Container (wide)              │
│ ┌─────────────────────────────────────┐ │
│ │ More   │   Europe    │    More      │ │
│ │ Africa │  (centered) │   Middle     │ │
│ │        │             │   East       │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Math Strategy

### Inputs
- `originalViewBox`: Full map bounds (e.g., `0 0 1000 500` for world map)
- `cropRegion`: Custom crop that MUST be visible (e.g., `346.40 53.73 247.56 360.70` for Europe)
- `containerAspect`: Container's width/height ratio

### Algorithm

```typescript
function calculateFitCropViewBox(
  originalViewBox: { x: number; y: number; width: number; height: number },
  cropRegion: { x: number; y: number; width: number; height: number },
  containerAspect: number // width / height
): { x: number; y: number; width: number; height: number } {

  const cropAspect = cropRegion.width / cropRegion.height;

  let viewBoxWidth: number;
  let viewBoxHeight: number;

  // Step 1: Calculate dimensions to fill container while containing crop
  if (containerAspect > cropAspect) {
    // Container is WIDER than crop - expand horizontally
    viewBoxHeight = cropRegion.height;
    viewBoxWidth = viewBoxHeight * containerAspect;
  } else {
    // Container is TALLER than crop - expand vertically
    viewBoxWidth = cropRegion.width;
    viewBoxHeight = viewBoxWidth / containerAspect;
  }

  // Step 2: Center on crop region
  const cropCenterX = cropRegion.x + cropRegion.width / 2;
  const cropCenterY = cropRegion.y + cropRegion.height / 2;

  let viewBoxX = cropCenterX - viewBoxWidth / 2;
  let viewBoxY = cropCenterY - viewBoxHeight / 2;

  // Step 3: Clamp to original map bounds
  // (shift if needed, don't resize)

  // Clamp X
  if (viewBoxX < originalViewBox.x) {
    viewBoxX = originalViewBox.x;
  } else if (viewBoxX + viewBoxWidth > originalViewBox.x + originalViewBox.width) {
    viewBoxX = originalViewBox.x + originalViewBox.width - viewBoxWidth;
  }

  // Clamp Y
  if (viewBoxY < originalViewBox.y) {
    viewBoxY = originalViewBox.y;
  } else if (viewBoxY + viewBoxHeight > originalViewBox.y + originalViewBox.height) {
    viewBoxY = originalViewBox.y + originalViewBox.height - viewBoxHeight;
  }

  // Step 4: Handle case where expanded viewBox exceeds map bounds
  // (show entire map dimension, may result in letterboxing)
  if (viewBoxWidth > originalViewBox.width) {
    viewBoxWidth = originalViewBox.width;
    viewBoxX = originalViewBox.x;
  }
  if (viewBoxHeight > originalViewBox.height) {
    viewBoxHeight = originalViewBox.height;
    viewBoxY = originalViewBox.y;
  }

  return { x: viewBoxX, y: viewBoxY, width: viewBoxWidth, height: viewBoxHeight };
}
```

### Example: Europe in Wide Container

```
Original map:     0, 0, 1000, 500  (aspect 2:1)
Europe crop:      346.40, 53.73, 247.56, 360.70  (aspect ~0.69:1)
Container:        800x400 pixels  (aspect 2:1)

Container is wider (2.0 > 0.69), expand horizontally:
  viewBoxHeight = 360.70
  viewBoxWidth = 360.70 * 2.0 = 721.40

Center on Europe:
  cropCenterX = 346.40 + 247.56/2 = 470.18
  cropCenterY = 53.73 + 360.70/2 = 234.08
  viewBoxX = 470.18 - 721.40/2 = 109.48
  viewBoxY = 234.08 - 360.70/2 = 53.73

Check bounds:
  Left: 109.48 >= 0 ✓
  Right: 109.48 + 721.40 = 830.88 <= 1000 ✓
  Top: 53.73 >= 0 ✓
  Bottom: 53.73 + 360.70 = 414.43 <= 500 ✓

Final viewBox: 109.48 53.73 721.40 360.70
```

Result: Europe is centered, but we also see parts of Africa on the left and Middle East on the right!

### Example: North America in Tall Container

```
Original map:     0, 0, 1000, 500
N.America crop:   -2.22, 158.58, 361.43, 293.07  (aspect ~1.23:1)
Container:        400x600 pixels  (aspect 0.67:1)

Container is taller (0.67 < 1.23), expand vertically:
  viewBoxWidth = 361.43
  viewBoxHeight = 361.43 / 0.67 = 539.45

But 539.45 > 500 (map height), so clamp:
  viewBoxHeight = 500
  viewBoxY = 0

Result: Shows full map height, N.America visible but not centered vertically
```

## Implementation Changes

### 1. Update MapData Type (`types.ts`)

```typescript
interface MapData {
  // ... existing fields
  viewBox: string;           // The display viewBox (crop or full)
  originalViewBox: string;   // Always the full map bounds
  customCrop: string | null; // The custom crop if any
}
```

### 2. Update `getFilteredMapDataSync` (`maps.ts`)

Return both the custom crop (as `customCrop`) and original bounds (as `originalViewBox`):

```typescript
return {
  ...mapData,
  regions: filteredRegions,
  viewBox: adjustedViewBox,        // For backward compatibility
  originalViewBox: mapData.viewBox, // Original full bounds
  customCrop: customCrop,           // The crop region, or null
}
```

### 3. Create `calculateFitCropViewBox` utility (`maps.ts`)

Export the function described above.

### 4. Update `MapRenderer.tsx`

Calculate the display viewBox dynamically based on container dimensions:

```typescript
// In MapRenderer, after getting container dimensions:
const displayViewBox = useMemo(() => {
  if (!mapData.customCrop || !containerRef.current) {
    return mapData.viewBox; // No custom crop, use as-is
  }

  const containerRect = containerRef.current.getBoundingClientRect();
  const containerAspect = containerRect.width / containerRect.height;

  const originalBounds = parseViewBox(mapData.originalViewBox);
  const cropRegion = parseViewBox(mapData.customCrop);

  return calculateFitCropViewBox(originalBounds, cropRegion, containerAspect);
}, [mapData, svgDimensions]); // Re-calculate when container resizes

// Use displayViewBox for the main SVG
<animated.svg viewBox={displayViewBox} ... />
```

### 5. Update Dependent Calculations

The following need to use `displayViewBox` instead of `mapData.viewBox`:
- Magnifier viewBox calculations
- Debug bounding box label positioning
- Cursor-to-SVG coordinate conversions
- Any other coordinate transformations

## Edge Cases to Handle

1. **No custom crop**: Use `mapData.viewBox` as-is (current behavior)

2. **Crop region at edge of map**: Expand only in available direction
   - Europe at far right: Can only expand leftward
   - Result: Crop visible but not centered

3. **Very wide container with narrow crop**: May show most of the map width
   - That's OK - crop is still centered and visible

4. **Container matches crop aspect ratio exactly**: No expansion needed
   - Display viewBox = crop viewBox

5. **Window resize**: Re-calculate displayViewBox on container size change
   - Use `svgDimensions` state + ResizeObserver (already implemented)

## Testing Checklist

- [ ] Europe in wide container shows Africa + Middle East
- [ ] Europe in tall container shows more of map vertically
- [ ] North America in various aspect ratios
- [ ] Magnifier still works correctly at edges
- [ ] Give-up zoom animation still works
- [ ] Debug bounding boxes align with regions
- [ ] Window resize recalculates correctly
- [ ] No custom crop = unchanged behavior
