// Main subtraction problem stack function
// Composes all row components into the complete problem rendering

import { getPlaceValueColorNames } from '../shared/colors'
import type { CellDimensions } from '../shared/types'
import { generateBorrowBoxesRow } from './borrowBoxes'
import { generateMinuendRow } from './minuendRow'
import { generateSubtrahendRow } from './subtrahendRow'
import { generateLineRow, generateTenFramesRow, generateAnswerBoxesRow } from './answerRow'

/**
 * Generate the main subtraction problem stack function for Typst
 *
 * This function composes all the extracted row components into the complete
 * subtraction problem rendering logic. It handles:
 * - Borrow boxes (with optional hints/arrows)
 * - Minuend row (with optional scratch work boxes)
 * - Subtrahend row (with − sign)
 * - Line separator
 * - Ten-frames (optional borrowing visualization)
 * - Answer boxes
 *
 * @param cellSize - Size of each digit cell in inches
 * @param maxDigits - Maximum number of digits supported (default: 3)
 * @returns Typst function definition as string
 */
export function generateSubtractionProblemStackFunction(
  cellSize: number,
  maxDigits: number = 3
): string {
  const cellSizeIn = `${cellSize}in`
  const cellSizePt = cellSize * 72

  const cellDimensions: CellDimensions = {
    cellSize,
    cellSizeIn,
    cellSizePt,
  }

  const placeColors = getPlaceValueColorNames()

  return String.raw`
// Subtraction problem rendering function (supports 1-${maxDigits} digit problems)
// Returns the stack/grid structure for rendering a single subtraction problem
// Per-problem display flags: show-borrows, show-answers, show-colors, show-ten-frames, show-numbers, show-borrow-notation, show-borrowing-hints
#let subtraction-problem-stack(minuend, subtrahend, index-or-none, show-borrows, show-answers, show-colors, show-ten-frames, show-numbers, show-borrow-notation, show-borrowing-hints) = {
  // Place value colors array for dynamic lookup
  let place-colors = (${placeColors.join(', ')})

  // Extract digits dynamically based on problem size
  let max-digits = ${maxDigits}
  // Allow one extra digit for potential carry in difference check
  let max-extraction = max-digits + 1
  let m-digits = ()
  for i in range(0, max-extraction) {
    m-digits.push(calc.rem(calc.floor(minuend / calc.pow(10, i)), 10))
  }
  let s-digits = ()
  for i in range(0, max-extraction) {
    s-digits.push(calc.rem(calc.floor(subtrahend / calc.pow(10, i)), 10))
  }

  // Find highest non-zero digit position for each number
  let m-highest = 0
  for i in range(0, max-extraction).rev() {
    if m-digits.at(i) != 0 {
      m-highest = i
      break
    }
  }
  let s-highest = 0
  for i in range(0, max-extraction).rev() {
    if s-digits.at(i) != 0 {
      s-highest = i
      break
    }
  }

  // Calculate difference to determine answer digit count
  let diff = minuend - subtrahend
  let diff-digits = ()
  for i in range(0, max-extraction) {
    diff-digits.push(calc.rem(calc.floor(diff / calc.pow(10, i)), 10))
  }
  let diff-highest = 0
  for i in range(0, max-extraction).rev() {
    if diff-digits.at(i) != 0 {
      diff-highest = i
      break
    }
  }

  // Grid is sized for minuend/subtrahend, not difference
  let grid-digits = calc.max(m-highest, s-highest) + 1

  // Answer boxes only show up to difference digits
  let answer-digits = diff-highest + 1

  // Generate column list dynamically based on grid digits
  let column-list = (0.5em,)
  for i in range(0, grid-digits) {
    column-list.push(${cellSizeIn})
  }

  // Show problem number (only if problem numbers are enabled)
  let problem-number-display = if show-numbers and index-or-none != none {
    align(top + left)[
      #box(inset: (left: 0.08in, top: 0.05in))[
        #text(size: ${(cellSizePt * 0.6).toFixed(1)}pt, weight: "bold", font: "New Computer Modern Math")[\##(index-or-none + 1).]
      ]
    ]
  }

  stack(
    dir: ttb,
    spacing: 0pt,
    problem-number-display,
    grid(
      columns: column-list,
      gutter: 0pt,

${generateBorrowBoxesRow(cellDimensions)}

${generateMinuendRow(cellDimensions)}

${generateSubtrahendRow(cellDimensions)}

${generateLineRow(cellDimensions)}

${generateTenFramesRow(cellDimensions)}

${generateAnswerBoxesRow(cellDimensions)}
    )
  )
}
`
}
