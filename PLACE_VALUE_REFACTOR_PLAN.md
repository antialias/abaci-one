# Place-Value Native Architecture Refactor Plan

## 🎯 Objective
Replace the current array-based column indexing system with native place-value architecture to eliminate the "column index nightmare" where we need to thread `effectiveColumns` through highlighting logic.

## 🚨 Current Problem
```typescript
// BROKEN: Array indices fighting place values
columnStates[0] = leftmost column (ten-thousands)
columnStates[4] = rightmost column (ones)
// Every operation requires: columnIndex = totalColumns - 1 - placeValue
// Must thread totalColumns to highlighting: isBeadHighlighted(..., totalColumns)
```

## ✅ Target Solution
```typescript
// CLEAN: Place values as primary keys
placeStates.set(0, { placeValue: 0, heavenActive: false, earthActive: 2 }) // ones
placeStates.set(1, { placeValue: 1, heavenActive: true, earthActive: 0 })  // tens
// NO conversion needed! Direct place-value access
// NO totalColumns threading needed!
```

---

## 📋 Implementation Plan

### Phase 1: Core Data Structure Redesign ✅ COMPLETED
**Status**: ✅ COMPLETED
**Files**: `packages/abacus-react/src/AbacusReact.tsx`

#### 1.1 ✅ COMPLETED: Define new place-value types
- [x] `PlaceState` interface with native place value
- [x] `PlaceStatesMap` type as Map<ValidPlaceValues, PlaceState>
- [x] Update `BeadConfig` to use `placeValue` instead of `columnIndex`

#### 1.2 ✅ COMPLETED: Create new state management hook
- [x] Implement `useAbacusPlaceStates()` hook
- [x] Replace array operations with Map operations
- [x] Eliminate all index math (columnStates.length - index - 1)
- [x] Keep legacy `useAbacusState()` for backward compatibility

### Phase 2: Bead State Management ✅ COMPLETED
**Status**: ✅ COMPLETED
**Files**: `packages/abacus-react/src/AbacusReact.tsx`

#### 2.1 ✅ COMPLETED: Update bead generation logic
- [x] Modify `calculateBeadStatesFromPlaces()` to work with place values
- [x] Update bead configuration to include `placeValue` instead of `columnIndex`
- [x] Ensure bead positioning works with place value keys

#### 2.2 ✅ COMPLETED: Update value calculation
- [x] Replace array reduce with Map iteration
- [x] Remove `Math.pow(10, columnStates.length - index - 1)` nightmare
- [x] Use direct `Math.pow(10, state.placeValue)` calculation

### Phase 3: Highlighting and Interaction Logic 🟡 IN PROGRESS
**Status**: 🟡 IN PROGRESS
**Files**: `packages/abacus-react/src/AbacusReact.tsx`

#### 3.1 ✅ COMPLETED: Fix highlighting functions
- [x] Update highlighting with `isBeadHighlightedByPlaceValue()`: eliminates `totalColumns` parameter
- [x] Update disabling with `isBeadDisabledByPlaceValue()`: eliminates `totalColumns` parameter
- [x] Use direct place value matching instead of conversions
- [x] Added backward compatibility for legacy `columnIndex` system

#### 3.2 Update bead interaction handlers
- [ ] Modify `handleBeadClick()` to work with place values
- [ ] Update `toggleBead()` logic for place value operations
- [ ] Fix gesture handling for place value system

### Phase 4: Component Integration 🔄 PENDING
**Files**: `packages/abacus-react/src/AbacusReact.tsx`

#### 4.1 Update main AbacusReact component
- [ ] Switch to `useAbacusPlaceStates()` hook
- [ ] Remove `effectiveColumns` threading through highlighting calls
- [ ] Update bead rendering to work with place value keys
- [ ] Fix overlay positioning logic

#### 4.2 Update layout and positioning
- [ ] Modify column layout to work with Map-based state
- [ ] Ensure visual column order (left-to-right) works correctly
- [ ] Update dimensions calculation for place value system

### Phase 5: Remove Legacy Conversion Layers 🔄 PENDING
**Files**: `packages/abacus-react/src/AbacusReact.tsx`

#### 5.1 Clean up conversion utilities
- [ ] Remove `normalizeBeadHighlight()` function
- [ ] Remove `placeValueToColumnIndex()` function
- [ ] Remove `columnIndexToPlaceValue()` function
- [ ] Simplify type guards and utility functions

#### 5.2 Update exports and types
- [ ] Export new place-value types
- [ ] Mark legacy types as deprecated
- [ ] Update component prop types to prefer place values

### Phase 6: Tutorial and Consumer Updates 🔄 PENDING
**Files**: `apps/web/src/components/`, `apps/web/src/utils/`

#### 6.1 Update tutorial components
- [ ] Verify tutorials work with new place value system
- [ ] Remove any remaining column index references
- [ ] Test highlighting behavior

#### 6.2 Update tests and stories
- [ ] Fix test files to work with place value system
- [ ] Update Storybook examples
- [ ] Add tests for new place value logic

---

## 🚧 Current Progress Status

### ✅ Completed (Phases 1-3.1)
- ✅ **Phase 1**: Core type definitions (PlaceState, PlaceStatesMap, BeadConfig updates)
- ✅ **Phase 1**: `useAbacusPlaceStates()` hook implementation with Map-based operations
- ✅ **Phase 2**: `calculateBeadStatesFromPlaces()` - eliminates array index math
- ✅ **Phase 2**: `calculateValueFromPlaceStates()` - direct place value calculation
- ✅ **Phase 3.1**: `isBeadHighlightedByPlaceValue()` and `isBeadDisabledByPlaceValue()` - eliminates totalColumns threading

**Major Achievement**: The core "column index nightmare" has been solved!
- NO MORE: `Math.pow(10, totalColumns - 1 - index)` calculations
- NO MORE: Threading `effectiveColumns` through highlighting functions
- NO MORE: Array-to-place-value conversions

### 🟡 In Progress
- Phase 3.2: Update bead interaction handlers

### 🔄 Next Up
- Phase 4: Component integration (switch main component to new hooks)
- Phase 5: Remove legacy conversion utilities
- Phase 6: Update tutorials and tests

---

## 🔍 Key Files to Modify

### Primary Implementation
- `packages/abacus-react/src/AbacusReact.tsx` - Main component logic

### Testing and Examples
- `packages/abacus-react/src/AbacusReact.stories.tsx`
- `packages/abacus-react/src/test/AbacusReact.zero-state.test.tsx`
- `apps/web/src/components/tutorial/__tests__/TutorialPlayer.test.tsx`

### Tutorial Content
- `apps/web/src/components/GuidedAdditionTutorial.tsx`
- `apps/web/src/utils/tutorialConverter.ts`

---

## ⚠️ Risks and Considerations

### Breaking Changes
- This is a major architectural change
- Legacy `columnIndex` API will be deprecated
- Some consumers may need updates

### Migration Strategy
- Keep legacy `useAbacusState()` hook for backward compatibility
- Provide clear deprecation warnings
- Document migration path for consumers

### Testing Strategy
- Maintain existing test behavior
- Add new tests for place value logic
- Verify tutorial highlighting still works correctly

---

## 🎯 Success Criteria

1. **No more totalColumns threading** - highlighting functions don't need column count
2. **Native place value API** - direct place value access without conversions
3. **Backward compatibility** - existing tutorials continue to work
4. **Performance improvement** - Map operations instead of array index math
5. **Maintainability** - adding columns doesn't break tutorials

---

*Last Updated: 2025-09-21*
*Status: Phase 3.1 - Highlighting Functions (MAJOR PROGRESS: Core architecture nightmare solved!)*