import { describe, it, expect } from 'vitest'
import {
  sizesToRange,
  rangeToSizes,
  calculateExcludedRegions,
  calculatePreviewChanges,
} from '../../utils/regionSizeUtils'
import type { RegionSize } from '../../maps'

describe('DrillDownMapSelector utility functions', () => {
  describe('sizesToRange', () => {
    it('converts a full range of sizes', () => {
      const sizes: RegionSize[] = ['huge', 'large', 'medium', 'small', 'tiny']
      const result = sizesToRange(sizes)
      expect(result).toEqual(['huge', 'tiny'])
    })

    it('converts a partial range', () => {
      const sizes: RegionSize[] = ['large', 'medium', 'small']
      const result = sizesToRange(sizes)
      expect(result).toEqual(['large', 'small'])
    })

    it('handles single size', () => {
      const sizes: RegionSize[] = ['medium']
      const result = sizesToRange(sizes)
      expect(result).toEqual(['medium', 'medium'])
    })

    it('handles unordered input', () => {
      const sizes: RegionSize[] = ['small', 'huge', 'medium']
      const result = sizesToRange(sizes)
      expect(result).toEqual(['huge', 'small'])
    })

    it('handles just two sizes', () => {
      const sizes: RegionSize[] = ['large', 'tiny']
      const result = sizesToRange(sizes)
      expect(result).toEqual(['large', 'tiny'])
    })

    it('handles adjacent sizes', () => {
      const sizes: RegionSize[] = ['medium', 'small']
      const result = sizesToRange(sizes)
      expect(result).toEqual(['medium', 'small'])
    })
  })

  describe('rangeToSizes', () => {
    it('converts full range back to array', () => {
      const result = rangeToSizes('huge', 'tiny')
      expect(result).toEqual(['huge', 'large', 'medium', 'small', 'tiny'])
    })

    it('converts partial range', () => {
      const result = rangeToSizes('large', 'small')
      expect(result).toEqual(['large', 'medium', 'small'])
    })

    it('handles same min and max', () => {
      const result = rangeToSizes('medium', 'medium')
      expect(result).toEqual(['medium'])
    })

    it('handles adjacent sizes', () => {
      const result = rangeToSizes('large', 'medium')
      expect(result).toEqual(['large', 'medium'])
    })

    it('handles first two sizes', () => {
      const result = rangeToSizes('huge', 'large')
      expect(result).toEqual(['huge', 'large'])
    })

    it('handles last two sizes', () => {
      const result = rangeToSizes('small', 'tiny')
      expect(result).toEqual(['small', 'tiny'])
    })
  })

  describe('sizesToRange and rangeToSizes roundtrip', () => {
    it('roundtrips correctly for full range', () => {
      const original: RegionSize[] = ['huge', 'large', 'medium', 'small', 'tiny']
      const [min, max] = sizesToRange(original)
      const result = rangeToSizes(min, max)
      expect(result).toEqual(original)
    })

    it('roundtrips correctly for partial range', () => {
      const original: RegionSize[] = ['large', 'medium', 'small']
      const [min, max] = sizesToRange(original)
      const result = rangeToSizes(min, max)
      expect(result).toEqual(original)
    })

    it('roundtrips correctly for single element', () => {
      const original: RegionSize[] = ['medium']
      const [min, max] = sizesToRange(original)
      const result = rangeToSizes(min, max)
      expect(result).toEqual(original)
    })

    it('roundtrips correctly for two elements', () => {
      const original: RegionSize[] = ['huge', 'large']
      const [min, max] = sizesToRange(original)
      const result = rangeToSizes(min, max)
      expect(result).toEqual(original)
    })
  })

  describe('edge cases', () => {
    it('sizesToRange maintains order consistency', () => {
      // Test that sorting is stable and consistent
      const test1 = sizesToRange(['tiny', 'huge'])
      const test2 = sizesToRange(['huge', 'tiny'])
      expect(test1).toEqual(test2)
    })

    it('rangeToSizes includes all intermediate values', () => {
      const result = rangeToSizes('huge', 'tiny')
      expect(result).toContain('huge')
      expect(result).toContain('large')
      expect(result).toContain('medium')
      expect(result).toContain('small')
      expect(result).toContain('tiny')
      expect(result.length).toBe(5)
    })
  })
})

describe('SelectionPath type behavior', () => {
  type SelectionPath = [] | [string] | [string, string]

  describe('path length semantics', () => {
    it('empty path represents world level', () => {
      const path: SelectionPath = []
      expect(path.length).toBe(0)
    })

    it('single element path represents continent level', () => {
      const path: SelectionPath = ['europe']
      expect(path.length).toBe(1)
      expect(path[0]).toBe('europe')
    })

    it('two element path represents sub-map level', () => {
      const path: SelectionPath = ['north-america', 'us']
      expect(path.length).toBe(2)
      expect(path[0]).toBe('north-america')
      expect(path[1]).toBe('us')
    })
  })

  describe('path navigation', () => {
    it('can navigate up from sub-map to continent', () => {
      const path: SelectionPath = ['north-america', 'us']
      const parentPath: SelectionPath = [path[0]]
      expect(parentPath).toEqual(['north-america'])
    })

    it('can navigate up from continent to world', () => {
      const path: SelectionPath = ['europe']
      const parentPath: SelectionPath = []
      expect(parentPath).toEqual([])
    })

    it('can navigate down from world to continent', () => {
      const parentPath: SelectionPath = []
      const childPath: SelectionPath = ['asia']
      expect(childPath.length).toBe(parentPath.length + 1)
    })

    it('can navigate down from continent to sub-map', () => {
      const parentPath: SelectionPath = ['north-america']
      const childPath: SelectionPath = ['north-america', 'us']
      expect(childPath.length).toBe(parentPath.length + 1)
      expect(childPath[0]).toBe(parentPath[0])
    })
  })
})

describe('Region filtering logic', () => {
  // Test the excluded regions calculation logic
  describe('excluded regions calculation', () => {
    const allRegionIds = ['region-1', 'region-2', 'region-3', 'region-4', 'region-5']

    it('returns empty when all regions are included', () => {
      const filtered = ['region-1', 'region-2', 'region-3', 'region-4', 'region-5']
      const excluded = calculateExcludedRegions(allRegionIds, filtered)
      expect(excluded).toEqual([])
    })

    it('returns correct excluded regions', () => {
      const filtered = ['region-1', 'region-3', 'region-5']
      const excluded = calculateExcludedRegions(allRegionIds, filtered)
      expect(excluded).toEqual(['region-2', 'region-4'])
    })

    it('returns all when none are filtered', () => {
      const filtered: string[] = []
      const excluded = calculateExcludedRegions(allRegionIds, filtered)
      expect(excluded).toEqual(allRegionIds)
    })

    it('handles single region filtered', () => {
      const filtered = ['region-3']
      const excluded = calculateExcludedRegions(allRegionIds, filtered)
      expect(excluded).toEqual(['region-1', 'region-2', 'region-4', 'region-5'])
    })
  })
})

describe('Preview add/remove regions calculation', () => {
  it('detects regions to be added', () => {
    const current = ['a', 'b']
    const preview = ['a', 'b', 'c', 'd']
    const { addRegions, removeRegions } = calculatePreviewChanges(current, preview)

    expect(addRegions).toEqual(['c', 'd'])
    expect(removeRegions).toEqual([])
  })

  it('detects regions to be removed', () => {
    const current = ['a', 'b', 'c', 'd']
    const preview = ['a', 'b']
    const { addRegions, removeRegions } = calculatePreviewChanges(current, preview)

    expect(addRegions).toEqual([])
    expect(removeRegions).toEqual(['c', 'd'])
  })

  it('detects both adds and removes', () => {
    const current = ['a', 'b', 'c']
    const preview = ['b', 'c', 'd', 'e']
    const { addRegions, removeRegions } = calculatePreviewChanges(current, preview)

    expect(addRegions).toEqual(['d', 'e'])
    expect(removeRegions).toEqual(['a'])
  })

  it('handles no changes', () => {
    const current = ['a', 'b', 'c']
    const preview = ['a', 'b', 'c']
    const { addRegions, removeRegions } = calculatePreviewChanges(current, preview)

    expect(addRegions).toEqual([])
    expect(removeRegions).toEqual([])
  })

  it('handles complete replacement', () => {
    const current = ['a', 'b']
    const preview = ['c', 'd']
    const { addRegions, removeRegions } = calculatePreviewChanges(current, preview)

    expect(addRegions).toEqual(['c', 'd'])
    expect(removeRegions).toEqual(['a', 'b'])
  })
})
