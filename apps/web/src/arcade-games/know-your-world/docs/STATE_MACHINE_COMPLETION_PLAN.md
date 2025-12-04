# State Machine Completion & MapRenderer Composition Plan

## Current Status

- **MapRenderer.tsx**: 3,553 lines (down from 4,644 - 23% reduction)
- **Goal**: < 1,000 lines (pure composition)
- **State machine**: Partially adopted

## Key Insight: State Machine Already Has cursorPosition and hoveredRegionId

The interaction state machine (`useInteractionStateMachine`) already maintains:
- `cursor` (desktop) / `touchCenter` (mobile) → exposed as `cursorPosition`
- `hoveredRegion` (desktop) / `touchedRegion` (mobile) → exposed as `hoveredRegionId`

**But MapRenderer duplicates these with:**
- `cursorPositionRef` + `cursorPosition` (useState)
- `hoveredRegion` (from useRegionDetection)

---

## Phase 1: Eliminate Cursor Position Duplication (LOW RISK)

### Current Duplication

```tsx
// MapRenderer.tsx - DUPLICATED STATE
const cursorPositionRef = useRef<{ x: number; y: number } | null>(null)
const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null)

// State machine already has this:
const { cursorPosition: machinePosition } = interaction  // derived from state.cursor/state.touchCenter
```

### Analysis

**Why cursorPositionRef exists:**
- Used for synchronous reads in event handlers (60+ references)
- State machine `state.cursor` is async (useReducer batching)
- Ref provides immediate reads needed for smooth gesture handling

**Why cursorPosition (useState) exists:**
- Triggers re-renders when cursor moves (for UI components)
- Powers magnifier positioning, crosshair, debug info

### Resolution Strategy: **Keep Ref, Replace State**

1. **Keep `cursorPositionRef`** - Essential for synchronous event handler reads
2. **Replace `cursorPosition` state** with `interaction.cursorPosition` from state machine
3. **Dispatch MOUSE_MOVE/TOUCH_MOVE** to state machine with position updates
4. **Remove `setCursorPosition`** calls - state machine is authoritative

### Implementation Steps

```
1. Ensure MOUSE_MOVE dispatches include position: { x, y }
2. Ensure TOUCH_MOVE dispatches include position: { x, y }
3. Replace all reads of `cursorPosition` with `interaction.cursorPosition`
4. Remove `const [cursorPosition, setCursorPosition] = useState(...)`
5. Keep `cursorPositionRef` for synchronous handler logic
6. Update MagnifierContext to get cursorPosition from interaction
```

### Risk: LOW
- State machine already has the infrastructure
- Just need to ensure all MOUSE_MOVE/TOUCH_MOVE events include position

---

## Phase 2: Eliminate hoveredRegion Duplication (MEDIUM RISK)

### Current Duplication

```tsx
// useRegionDetection.ts
const [hoveredRegion, setHoveredRegion] = useState<string | null>(null)

// State machine already has:
state.hoveredRegion (desktop) / state.touchedRegion (mobile)
// Exposed as interaction.hoveredRegionId
```

### Analysis

**Why useRegionDetection has its own state:**
- `detectRegions()` calculates which region is under cursor
- Sets `hoveredRegion` as a side effect
- Consumer (MapRenderer) calls `setHoveredRegion` separately

**Why state machine has hoveredRegion:**
- MOUSE_MOVE events include `regionId` parameter
- State machine stores it in `state.hoveredRegion`

### Resolution Strategy: **State Machine is Authoritative**

1. **Remove hoveredRegion state from useRegionDetection**
2. **useRegionDetection.detectRegions()** returns `regionUnderCursor` (already does)
3. **Caller dispatches** `MOUSE_MOVE { regionId }` or `TOUCH_MOVE { regionId }`
4. **All consumers read** `interaction.hoveredRegionId`

### Implementation Steps

```
1. Remove useState from useRegionDetection (return only detectRegions function)
2. After detectRegions(), dispatch to state machine with regionId
3. MapGameContext: get hoveredRegion from interaction state machine
4. Remove setHoveredRegion prop drilling
5. Update MagnifierOverlay et al. to use context value
```

### Risk: MEDIUM
- More consumers depend on hoveredRegion
- Need to audit all callers of setHoveredRegion

---

## Phase 3: Extract Large Handler Blocks into Hooks (HIGH IMPACT)

### Candidate Extractions

| Handler Block | Lines | Target Hook | Notes |
|---------------|-------|-------------|-------|
| Mouse movement | ~200 | `useDesktopInteraction` | handleMouseMove, pointer lock logic |
| Map touch handlers | ~250 | `useMapTouchInteraction` | handleMapTouchStart/Move/End |
| Celebration logic | ~150 | `useCelebration` | Flash animations, timing |
| Settings persistence | ~100 | `useGameSettings` | autoSpeak, autoHint, hotCold |
| Speech/announce | ~150 | `useAnnouncements` | Auto-speak, hint bubbles |
| Give-up/hint animation | ~100 | `useRevealAnimation` | Zoom, flash progress |

### Priority Order

1. **useGameSettings** - Pure state management, no deps on other handlers
2. **useCelebration** - Self-contained animation logic
3. **useDesktopInteraction** - Consolidates mouse handling
4. **useMapTouchInteraction** - Consolidates touch handling

### Extraction Pattern

```tsx
// Before (in MapRenderer - 100 lines)
const [autoSpeak, setAutoSpeak] = useState(() => { ... })
const [withAccent, setWithAccent] = useState(() => { ... })
const handleAutoSpeakChange = useCallback(...)
const handleWithAccentChange = useCallback(...)
// ... effects for localStorage sync

// After (in MapRenderer - 3 lines)
const settings = useGameSettings({
  selectedMap,
  gameMode,
  isArcadeMode
})
// settings.autoSpeak, settings.handleAutoSpeakChange, etc.
```

---

## Phase 4: Extract Render Sections into Components

### Current JSX Structure (~700 lines)

```
<div container>
  <animated.svg>
    <RegionRenderProvider>
      {regions.map(RegionPath)}
    </RegionRenderProvider>
    {debugBoundingBoxes.map(...)}  // ~40 lines
    <defs>...</defs>               // ~30 lines
  </animated.svg>

  <MagnifierProvider>
    <MapGameProvider>
      <MagnifierOverlayWithHandlers />
      {showMagnifier && cursorPosition && (
        // Magnifier zoom lines overlay ~60 lines
      )}
    </MapGameProvider>
  </MagnifierProvider>

  {cursorPosition && hasAnyFinePointer && (
    <CrosshairCursor />           // Already extracted
  )}

  {hotColdEnabled && cursorPosition && (
    // Hot/cold indicator ~30 lines
  )}

  {cursorPosition && (
    // Magnifier select button ~50 lines
  )}

  {debugInfo && (
    // Debug overlay ~50 lines
  )}
</div>
```

### Extraction Candidates

| Section | Lines | Extract To | Priority |
|---------|-------|------------|----------|
| Debug bounding boxes | 40 | `DebugBoundingBoxes.tsx` | Low |
| SVG defs (markers) | 30 | `MapDefs.tsx` | Low |
| Hot/cold indicator | 30 | `HotColdIndicator.tsx` | Medium |
| Select button | 50 | `SelectButton.tsx` | Medium |
| Debug overlay | 50 | `DebugOverlay.tsx` | Low |
| Zoom lines overlay | 60 | Already in MagnifierOverlay context | Done |

---

## Recommended Sprint Plan

### Day 1: State Machine Cursor Position Migration

**Effort: 2-3 hours**

1. Audit MOUSE_MOVE/TOUCH_MOVE dispatches - ensure position included
2. Update MagnifierContext to derive cursorPosition from interaction
3. Replace `cursorPosition` state reads with `interaction.cursorPosition`
4. Remove `const [cursorPosition, setCursorPosition]`
5. Keep `cursorPositionRef` for sync access
6. Test thoroughly on mobile and desktop

### Day 2: State Machine hoveredRegion Migration

**Effort: 3-4 hours**

1. Remove `hoveredRegion` state from useRegionDetection
2. Update MapGameContext to derive from interaction state
3. Audit all `setHoveredRegion` calls - convert to state machine dispatches
4. Update MagnifierContext/MagnifierOverlay
5. Test region highlighting on both platforms

### Day 3: Extract useGameSettings Hook

**Effort: 2 hours**

1. Create `hooks/useGameSettings.ts`
2. Move autoSpeak, withAccent, autoHint, hotCold state
3. Move localStorage sync effects
4. Move handler callbacks
5. Update MapRenderer to use hook

### Day 4: Extract useCelebration Hook

**Effort: 2 hours**

1. Create `features/celebration/useCelebration.ts`
2. Move celebrationFlashProgress, celebration state
3. Move handleRegionClickWithCelebration
4. Move handleCelebrationComplete
5. Move related effects

### Day 5: Component Extraction & Cleanup

**Effort: 2-3 hours**

1. Extract HotColdIndicator component
2. Extract SelectButton component
3. Extract DebugBoundingBoxes component
4. Final cleanup and testing

---

## Expected Outcome

| Metric | Before | After |
|--------|--------|-------|
| MapRenderer lines | 3,553 | ~1,200 |
| State machine authority | Partial | Full |
| Duplicate state | 3 items | 0 |
| Testable units | Low | High |
| Context usage | 2 contexts | 2 contexts (lean) |

---

## Decision Points

### Q: Should cursorPositionRef stay?

**Yes.** React state updates batch asynchronously. Event handlers need immediate cursor position reads for smooth gesture handling. The ref provides O(1) sync access while state machine is authoritative for render.

### Q: Should we consolidate MagnifierContext and MapGameContext?

**No.** They serve different domains:
- MagnifierContext: Magnifier visual state, springs, sizing
- MapGameContext: Game logic state, regions, celebration

### Q: Should useRegionDetection return state?

**No.** After migration:
- `detectRegions(x, y)` → returns detection result (pure function)
- State machine stores `hoveredRegionId`
- Consumers read from interaction or context

---

## Files to Create

```
features/settings/useGameSettings.ts       # Settings persistence
features/settings/index.ts

features/celebration/useCelebration.ts     # Celebration logic
features/celebration/index.ts

features/interaction/useDesktopInteraction.ts  # Desktop mouse logic
features/interaction/useMapTouchInteraction.ts # Map touch logic (not magnifier)

components/HotColdIndicator.tsx
components/SelectButton.tsx
components/DebugBoundingBoxes.tsx
components/MapDefs.tsx
```

## Files to Modify

```
hooks/useRegionDetection.ts          # Remove internal state
features/magnifier/MagnifierContext.tsx  # Derive from interaction
features/game/MapGameContext.tsx     # Derive hoveredRegion from interaction
components/MapRenderer.tsx           # Use extracted hooks/components
```
