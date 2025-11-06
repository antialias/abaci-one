// Shared Typst helper functions and components for addition worksheets
// Used by both full worksheets and compact examples

export interface DisplayOptions {
  showCarryBoxes: boolean
  showAnswerBoxes: boolean
  showPlaceValueColors: boolean
  showProblemNumbers: boolean
  showCellBorder: boolean
  showTenFrames: boolean
  showTenFramesForAll: boolean
  fontSize: number
}

/**
 * Generate Typst helper functions (ten-frames, diagonal boxes, etc.)
 * These are shared between full worksheets and examples
 */
export function generateTypstHelpers(cellSize: number): string {
  return String.raw`
// Place value colors (light pastels)
#let color-ones = rgb(227, 242, 253)      // Light blue
#let color-tens = rgb(232, 245, 233)      // Light green
#let color-hundreds = rgb(255, 249, 196)  // Light yellow
#let color-none = white                   // No color

// Ten-frame helper - stacked 2 frames vertically, sized to fit cell width
#let ten-frame-spacing = 0pt
#let ten-frame-cell-stroke = 0.4pt
#let ten-frame-cell-color = rgb(0, 0, 0, 30%)
#let ten-frame-outer-stroke = 0.8pt
#let ten-frames-stacked(cell-width, top-color, bottom-color) = {
  let cell-w = cell-width / 5
  let cell-h = cell-w  // Square cells
  stack(
    dir: ttb,
    spacing: ten-frame-spacing,
    // Top ten-frame (carry to next place value)
    box(stroke: ten-frame-outer-stroke + black, inset: 0pt)[
      #grid(
        columns: 5, rows: 2, gutter: 0pt, stroke: none,
        ..for i in range(0, 10) {
          (box(width: cell-w, height: cell-h, fill: top-color, stroke: ten-frame-cell-stroke + ten-frame-cell-color)[],)
        }
      )
    ],
    // Bottom ten-frame (current place value overflow)
    box(stroke: ten-frame-outer-stroke + black, inset: 0pt)[
      #grid(
        columns: 5, rows: 2, gutter: 0pt, stroke: none,
        ..for i in range(0, 10) {
          (box(width: cell-w, height: cell-h, fill: bottom-color, stroke: ten-frame-cell-stroke + ten-frame-cell-color)[],)
        }
      )
    ]
  )
}

// Diagonal-split box for carry cells
// Shows the transition from one place value to another
// source-color: color of the place value where the carry comes FROM (right side)
// dest-color: color of the place value where the carry goes TO (left side)
#let diagonal-split-box(cell-size, source-color, dest-color) = {
  box(width: cell-size, height: cell-size, stroke: 0.5pt)[
    // Bottom-right triangle (source place value)
    #place(
      bottom + right,
      polygon(
        fill: source-color,
        stroke: none,
        (0pt, 0pt),           // bottom-left corner of triangle
        (cell-size, 0pt),     // bottom-right corner
        (cell-size, cell-size) // top-right corner
      )
    )
    // Top-left triangle (destination place value)
    #place(
      top + left,
      polygon(
        fill: dest-color,
        stroke: none,
        (0pt, 0pt),           // top-left corner
        (cell-size, cell-size), // bottom-right corner of triangle
        (0pt, cell-size)      // bottom-left corner
      )
    )
  ]
}
`
}

/**
 * Generate Typst function for rendering problem stack/grid
 * This is the SINGLE SOURCE OF TRUTH for problem rendering layout
 * Used by both full worksheets and preview examples
 */
export function generateProblemStackFunction(cellSize: number): string {
  const cellSizeIn = `${cellSize}in`
  const cellSizePt = cellSize * 72

  return String.raw`
// Problem rendering function for addition worksheets
// Returns the stack/grid structure for rendering a single 2-digit addition problem
#let problem-stack(a, b, aT, aO, bT, bO, index-or-none) = {
  stack(
    dir: ttb,
    spacing: 0pt,
    if show-numbers and index-or-none != none {
      align(top + left)[
        #box(inset: (left: 0.08in, top: 0.05in))[
          #text(size: ${(cellSizePt * 0.6).toFixed(1)}pt, weight: "bold", font: "New Computer Modern Math")[\##(index-or-none + 1).]
        ]
      ]
    },
    grid(
      columns: (0.5em, ${cellSizeIn}, ${cellSizeIn}, ${cellSizeIn}),
      gutter: 0pt,

      [],
      // Hundreds carry box: shows carry FROM tens (green) TO hundreds (yellow)
      if show-carries {
        if show-colors {
          diagonal-split-box(${cellSizeIn}, color-tens, color-hundreds)
        } else {
          box(width: ${cellSizeIn}, height: ${cellSizeIn}, stroke: 0.5pt)[]
        }
      } else { v(${cellSizeIn}) },
      // Tens carry box: shows carry FROM ones (blue) TO tens (green)
      if show-carries {
        if show-colors {
          diagonal-split-box(${cellSizeIn}, color-ones, color-tens)
        } else {
          box(width: ${cellSizeIn}, height: ${cellSizeIn}, stroke: 0.5pt)[]
        }
      } else { v(${cellSizeIn}) },
      [],

      [],
      [],
      box(width: ${cellSizeIn}, height: ${cellSizeIn}, fill: if show-colors { color-tens } else { color-none })[#align(center + horizon)[#text(size: ${(cellSizePt * 0.8).toFixed(1)}pt)[#str(aT)]]],
      box(width: ${cellSizeIn}, height: ${cellSizeIn}, fill: if show-colors { color-ones } else { color-none })[#align(center + horizon)[#text(size: ${(cellSizePt * 0.8).toFixed(1)}pt)[#str(aO)]]],

      box(width: ${cellSizeIn}, height: ${cellSizeIn})[#align(center + horizon)[#text(size: ${(cellSizePt * 0.8).toFixed(1)}pt)[+]]],
      [],
      box(width: ${cellSizeIn}, height: ${cellSizeIn}, fill: if show-colors { color-tens } else { color-none })[#align(center + horizon)[#text(size: ${(cellSizePt * 0.8).toFixed(1)}pt)[#str(bT)]]],
      box(width: ${cellSizeIn}, height: ${cellSizeIn}, fill: if show-colors { color-ones } else { color-none })[#align(center + horizon)[#text(size: ${(cellSizePt * 0.8).toFixed(1)}pt)[#str(bO)]]],

      // Line row
      [],
      line(length: ${cellSizeIn}, stroke: heavy-stroke),
      line(length: ${cellSizeIn}, stroke: heavy-stroke),
      line(length: ${cellSizeIn}, stroke: heavy-stroke),

      // Ten-frames row with overlaid line on top
      ..if show-ten-frames {
        let carry = if (aO + bO) >= 10 { 1 } else { 0 }
        let tens-regroup = (aT + bT + carry) >= 10
        let ones-regroup = (aO + bO) >= 10
        let needs-ten-frames = show-ten-frames-for-all or tens-regroup or ones-regroup

        if needs-ten-frames {
          (
            [],
            [],  // Empty cell for hundreds column
            if show-ten-frames-for-all or tens-regroup {
              box(width: ${cellSizeIn}, height: ${cellSizeIn} * 0.8)[
                #align(center + top)[#ten-frames-stacked(${cellSizeIn} * 0.90, if show-colors { color-hundreds } else { color-none }, if show-colors { color-tens } else { color-none })]
                #place(top, line(length: ${cellSizeIn} * 0.90, stroke: heavy-stroke))
              ]
              h(2.5pt)
            } else {
              v(${cellSizeIn} * 0.8)
            },
            if show-ten-frames-for-all or ones-regroup {
              box(width: ${cellSizeIn}, height: ${cellSizeIn} * 0.8)[
                #align(center + top)[#ten-frames-stacked(${cellSizeIn} * 0.90, if show-colors { color-tens } else { color-none }, if show-colors { color-ones } else { color-none })]
                #place(top, line(length: ${cellSizeIn} * 0.90, stroke: heavy-stroke))
              ]
            } else {
              v(${cellSizeIn} * 0.8)
            },
          )
        } else {
          ()
        }
      } else {
        ()
      },

      // Answer boxes
      [],
      if show-answers { box(width: ${cellSizeIn}, height: ${cellSizeIn}, stroke: 0.5pt, fill: if show-colors { color-hundreds } else { color-none })[] } else { v(${cellSizeIn}) },
      if show-answers { box(width: ${cellSizeIn}, height: ${cellSizeIn}, stroke: 0.5pt, fill: if show-colors { color-tens } else { color-none })[] } else { v(${cellSizeIn}) },
      if show-answers { box(width: ${cellSizeIn}, height: ${cellSizeIn}, stroke: 0.5pt, fill: if show-colors { color-ones } else { color-none })[] } else { v(${cellSizeIn}) },
    )
  )
}
`
}

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
