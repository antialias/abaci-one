/**
 * Utility functions for working with abacus states and calculations
 * These help convert between numbers and bead positions, calculate diffs, etc.
 */

import type { ValidPlaceValues, BeadHighlight } from './AbacusReact'

/**
 * Represents the state of beads in a single column
 */
export interface BeadState {
  heavenActive: boolean
  earthActive: number // 0-4
}

/**
 * Represents the complete state of an abacus
 * Key is the place value (0 = ones, 1 = tens, etc.)
 */
export interface AbacusState {
  [placeValue: number]: BeadState
}

/**
 * Convert a number to abacus state representation
 * @param value - The number to convert
 * @param maxPlaces - Maximum number of place values to include
 * @returns AbacusState object representing the bead positions
 */
export function numberToAbacusState(value: number | bigint, maxPlaces: number = 5): AbacusState {
  const state: AbacusState = {}
  const valueNum = typeof value === 'bigint' ? Number(value) : value

  for (let place = 0; place < maxPlaces; place++) {
    const placeValueNum = 10 ** place
    const digit = Math.floor(valueNum / placeValueNum) % 10

    state[place] = {
      heavenActive: digit >= 5,
      earthActive: digit >= 5 ? digit - 5 : digit,
    }
  }

  return state
}

/**
 * Convert abacus state to a number
 * @param state - The abacus state to convert
 * @returns The numeric value represented by the abacus
 */
export function abacusStateToNumber(state: AbacusState): number {
  let total = 0

  for (const placeStr in state) {
    const place = parseInt(placeStr, 10)
    const beadState = state[place]
    const digit = (beadState.heavenActive ? 5 : 0) + beadState.earthActive
    total += digit * (10 ** place)
  }

  return total
}

/**
 * Bead highlight with place value (internal type for calculations)
 */
export interface PlaceValueBasedBead {
  placeValue: ValidPlaceValues
  beadType: 'heaven' | 'earth'
  position?: 0 | 1 | 2 | 3
}

/**
 * Calculate which beads need to change between two abacus states
 * @param startState - The starting abacus state
 * @param targetState - The target abacus state
 * @returns Object with arrays of bead additions and removals
 */
export function calculateBeadChanges(
  startState: AbacusState,
  targetState: AbacusState
): {
  additions: PlaceValueBasedBead[]
  removals: PlaceValueBasedBead[]
  placeValue: number
} {
  const additions: PlaceValueBasedBead[] = []
  const removals: PlaceValueBasedBead[] = []
  let mainPlaceValue = 0

  for (const placeStr in targetState) {
    const place = parseInt(placeStr, 10) as ValidPlaceValues
    const start = startState[place] || { heavenActive: false, earthActive: 0 }
    const target = targetState[place]

    // Check heaven bead changes
    if (!start.heavenActive && target.heavenActive) {
      additions.push({ placeValue: place, beadType: 'heaven' })
      mainPlaceValue = place
    } else if (start.heavenActive && !target.heavenActive) {
      removals.push({ placeValue: place, beadType: 'heaven' })
      mainPlaceValue = place
    }

    // Check earth bead changes
    if (target.earthActive > start.earthActive) {
      // Adding earth beads
      for (let pos = start.earthActive; pos < target.earthActive; pos++) {
        additions.push({ placeValue: place, beadType: 'earth', position: pos as 0 | 1 | 2 | 3 })
        mainPlaceValue = place
      }
    } else if (target.earthActive < start.earthActive) {
      // Removing earth beads
      for (let pos = start.earthActive - 1; pos >= target.earthActive; pos--) {
        removals.push({ placeValue: place, beadType: 'earth', position: pos as 0 | 1 | 2 | 3 })
        mainPlaceValue = place
      }
    }
  }

  return { additions, removals, placeValue: mainPlaceValue }
}

/**
 * Result of a bead diff calculation
 */
export interface BeadDiffResult {
  placeValue: ValidPlaceValues
  beadType: 'heaven' | 'earth'
  position?: number
  direction: 'activate' | 'deactivate'
  order: number // Order of operations for animations
}

/**
 * Output of calculateBeadDiff function
 */
export interface BeadDiffOutput {
  changes: BeadDiffResult[]
  highlights: PlaceValueBasedBead[]
  hasChanges: boolean
  summary: string
}

/**
 * Calculate the diff between two abacus states
 * Returns exactly which beads need to move with directions and order
 * @param fromState - Starting state
 * @param toState - Target state
 * @returns BeadDiffOutput with changes, highlights, and summary
 */
export function calculateBeadDiff(fromState: AbacusState, toState: AbacusState): BeadDiffOutput {
  const { additions, removals } = calculateBeadChanges(fromState, toState)

  const changes: BeadDiffResult[] = []
  const highlights: PlaceValueBasedBead[] = []
  let order = 0

  // Process removals first (pedagogical order: clear before adding)
  removals.forEach((removal) => {
    changes.push({
      placeValue: removal.placeValue,
      beadType: removal.beadType,
      position: removal.position,
      direction: 'deactivate',
      order: order++,
    })

    highlights.push({
      placeValue: removal.placeValue,
      beadType: removal.beadType,
      position: removal.position,
    })
  })

  // Process additions second (pedagogical order: add after clearing)
  additions.forEach((addition) => {
    changes.push({
      placeValue: addition.placeValue,
      beadType: addition.beadType,
      position: addition.position,
      direction: 'activate',
      order: order++,
    })

    highlights.push({
      placeValue: addition.placeValue,
      beadType: addition.beadType,
      position: addition.position,
    })
  })

  // Generate summary
  const summary = generateDiffSummary(changes)

  return {
    changes,
    highlights,
    hasChanges: changes.length > 0,
    summary,
  }
}

/**
 * Calculate bead diff from numeric values
 * Convenience function for when you have numbers instead of states
 * @param fromValue - Starting numeric value
 * @param toValue - Target numeric value
 * @param maxPlaces - Maximum number of place values to consider
 * @returns BeadDiffOutput
 */
export function calculateBeadDiffFromValues(
  fromValue: number | bigint,
  toValue: number | bigint,
  maxPlaces: number = 5
): BeadDiffOutput {
  const fromState = numberToAbacusState(fromValue, maxPlaces)
  const toState = numberToAbacusState(toValue, maxPlaces)
  return calculateBeadDiff(fromState, toState)
}

/**
 * Validate that an abacus value is within the supported range
 * @param value - The value to validate
 * @param maxPlaces - Maximum number of place values supported
 * @returns Object with isValid boolean and optional error message
 */
export function validateAbacusValue(
  value: number | bigint,
  maxPlaces: number = 5
): { isValid: boolean; error?: string } {
  const valueNum = typeof value === 'bigint' ? Number(value) : value

  if (valueNum < 0) {
    return { isValid: false, error: 'Negative values are not supported' }
  }

  const maxValue = 10 ** maxPlaces - 1
  if (valueNum > maxValue) {
    return { isValid: false, error: `Value exceeds maximum for ${maxPlaces} columns (max: ${maxValue})` }
  }

  return { isValid: true }
}

/**
 * Check if two abacus states are equal
 * @param state1 - First state
 * @param state2 - Second state
 * @returns true if states are equal
 */
export function areStatesEqual(state1: AbacusState, state2: AbacusState): boolean {
  const places1 = Object.keys(state1)
    .map((k) => parseInt(k, 10))
    .sort()
  const places2 = Object.keys(state2)
    .map((k) => parseInt(k, 10))
    .sort()

  if (places1.length !== places2.length) return false

  for (const place of places1) {
    const bead1 = state1[place]
    const bead2 = state2[place]

    if (!bead2) return false
    if (bead1.heavenActive !== bead2.heavenActive) return false
    if (bead1.earthActive !== bead2.earthActive) return false
  }

  return true
}

// Internal helper functions

function generateDiffSummary(changes: BeadDiffResult[]): string {
  if (changes.length === 0) {
    return 'No changes needed'
  }

  // Sort by order to respect pedagogical sequence
  const sortedChanges = [...changes].sort((a, b) => a.order - b.order)

  const deactivations = sortedChanges.filter((c) => c.direction === 'deactivate')
  const activations = sortedChanges.filter((c) => c.direction === 'activate')

  const parts: string[] = []

  // Process deactivations first (pedagogical order)
  if (deactivations.length > 0) {
    const deactivationsByPlace = groupByPlace(deactivations)
    Object.entries(deactivationsByPlace).forEach(([place, beads]) => {
      const placeName = getPlaceName(parseInt(place, 10))
      const heavenBeads = beads.filter((b) => b.beadType === 'heaven')
      const earthBeads = beads.filter((b) => b.beadType === 'earth')

      if (heavenBeads.length > 0) {
        parts.push(`remove heaven bead in ${placeName}`)
      }
      if (earthBeads.length > 0) {
        const count = earthBeads.length
        parts.push(`remove ${count} earth bead${count > 1 ? 's' : ''} in ${placeName}`)
      }
    })
  }

  // Process activations second (pedagogical order)
  if (activations.length > 0) {
    const activationsByPlace = groupByPlace(activations)
    Object.entries(activationsByPlace).forEach(([place, beads]) => {
      const placeName = getPlaceName(parseInt(place, 10))
      const heavenBeads = beads.filter((b) => b.beadType === 'heaven')
      const earthBeads = beads.filter((b) => b.beadType === 'earth')

      if (heavenBeads.length > 0) {
        parts.push(`add heaven bead in ${placeName}`)
      }
      if (earthBeads.length > 0) {
        const count = earthBeads.length
        parts.push(`add ${count} earth bead${count > 1 ? 's' : ''} in ${placeName}`)
      }
    })
  }

  return parts.join(', then ')
}

function groupByPlace(changes: BeadDiffResult[]): {
  [place: string]: BeadDiffResult[]
} {
  return changes.reduce(
    (groups, change) => {
      const place = change.placeValue.toString()
      if (!groups[place]) {
        groups[place] = []
      }
      groups[place].push(change)
      return groups
    },
    {} as { [place: string]: BeadDiffResult[] }
  )
}

function getPlaceName(place: number): string {
  switch (place) {
    case 0:
      return 'ones column'
    case 1:
      return 'tens column'
    case 2:
      return 'hundreds column'
    case 3:
      return 'thousands column'
    default:
      return `place ${place} column`
  }
}

/**
 * Calculate the natural dimensions of an abacus SVG
 * This uses the same logic as AbacusStatic to ensure consistency
 *
 * @param columns - Number of columns in the abacus
 * @param showNumbers - Whether numbers are shown below columns
 * @param columnLabels - Array of column labels (if any)
 * @returns Object with width and height in pixels (at scale=1)
 */
export function calculateAbacusDimensions({
  columns,
  showNumbers = true,
  columnLabels = [],
}: {
  columns: number
  showNumbers?: boolean
  columnLabels?: string[]
}): { width: number; height: number } {
  // Constants matching AbacusStatic
  const beadSize = 20
  const rodSpacing = 40
  const heavenHeight = 60
  const earthHeight = 120
  const barHeight = 10
  const padding = 20
  const numberHeightCalc = showNumbers ? 30 : 0
  const labelHeight = columnLabels.length > 0 ? 30 : 0

  const width = columns * rodSpacing + padding * 2
  const height = heavenHeight + earthHeight + barHeight + padding * 2 + numberHeightCalc + labelHeight

  return { width, height }
}
