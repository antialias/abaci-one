// Shared Typst helper functions and components for addition worksheets
// Used by both full worksheets and compact examples
//
// NOTE: This file now re-exports from the modular typstHelpers/ directory
// for backward compatibility. New code should import from typstHelpers/ directly.

// Import types for internal use
import type { DisplayOptions } from './typstHelpers/shared/types'

// Re-export everything from modular structure
export type {
  DisplayOptions,
  CellDimensions,
} from './typstHelpers/shared/types'
export { generateTypstHelpers } from './typstHelpers/shared/helpers'
export { generatePlaceValueColors } from './typstHelpers/shared/colors'
export { generateSubtractionProblemStackFunction } from './typstHelpers/subtraction/problemStack'

/**
 * Generate Typst function for rendering problem stack/grid
 * This is the SINGLE SOURCE OF TRUTH for problem rendering layout
 * Used by both full worksheets and preview examples
 *
 * @param cellSize Size of each digit cell in inches
 * @param maxDigits Maximum number of digits in any problem on this page (1-6)
 */
export function generateProblemStackFunction(cellSize: number, maxDigits: number = 3): string {
  const cellSizeIn = `${cellSize}in`
  const cellSizePt = cellSize * 72

  // Generate place value color assignments (unique color per place value)
  // Index 0 = ones, 1 = tens, 2 = hundreds, 3 = thousands, 4 = ten-thousands, 5 = hundred-thousands
  const placeColors = [
    'color-ones', // 0: ones (light blue)
    'color-tens', // 1: tens (light green)
    'color-hundreds', // 2: hundreds (light yellow)
    'color-thousands', // 3: thousands (light pink/rose)
    'color-ten-thousands', // 4: ten-thousands (light purple/lavender)
    'color-hundred-thousands', // 5: hundred-thousands (light peach/orange)
  ]

  return String.raw`
// Problem rendering function for addition worksheets (supports 1-${maxDigits} digit problems)
// Returns the stack/grid structure for rendering a single addition problem
// Per-problem display flags: show-carries, show-answers, show-colors, show-ten-frames, show-numbers
#let problem-stack(a, b, index-or-none, show-carries, show-answers, show-colors, show-ten-frames, show-numbers) = {
  // Place value colors array for dynamic lookup (index 0 = ones, 1 = tens, ...)
  let place-colors = (${placeColors.join(', ')})

  // Extract digits dynamically based on problem size
  let max-digits = ${maxDigits}
  // Allow one extra digit for potential overflow (e.g., 99999 + 99999 = 199998)
  let max-extraction = max-digits + 1
  let a-digits = ()
  let b-digits = ()
  let temp-a = a
  let temp-b = b

  // Extract digits from right to left (ones, tens, hundreds, ...)
  for i in range(0, max-extraction) {
    a-digits.push(calc.rem(temp-a, 10))
    b-digits.push(calc.rem(temp-b, 10))
    temp-a = calc.floor(temp-a / 10)
    temp-b = calc.floor(temp-b / 10)
  }

  // Find highest non-zero digit position for each number (for leading zero detection)
  let a-highest = 0
  let b-highest = 0
  for i in range(0, max-extraction) {
    if a-digits.at(i) > 0 { a-highest = i }
    if b-digits.at(i) > 0 { b-highest = i }
  }

  // Actual number of digits in this specific problem (not the page max)
  // Must consider the sum, which may have one more digit than the addends (e.g., 99 + 1 = 100)
  let sum = a + b
  let sum-highest = 0
  let temp-sum = sum
  for i in range(0, max-extraction) {
    if calc.rem(temp-sum, 10) > 0 { sum-highest = i }
    temp-sum = calc.floor(temp-sum / 10)
  }
  let actual-digits = calc.max(calc.max(a-highest, b-highest), sum-highest) + 1

  // Generate column list dynamically based on actual digits in this problem
  // Column list: [+sign column (0.5em), ...actual-digits × cellSizeIn]
  let column-list = (0.5em,)
  for i in range(0, actual-digits) {
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

      // Carry boxes row (one per place value, right to left)
      [],  // Empty cell for + sign column
      ..for i in range(0, actual-digits).rev() {
        // DEBUG: Show which place values get carry boxes and why
        let show-carry = show-carries and i > 0

        if show-carry {
          // Carry box: shows carry FROM position i-1 TO position i
          let source-color = place-colors.at(i - 1)  // Color of source place value
          let dest-color = place-colors.at(i)        // Color of destination place value

          if show-colors {
            (box(width: ${cellSizeIn}, height: ${cellSizeIn})[
              #diagonal-split-box(${cellSizeIn}, source-color, dest-color)
            ],)
          } else {
            (box(width: ${cellSizeIn}, height: ${cellSizeIn}, stroke: 0.5pt)[],)
          }
        } else {
          // No carry box for this position (i == 0 or show-carries is false)
          (box(width: ${cellSizeIn}, height: ${cellSizeIn})[
            #v(${cellSizeIn})
          ],)
        }
      },

      // First addend row (right to left: ones, tens, hundreds, ...)
      [],  // Empty cell for + sign column
      ..for i in range(0, actual-digits).rev() {
        let digit = a-digits.at(i)
        let place-color = place-colors.at(i)  // Dynamic color lookup by place value
        let fill-color = if show-colors { place-color } else { color-none }

        // Hide leading zeros (zeros higher than the highest non-zero digit)
        (box(width: ${cellSizeIn}, height: ${cellSizeIn}, fill: fill-color)[
          #align(center + horizon)[
            #if i <= a-highest [
              #text(size: ${(cellSizePt * 0.8).toFixed(1)}pt)[#str(digit)]
            ] else [
              #h(0pt)
            ]
          ]
        ],)
      },

      // Second addend row with + sign (right to left)
      box(width: 0.5em, height: ${cellSizeIn})[#align(center + horizon)[#text(size: ${(cellSizePt * 0.8).toFixed(1)}pt)[+]]],
      ..for i in range(0, actual-digits).rev() {
        let digit = b-digits.at(i)
        let place-color = place-colors.at(i)  // Dynamic color lookup by place value
        let fill-color = if show-colors { place-color } else { color-none }

        // Hide leading zeros (zeros higher than the highest non-zero digit)
        (box(width: ${cellSizeIn}, height: ${cellSizeIn}, fill: fill-color)[
          #align(center + horizon)[
            #if i <= b-highest [
              #text(size: ${(cellSizePt * 0.8).toFixed(1)}pt)[#str(digit)]
            ] else [
              #h(0pt)
            ]
          ]
        ],)
      },

      // Line row
      [],  // Empty cell for + sign column
      ..for i in range(0, actual-digits) {
        (line(length: ${cellSizeIn}, stroke: heavy-stroke),)
      },

      // Ten-frames row with overlaid line on top
      // Show ten-frames for any place value that has regrouping (or all if show-ten-frames-for-all)
      ..if show-ten-frames {
        // Check which place values need ten-frames (only for actual digits in this problem)
        let carry = 0
        let regrouping-places = ()
        for i in range(0, actual-digits) {
          let digit-sum = a-digits.at(i) + b-digits.at(i) + carry
          if digit-sum >= 10 {
            regrouping-places.push(i)
            carry = 1
          } else {
            carry = 0
          }
        }

        let needs-ten-frames = show-ten-frames-for-all or regrouping-places.len() > 0

        if needs-ten-frames {
          (
            [],  // Empty cell for + sign column
            // Show ten-frames for any place value that needs regrouping
            ..for i in range(0, actual-digits).rev() {
              let shows-frame = show-ten-frames-for-all or regrouping-places.contains(i)
              if shows-frame {
                // Show ten-frame for this place value
                // Top frame: carry destination (next higher place value)
                // Bottom frame: current place value overflow
                let top-color = if i + 1 < actual-digits { place-colors.at(i + 1) } else { color-none }
                let bottom-color = place-colors.at(i)

                (box(width: ${cellSizeIn}, height: ${cellSizeIn} * 0.8)[
                  #align(center + top)[#ten-frames-stacked(${cellSizeIn} * 0.90, if show-colors { top-color } else { color-none }, if show-colors { bottom-color } else { color-none })]
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

      // Answer boxes (one per digit column, only for actual digits including sum)
      [],  // Empty cell for + sign column
      ..for i in range(0, actual-digits).rev() {
        let place-color = place-colors.at(i)  // Dynamic color lookup by place value
        let fill-color = if show-colors { place-color } else { color-none }
        let show-answer = show-answers

        if show-answer {
          (box(width: ${cellSizeIn}, height: ${cellSizeIn}, stroke: 0.5pt, fill: fill-color)[],)
        } else {
          // No answer box (show-answers is false)
          (box(width: ${cellSizeIn}, height: ${cellSizeIn})[
            #v(${cellSizeIn})
          ],)
        }
      },
    )
  )
}
`
}

/**
 * Generate Typst function for rendering subtraction problem stack/grid
 * Parallel to generateProblemStackFunction but for subtraction
 *
 * Key differences from addition:
 * - Borrow boxes (instead of carry boxes) show borrows FROM higher TO lower
 * - Operator is minus sign (−)
 * - Difference can have fewer digits than minuend (hide leading zeros)
 * - Ten-frames show borrowing visualization
 *
 * @param cellSize Size of each digit cell in inches
 * @param maxDigits Maximum number of digits in any problem on this page (1-6)
 */

/**
 * DEPRECATED: Old generateProblemTypst function - use generateProblemStackFunction() instead
 * This function is kept for backwards compatibility but should not be used
 * Generate Typst code for rendering a single addition problem
 * This is the core rendering logic shared between worksheets and examples
 */
export function generateProblemTypst(
  addend1: number,
  addend2: number,
  cellSize: number,
  options: DisplayOptions,
  problemNumber?: number
): string {
  const cellSizeIn = `${cellSize}in`
  const cellSizePt = cellSize * 72

  return String.raw`
#let a = ${addend1}
#let b = ${addend2}
#let aH = calc.floor(a / 100)
#let aT = calc.floor(calc.rem(a, 100) / 10)
#let aO = calc.rem(a, 10)
#let bH = calc.floor(b / 100)
#let bT = calc.floor(calc.rem(b, 100) / 10)
#let bO = calc.rem(b, 10)

#stack(
  dir: ttb,
  spacing: 0pt,
  ${
    options.showProblemNumbers && problemNumber !== undefined
      ? `align(top + left)[
    #box(inset: (left: 0.08in, top: 0.05in))[
      #text(size: ${(cellSizePt * 0.6).toFixed(1)}pt, weight: "bold", font: "New Computer Modern Math")[\\#${problemNumber}.]
    ]
  ],`
      : ''
  }
  grid(
    columns: (0.5em, ${cellSizeIn}, ${cellSizeIn}, ${cellSizeIn}),
    gutter: 0pt,

    [],
    // Hundreds carry box: shows carry FROM tens (green) TO hundreds (yellow)
    ${
      options.showCarryBoxes
        ? options.showPlaceValueColors
          ? 'diagonal-split-box(' + cellSizeIn + ', color-tens, color-hundreds),'
          : 'box(width: ' + cellSizeIn + ', height: ' + cellSizeIn + ', stroke: 0.5pt)[],'
        : 'v(' + cellSizeIn + '),'
    }
    // Tens carry box: shows carry FROM ones (blue) TO tens (green)
    ${
      options.showCarryBoxes
        ? options.showPlaceValueColors
          ? 'diagonal-split-box(' + cellSizeIn + ', color-ones, color-tens),'
          : 'box(width: ' + cellSizeIn + ', height: ' + cellSizeIn + ', stroke: 0.5pt)[],'
        : 'v(' + cellSizeIn + '),'
    }
    [],

    // First addend
    [],
    box(width: ${cellSizeIn}, height: ${cellSizeIn}, fill: ${options.showPlaceValueColors ? 'color-hundreds' : 'color-none'})[#align(center + horizon)[#if aH > 0 [#aH] else [#h(0pt)]]],
    box(width: ${cellSizeIn}, height: ${cellSizeIn}, fill: ${options.showPlaceValueColors ? 'color-tens' : 'color-none'})[#align(center + horizon)[#aT]],
    box(width: ${cellSizeIn}, height: ${cellSizeIn}, fill: ${options.showPlaceValueColors ? 'color-ones' : 'color-none'})[#align(center + horizon)[#aO]],

    // Second addend with + sign
    [+],
    box(width: ${cellSizeIn}, height: ${cellSizeIn}, fill: ${options.showPlaceValueColors ? 'color-hundreds' : 'color-none'})[#align(center + horizon)[#if bH > 0 [#bH] else [#h(0pt)]]],
    box(width: ${cellSizeIn}, height: ${cellSizeIn}, fill: ${options.showPlaceValueColors ? 'color-tens' : 'color-none'})[#align(center + horizon)[#bT]],
    box(width: ${cellSizeIn}, height: ${cellSizeIn}, fill: ${options.showPlaceValueColors ? 'color-ones' : 'color-none'})[#align(center + horizon)[#bO]],

    // Horizontal line
    [],
    box(width: ${cellSizeIn}, height: 1pt, inset: 0pt)[#line(length: 100%, stroke: 0.8pt)],
    box(width: ${cellSizeIn}, height: 1pt, inset: 0pt)[#line(length: 100%, stroke: 0.8pt)],
    box(width: ${cellSizeIn}, height: 1pt, inset: 0pt)[#line(length: 100%, stroke: 0.8pt)],

    // Answer boxes (or blank space)
    ${
      options.showAnswerBoxes
        ? `[],
    box(width: ${cellSizeIn}, height: ${cellSizeIn}, fill: color-none, stroke: grid-stroke, inset: 0pt)[],
    box(width: ${cellSizeIn}, height: ${cellSizeIn}, fill: color-none, stroke: grid-stroke, inset: 0pt)[],
    box(width: ${cellSizeIn}, height: ${cellSizeIn}, fill: color-none, stroke: grid-stroke, inset: 0pt)[],`
        : ''
    }
  )${
    options.showTenFrames || options.showTenFramesForAll
      ? `,
  v(4pt),
  box(inset: 2pt)[
    #ten-frames-stacked(${cellSizeIn}, color-ones, color-tens)
  ]`
      : ''
  }
)
`
}
