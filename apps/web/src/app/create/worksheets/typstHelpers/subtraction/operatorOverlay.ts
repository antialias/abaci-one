// Operator overlay for subtraction problems
// Rendered last to ensure proper layering over all other elements

import type { CellDimensions } from '../shared/types'

/**
 * Generate Typst code for the operator overlay
 *
 * The operator (− sign) is rendered using place() to overlay it on top of
 * all other problem elements, ensuring proper layering regardless of
 * borrow boxes, scratch work, or other decorations.
 *
 * @param cellDimensions - Cell sizing information
 * @returns Typst code for operator overlay using place()
 */
export function generateOperatorOverlay(cellDimensions: CellDimensions): string {
  const { cellSizeIn, cellSizePt } = cellDimensions

  // The operator should be positioned at the subtrahend row level
  // Borrow boxes row height + minuend row height = 2 * cellSize from top
  // We position relative to the grid, so we need to account for:
  // - Row 0: borrow boxes (height: cellSize)
  // - Row 1: minuend row (height: cellSize)
  // - Row 2: subtrahend row (where operator should appear)

  return String.raw`
    // Operator overlay - rendered last for proper layering
    // Position: left edge, at subtrahend row vertical position
    #place(
      left + top,
      dx: 0pt,
      dy: ${cellSizeIn} * 2,  // Skip borrow boxes row + minuend row
      box(width: 0.5em, height: ${cellSizeIn})[
        #align(center + horizon)[
          #text(size: ${(cellSizePt * 0.8).toFixed(1)}pt)[−]
        ]
      ]
    )`
}
