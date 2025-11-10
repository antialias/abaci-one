// Subtrahend row rendering for subtraction problems
// Shows the bottom number being subtracted with − sign

import type { CellDimensions } from '../shared/types'

/**
 * Generate Typst code for the subtrahend row
 *
 * The subtrahend row shows the number being subtracted (bottom number) with
 * a − sign in the operator column. When borrow notation is enabled, cells
 * include invisible spacer boxes to maintain alignment with the minuend row's
 * scratch boxes.
 *
 * @param cellDimensions - Cell sizing information
 * @returns Typst code for subtrahend row
 */
export function generateSubtrahendRow(cellDimensions: CellDimensions): string {
  const { cellSize, cellSizeIn, cellSizePt } = cellDimensions

  return String.raw`
      // Subtrahend row with − sign
      box(width: ${cellSizeIn}, height: ${cellSizeIn})[
        #align(center + horizon)[
          #text(size: ${(cellSizePt * 0.8).toFixed(1)}pt)[−]
        ]
      ],
      ..for i in range(0, grid-digits).rev() {
        let digit = s-digits.at(i)
        let place-color = place-colors.at(i)
        let fill-color = if show-colors { place-color } else { color-none }

        // Check if this column has borrowing (need to match minuend row alignment)
        let column-has-borrow = i < grid-digits and (m-digits.at(i) < s-digits.at(i))

        // Show digit if within subtrahend's actual range
        if i <= s-highest {
          if show-borrow-notation and column-has-borrow {
            // Add invisible box space to maintain alignment with minuend row
            (box(width: ${cellSizeIn}, height: ${cellSizeIn}, fill: fill-color)[
              #align(center + horizon)[
                #stack(
                  dir: ltr,
                  spacing: 3pt,
                  // Invisible box (same size as minuend's borrow box) to maintain alignment
                  box(
                    width: ${cellSizeIn} * 0.45,
                    height: ${cellSizeIn} * 0.95,
                  )[],
                  // Original digit
                  text(size: ${cellSizePt.toFixed(1)}pt, font: "New Computer Modern Math")[#str(digit)]
                )
              ]
            ],)
          } else {
            // Normal digit display (no borrow notation mode or column doesn't need borrowing)
            (box(width: ${cellSizeIn}, height: ${cellSizeIn}, fill: fill-color)[
              #align(center + horizon)[
                #text(size: ${cellSizePt.toFixed(1)}pt, font: "New Computer Modern Math")[#str(digit)]
              ]
            ],)
          }
        } else {
          // Leading zero position - don't show
          (box(width: ${cellSizeIn}, height: ${cellSizeIn})[
            #h(0pt)
          ],)
        }
      },
`
}
