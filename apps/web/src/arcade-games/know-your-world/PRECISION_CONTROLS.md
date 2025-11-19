# Precision Controls for Tiny Map Regions

## Overview

The Know Your World map includes sophisticated precision controls that automatically activate when hovering over extremely small regions, making it possible to accurately select sub-pixel regions like Gibraltar (0.08px) and Jersey (0.82px) on screen.

## Features

### 1. Automatic Cursor Dampening (Precision Mode)

**Purpose**: Slow down cursor movement when over tiny regions for more precise control

**Activation**: Automatically detects when hovering over small regions (< 15px)

**Behavior**:
- **Sub-pixel regions (< 1px)**: 3% cursor speed (ultra precision)
  - Example: Gibraltar (0.08px width)
- **Tiny regions (1-5px)**: 10% cursor speed (high precision)
  - Example: Jersey (0.82px width)
- **Small regions (5-15px)**: 25% cursor speed (moderate precision)
  - Example: Rhode Island (~11px)

**Visual feedback**: Cursor changes to crosshair when precision mode is active

**Implementation**: `MapRenderer.tsx` lines 166-187, 668-712

```typescript
// Adaptive dampening based on smallest region size
const getDampeningFactor = (size: number): number => {
  if (size < 1) return 0.03 // Ultra precision
  if (size < 5) return 0.1   // High precision
  return 0.25                 // Moderate precision
}

// Apply dampening by interpolating cursor position
const deltaX = cursorX - lastCursorRef.current.x
const deltaY = cursorY - lastCursorRef.current.y
finalCursorX = lastCursorRef.current.x + deltaX * dampeningFactor
finalCursorY = lastCursorRef.current.y + deltaY * dampeningFactor
```

### 2. Auto Super-Zoom on Hover

**Purpose**: Dramatically increase magnification for sub-pixel regions after a brief hover

**Activation**:
- Automatically triggers after **500ms** of hovering over sub-pixel regions (< 1px)
- Only activates when magnifier is already showing

**Behavior**:
- Normal adaptive zoom: 8-24x
- Super zoom: up to **60x magnification** (2.5x multiplier)
- Applies to regions smaller than 1 screen pixel

**Visual feedback**:
- Magnifier border changes from **blue** to **gold**
- Gold glow shadow around magnifier
- Zoom level indicator shows current magnification

**Implementation**: `MapRenderer.tsx` lines 853-873, 1282-1292

```typescript
const HOVER_DELAY_MS = 500
const SUPER_ZOOM_MULTIPLIER = 2.5

// Start timer when hovering over sub-pixel regions
if (detectedSmallestSize < 1 && shouldShow && !superZoomActive) {
  hoverTimerRef.current = setTimeout(() => {
    setSuperZoomActive(true)
  }, HOVER_DELAY_MS)
}

// Apply super zoom multiplier to adaptive zoom
if (superZoomActive) {
  adaptiveZoom = Math.min(60, adaptiveZoom * SUPER_ZOOM_MULTIPLIER)
}
```

### 3. Quick-Escape Mechanism

**Purpose**: Allow users to instantly cancel precision mode and super zoom with fast mouse movement

**Activation**: Moving mouse faster than **50 pixels per frame**

**Behavior**:
- Immediately cancels cursor dampening
- Immediately cancels super zoom
- Clears hover timer if active
- Restores normal cursor speed

**Visual feedback**:
- Cursor returns to normal pointer
- Magnifier border returns to blue (if still showing)
- Super zoom deactivates

**Implementation**: `MapRenderer.tsx` lines 641-665

```typescript
const QUICK_MOVE_THRESHOLD = 50 // pixels per frame

// Calculate velocity
const deltaX = cursorX - lastCursorRef.current.x
const deltaY = cursorY - lastCursorRef.current.y
const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
velocity = distance

// Quick escape on fast movement
if (velocity > QUICK_MOVE_THRESHOLD) {
  setPrecisionMode(false)
  setSuperZoomActive(false)
  clearTimeout(hoverTimerRef.current)
}
```

### 4. Crosshair Accuracy

**Purpose**: Ensure crosshairs in magnifier accurately show which region will be selected

**Challenge**: When cursor dampening is active, native mouse events fire at real mouse position, but crosshairs show dampened position - creating a mismatch

**Solution**: Manual region detection using dampened cursor position

**Implementation**: `MapRenderer.tsx` lines 743-842

```typescript
// Convert dampened cursor to client coordinates
const finalClientX = containerRect.left + finalCursorX
const finalClientY = containerRect.top + finalCursorY

// Check which region is under dampened cursor
const cursorInRegion =
  finalClientX >= regionLeft &&
  finalClientX <= regionRight &&
  finalClientY >= regionTop &&
  finalClientY <= regionBottom

// Find closest region by distance to center
if (cursorInRegion) {
  const distanceToCenter = Math.sqrt(
    Math.pow(finalClientX - regionCenterX, 2) +
    Math.pow(finalClientY - regionCenterY, 2)
  )

  if (distanceToCenter < smallestDistanceToCenter) {
    regionUnderCursor = region.id
  }
}

// Set hover state manually (bypass native events)
setHoveredRegion(regionUnderCursor)
```

**Native hover events disabled**: When precision mode is active, native `onMouseEnter`/`onMouseLeave` are bypassed:

```typescript
onMouseEnter={() => !precisionMode && setHoveredRegion(region.id)}
onMouseLeave={() => !precisionMode && setHoveredRegion(null)}
```

## User Experience Flow

### Example: Selecting Gibraltar (0.08px)

1. **Hover over Iberian Peninsula area**
   - Magnifier appears showing 8-12x zoom
   - Cursor speed normal

2. **Move cursor near Gibraltar**
   - **Precision mode activates**: Cursor becomes crosshair
   - **Cursor dampening**: Movement slows to 3% speed
   - User has fine control to position cursor

3. **Hold cursor over Gibraltar for 500ms**
   - **Super zoom activates**: Magnifier zooms to 40-60x
   - **Magnifier border**: Changes from blue to gold
   - Gibraltar now clearly visible and selectable

4. **Click on Gibraltar** or **"shake" mouse to escape**
   - Quick movement (>50px/frame) instantly cancels precision mode
   - Cursor returns to normal speed
   - Magnifier returns to blue border (or hides if moved away)

## Debug Logging

Extensive console logging helps troubleshoot precision controls:

```javascript
// Precision mode activation
console.log('[Precision Mode] ✅ DAMPENING ACTIVE:', {
  smallestRegionSize: '0.82px',
  dampeningFactor: '10%',
  actual: { x: 500, y: 300 },
  dampened: { x: 485, y: 298 }
})

// Super zoom activation
console.log('[Super Zoom] 🔍 ACTIVATING super zoom!')

// Quick escape
console.log('[Quick Escape] 💨 Fast movement detected (75px) - canceling')

// Hover detection
console.log('[Hover Detection] Region under dampened cursor:', {
  region: 'je',
  regionName: 'Jersey',
  dampenedPos: { x: 485, y: 298 },
  distanceToCenter: '2.5px'
})
```

## Configuration Constants

All tuning parameters are defined at the top of `MapRenderer.tsx`:

```typescript
// Hover delay before super zoom activates
const HOVER_DELAY_MS = 500

// Velocity threshold for quick-escape (pixels per frame)
const QUICK_MOVE_THRESHOLD = 50

// Super zoom multiplier (applied to adaptive zoom)
const SUPER_ZOOM_MULTIPLIER = 2.5

// Adaptive dampening factors
const getDampeningFactor = (size: number): number => {
  if (size < 1) return 0.03  // Ultra precision: 3% speed
  if (size < 5) return 0.1   // High precision: 10% speed
  return 0.25                // Moderate precision: 25% speed
}

// Maximum zoom levels
const MAX_ZOOM_NORMAL = 24  // Normal adaptive zoom cap
const MAX_ZOOM_SUPER = 60   // Super zoom cap
```

## Technical Details

### Coordinate Systems

The implementation handles three coordinate systems:

1. **Container coordinates**: Relative to map container div (includes padding)
2. **Client coordinates**: Absolute screen position
3. **SVG coordinates**: ViewBox coordinate space for rendering

Cursor dampening happens in container coordinates, then converts to client coordinates for region detection.

### Performance Considerations

- **No performance impact when inactive**: All precision features only run when hovering over map
- **Efficient region detection**: Uses `getBoundingClientRect()` which is hardware-accelerated
- **Minimal state updates**: Only updates when cursor moves or regions change
- **Spring animations**: Uses `@react-spring/web` for smooth magnifier transitions

### Browser Compatibility

Works in all modern browsers that support:
- CSS transforms
- getBoundingClientRect()
- React 18 hooks
- @react-spring/web

Tested on:
- Chrome/Edge (Chromium)
- Firefox
- Safari

## Future Improvements

Potential enhancements:

1. **Configurable sensitivity**: Let users adjust dampening factors in settings
2. **Haptic feedback**: Vibration on mobile when precision mode activates
3. **Audio cues**: Subtle sound when super zoom activates
4. **Visual trail**: Show cursor path in dampened mode
5. **Gamepad support**: Use analog stick for dampened cursor control
6. **Keyboard navigation**: Arrow keys for pixel-perfect positioning

## Related Files

- `MapRenderer.tsx` - Main implementation
- `PlayingPhase.tsx` - Passes props to MapRenderer
- `maps.ts` - Map data and region metadata
- `types.ts` - TypeScript interfaces

## See Also

- [Map Rendering Architecture](./MAP_RENDERING.md) (if exists)
- [Game Configuration](./GAME_CONFIG.md) (if exists)
- [Difficulty System](./DIFFICULTY.md) (if exists)
