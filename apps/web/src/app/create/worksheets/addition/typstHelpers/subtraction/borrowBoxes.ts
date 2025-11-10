// Borrow boxes row rendering for subtraction problems
// This row shows where borrows occur (FROM higher place TO lower place)

import type { CellDimensions } from '../shared/types'
import { TYPST_CONSTANTS } from '../shared/types'

/**
 * Generate Typst code for the borrow boxes row
 *
 * Borrow boxes indicate where a borrow operation occurs:
 * - Source: The place value we're borrowing FROM (giving)
 * - Destination: The place value we're borrowing TO (receiving)
 *
 * Design decision: Borrow boxes NEVER use place value colors (always stroke-only)
 * to avoid arrow layering issues where arrows get covered by adjacent cell backgrounds.
 *
 * @param cellDimensions - Cell sizing information
 * @returns Typst code for borrow boxes row
 */
export function generateBorrowBoxesRow(cellDimensions: CellDimensions): string {
  const { cellSize, cellSizeIn, cellSizePt } = cellDimensions

  const hintTextSize = (cellSizePt * TYPST_CONSTANTS.HINT_TEXT_SIZE_FACTOR).toFixed(1)
  const arrowheadSize = (cellSizePt * TYPST_CONSTANTS.ARROWHEAD_SIZE_FACTOR).toFixed(1)

  const arrowStartDx = (cellSize * TYPST_CONSTANTS.ARROW_START_DX).toFixed(2)
  const arrowStartDy = (cellSize * TYPST_CONSTANTS.ARROW_START_DY).toFixed(2)
  const arrowEndX = (cellSize * 0.24).toFixed(2)
  const arrowEndY = (cellSize * 0.7).toFixed(2)
  const arrowControlX = (cellSize * 0.11).toFixed(2)
  const arrowControlY = (cellSize * -0.5).toFixed(2)
  const arrowheadDx = (cellSize * TYPST_CONSTANTS.ARROWHEAD_DX).toFixed(2)
  const arrowheadDy = (cellSize * TYPST_CONSTANTS.ARROWHEAD_DY).toFixed(2)

  return String.raw`
      // Borrow boxes row (shows borrows FROM higher place TO lower place)
      [],  // Empty cell for operator column
      ..for i in range(0, grid-digits).rev() {
        // Check if we need to borrow FROM this place (to give to i-1)
        // We borrow when m-digit < s-digit at position i-1
        let shows-borrow = show-borrows and i > 0 and (m-digits.at(i - 1) < s-digits.at(i - 1))

        if shows-borrow {
          // This place borrowed FROM to give to lower place
          let source-color = place-colors.at(i)      // This place (giving)
          let dest-color = place-colors.at(i - 1)    // Lower place (receiving)

          // When showing hints, determine what to display based on cascading
          if show-borrowing-hints and i <= m-highest {
            // Determine the actual value to show in the hint
            // For cascading: if this digit is 0, it received 10 from left and gives 1 to right
            // So it shows "10 - 1". Otherwise it shows "original - 1"
            let original-digit = m-digits.at(i)

            // Check if this is part of a cascade (is it 0 and needs to borrow?)
            let is-cascade = original-digit == 0

            // The display value is either the original digit or 10 (if cascading)
            let display-value = if is-cascade { 10 } else { original-digit }

            // Borrow boxes never use place value colors (always stroke-only)
            // to avoid arrow layering issues
            (box(width: ${cellSizeIn}, height: ${cellSizeIn}, stroke: ${TYPST_CONSTANTS.CELL_STROKE_WIDTH}pt)[
              #place(
                top + center,
                dy: 2pt,
                text(size: ${hintTextSize}pt, fill: gray.darken(30%), weight: "bold")[
                  #display-value#h(0.1em)−#h(0.1em)1
                ]
              )
              // Draw curved line using Typst bezier with control point
              #place(
                top + left,
                dx: ${arrowStartDx}in,
                dy: ${arrowStartDy}in,
                path(
                  stroke: (paint: gray.darken(30%), thickness: ${TYPST_CONSTANTS.ARROW_STROKE_WIDTH}pt),
                  // Start vertex (near the "1" in borrow box)
                  (0pt, 0pt),
                  // End vertex adjusted up and left to align with arrowhead (vertex, relative-control-point)
                  ((${arrowEndX}in, ${arrowEndY}in), (${arrowControlX}in, ${arrowControlY}in)),
                )
              )
              // Arrowhead pointing down at the top edge of borrowed 10s box
              #place(
                top + left,
                dx: ${arrowheadDx}in,
                dy: ${arrowheadDy}in,
                text(size: ${arrowheadSize}pt, fill: gray.darken(30%))[▼]
              )
            ],)
          } else {
            // No hints - just show stroke box
            (box(width: ${cellSizeIn}, height: ${cellSizeIn}, stroke: ${TYPST_CONSTANTS.CELL_STROKE_WIDTH}pt)[],)
          }
        } else {
          // No borrow from this position
          (box(width: ${cellSizeIn}, height: ${cellSizeIn})[
            #v(${cellSizeIn})
          ],)
        }
      },
`
}
