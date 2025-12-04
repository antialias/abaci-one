# MapRenderer Refactoring Plan

**Starting state**: 2,997 lines
**Current state**: 2,810 lines (187 lines removed, 6.2% reduction)
**State machine**: 762 lines (+110 lines for magnifier state)
**Target**: ~1,800-2,000 lines

---

## Completed Work

| Extraction | Lines Saved | Status |
|-----------|-------------|--------|
| useSpeechAnnouncements | 173 | ✅ Done |
| useStruggleDetection | 31 | ✅ Done |
| useControlsSync | 0 | ⏭️ Skipped (low value) |
| **Magnifier state → State Machine** | ~20 (moved to state machine) | ✅ Done |
| **useMagnifierState deletion** | 183 | ✅ Done (file deleted) |
| **MapRendererContext deletion** | 145 | ✅ Done (file deleted) |

### State Machine Consolidation (Phase 1) ✅

Added to `useInteractionStateMachine.ts`:
- `MagnifierDisplayState` interface with visibility, opacity, zoom, position, expansion
- Magnifier events: `MAGNIFIER_SHOW`, `MAGNIFIER_HIDE`, `MAGNIFIER_SET_ZOOM`, etc.
- Shared event handler across desktop and mobile reducers
- Derived state in hook return: `showMagnifier`, `magnifierOpacity`, etc.

MapRenderer now sources magnifier state from state machine:
- `showMagnifier` = `interaction.showMagnifier`
- `targetOpacity` = `interaction.magnifierOpacity`
- `isMagnifierExpanded` = `interaction.isMagnifierExpanded`
- Wrapper callbacks dispatch events for child components via context

---

## Existing Architecture

### Provider Hierarchy
```
KnowYourWorldProvider (Provider.tsx) - Game state, actions, multiplayer
  └─ MusicProvider - Music engine (OWNS its state)
      └─ MapRenderer (component)
          ├─ RegionRenderProvider - Theme, animations (value bag)
          └─ MagnifierProvider + MapGameProvider - Magnifier/game state (value bags)
```

### Existing Contexts

| Context | Where Created | Pattern | Notes |
|---------|---------------|---------|-------|
| KnowYourWorldContext | Provider.tsx | Owns state | Game-level state |
| MusicContext | Provider.tsx | **Owns state** | Good model to follow |
| RegionRenderContext | MapRenderer | Value bag | Passes animation values |
| MagnifierContext | MapRenderer | Value bag | Passes values through, `interaction` has dispatch |
| MapGameContext | MapRenderer | Value bag | **Just passes values through** |
| ~~MapRendererContext~~ | ~~features/shared/~~ | ~~UNUSED!~~ | ✅ **DELETED** |

**Key Insight**: MagnifierContext and MapGameContext are "value bags" - MapRenderer creates all state, constructs value objects, passes them to providers. However, child components now have access to `interaction.dispatch` via context.

---

## State Management Status

### What the State Machine Tracks ✅
- `cursorPosition` / `touchCenter`
- `hoveredRegion` / `touchedRegion`
- `isPointerLocked`, `isDesktopDragging`, `isMapPanning`
- `isMagnifierActive` (mobile only - via phase)
- `magnifierTriggeredByDrag`
- `isPinching`, `isMagnifierDragging`
- ✅ `showMagnifier` (unified for mobile and desktop via `magnifier.isVisible`)
- ✅ `targetOpacity` (via `magnifier.targetOpacity`)
- ✅ `isMagnifierExpanded` (via `magnifier.isExpanded`)
- ✅ `magnifierPosition` (via `magnifier.position`)
- ✅ `magnifierZoom` (via `magnifier.targetZoom`)

### What Remains Local (OK to stay local)

| State | Current Location | Notes |
|-------|------------------|-------|
| `targetTop` / `targetLeft` | MapRenderer `useState` | ⚠️ Consider moving to state machine |
| `targetZoom` | `useMagnifierZoom` hook | Separate hook, may consolidate later |
| `smallestRegionSize` | MapRenderer `useState` | Derived value, fine as local state |

### Resolved: The Dual-Source Problem ✅
```typescript
// BEFORE: Different sources for mobile vs desktop!
const showMagnifier = isTouchDevice
  ? interaction.isMagnifierActive  // state machine
  : magnifierState.isVisible       // separate hook

// AFTER: Unified source from state machine
const showMagnifier = isTouchDevice
  ? interaction.isMagnifierActive || interaction.showMagnifier
  : interaction.showMagnifier
```

---

## Strategy: Consolidate Into State Machine

### Phase 1: Add Magnifier State to State Machine

Expand `InteractionState` to include magnifier display state:

```typescript
// Add to BOTH desktop and mobile modes (shared structure):
magnifier: {
  isVisible: boolean        // Unified source of truth (replaces useMagnifierState.isVisible)
  targetZoom: number        // Current target zoom level
  targetOpacity: number     // For fade animations
  position: { top: number; left: number }
  isExpanded: boolean       // Mobile expansion state
}
```

Add new events:
```typescript
| { type: 'MAGNIFIER_SHOW'; position?: { top: number; left: number }; zoom?: number }
| { type: 'MAGNIFIER_HIDE' }
| { type: 'MAGNIFIER_SET_ZOOM'; zoom: number }
| { type: 'MAGNIFIER_SET_POSITION'; top: number; left: number }
| { type: 'MAGNIFIER_SET_OPACITY'; opacity: number }
| { type: 'MAGNIFIER_TOGGLE_EXPANDED' }
| { type: 'MAGNIFIER_SET_EXPANDED'; expanded: boolean }
```

### Phase 2: Remove useMagnifierState Hook

After Phase 1:
- `useMagnifierState` becomes unnecessary
- All visibility/expansion logic lives in state machine
- MapRenderer dispatches events instead of calling setters
- Delete the hook file

### Phase 3: Clean Up Unused Contexts

**MapRendererContext** - currently unused:
- **Action**: Delete `features/shared/MapRendererContext.tsx`
- It was defined but never connected to anything

**MagnifierContext** and **MapGameContext**:
- Keep them for now - they serve logical grouping
- After state consolidation, their values become simpler
- Less state to pass through = smaller context values

---

## Implementation Plan

### Step 1: Add `magnifier` to InteractionState

```typescript
// In useInteractionStateMachine.ts

// Default magnifier state (shared by both modes)
const defaultMagnifier = {
  isVisible: false,
  targetZoom: 10,
  targetOpacity: 0,
  position: { top: 290, left: 20 },  // Safe zone defaults
  isExpanded: false,
}

// Add to initial states:
const initialDesktopState: InteractionState = {
  mode: 'desktop',
  phase: 'idle',
  // ... existing fields ...
  magnifier: { ...defaultMagnifier },
}

const initialMobileState: InteractionState = {
  mode: 'mobile',
  phase: 'idle',
  // ... existing fields ...
  magnifier: { ...defaultMagnifier },
}
```

### Step 2: Add Reducer Cases

```typescript
// Handle in BOTH desktopReducer and mobileReducer (or extract common handler)

case 'MAGNIFIER_SHOW':
  return {
    ...state,
    magnifier: {
      ...state.magnifier,
      isVisible: true,
      targetOpacity: 1,
      ...(event.position && { position: event.position }),
      ...(event.zoom !== undefined && { targetZoom: event.zoom }),
    },
  }

case 'MAGNIFIER_HIDE':
  return {
    ...state,
    magnifier: {
      ...state.magnifier,
      isVisible: false,
      targetOpacity: 0,
      isExpanded: false,
    },
  }

case 'MAGNIFIER_SET_ZOOM':
  return {
    ...state,
    magnifier: { ...state.magnifier, targetZoom: event.zoom },
  }

case 'MAGNIFIER_SET_POSITION':
  return {
    ...state,
    magnifier: {
      ...state.magnifier,
      position: { top: event.top, left: event.left },
    },
  }

case 'MAGNIFIER_SET_OPACITY':
  return {
    ...state,
    magnifier: { ...state.magnifier, targetOpacity: event.opacity },
  }

case 'MAGNIFIER_SET_EXPANDED':
  return {
    ...state,
    magnifier: { ...state.magnifier, isExpanded: event.expanded },
  }

case 'MAGNIFIER_TOGGLE_EXPANDED':
  return {
    ...state,
    magnifier: { ...state.magnifier, isExpanded: !state.magnifier.isExpanded },
  }
```

### Step 3: Add Derived State to Hook Return

```typescript
// In UseInteractionStateMachineReturn, add:

// Magnifier state (unified for mobile and desktop)
showMagnifier: boolean
targetZoom: number
targetOpacity: number
magnifierPosition: { top: number; left: number }
isMagnifierExpanded: boolean

// In the hook implementation:
const showMagnifier = state.magnifier.isVisible
const targetZoom = state.magnifier.targetZoom
const targetOpacity = state.magnifier.targetOpacity
const magnifierPosition = state.magnifier.position
const isMagnifierExpanded = state.magnifier.isExpanded
```

### Step 4: Update MapRenderer Incrementally

Replace usages one at a time:

```typescript
// Before
const magnifierState = useMagnifierState()
const showMagnifier = isTouchDevice ? interaction.isMagnifierActive : magnifierState.isVisible
magnifierState.show()
setTargetZoom(newZoom)

// After
const { showMagnifier, targetZoom, targetOpacity, magnifierPosition, isMagnifierExpanded } = interaction
interaction.dispatch({ type: 'MAGNIFIER_SHOW' })
interaction.dispatch({ type: 'MAGNIFIER_SET_ZOOM', zoom: newZoom })
```

### Step 5: Remove useMagnifierState

Once all usages are migrated:
- Delete `features/magnifier/useMagnifierState.ts`
- Update exports in `features/magnifier/index.ts`
- Remove any refs that were only needed by that hook

### Step 6: Delete MapRendererContext

```bash
rm features/shared/MapRendererContext.tsx
# Update features/shared/index.ts to remove exports
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking mobile magnifier | Medium | High | Test: drag to show, pan, pinch, select button |
| Breaking desktop magnifier | Medium | High | Test: hover, shift+click, pointer lock |
| Spring animation timing | Low | Medium | Springs still in MapRenderer, just read from state machine |
| Stale closures | Low | Medium | State machine is source of truth, handlers dispatch |
| TypeScript errors | Low | Low | Add magnifier to state type, update all usages |

---

## Testing Checklist

After each step:
- [ ] `npm run type-check` passes
- [ ] Desktop: mouse movement, magnifier appear/disappear
- [ ] Desktop: region clicks with celebration
- [ ] Desktop: shift+click precision mode, pointer lock, edge escape
- [ ] Mobile: drag map to show magnifier
- [ ] Mobile: pan magnifier, pinch zoom
- [ ] Mobile: select button appears after drag, works correctly
- [ ] Hot/cold feedback works on both platforms
- [ ] Celebrations animate correctly
- [ ] Multiplayer cursor sharing works

---

## Estimated Impact

| Phase | Description | Lines Change |
|-------|-------------|--------------|
| Step 1-3 | Add magnifier to state machine | +80 to state machine |
| Step 4 | Update MapRenderer to use it | ~-50 (remove computed showMagnifier, setters) |
| Step 5 | Remove useMagnifierState | ~-100 |
| Step 6 | Delete MapRendererContext | ~-150 |
| Handler simplification | Handlers dispatch instead of manage state | ~-150 |

**Net reduction**: ~370 lines, bringing MapRenderer to ~2,400 lines

---

## Next Action

**Start with Step 1-2**: Add `magnifier` field and reducer cases to `useInteractionStateMachine.ts`.

This is the foundation for everything else and is **additive** - it doesn't change existing behavior until we start using the new state in MapRenderer.
