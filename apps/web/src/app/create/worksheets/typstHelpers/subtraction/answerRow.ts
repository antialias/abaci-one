// Answer row and ten-frames rendering for subtraction problems
// Shows answer boxes and optional borrowing visualization

import type { CellDimensions } from '../shared/types'
import { TYPST_CONSTANTS } from '../shared/types'

/**
 * Generate Typst code for the line row (separates problem from answer)
 *
 * @param cellDimensions - Cell sizing information
 * @returns Typst code for line row
 */
export function generateLineRow(cellDimensions: CellDimensions): string {
  const { cellSizeIn } = cellDimensions

  return String.raw`
      // Line row
      [],  // Empty cell for operator column
      ..for i in range(0, grid-digits) {
        (line(length: ${cellSizeIn}, stroke: heavy-stroke),)
      },
`
}

/**
 * Generate Typst code for the ten-frames row (borrowing visualization)
 *
 * Shows stacked ten-frames for places that need borrowing, providing
 * visual representation of "borrowing 10 from the next place value".
 *
 * @param cellDimensions - Cell sizing information
 * @returns Typst code for ten-frames row
 */
export function generateTenFramesRow(cellDimensions: CellDimensions): string {
  const { cellSizeIn } = cellDimensions

  return String.raw`
      // Ten-frames row (show borrowing visualization)
      ..if show-ten-frames {
        // Detect which places need borrowing
        let borrow-places = ()
        for i in range(0, grid-digits) {
          if m-digits.at(i) < s-digits.at(i) {
            borrow-places.push(i)
          }
        }

        if borrow-places.len() > 0 {
          (
            [],  // Empty cell for operator column
            ..for i in range(0, grid-digits).rev() {
              let shows-frame = show-ten-frames-for-all or borrow-places.contains(i)

              if shows-frame {
                // Show borrowed amount visualization
                let top-color = if i + 1 < grid-digits { place-colors.at(i + 1) } else { color-none }
                let bottom-color = place-colors.at(i)

                (box(width: ${cellSizeIn}, height: ${cellSizeIn} * 0.8)[
                  #align(center + top)[
                    #ten-frames-stacked(
                      ${cellSizeIn} * 0.90,
                      if show-colors { top-color } else { color-none },
                      if show-colors { bottom-color } else { color-none }
                    )
                  ]
                  #place(top, line(length: ${cellSizeIn} * 0.90, stroke: heavy-stroke))
                ],)
              } else {
                (v(${cellSizeIn} * 0.8),)
              }
            },
          )
        } else {
          ()
        }
      } else {
        ()
      },
`
}

/**
 * Generate Typst code for the answer boxes row
 *
 * Shows boxes where students write their answers. Only shows boxes for
 * actual difference digits, hiding leading zeros.
 *
 * @param cellDimensions - Cell sizing information
 * @returns Typst code for answer boxes row
 */
export function generateAnswerBoxesRow(cellDimensions: CellDimensions): string {
  const { cellSizeIn } = cellDimensions

  return String.raw`
      // Answer boxes (only for actual difference digits, hiding leading zeros)
      [],  // Empty cell for operator column
      ..for i in range(0, grid-digits).rev() {
        let place-color = place-colors.at(i)
        let fill-color = if show-colors { place-color } else { color-none }

        // Only show answer box if within actual difference digits
        let shows-answer = show-answers and i < answer-digits

        if shows-answer {
          (box(width: ${cellSizeIn}, height: ${cellSizeIn}, stroke: ${TYPST_CONSTANTS.CELL_STROKE_WIDTH}pt, fill: fill-color)[],)
        } else {
          // No answer box for leading zero positions
          (box(width: ${cellSizeIn}, height: ${cellSizeIn})[
            #v(${cellSizeIn})
          ],)
        }
      },
`
}
