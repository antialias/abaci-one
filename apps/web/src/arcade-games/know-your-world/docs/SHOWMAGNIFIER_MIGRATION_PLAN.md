# showMagnifier Migration Plan

## Current State Analysis

### What `showMagnifier` represents
`showMagnifier` is currently stored in `useMagnifierState().isVisible` and controls whether the magnifier overlay is rendered/visible.

### Current Triggers for Setting showMagnifier

#### Desktop Triggers (lines 2223-2232)
When `shouldShow` is true in `handleMouseMove`:
```typescript
const shouldShow =
  shiftPressed ||                                    // 1. Shift key held
  isMobileMapDragging ||                            // 2. Mobile dragging (never true on desktop)
  isDesktopMapDragging ||                           // 3. Desktop click-and-drag
  isNearLastDragPosition ||                         // 4. Cursor near last drag end
  (targetNeedsMagnification && hasSmallRegion)     // 5. Small regions detected
```

If `shouldShow` → `setShowMagnifier(true)`
If `!shouldShow` → `setShowMagnifier(false)`

#### Desktop Hide Triggers
- `handleMouseLeave` (line 2251): `setShowMagnifier(false)`

#### Mobile Triggers (line 2324)
- `handleMapTouchMove`: `setShowMagnifier(true)` when user drags on map

#### Mobile Hide Triggers
- `handleMapTouchEnd` (line 2499): tapping elsewhere while magnifier visible → `dismissMagnifier()`
- `dismissMagnifier()` (line 2471): `setShowMagnifier(false)`

---

## State Machine Coverage Analysis

### Already Tracked by State Machine

| Condition | State Machine Coverage |
|-----------|----------------------|
| `isMobileMapDragging` | ✅ `interaction.isMapPanning` |
| `isDesktopMapDragging` | ✅ `interaction.isDesktopDragging` |
| `shiftPressed` | ❌ Local state (migration pending) |
| `isNearLastDragPosition` | ❌ Ref-based check |
| `targetNeedsMagnification && hasSmallRegion` | ❌ Detection logic |

### Mobile State Machine Already Has:
- `magnifierActive` phase → magnifier is shown
- `magnifierPanning` phase → magnifier visible, panning within it
- `magnifierPinching` phase → magnifier visible, zooming
- `isMagnifierActive` derived property → any of above phases

**Key insight**: On mobile, `isMagnifierActive` from state machine already represents when magnifier should be visible. The state machine transitions:
- `mapPanning → magnifierActive` when drag ends
- `magnifierActive → idle` on `MAGNIFIER_DEACTIVATED`

---

## Migration Approach

### Option A: Full State Machine Integration (Complex)

Make state machine fully authoritative by adding:
1. `MAGNIFIER_SHOW` / `MAGNIFIER_HIDE` events
2. `magnifierVisible: boolean` to desktop state
3. Handle all trigger conditions inside state machine

**Problems**:
- `isNearLastDragPosition` requires ref access (not pure state)
- `targetNeedsMagnification && hasSmallRegion` requires detection results
- State machine would need detection results passed to every event
- Increases state machine complexity significantly

### Option B: Hybrid Approach (Recommended) ✅

**Mobile**: Derive from state machine (already complete!)
```typescript
// Mobile: magnifier visible when in any magnifier-related phase
const showMagnifierMobile = interaction.isMagnifierActive
```

**Desktop**: Keep as derived computed value
```typescript
// Desktop: computed from multiple sources including state machine
const showMagnifierDesktop =
  isShiftPressed ||           // From state machine (after migration)
  isDesktopDragging ||        // Already from state machine
  isNearLastDragPosition ||   // Ref-based
  (targetNeedsMagnification && hasSmallRegion)  // Detection-based
```

**Combined**:
```typescript
const showMagnifier = isMobile
  ? interaction.isMagnifierActive
  : showMagnifierDesktop
```

### Why Option B is Better

1. **Mobile is already fully tracked** - state machine has `magnifierActive/Panning/Pinching` phases
2. **Desktop conditions are diverse** - not all fit cleanly in state machine:
   - `shiftPressed` → CAN migrate (keyboard event)
   - `isDesktopDragging` → Already in state machine
   - `isNearLastDragPosition` → Ref-based, timing-dependent
   - Small region detection → External input to state machine

3. **Eliminates duplicate state on mobile** - remove `useMagnifierState().isVisible` for mobile
4. **Keeps desktop simple** - compute visibility from authoritative sources

---

## Implementation Steps

### Phase 1: Migrate `shiftPressed` to State Machine (Prerequisite)

See separate implementation - adds `SHIFT_KEY_DOWN` / `SHIFT_KEY_UP` events and `isShiftPressed` derived state.

### Phase 2: Mobile Magnifier Visibility from State Machine

1. **Remove `setShowMagnifier(true)` calls in mobile paths**:
   - Line 2324 (`handleMapTouchMove`) - state machine already transitions to `mapPanning → magnifierActive`

2. **Keep `dismissMagnifier()` but dispatch `MAGNIFIER_DEACTIVATED` instead**:
   - State machine handles `magnifierActive → idle` transition
   - `useMagnifierState` can react to state machine changes

3. **Derive visibility on mobile**:
   ```typescript
   const showMagnifierMobile = interaction.isMagnifierActive
   ```

### Phase 3: Desktop Magnifier Visibility Derived

1. **Remove `setShowMagnifier()` calls in desktop paths**:
   - Lines 2224, 2229 - computed instead
   - Line 2251 - handled by state machine (cursor leaves = magnifier hides)

2. **Compute desktop visibility**:
   ```typescript
   const showMagnifierDesktop = useMemo(() => {
     if (interaction.state.mode !== 'desktop') return false
     return (
       interaction.isShiftPressed ||  // After migration
       interaction.isDesktopDragging ||
       lastDragPositionRef.current !== null ||
       (targetNeedsMagnification && hasSmallRegion)
     )
   }, [interaction, targetNeedsMagnification, hasSmallRegion, /* ref trigger */])
   ```

### Phase 4: Eliminate `useMagnifierState().isVisible`

1. **Remove `isVisible` state from `useMagnifierState`**
2. **Remove `show()` / `hide()` methods**
3. **Keep other magnifier state** (isExpanded, opacity, touch refs)
4. **Update all consumers** to use derived visibility

---

## Files to Modify

1. **`useInteractionStateMachine.ts`**
   - Add `shiftKey: boolean` to desktop state
   - Add `SHIFT_KEY_DOWN` / `SHIFT_KEY_UP` events
   - Add `isShiftPressed` derived state

2. **`MapRenderer.tsx`**
   - Remove `shiftPressed` local state
   - Add keyboard event handlers that dispatch to state machine
   - Compute `showMagnifier` as derived value
   - Remove `setShowMagnifier()` calls
   - Update mobile to use `interaction.isMagnifierActive`

3. **`useMagnifierState.ts`**
   - Eventually remove `isVisible`, `show()`, `hide()`
   - Keep `isExpanded`, opacity state, touch refs

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Desktop detection logic timing | Keep in handleMouseMove, compute showMagnifier there |
| Mobile magnifier dismiss timing | State machine transition is synchronous |
| `lastDragPositionRef` timing | Use ref update as trigger for re-render if needed |
| Animation coordination | `targetOpacity` remains separate (animation concern) |

---

## Dependencies

1. **Must complete first**: `shiftPressed` migration to state machine
2. **Can do in parallel**: Mobile visibility from state machine (independent)
3. **Final step**: Remove `isVisible` from `useMagnifierState`

---

## Estimated Line Reduction

- Remove `showMagnifier` state: ~5 lines
- Remove `setShowMagnifier` wrapper: ~6 lines
- Remove `setShowMagnifier()` calls: ~8 lines
- Simplify mobile touch handlers: ~10 lines

**Total**: ~30 lines saved

**Main benefit**: Elimination of duplicate state, clearer data flow, state machine as single source of truth for mobile magnifier visibility.
