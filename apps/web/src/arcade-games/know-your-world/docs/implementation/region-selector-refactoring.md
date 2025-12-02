# Region Selector Refactoring Proposals

This document outlines potential refactoring opportunities for the DrillDownMapSelector and RangeThermometer components.

## 1. Extract Utility Functions to Separate Module

**Current State:** `sizesToRange` and `rangeToSizes` are defined inline in DrillDownMapSelector.tsx.

**Problem:**
- Functions can't be easily imported for testing
- Duplicated logic if needed elsewhere
- Component file is larger than necessary

**Proposal:** Extract to `apps/web/src/arcade-games/know-your-world/utils/regionSizeUtils.ts`

```typescript
// regionSizeUtils.ts
import type { RegionSize } from '../maps'
import { ALL_REGION_SIZES } from '../maps'

export function sizesToRange(sizes: RegionSize[]): [RegionSize, RegionSize] {
  const sorted = [...sizes].sort(
    (a, b) => ALL_REGION_SIZES.indexOf(a) - ALL_REGION_SIZES.indexOf(b)
  )
  return [sorted[0], sorted[sorted.length - 1]]
}

export function rangeToSizes(min: RegionSize, max: RegionSize): RegionSize[] {
  const minIdx = ALL_REGION_SIZES.indexOf(min)
  const maxIdx = ALL_REGION_SIZES.indexOf(max)
  return ALL_REGION_SIZES.slice(minIdx, maxIdx + 1)
}
```

**Impact:** Low risk, improves testability and reusability.

---

## 2. Create Custom Hook for Region Filtering Logic

**Current State:** Multiple `useMemo` blocks in DrillDownMapSelector calculate excluded regions, preview regions, and region names.

**Problem:**
- Complex memoization dependencies
- Hard to test filtering logic in isolation
- Repeated patterns across different calculations

**Proposal:** Create `useRegionFiltering` hook

```typescript
// hooks/useRegionFiltering.ts
interface UseRegionFilteringProps {
  mapId: 'world' | 'usa'
  continentId: ContinentId | 'all'
  includeSizes: RegionSize[]
  previewSizes?: RegionSize[] | null
}

interface UseRegionFilteringResult {
  includedRegions: string[]
  excludedRegions: string[]
  previewAddRegions: string[]
  previewRemoveRegions: string[]
  regionNamesBySize: Record<RegionSize, string[]>
  selectedRegionNames: string[]
}

export function useRegionFiltering(props: UseRegionFilteringProps): UseRegionFilteringResult {
  // Consolidate all filtering logic here
}
```

**Impact:** Medium complexity, significant improvement to code organization.

---

## 3. Simplify RangeThermometer Props with Compound Pattern

**Current State:** RangeThermometer has 14+ props, many of which are optional and interdependent.

**Problem:**
- Prop drilling complexity
- Unclear which props work together
- Large interface to understand

**Proposal:** Use compound component pattern or grouped prop objects

```typescript
// Option A: Grouped props
interface RangeThermometerProps<T> {
  options: ThermometerOption<T>[]
  range: { min: T; max: T }
  onChange: (min: T, max: T) => void

  // Optional feature groups
  counts?: {
    perOption: Partial<Record<T, number>>
    showTotal?: boolean
    hideOnMd?: boolean
  }

  regionNames?: {
    byCategory: Partial<Record<T, string[]>>
    selected: string[]
    onHover?: (name: string | null) => void
  }

  preview?: {
    onHover: (preview: RangePreviewState<T> | null) => void
  }
}

// Option B: Compound components
<RangeThermometer options={options} range={range} onChange={onChange}>
  <RangeThermometer.Counts perOption={counts} showTotal />
  <RangeThermometer.RegionNames selected={names} onHover={setHover} />
</RangeThermometer>
```

**Impact:** Breaking change, but significantly improves API clarity.

---

## 4. Extract Region List Component

**Current State:** The inline region list in DrillDownMapSelector is defined inline with ~50 lines of JSX.

**Problem:**
- DrillDownMapSelector is 1300+ lines
- Region list styling is tightly coupled
- Can't reuse list in other contexts

**Proposal:** Extract `RegionListPanel` component

```typescript
// components/RegionListPanel.tsx
interface RegionListPanelProps {
  regions: string[]
  onRegionHover?: (name: string | null) => void
  maxHeight?: string
  isDark?: boolean
}

export function RegionListPanel({ regions, onRegionHover, maxHeight = '200px', isDark }: RegionListPanelProps) {
  return (
    <div data-element="region-list-panel" className={css({...})}>
      <div className={css({ overflowY: 'auto', maxHeight })}>
        {regions.sort((a, b) => a.localeCompare(b)).map(name => (
          <RegionListItem
            key={name}
            name={name}
            onHover={onRegionHover}
            isDark={isDark}
          />
        ))}
      </div>
    </div>
  )
}
```

**Impact:** Low risk, improves reusability and reduces component size.

---

## 5. Consolidate Responsive Breakpoint Logic

**Current State:** Multiple places check for responsive behavior with `{ base: '...', md: '...' }` patterns.

**Problem:**
- Breakpoint values scattered across components
- Inconsistent breakpoint choices
- Hard to change responsive behavior globally

**Proposal:** Create responsive utilities

```typescript
// utils/responsive.ts
export const BREAKPOINTS = {
  mobile: 'base',
  tablet: 'sm',
  desktop: 'md',
  wide: 'lg',
} as const

export function responsiveDisplay(showOnDesktop: boolean) {
  return showOnDesktop
    ? { base: 'none', md: 'flex' }
    : { base: 'flex', md: 'none' }
}

export function responsiveScale(mobileScale: number, desktopScale: number) {
  return {
    transform: { base: `scale(${mobileScale})`, sm: `scale(${desktopScale})` },
    transformOrigin: 'top right',
  }
}
```

**Impact:** Low risk, improves consistency and maintainability.

---

## 6. Add TypeScript Discriminated Union for Selection Path

**Current State:** `SelectionPath` is defined as `[] | [ContinentId] | [ContinentId, string]`

**Problem:**
- Hard to exhaustively check path levels
- Type narrowing requires manual length checks
- Semantics not self-documenting

**Proposal:** Use discriminated union

```typescript
type SelectionPath =
  | { level: 'world' }
  | { level: 'continent'; continentId: ContinentId }
  | { level: 'submap'; continentId: ContinentId; submapId: string }

// Usage becomes more explicit
function getMapData(path: SelectionPath) {
  switch (path.level) {
    case 'world':
      return WORLD_MAP
    case 'continent':
      return filterByContinent(path.continentId)
    case 'submap':
      return getSubMap(path.submapId)
  }
}
```

**Impact:** Medium complexity, improves type safety and code clarity.

---

## 7. Memoize Expensive Calculations with React Query or Similar

**Current State:** Multiple `useMemo` hooks recalculate on every render cycle.

**Problem:**
- `getFilteredMapDataBySizesSync` called multiple times with same params
- No caching between component unmount/remount
- Complex dependency arrays

**Proposal:** Use caching layer

```typescript
// Option A: Simple memoization cache
const regionDataCache = new Map<string, MapData>()

function getCachedFilteredMapData(mapId: string, continentId: string, sizes: RegionSize[]) {
  const key = `${mapId}-${continentId}-${sizes.join(',')}`
  if (!regionDataCache.has(key)) {
    regionDataCache.set(key, getFilteredMapDataBySizesSync(mapId, continentId, sizes))
  }
  return regionDataCache.get(key)!
}

// Option B: React Query
const { data: filteredRegions } = useQuery({
  queryKey: ['filtered-regions', mapId, continentId, includeSizes],
  queryFn: () => getFilteredMapDataBySizesSync(mapId, continentId, includeSizes),
  staleTime: Infinity,
})
```

**Impact:** Medium complexity, potential performance improvement.

---

## Priority Recommendations

1. **High Priority (Quick Wins)**
   - Extract utility functions (#1)
   - Extract RegionListPanel component (#4)
   - Consolidate responsive utilities (#5)

2. **Medium Priority (Architectural Improvements)**
   - Create useRegionFiltering hook (#2)
   - Improve SelectionPath types (#6)

3. **Lower Priority (Nice to Have)**
   - Simplify RangeThermometer props (#3) - breaking change
   - Add caching layer (#7) - may be premature optimization

---

## Testing Considerations

After any refactoring:
- Run existing tests: `npm run test:run -- src/components/Thermometer src/arcade-games/know-your-world`
- Add integration tests for extracted components
- Verify responsive behavior manually on mobile/desktop
- Check network sync still works in multiplayer
