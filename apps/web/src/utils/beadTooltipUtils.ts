/**
 * Bead Tooltip Utilities
 *
 * Extracted from TutorialPlayer for reuse in practice help overlay.
 * Handles smart tooltip positioning to avoid covering active beads.
 */

import type { StepBeadHighlight } from '@soroban/abacus-react'

/**
 * Target specification for tooltip overlay
 */
export interface TooltipTarget {
  type: 'bead'
  columnIndex: number
  beadType: 'heaven' | 'earth'
  beadPosition: number | undefined
}

/**
 * Result of tooltip positioning calculation
 */
export interface TooltipPositioning {
  /** Which side to show tooltip on */
  side: 'top' | 'left'
  /** Target bead for the tooltip */
  target: TooltipTarget
  /** The topmost bead that was selected */
  topmostBead: StepBeadHighlight
  /** Column index of the target */
  targetColumnIndex: number
}

/**
 * Find the topmost bead with arrows in a step
 *
 * Priority order:
 * 1. Higher place value (leftmost columns = more significant)
 * 2. Heaven beads before earth beads
 * 3. Lower position number for earth beads (higher on abacus)
 *
 * @param stepBeadHighlights - Array of bead highlights for the current step
 * @returns The topmost bead, or null if none have arrows
 */
export function findTopmostBeadWithArrows(
  stepBeadHighlights: StepBeadHighlight[] | undefined
): StepBeadHighlight | null {
  if (!stepBeadHighlights || stepBeadHighlights.length === 0) return null

  // Filter only beads that have direction arrows
  const beadsWithArrows = stepBeadHighlights.filter(
    (bead) => !!bead.direction
  )

  if (beadsWithArrows.length === 0) {
    return null
  }

  // Sort by priority
  const sortedBeads = [...beadsWithArrows].sort((a, b) => {
    // First sort by place value (higher place value = more significant = topmost priority)
    if (a.placeValue !== b.placeValue) {
      return b.placeValue - a.placeValue
    }

    // If same place value, heaven beads come before earth beads
    if (a.beadType !== b.beadType) {
      return a.beadType === 'heaven' ? -1 : 1
    }

    // If both earth beads in same column, lower position number = higher on abacus
    if (a.beadType === 'earth' && b.beadType === 'earth') {
      return (a.position || 0) - (b.position || 0)
    }

    return 0
  })

  return sortedBeads[0] || null
}

/**
 * Check if there are active beads to the left of a target column
 *
 * Active beads are:
 * - Beads against the reckoning bar (based on current value)
 * - Beads with direction arrows in the current step
 *
 * @param currentValue - Current abacus value
 * @param stepBeadHighlights - Bead highlights for current step
 * @param abacusColumns - Number of columns on the abacus
 * @param targetColumnIndex - Column index to check left of
 * @returns True if there are active beads to the left
 */
export function hasActiveBeadsToLeft(
  currentValue: number,
  stepBeadHighlights: StepBeadHighlight[] | undefined,
  abacusColumns: number,
  targetColumnIndex: number
): boolean {
  // Get current abacus state - check which beads are against the reckoning bar
  const abacusDigits = currentValue.toString().padStart(abacusColumns, '0').split('').map(Number)

  for (let col = 0; col < targetColumnIndex; col++) {
    const digitValue = abacusDigits[col]

    // Check if any beads are active (against reckoning bar) in this column
    if (digitValue >= 5) {
      // Heaven bead is active
      return true
    }
    if (digitValue % 5 > 0) {
      // Earth beads are active
      return true
    }

    // Also check if this column has beads with direction arrows
    const hasArrowsInColumn =
      stepBeadHighlights?.some((bead) => {
        const beadColumnIndex = abacusColumns - 1 - bead.placeValue
        return beadColumnIndex === col && !!bead.direction
      }) ?? false

    if (hasArrowsInColumn) {
      return true
    }
  }

  return false
}

/**
 * Calculate smart tooltip positioning
 *
 * Determines which side to show the tooltip on and which bead to target,
 * avoiding covering active beads.
 *
 * @param currentValue - Current abacus value
 * @param stepBeadHighlights - Bead highlights for current step
 * @param abacusColumns - Number of columns on the abacus
 * @returns Positioning info, or null if no beads with arrows
 */
export function calculateTooltipPositioning(
  currentValue: number,
  stepBeadHighlights: StepBeadHighlight[] | undefined,
  abacusColumns: number
): TooltipPositioning | null {
  const topmostBead = findTopmostBeadWithArrows(stepBeadHighlights)
  if (!topmostBead) return null

  // Convert placeValue to columnIndex
  const targetColumnIndex = abacusColumns - 1 - topmostBead.placeValue

  // Check if there are active beads to the left
  const activeToLeft = hasActiveBeadsToLeft(
    currentValue,
    stepBeadHighlights,
    abacusColumns,
    targetColumnIndex
  )

  // Determine tooltip position and target
  const shouldPositionAbove = activeToLeft
  const side = shouldPositionAbove ? 'top' : 'left'

  const target: TooltipTarget = shouldPositionAbove
    ? {
        // Target the heaven bead position for the column
        type: 'bead',
        columnIndex: targetColumnIndex,
        beadType: 'heaven',
        beadPosition: 0, // Heaven beads are always at position 0
      }
    : {
        // Target the actual bead
        type: 'bead',
        columnIndex: targetColumnIndex,
        beadType: topmostBead.beadType,
        beadPosition: topmostBead.position,
      }

  return {
    side,
    target,
    topmostBead,
    targetColumnIndex,
  }
}
