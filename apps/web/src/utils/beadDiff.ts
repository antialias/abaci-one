// Dynamic bead diff algorithm for calculating transitions between abacus states
// Provides arrows, highlights, and movement directions for tutorial UI

import type { ValidPlaceValues } from '@soroban/abacus-react'
import {
  type AbacusState,
  type BeadHighlight,
  calculateBeadChanges,
  numberToAbacusState,
} from './abacusInstructionGenerator'

export interface BeadDiffResult {
  placeValue: ValidPlaceValues
  beadType: 'heaven' | 'earth'
  position?: number
  direction: 'activate' | 'deactivate'
  order: number // Order of operations for animations
}

export interface BeadDiffOutput {
  changes: BeadDiffResult[]
  highlights: BeadHighlight[]
  hasChanges: boolean
  summary: string
}

/**
 * THE BEAD DIFF ALGORITHM
 *
 * Takes current and desired abacus states and returns exactly which beads
 * need to move with arrows and highlights for the tutorial UI.
 *
 * This is the core "diff" function that keeps tutorial highlights in sync.
 */
export function calculateBeadDiff(fromState: AbacusState, toState: AbacusState): BeadDiffOutput {
  const { additions, removals } = calculateBeadChanges(fromState, toState)

  const changes: BeadDiffResult[] = []
  const highlights: BeadHighlight[] = []
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
 */
export function calculateBeadDiffFromValues(
  fromValue: number,
  toValue: number,
  maxPlaces: number = 5
): BeadDiffOutput {
  const fromState = numberToAbacusState(fromValue, maxPlaces)
  const toState = numberToAbacusState(toValue, maxPlaces)
  return calculateBeadDiff(fromState, toState)
}

/**
 * Calculate step-by-step bead diffs for multi-step operations
 * This is used for tutorial multi-step instructions where we want to show
 * the progression through intermediate states
 */
export function calculateMultiStepBeadDiffs(
  startValue: number,
  steps: Array<{ expectedValue: number; instruction: string }>
): Array<{
  stepIndex: number
  instruction: string
  diff: BeadDiffOutput
  fromValue: number
  toValue: number
}> {
  const stepDiffs = []
  let currentValue = startValue

  steps.forEach((step, index) => {
    const diff = calculateBeadDiffFromValues(currentValue, step.expectedValue)

    stepDiffs.push({
      stepIndex: index,
      instruction: step.instruction,
      diff,
      fromValue: currentValue,
      toValue: step.expectedValue,
    })

    currentValue = step.expectedValue
  })

  return stepDiffs
}

/**
 * Generate a human-readable summary of what the diff does
 * Respects pedagogical order: removals first, then additions
 */
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

/**
 * Group bead changes by place value
 */
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

/**
 * Get human-readable place name
 */
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
 * Check if two abacus states are equal
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

/**
 * Validate that a bead diff is feasible (no impossible bead states)
 */
export function validateBeadDiff(diff: BeadDiffOutput): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Check for impossible earth bead counts
  const earthChanges = diff.changes.filter((c) => c.beadType === 'earth')
  const earthByPlace = groupByPlace(earthChanges)

  Object.entries(earthByPlace).forEach(([place, changes]) => {
    const activations = changes.filter((c) => c.direction === 'activate').length
    const deactivations = changes.filter((c) => c.direction === 'deactivate').length
    const netChange = activations - deactivations

    if (netChange > 4) {
      errors.push(`Place ${place}: Cannot have more than 4 earth beads`)
    }
    if (netChange < 0) {
      errors.push(`Place ${place}: Cannot have negative earth beads`)
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
  }
}
