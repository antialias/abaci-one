// Minuend row rendering for subtraction problems
// Shows the top number with optional scratch work boxes for borrowing

import type { CellDimensions } from '../shared/types'

/**
 * Generate Typst code for the minuend row
 *
 * The minuend row shows the number being subtracted from (top number).
 * When borrow notation is enabled, cells that need borrowing show a dotted
 * scratch box to the left where students write the modified digit value.
 *
 * @param cellDimensions - Cell sizing information
 * @returns Typst code for minuend row
 */
export function generateMinuendRow(cellDimensions: CellDimensions): string {
  const { cellSize, cellSizeIn, cellSizePt } = cellDimensions

  return String.raw`
      // Minuend row (top number with optional scratch work boxes)
      [],  // Empty cell for operator column
      ..for i in range(0, grid-digits).rev() {
        let digit = m-digits.at(i)
        let place-color = place-colors.at(i)
        let fill-color = if show-colors { place-color } else { color-none }

        // Check if this place needs to borrow (destination)
        let needs-borrow = i < grid-digits and (m-digits.at(i) < s-digits.at(i))

        // Check if ANY row in this column needs borrowing (for alignment)
        let column-has-borrow = needs-borrow

        // Show digit if within minuend's actual range
        if i <= m-highest {
          if show-borrow-notation and column-has-borrow {
            if needs-borrow {
              // Get the color from the place we're borrowing FROM (one position to the left, i.e., i+1)
              let borrow-source-color = if show-colors and (i + 1) < place-colors.len() {
                place-colors.at(i + 1)
              } else {
                color-none
              }

              // Show digit with visible scratch box to the left for modified value (e.g., "12")
              (box(width: ${cellSizeIn}, height: ${cellSizeIn}, fill: fill-color)[
                #align(center + horizon)[
                  #stack(
                    dir: ltr,
                    spacing: 3pt,
                    // Visible dotted box for student to write modified digit (same height as cell)
                    // Background color is from the place we're borrowing FROM
                    box(
                      width: ${cellSizeIn} * 0.45,
                      height: ${cellSizeIn} * 0.95,
                      stroke: (dash: "dotted", thickness: 1pt, paint: gray),
                      fill: borrow-source-color
                    )[],
                    // Original digit
                    text(size: ${cellSizePt.toFixed(1)}pt, font: "New Computer Modern Math")[#str(digit)]
                  )
                ]
              ],)
            } else {
              // Invisible box space to maintain alignment in columns with borrowing
              (box(width: ${cellSizeIn}, height: ${cellSizeIn}, fill: fill-color)[
                #align(center + horizon)[
                  #stack(
                    dir: ltr,
                    spacing: 3pt,
                    // Invisible box (same size, no stroke) to maintain alignment
                    box(
                      width: ${cellSizeIn} * 0.45,
                      height: ${cellSizeIn} * 0.95,
                    )[],
                    // Original digit
                    text(size: ${cellSizePt.toFixed(1)}pt, font: "New Computer Modern Math")[#str(digit)]
                  )
                ]
              ],)
            }
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
