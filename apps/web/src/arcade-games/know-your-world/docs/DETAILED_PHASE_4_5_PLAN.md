# Detailed Plan for Phases 4 & 5: MapRenderer Refactoring

## Current Status (as of Phase 3 completion)

- **MapRenderer.tsx**: 3,524 lines
- **Goal**: < 1,000 lines (pure composition)
- **Line reduction so far**: ~30 lines from Phase 3

### Completed Phases
- ✅ Phase 1: cursorPosition migrated to state machine
- ✅ Phase 2: hoveredRegion migrated to state machine
- ✅ Phase 2b: Dead hoveredRegion state removed from useRegionDetection
- ✅ Phase 3: useGameSettings hook extracted

---

## Line Budget Analysis

To get from 3,524 to <1,000 lines, we need to remove **~2,524 lines**.

### Current Structure Breakdown

| Section | Lines | Notes |
|---------|-------|-------|
| Imports | ~70 | Mostly necessary |
| Constants/types | ~30 | Keep |
| Helper functions | ~100 | Some extractable |
| Hook calls & state setup | ~350 | Target for extraction |
| useEffect blocks | ~500 | Major extraction target |
| useCallback handlers | ~400 | Major extraction target |
| handleMouseMove logic | ~200 | Desktop interaction |
| handleMapTouch* handlers | ~280 | Map touch (not magnifier) |
| useMemo computations | ~200 | Keep most, some extractable |
| Spring configurations | ~100 | Keep |
| JSX return | ~800 | Component extraction target |

---

## Phase 4: Celebration & Animation Hooks

### 4A: Extract useCelebration Hook (~150 lines savings)

**Key Discovery**: `celebration` and `setCelebration` come from `useKnowYourWorld()` context, NOT local state. This means the hook needs to work WITH the context, not replace it.

**What to extract:**

```typescript
// features/celebration/useCelebration.ts

interface UseCelebrationOptions {
  celebration: CelebrationState | null           // From useKnowYourWorld()
  setCelebration: (c: CelebrationState | null) => void
  currentPrompt: string | null
  assistanceLevel: string
  onRegionClick: (regionId: string, regionName: string) => void
  puzzlePieceTarget: PuzzlePieceTarget | null    // From useKnowYourWorld()
  setPuzzlePieceTarget: (t: PuzzlePieceTarget | null) => void
  getSearchMetrics: () => SearchMetrics
  promptStartTime: React.RefObject<number>
  svgRef: React.RefObject<SVGSVGElement>
  mapData: MapData
  parsedViewBox: ParsedViewBox
}

interface UseCelebrationReturn {
  // State
  celebrationFlashProgress: number

  // Callbacks
  handleCelebrationComplete: () => void
  handleRegionClickWithCelebration: (regionId: string, regionName: string) => void
  getCelebrationRegionCenter: () => { x: number; y: number }
}
```

**Lines in MapRenderer to extract:**
- Lines 539-540: `celebrationFlashProgress` state + `pendingCelebrationClick` ref
- Line 545: `celebrationAnimation = usePulsingAnimation()`
- Lines 1438-1460: Celebration animation effect
- Lines 1462-1473: `handleCelebrationComplete` callback
- Lines 1476-1575: `handleRegionClickWithCelebration` callback (~100 lines!)
- Lines 1577-1601: `getCelebrationRegionCenter` callback

**Complexity**: HIGH - Many dependencies on props/context

---

### 4B: Extract useGiveUpReveal Hook (~130 lines savings)

**What to extract:**

```typescript
// features/reveal/useGiveUpReveal.ts

interface UseGiveUpRevealOptions {
  giveUpReveal: GiveUpReveal | null  // From props
  svgRef: React.RefObject<SVGSVGElement>
  containerRef: React.RefObject<HTMLDivElement>
  fillContainer: boolean
}

interface UseGiveUpRevealReturn {
  giveUpFlashProgress: number
  isGiveUpAnimating: boolean
  savedButtonPosition: { top: number; right: number } | null
  giveUpZoomTarget: { scale: number; translateX: number; translateY: number }
}
```

**Lines to extract:**
- Lines 531-532: `giveUpFlashProgress`, `isGiveUpAnimating` state
- Line 543: `giveUpAnimation = usePulsingAnimation()`
- Lines 547-550: `savedButtonPosition` state
- Lines 1168-1172: `giveUpZoomTarget` state
- Lines 1313-1408: Give-up reveal animation effect (~95 lines!)

**Complexity**: MEDIUM - Self-contained, fewer external dependencies

---

### 4C: Extract useHintAnimation Hook (~60 lines savings)

```typescript
// features/hint/useHintAnimation.ts

interface UseHintAnimationOptions {
  hintActive: HintActive | null  // From props
}

interface UseHintAnimationReturn {
  hintFlashProgress: number
  isHintAnimating: boolean
}
```

**Lines to extract:**
- Lines 535-536: `hintFlashProgress`, `isHintAnimating` state
- Line 544: `hintAnimation = usePulsingAnimation()`
- Lines 1410-1436: Hint animation effect

**Complexity**: LOW - Very self-contained

---

### Phase 4 Summary

| Hook | Lines Saved | Complexity | Priority |
|------|-------------|------------|----------|
| useHintAnimation | ~60 | LOW | 1st |
| useGiveUpReveal | ~130 | MEDIUM | 2nd |
| useCelebration | ~150 | HIGH | 3rd |
| **Total** | **~340** | | |

**Post-Phase 4 estimate**: 3,524 - 340 = **~3,184 lines**

---

## Phase 5: Component & Handler Extraction

### 5A: Extract Desktop Mouse Handlers (~250 lines savings)

This is the BIG one. The `handleMouseMove` function is inline and massive.

```typescript
// features/interaction/useDesktopMouseHandlers.ts

interface UseDesktopMouseHandlersOptions {
  svgRef: React.RefObject<SVGSVGElement>
  containerRef: React.RefObject<HTMLDivElement>
  cursorPositionRef: React.MutableRefObject<{ x: number; y: number } | null>
  interaction: InteractionStateMachine
  pointerLocked: boolean
  detectRegions: DetectRegionsFn
  mapData: MapData
  parsedViewBox: ParsedViewBox
  // ... many more deps
}

interface UseDesktopMouseHandlersReturn {
  handleMouseDown: (e: React.MouseEvent) => void
  handleMouseUp: (e: React.MouseEvent) => void
  handleMouseMove: (e: React.MouseEvent) => void
  handleMouseLeave: () => void
  handleContainerClick: (e: React.MouseEvent) => void
}
```

**Lines to extract:**
- Lines 1008-1040: `handleContainerClick`
- Lines 2000-2235 (approx): `handleMouseMove` - this is HUGE (~235 lines)
- Lines 2237-2263: `handleMouseLeave`
- Desktop drag refs and state

**Complexity**: HIGH - Tightly coupled to magnifier, hot/cold, state machine

---

### 5B: Extract Map Touch Handlers (~280 lines savings)

The `handleMapTouchStart/Move/End` are already `useCallback` but inline.

```typescript
// features/interaction/useMapTouchHandlers.ts

interface UseMapTouchHandlersOptions {
  svgRef: React.RefObject<SVGSVGElement>
  containerRef: React.RefObject<HTMLDivElement>
  interaction: InteractionStateMachine
  detectRegions: DetectRegionsFn
  // hot/cold deps
  // magnifier deps
}

interface UseMapTouchHandlersReturn {
  handleMapTouchStart: (e: React.TouchEvent) => void
  handleMapTouchMove: (e: React.TouchEvent) => void
  handleMapTouchEnd: () => void
  dismissMagnifier: () => void
  selectRegionAtCrosshairs: () => void
}
```

**Lines to extract:**
- Lines 2266-2283: `handleMapTouchStart`
- Lines 2285-2470: `handleMapTouchMove` (~185 lines!)
- Lines 2472-2487: `dismissMagnifier`
- Lines 2489-2543: `handleMapTouchEnd`
- Lines 2545-2600: `selectRegionAtCrosshairs`

**Complexity**: HIGH - Similar coupling as desktop handlers

---

### 5C: Extract JSX Components (~300 lines savings)

Break down the massive JSX return into smaller components:

```typescript
// components/DebugBoundingBoxes.tsx (~50 lines)
// Renders debug bounding box rectangles in SVG

// components/MapDefs.tsx (~80 lines)
// SVG <defs> for markers and player patterns

// components/HotColdIndicator.tsx (~30 lines from inline JSX)
// The hot/cold crosshair indicator

// components/MagnifierSelectButton.tsx (~50 lines)
// The floating select button on mobile

// components/DebugOverlay.tsx (~50 lines)
// Debug info panel
```

**Complexity**: LOW-MEDIUM - Mostly prop threading

---

### 5D: Extract Auxiliary Hooks (~200 lines savings)

```typescript
// features/hints/useHintFeature.ts (~100 lines)
// Consolidates: showHintBubble state, useRegionHint, useSpeakHint
// struggle detection effect, hint cycling effect

// features/crosshair/useCrosshairRotation.ts (~80 lines)
// The rotation spring + rAF animation loop (lines 1194-1268)

// features/multiplayer/useNetworkCursorSync.ts (~50 lines)
// onCursorUpdate effect and networkHoveredRegions computation
```

---

### Phase 5 Summary

| Extraction | Lines Saved | Complexity | Priority |
|------------|-------------|------------|----------|
| useHintFeature | ~100 | MEDIUM | 1st (self-contained) |
| useCrosshairRotation | ~80 | LOW | 2nd |
| JSX Components | ~300 | LOW-MEDIUM | 3rd |
| useMapTouchHandlers | ~280 | HIGH | 4th |
| useDesktopMouseHandlers | ~250 | HIGH | 5th |
| useNetworkCursorSync | ~50 | LOW | 6th |
| **Total** | **~1,060** | | |

**Post-Phase 5 estimate**: 3,184 - 1,060 = **~2,124 lines**

---

## Phase 6: Deep Refactoring (if needed)

We're still at ~2,124 lines, above the 1,000 target. Options:

### 6A: Extract the entire magnifier system integration

Move all magnifier positioning, zoom calculation, and coordinate conversion to a dedicated hook:

```typescript
// features/magnifier/useMagnifierIntegration.ts (~300 lines)
// Combines: magnifierSpring, displayViewBox calculation,
// parsedViewBox, magnifierDimensions, zoom capping logic
```

### 6B: Extract ViewBox management

```typescript
// features/viewbox/useViewBoxManagement.ts (~150 lines)
// displayViewBox calculation, parsedViewBox,
// safe zone calculations, fit-crop logic
```

### 6C: Reconsider the "controls state" sync

The `setControlsState` effect (lines 902-951) syncs ~20 values to context for GameInfoPanel. This could become a dedicated hook or context provider.

### 6D: Move region precomputation out

The `largestPieceSizesRef` calculation effect could be a utility that runs once on mount.

---

## Recommended Execution Order

### Week 1: Low-hanging fruit

1. **useHintAnimation** (60 lines) - Standalone, no dependencies
2. **useCrosshairRotation** (80 lines) - Standalone animation logic
3. **JSX: DebugBoundingBoxes** (50 lines) - Simple prop pass-through
4. **JSX: MapDefs** (80 lines) - Static SVG defs

**Savings: ~270 lines → ~3,254 lines**

### Week 2: Medium complexity

5. **useGiveUpReveal** (130 lines) - Self-contained reveal logic
6. **useHintFeature** (100 lines) - Consolidates hint state
7. **JSX: Remaining components** (120 lines) - HotColdIndicator, SelectButton, Debug

**Savings: ~350 lines → ~2,904 lines**

### Week 3: High complexity handlers

8. **useCelebration** (150 lines) - Needs careful dependency management
9. **useNetworkCursorSync** (50 lines) - Multiplayer sync
10. **useMapTouchHandlers** (280 lines) - Touch gesture handling

**Savings: ~480 lines → ~2,424 lines**

### Week 4: Final push

11. **useDesktopMouseHandlers** (250 lines) - Desktop interaction
12. **useMagnifierIntegration** (300 lines) - Magnifier system
13. **useViewBoxManagement** (150 lines) - ViewBox logic

**Savings: ~700 lines → ~1,724 lines**

---

## Revised Goal Assessment

Getting to exactly 1,000 lines may not be achievable without:
- Sacrificing code clarity
- Over-fragmenting related logic
- Creating too many small files

**Realistic target: ~1,500-1,800 lines**

This still represents a **50%+ reduction** and achieves the main goals:
- State machine is authoritative
- No duplicate state
- Logic is grouped by feature domain
- Components are testable in isolation

---

## Risk Assessment

### HIGH RISK extractions:
- `useDesktopMouseHandlers` - Touches hot/cold, magnifier, state machine, drag detection
- `useMapTouchHandlers` - Similar coupling
- `useCelebration` - Depends on context, refs, and props

**Mitigation**:
- Extract incrementally (one callback at a time)
- Keep internal refs in the hook
- Pass minimum necessary dependencies

### LOW RISK extractions:
- `useHintAnimation` - Truly self-contained
- `useCrosshairRotation` - Animation-only
- JSX components - Presentation-only

---

## Files to Create (Revised List)

```
features/celebration/useCelebration.ts
features/celebration/index.ts

features/reveal/useGiveUpReveal.ts
features/reveal/index.ts

features/hint/useHintAnimation.ts
features/hint/useHintFeature.ts
features/hint/index.ts

features/crosshair/useCrosshairRotation.ts
features/crosshair/index.ts

features/interaction/useDesktopMouseHandlers.ts
features/interaction/useMapTouchHandlers.ts
(update existing index.ts)

components/DebugBoundingBoxes.tsx
components/MapDefs.tsx
components/HotColdIndicator.tsx
components/MagnifierSelectButton.tsx
components/DebugOverlay.tsx
```

---

## Next Action

Start with the simplest extraction that proves the pattern works:

1. **Create `features/hint/useHintAnimation.ts`**
   - Move hint flash state and effect
   - ~60 lines, minimal dependencies
   - Validates extraction approach before tackling complex hooks

After verifying this works, proceed with `useCrosshairRotation`, then work up the complexity ladder.
