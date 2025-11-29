# Magnifier Architecture

## Overview

The know-your-world game features an adaptive magnifier system that helps users click on tiny regions (like Gibraltar at 0.08px). The magnifier automatically adjusts its zoom level and enables precision controls based on the size of detected regions.

## Core Concepts

### 1. Screen Pixel Ratio

**Definition**: How many screen pixels the magnifier "jumps over" when the mouse moves one pixel on the main map.

**Formula**:

```
screenPixelRatio = (viewBoxWidth / svgWidth) × (magnifierWidth / (viewBoxWidth / zoom))
```

**Example**:

- At 50× zoom with a magnifier, moving the mouse 1px on the main map moves the magnifier view 50 screen pixels
- This makes clicking tiny regions extremely difficult without precision mode

### 2. Precision Mode Threshold

**Value**: 20 px/px

**Purpose**: When screen pixel ratio exceeds 20, the magnifier becomes too sensitive for normal mouse control. At this point, pointer lock (precision mode) is recommended.

**Why 20?**: Through testing, 20 px/px was found to be the boundary where fine control becomes nearly impossible without pointer lock.

### 3. Zoom Capping

**Purpose**: Prevent excessive magnifier sensitivity before precision mode is activated.

**Behavior**:

- When NOT in pointer lock mode: Zoom is capped at the precision mode threshold (20 px/px)
- When IN pointer lock mode: Zoom is uncapped, allowing zoom up to 1000× for sub-pixel regions

**Implementation**: See `utils/zoomCapping.ts`

### 4. Adaptive Zoom Search

**Purpose**: Automatically find the optimal zoom level based on detected region sizes.

**Algorithm**:

1. Detect regions within a 50px detection box around the cursor
2. Sort regions by size (smallest first)
3. Start from MAX_ZOOM (1000×) and reduce by 10% each iteration
4. For each zoom level, check if any detected region would occupy 10-25% of the magnifier
5. Accept the first zoom level where a region fits nicely
6. Apply zoom capping if not in pointer lock mode

**Adaptive thresholds** based on smallest detected region:

- Sub-pixel regions (< 1px): Accept 2-8% of magnifier (Gibraltar needs this)
- Tiny regions (1-5px): Accept 5-15% of magnifier
- Normal small regions: Accept 10-25% of magnifier

**Location**: This logic is currently in `MapRenderer.tsx` (lines ~1330-1616) and should be extracted to `utils/adaptiveZoomSearch.ts`

### 5. Pointer Lock (Precision Mode)

**Purpose**: Enable fine-grained cursor control for high zoom levels.

**Behavior**:

- Cursor becomes invisible and locked to the container
- Mouse movements are captured as relative deltas instead of absolute positions
- Cursor speed is adaptively reduced based on smallest detected region size
- When released, zoom is recalculated with capping applied

**Speed multipliers** based on region size:

- Sub-pixel (< 1px): 3% speed (Gibraltar at 0.08px)
- Tiny (1-5px): 10% speed
- Small (5-15px): 25% speed
- Normal: 100% speed

**Implementation**: `hooks/usePointerLock.ts` (basic), with additional zoom logic in MapRenderer

## System Architecture

### Current State (2430 lines in MapRenderer.tsx)

```
MapRenderer.tsx
├── State Management (~100 lines)
│   ├── Cursor position tracking
│   ├── Magnifier visibility/position/zoom
│   ├── Pointer lock state
│   └── Region detection results
├── Pointer Lock Logic (~135 lines)
│   ├── Event listeners (pointerlockchange, pointerlockerror)
│   ├── Zoom recalculation on release
│   ├── Initial position capture
│   └── Cleanup on unmount
├── React Spring Animation (~130 lines)
│   ├── Zoom animation setup
│   ├── Pause/resume at threshold
│   ├── Opacity fade in/out
│   └── Position animation
├── Region Detection (~120 lines)
│   ├── 50px detection box
│   ├── Region overlap checking
│   ├── Region-under-cursor detection
│   └── Size tracking for dampening
├── Adaptive Zoom Search (~280 lines)
│   ├── Viewport calculation at each zoom level
│   ├── Region fitting checks
│   ├── Adaptive thresholds
│   └── Debug bounding boxes
├── Mouse Event Handlers (~150 lines)
│   ├── handleMouseMove (region detection + zoom calculation)
│   ├── handleMouseLeave (hide magnifier)
│   └── handleContainerClick (request pointer lock)
├── Label Positioning (~400 lines)
│   ├── Ghost elements for measurement
│   ├── D3 force simulation
│   └── Small region leader lines
└── SVG Rendering (~1100 lines)
    ├── Main map regions
    ├── Magnifier overlay
    ├── Crosshairs and guides
    ├── Debug visualizations
    └── Labels and indicators
```

### Extracted Modules (Phase 1 & 2)

**Phase 1: Pure Utilities**

```
utils/screenPixelRatio.ts (130 lines)
├── calculateScreenPixelRatio()
├── isAboveThreshold()
├── calculateMaxZoomAtThreshold()
└── createZoomContext()

utils/zoomCapping.ts (122 lines)
├── capZoomAtThreshold()
└── wouldZoomBeCapped()
```

**Phase 2: Custom Hooks**

```
hooks/usePointerLock.ts (119 lines)
├── State: pointerLocked
├── Methods: requestPointerLock(), exitPointerLock()
├── Event listeners: pointerlockchange, pointerlockerror
└── Callbacks: onLockAcquired(), onLockReleased()

hooks/useMagnifierZoom.ts (240 lines)
├── State: targetZoom, uncappedAdaptiveZoomRef
├── React Spring animation with pause/resume
├── Zoom capping on pointer lock changes
└── getCurrentZoom() helper

hooks/useRegionDetection.ts (238 lines)
├── detectRegions() method
├── Detection box logic (50px around cursor)
├── Region overlap and under-cursor detection
├── Size tracking (smallest, total area)
└── Returns: DetectedRegion[] sorted by size
```

### Target State (Phase 3 Integration)

**Goal**: Reduce MapRenderer.tsx from 2430 lines to ~500-800 lines

```
MapRenderer.tsx (~600 lines)
├── Hook Composition (~30 lines)
│   ├── const { pointerLocked, ... } = usePointerLock(...)
│   ├── const { targetZoom, ... } = useMagnifierZoom(...)
│   └── const { detectRegions, ... } = useRegionDetection(...)
├── Adaptive Zoom Search (~280 lines)
│   └── TODO: Extract to utils/adaptiveZoomSearch.ts
├── Mouse Event Handlers (~100 lines)
│   ├── Simplified with hook integration
│   └── Calls detectRegions() and adaptive zoom
├── Label Positioning (~400 lines)
│   └── No changes (out of scope)
└── SVG Rendering (~800 lines)
    └── Simplified with extracted logic
```

**Further extraction** (optional):

```
utils/adaptiveZoomSearch.ts (~280 lines)
├── findOptimalZoom()
├── checkRegionFit()
└── calculateViewport()
```

## Data Flow

### Magnifier Activation Flow

```
1. Mouse moves over map
   ↓
2. detectRegions() called with cursor position
   ↓
3. Returns DetectedRegion[] with sizes
   ↓
4. Check if any region is "very small" (< 15px or < 200px²)
   ↓
5. If yes → Show magnifier, run adaptive zoom search
   ↓
6. Adaptive zoom search finds optimal zoom
   ↓
7. Check screen pixel ratio at this zoom
   ↓
8. If ratio > 20 px/px → Cap zoom at threshold (unless in pointer lock)
   ↓
9. Set targetZoom, magnifier animates to new zoom level
```

### Pointer Lock Activation Flow

```
1. User clicks on map
   ↓
2. requestPointerLock() called
   ↓
3. Browser shows "Allow precision mode?" prompt
   ↓
4. User accepts → pointerlockchange event fires
   ↓
5. onLockAcquired() callback:
   - Save initial cursor position
   - Update targetZoom to uncapped value (allows zoom > threshold)
   ↓
6. Mouse movements now provide movementX/movementY deltas
   ↓
7. Apply adaptive speed multiplier based on region size
   ↓
8. User presses Escape → pointerlockchange event fires
   ↓
9. onLockReleased() callback:
   - Recalculate zoom with capping
   - Reset cursor position
   - Animate zoom back to capped level if needed
```

### Zoom Animation Flow

```
1. setTargetZoom(newZoom) called
   ↓
2. React Spring animation starts toward targetZoom
   ↓
3. On each animation frame:
   - Check current zoom vs threshold
   - If at threshold AND target also at threshold → Pause animation
   ↓
4. Animation pauses (magnifier waits for precision mode)
   ↓
5. User activates pointer lock
   ↓
6. onLockAcquired() sets targetZoom to uncapped value
   ↓
7. Animation resumes toward higher zoom
```

## Key Design Decisions

### Why Cap Zoom Without Pointer Lock?

Without capping, the magnifier would be nearly impossible to control at high zoom levels. A 50× zoom means moving the mouse 1px on the main map moves the magnifier view 50 screen pixels - making it impossible to keep the cursor on a tiny region.

### Why Adaptive Thresholds?

Gibraltar (0.08px) is so small that even at 1000× zoom it only occupies ~0.02% of the magnifier. Using the standard 10-25% threshold would reject all zoom levels. Adaptive thresholds (2-8% for sub-pixel regions) allow the algorithm to find acceptable zoom levels for extreme cases.

### Why Sort Regions Smallest-First?

When multiple regions are detected, we want to optimize for the smallest one. If Gibraltar (0.08px) and Spain (81px) are both detected, we should find zoom that works for Gibraltar, not Spain. Sorting smallest-first ensures tiny regions are checked first.

### Why Pointer Lock Instead of Custom Cursor?

Pointer lock provides true relative mouse movement without cursor constraints. A custom cursor would still be limited by screen edges and wouldn't provide the same level of precision. Pointer lock also hides the cursor, reducing visual clutter at high zoom levels.

## Testing Strategy

### Manual Testing Checklist

- [ ] Magnifier appears when hovering over small regions
- [ ] Magnifier disappears when moving away from small regions
- [ ] Zoom adapts to region size (larger for smaller regions)
- [ ] Zoom caps at threshold when not in pointer lock mode
- [ ] Pointer lock can be requested by clicking
- [ ] Pointer lock cursor is invisible and movements are smooth
- [ ] Cursor speed reduces for tiny regions (Gibraltar should be very slow)
- [ ] Escape key releases pointer lock
- [ ] Zoom recalculates and animates down when pointer lock is released
- [ ] Animation pauses at threshold when zooming in
- [ ] Animation resumes when pointer lock is activated

### Edge Cases

1. **Gibraltar (0.08px)**: Should reach 1000× zoom with pointer lock, use 2-8% threshold
2. **Rhode Island (11px)**: Should reach ~30× zoom, use standard 10-25% threshold
3. **Multiple tiny regions**: Should optimize for smallest detected region
4. **Cursor at map edge**: Magnifier viewport should clamp to map bounds
5. **Rapid mouse movement**: Magnifier should keep up without lag

## Future Improvements

### Performance Optimizations

- [ ] Cache region bounding boxes (currently recalculated on every mouse move)
- [ ] Throttle region detection to 60fps
- [ ] Use Web Workers for adaptive zoom search
- [ ] Implement spatial indexing (R-tree) for faster region detection

### Feature Enhancements

- [ ] Zoom in/out with scroll wheel
- [ ] Click-to-zoom on magnifier to toggle between preset zoom levels
- [ ] Magnifier position customization (corner preference)
- [ ] Keyboard shortcuts for precision mode (P to toggle)
- [ ] Visual indicator for precision mode recommendation
- [ ] Smooth transitions when magnifier changes quadrants

### Code Quality

- [ ] Extract adaptive zoom search to `utils/adaptiveZoomSearch.ts`
- [ ] Add unit tests for pure utility functions
- [ ] Add integration tests for hooks
- [ ] Document complex algorithms with diagrams
- [ ] Reduce MapRenderer.tsx below 500 lines

## References

- **Pointer Lock API**: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API
- **React Spring**: https://www.react-spring.dev/
- **D3 Force Simulation**: https://d3js.org/d3-force

## Glossary

- **Screen Pixel Ratio**: How many screen pixels the magnifier jumps when mouse moves 1px
- **Precision Mode**: Pointer lock mode with reduced cursor speed
- **Zoom Capping**: Limiting zoom level to prevent excessive sensitivity
- **Adaptive Zoom**: Automatically finding optimal zoom based on region sizes
- **Detection Box**: 50px × 50px area around cursor for region detection
- **Very Small Region**: Region with width < 15px OR height < 15px OR area < 200px²
- **Sub-pixel Region**: Region with smallest dimension < 1px (e.g., Gibraltar at 0.08px)
