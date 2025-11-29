# Testing Plan for Know-Your-World Utilities

## Study Results

### screenPixelRatio.ts

**Purpose:** Calculate how many screen pixels the magnifier jumps when mouse moves 1px on main map.

**Key Functions:**

1. `calculateScreenPixelRatio(context)` - Core calculation, returns number
   - Formula: `(viewBoxWidth/svgWidth) * (magnifierWidth / (viewBoxWidth/zoom))`
   - Simplifies to: `zoom * (magnifierWidth / svgWidth)`

2. `isAboveThreshold(ratio, threshold)` - Returns `ratio >= threshold` (includes equality)

3. `calculateMaxZoomAtThreshold(threshold, magnifierWidth, svgWidth)`
   - Formula: `threshold / (magnifierWidth / svgWidth)`
   - Or: `threshold * svgWidth / magnifierWidth`

4. `createZoomContext(container, svg, viewBoxWidth, zoom)` - Helper to build context
   - Returns null if elements missing
   - Magnifier width is always `container.width * 0.5`

### zoomCapping.ts

**Purpose:** Cap zoom at threshold when not in pointer lock mode.

**Key Functions:**

1. `capZoomAtThreshold(context)` - Returns `{cappedZoom, wasCapped, originalZoom, screenPixelRatio}`
   - If `pointerLocked`: returns zoom uncapped, `wasCapped: false`
   - If ratio below threshold: returns zoom uncapped, `wasCapped: false`
   - If ratio at/above threshold: caps to `calculateMaxZoomAtThreshold()`, `wasCapped: true`

2. `wouldZoomBeCapped(context)` - Simpler boolean check
   - If `pointerLocked`: returns false
   - Otherwise: returns `isAboveThreshold(calculated ratio, threshold)`

### adaptiveZoomSearch.ts

**Pure Functions (Easily Testable):**

1. `calculateAdaptiveThresholds(size)` - Returns `{min, max}` based on size brackets
2. `clampViewportToMapBounds(viewport, mapBounds)` - Returns clamped viewport + `wasClamped` flag
3. `isRegionInViewport(regionBounds, viewport)` - Returns boolean for AABB intersection

**Complex Function (Needs DOM Mocking):**

- `findOptimalZoom(context)` - Hard to test, needs full DOM setup

## Testing Strategy

### Priority 1: Pure Math Functions (High Value, Easy to Test)

**screenPixelRatio.ts:**

- Test `calculateScreenPixelRatio()` with known inputs/outputs
- Verify simplified formula: `zoom * (magnifierWidth / svgWidth)`
- Test `isAboveThreshold()` includes equality (>= not >)
- Test `calculateMaxZoomAtThreshold()` produces correct max zoom
- Verify inverse relationship: max zoom → threshold ratio

**adaptiveZoomSearch.ts helpers:**

- Test `calculateAdaptiveThresholds()` for all three size brackets
- Test `clampViewportToMapBounds()` for all edge cases
- Test `isRegionInViewport()` for overlap/non-overlap cases

**zoomCapping.ts:**

- Test `capZoomAtThreshold()` with various scenarios
- Test `wouldZoomBeCapped()` matches capZoomAtThreshold logic

### Priority 2: Integration Tests (Important Invariants)

**Invariants to verify:**

1. If zoom produces threshold ratio, it should equal `calculateMaxZoomAtThreshold()`
2. `capZoomAtThreshold()` never returns zoom > max zoom
3. `wouldZoomBeCapped()` matches `capZoomAtThreshold().wasCapped`
4. Clamped viewport always stays within map bounds
5. `isRegionInViewport()` is commutative for overlapping regions

### Priority 3: Skip Complex DOM-Heavy Tests

**Skip for now:**

- `findOptimalZoom()` - Requires extensive DOM mocking, tested manually
- `createZoomContext()` - Simple helper, visually verify in browser

## Test Writing Approach

1. **Start with simplest functions first**
   - `isAboveThreshold` (1 line)
   - `calculateAdaptiveThresholds` (simple conditionals)
   - `isRegionInViewport` (pure AABB logic)

2. **Move to math functions with known results**
   - `calculateScreenPixelRatio` - verify formula
   - `calculateMaxZoomAtThreshold` - verify inverse relationship
   - `clampViewportToMapBounds` - verify all clamping directions

3. **Test integration invariants**
   - Verify max zoom produces threshold ratio
   - Verify capping never exceeds max
   - Verify boolean helpers match full functions

4. **Run tests after each function**
   - Write test → Run → Fix → Verify pass
   - Don't write all tests at once

## Expected Test Count

- screenPixelRatio.ts: ~10 tests
- zoomCapping.ts: ~8 tests
- adaptiveZoomSearch.ts helpers: ~12 tests
- Integration tests: ~5 tests

**Total: ~35 focused tests, all passing**

## Success Criteria

✅ All tests pass
✅ Tests verify actual behavior (not assumptions)
✅ Tests catch real regressions (changing formulas breaks tests)
✅ Tests are readable and maintainable
✅ Tests run fast (< 100ms total)
