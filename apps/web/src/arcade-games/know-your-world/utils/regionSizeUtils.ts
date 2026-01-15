/**
 * Utility functions for converting between region filter arrays and min/max ranges.
 * Used by the DrillDownMapSelector's RangeThermometer component.
 * Supports size, importance, and population filter criteria.
 */

import type { RegionSize, ImportanceLevel, PopulationLevel, FilterCriteria } from '../maps'
import { ALL_REGION_SIZES, ALL_IMPORTANCE_LEVELS, ALL_POPULATION_LEVELS } from '../maps'

/**
 * Generic type for all filter level types
 */
export type FilterLevel = RegionSize | ImportanceLevel | PopulationLevel

/**
 * Get the appropriate "ALL_*_LEVELS" array for a given filter criteria
 */
export function getAllLevelsForCriteria<T extends FilterLevel>(criteria: FilterCriteria): T[] {
  switch (criteria) {
    case 'size':
      return ALL_REGION_SIZES as T[]
    case 'importance':
      return ALL_IMPORTANCE_LEVELS as T[]
    case 'population':
      return ALL_POPULATION_LEVELS as T[]
    default:
      return ALL_REGION_SIZES as T[]
  }
}

/**
 * Convert an array of sizes to min/max values for the range thermometer.
 * Sorts the sizes by their position in ALL_REGION_SIZES and returns the first and last.
 *
 * @example
 * sizesToRange(['medium', 'small', 'large']) // returns ['large', 'small']
 * sizesToRange(['medium']) // returns ['medium', 'medium']
 */
export function sizesToRange(sizes: RegionSize[]): [RegionSize, RegionSize] {
  const sorted = [...sizes].sort(
    (a, b) => ALL_REGION_SIZES.indexOf(a) - ALL_REGION_SIZES.indexOf(b)
  )
  return [sorted[0], sorted[sorted.length - 1]]
}

/**
 * Convert min/max range values back to an array of sizes.
 * Returns all sizes between min and max (inclusive) in ALL_REGION_SIZES order.
 *
 * @example
 * rangeToSizes('large', 'small') // returns ['large', 'medium', 'small']
 * rangeToSizes('medium', 'medium') // returns ['medium']
 */
export function rangeToSizes(min: RegionSize, max: RegionSize): RegionSize[] {
  const minIdx = ALL_REGION_SIZES.indexOf(min)
  const maxIdx = ALL_REGION_SIZES.indexOf(max)
  return ALL_REGION_SIZES.slice(minIdx, maxIdx + 1)
}

/**
 * Calculate which regions are excluded based on the current size filter.
 * Returns IDs of regions that exist but are filtered out.
 */
export function calculateExcludedRegions(
  allRegionIds: string[],
  filteredRegionIds: string[]
): string[] {
  const filteredSet = new Set(filteredRegionIds)
  return allRegionIds.filter((id) => !filteredSet.has(id))
}

/**
 * Calculate preview changes when hovering over a different size range.
 * Returns which regions would be added or removed if the user clicked.
 */
export function calculatePreviewChanges(
  currentIncludedIds: string[],
  previewIncludedIds: string[]
): { addRegions: string[]; removeRegions: string[] } {
  const currentSet = new Set(currentIncludedIds)
  const previewSet = new Set(previewIncludedIds)

  const addRegions: string[] = []
  const removeRegions: string[] = []

  for (const id of previewSet) {
    if (!currentSet.has(id)) {
      addRegions.push(id)
    }
  }

  for (const id of currentSet) {
    if (!previewSet.has(id)) {
      removeRegions.push(id)
    }
  }

  return { addRegions, removeRegions }
}

/**
 * Generic: Convert an array of levels to min/max values for the range thermometer.
 * Works with any filter criteria (size, importance, population).
 */
export function levelsToRange<T extends FilterLevel>(levels: T[], allLevels: T[]): [T, T] {
  const sorted = [...levels].sort((a, b) => allLevels.indexOf(a) - allLevels.indexOf(b))
  return [sorted[0], sorted[sorted.length - 1]]
}

/**
 * Generic: Convert min/max range values back to an array of levels.
 * Works with any filter criteria (size, importance, population).
 */
export function rangeToLevels<T extends FilterLevel>(min: T, max: T, allLevels: T[]): T[] {
  const minIdx = allLevels.indexOf(min)
  const maxIdx = allLevels.indexOf(max)
  return allLevels.slice(minIdx, maxIdx + 1)
}

/**
 * Importance-specific: Convert array to range
 */
export function importanceToRange(levels: ImportanceLevel[]): [ImportanceLevel, ImportanceLevel] {
  return levelsToRange(levels, ALL_IMPORTANCE_LEVELS)
}

/**
 * Importance-specific: Convert range to array
 */
export function rangeToImportance(min: ImportanceLevel, max: ImportanceLevel): ImportanceLevel[] {
  return rangeToLevels(min, max, ALL_IMPORTANCE_LEVELS)
}

/**
 * Population-specific: Convert array to range
 */
export function populationToRange(levels: PopulationLevel[]): [PopulationLevel, PopulationLevel] {
  return levelsToRange(levels, ALL_POPULATION_LEVELS)
}

/**
 * Population-specific: Convert range to array
 */
export function rangeToPopulation(min: PopulationLevel, max: PopulationLevel): PopulationLevel[] {
  return rangeToLevels(min, max, ALL_POPULATION_LEVELS)
}
