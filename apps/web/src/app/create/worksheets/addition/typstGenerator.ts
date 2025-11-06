// Typst document generator for addition worksheets

import type { AdditionProblem, WorksheetConfig } from './types'

/**
 * Chunk array into pages of specified size
 */
function chunkProblems(problems: AdditionProblem[], pageSize: number): AdditionProblem[][] {
  const pages: AdditionProblem[][] = []
  for (let i = 0; i < problems.length; i += pageSize) {
    pages.push(problems.slice(i, i + pageSize))
  }
  return pages
}

/**
 * Generate Typst source code for a single page
 */
function generatePageTypst(
  config: WorksheetConfig,
  pageProblems: AdditionProblem[],
  problemOffset: number,
  rowsPerPage: number
): string {
  const problemsTypst = pageProblems.map((p) => `  (a: ${p.a}, b: ${p.b}),`).join('\n')

  // Calculate actual number of rows on this page
  const actualRows = Math.ceil(pageProblems.length / config.cols)

  // Use smaller margins to maximize space
  const margin = 0.4
  const contentWidth = config.page.wIn - margin * 2
  const contentHeight = config.page.hIn - margin * 2

  // Calculate grid spacing based on ACTUAL rows on this page
  const headerHeight = 0.35 // inches for header
  const availableHeight = contentHeight - headerHeight
  const problemBoxHeight = availableHeight / actualRows
  const problemBoxWidth = contentWidth / config.cols

  // Calculate cell size to fill the entire problem box
  // Without ten-frames: 5 rows (carry, first number, second number, line, answer)
  // With ten-frames: 5 rows + ten-frames row (0.8 * cellSize for square cells)
  // Total with ten-frames: 5.8 rows, use 6.4 for breathing room
  const cellSize = config.showTenFrames ? problemBoxHeight / 6.4 : problemBoxHeight / 5

  return String.raw`
// addition-worksheet-page.typ (auto-generated)

#set page(
  width: ${config.page.wIn}in,
  height: ${config.page.hIn}in,
  margin: ${margin}in,
  fill: white
)
#set text(size: ${config.fontSize}pt, font: "New Computer Modern Math")

// Single non-breakable block to ensure one page
#block(breakable: false)[

#let grid-stroke = ${config.showCellBorder ? '(thickness: 1pt, dash: "dashed", paint: gray.darken(20%))' : 'none'}
#let heavy-stroke = 0.8pt
#let show-carries = ${config.showCarryBoxes ? 'true' : 'false'}
#let show-answers = ${config.showAnswerBoxes ? 'true' : 'false'}
#let show-colors = ${config.showPlaceValueColors ? 'true' : 'false'}
#let show-numbers = ${config.showProblemNumbers ? 'true' : 'false'}
#let show-ten-frames = ${config.showTenFrames ? 'true' : 'false'}
#let show-ten-frames-for-all = ${config.showTenFramesForAll ? 'true' : 'false'}

// Place value colors (light pastels)
#let color-ones = rgb(227, 242, 253)      // Light blue
#let color-tens = rgb(232, 245, 233)      // Light green
#let color-hundreds = rgb(255, 249, 196)  // Light yellow
#let color-none = white                   // No color

// Ten-frame helper - stacked 2 frames vertically, sized to fit cell width
// top-color: background for top frame (represents carry to next place value)
// bottom-color: background for bottom frame (represents current place value)
#let ten-frame-spacing = 0pt  // No gap between frames
#let ten-frame-cell-stroke = 0.4pt  // Internal cell strokes - slightly thinner
#let ten-frame-cell-color = rgb(0, 0, 0, 30%)  // Light gray for internal lines
#let ten-frame-outer-stroke = 0.8pt  // Dark outer border for frame visibility
#let ten-frames-stacked(cell-width, top-color, bottom-color) = {
  let cell-w = cell-width / 5
  let cell-h = cell-w  // Square cells
  stack(
    dir: ttb,
    spacing: ten-frame-spacing,
    // Top ten-frame (carry to next place value) - wrapped with outer border
    box(
      stroke: ten-frame-outer-stroke + black,
      inset: 0pt
    )[
      #grid(
        columns: 5,
        rows: 2,
        gutter: 0pt,
        stroke: none,
        ..for i in range(0, 10) {
          (box(width: cell-w, height: cell-h, fill: top-color, stroke: ten-frame-cell-stroke + ten-frame-cell-color)[],)
        }
      )
    ],
    // Bottom ten-frame (current place value overflow) - wrapped with outer border
    box(
      stroke: ten-frame-outer-stroke + black,
      inset: 0pt
    )[
      #grid(
        columns: 5,
        rows: 2,
        gutter: 0pt,
        stroke: none,
        ..for i in range(0, 10) {
          (box(width: cell-w, height: cell-h, fill: bottom-color, stroke: ten-frame-cell-stroke + ten-frame-cell-color)[],)
        }
      )
    ]
  )
}

// Diagonal-split box for carry cells
// Shows the transition from one place value to another
// Visual metaphor: carry "flows" from bottom-right (source) to top-left (destination)
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

#let problem-box(problem, index) = {
  let a = problem.a
  let b = problem.b
  let aT = calc.floor(calc.rem(a, 100) / 10)
  let aO = calc.rem(a, 10)
  let bT = calc.floor(calc.rem(b, 100) / 10)
  let bO = calc.rem(b, 10)

  box(
    inset: 0pt,
    width: ${problemBoxWidth}in,
    height: ${problemBoxHeight}in
  )[
    #align(center + horizon)[
      #stack(
        dir: ttb,
        spacing: 0pt,
        if show-numbers {
          align(top + left)[
            #box(inset: (left: 0.08in, top: 0.05in))[
              #text(size: ${(cellSize * 0.6 * 72).toFixed(1)}pt, weight: "bold", font: "New Computer Modern Math")[\##(index + 1).]
            ]
          ]
        },
        grid(
          columns: (0.5em, ${cellSize}in, ${cellSize}in, ${cellSize}in),
          gutter: 0pt,

          [],
          // Hundreds carry box: shows carry FROM tens (green) TO hundreds (yellow)
          if show-carries {
            if show-colors {
              diagonal-split-box(${cellSize}in, color-tens, color-hundreds)
            } else {
              box(width: ${cellSize}in, height: ${cellSize}in, stroke: 0.5pt)[]
            }
          } else { v(${cellSize}in) },
          // Tens carry box: shows carry FROM ones (blue) TO tens (green)
          if show-carries {
            if show-colors {
              diagonal-split-box(${cellSize}in, color-ones, color-tens)
            } else {
              box(width: ${cellSize}in, height: ${cellSize}in, stroke: 0.5pt)[]
            }
          } else { v(${cellSize}in) },
          [],

          [],
          [],
          box(width: ${cellSize}in, height: ${cellSize}in, fill: if show-colors { color-tens } else { color-none })[#align(center + horizon)[#text(size: ${(cellSize * 0.8 * 72).toFixed(1)}pt)[#str(aT)]]],
          box(width: ${cellSize}in, height: ${cellSize}in, fill: if show-colors { color-ones } else { color-none })[#align(center + horizon)[#text(size: ${(cellSize * 0.8 * 72).toFixed(1)}pt)[#str(aO)]]],

          box(width: ${cellSize}in, height: ${cellSize}in)[#align(center + horizon)[#text(size: ${(cellSize * 0.8 * 72).toFixed(1)}pt)[+]]],
          [],
          box(width: ${cellSize}in, height: ${cellSize}in, fill: if show-colors { color-tens } else { color-none })[#align(center + horizon)[#text(size: ${(cellSize * 0.8 * 72).toFixed(1)}pt)[#str(bT)]]],
          box(width: ${cellSize}in, height: ${cellSize}in, fill: if show-colors { color-ones } else { color-none })[#align(center + horizon)[#text(size: ${(cellSize * 0.8 * 72).toFixed(1)}pt)[#str(bO)]]],

          // Line row
          [],
          line(length: ${cellSize}in, stroke: heavy-stroke),
          line(length: ${cellSize}in, stroke: heavy-stroke),
          line(length: ${cellSize}in, stroke: heavy-stroke),

          // Ten-frames row with overlaid line on top
          // Height calculation: each frame has 2 rows, cell-h = (cell-width/5) [square cells]
          // Total: 4 * cell-h + spacing = 4 * (cell-width/5) = cell-width * 0.8
          // Only add this row if ten-frames are enabled AND this problem needs them
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
                  // Top frame (carry to hundreds) = color-hundreds, Bottom frame (tens) = color-tens
                  // Use place() to overlay the line on top
                  // Add small right margin to create gap between tens and ones ten-frames
                  box(width: ${cellSize}in, height: ${cellSize}in * 0.8)[
                    #align(center + top)[#ten-frames-stacked(${cellSize}in * 0.90, if show-colors { color-hundreds } else { color-none }, if show-colors { color-tens } else { color-none })]
                    #place(top, line(length: ${cellSize}in * 0.90, stroke: heavy-stroke))
                  ]
                  h(2.5pt)  // Small horizontal gap between tens and ones ten-frames
                } else {
                  v(${cellSize}in * 0.8)
                },
                if show-ten-frames-for-all or ones-regroup {
                  // Top frame (carry to tens) = color-tens, Bottom frame (ones) = color-ones
                  // Use place() to overlay the line on top
                  box(width: ${cellSize}in, height: ${cellSize}in * 0.8)[
                    #align(center + top)[#ten-frames-stacked(${cellSize}in * 0.90, if show-colors { color-tens } else { color-none }, if show-colors { color-ones } else { color-none })]
                    #place(top, line(length: ${cellSize}in * 0.90, stroke: heavy-stroke))
                  ]
                } else {
                  v(${cellSize}in * 0.8)
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
          if show-answers { box(width: ${cellSize}in, height: ${cellSize}in, stroke: 0.5pt, fill: if show-colors { color-hundreds } else { color-none })[] } else { v(${cellSize}in) },
          if show-answers { box(width: ${cellSize}in, height: ${cellSize}in, stroke: 0.5pt, fill: if show-colors { color-tens } else { color-none })[] } else { v(${cellSize}in) },
          if show-answers { box(width: ${cellSize}in, height: ${cellSize}in, stroke: 0.5pt, fill: if show-colors { color-ones } else { color-none })[] } else { v(${cellSize}in) },
        )
      )
    ]
  ]
}

#let problems = (
${problemsTypst}
)

// Compact header - name on left, date on right
#grid(
  columns: (1fr, 1fr),
  align: (left, right),
  text(size: 0.75em, weight: "bold")[${config.name}],
  text(size: 0.65em)[${config.date}]
)
#v(${headerHeight}in - 0.25in)

// Problem grid - exactly ${actualRows} rows × ${config.cols} columns
#grid(
  columns: ${config.cols},
  column-gutter: 0pt,
  row-gutter: 0pt,
  stroke: grid-stroke,
  ..for r in range(0, ${actualRows}) {
    for c in range(0, ${config.cols}) {
      let idx = r * ${config.cols} + c
      if idx < problems.len() {
        (problem-box(problems.at(idx), ${problemOffset} + idx),)
      } else {
        (box(width: ${problemBoxWidth}in, height: ${problemBoxHeight}in),)
      }
    }
  }
)

] // End of constrained block
`
}

/**
 * Generate Typst source code for the worksheet (returns array of page sources)
 */
export function generateTypstSource(
  config: WorksheetConfig,
  problems: AdditionProblem[]
): string[] {
  // Use the problemsPerPage directly from config (primary state)
  const problemsPerPage = config.problemsPerPage
  const rowsPerPage = problemsPerPage / config.cols

  // Chunk problems into discrete pages
  const pages = chunkProblems(problems, problemsPerPage)

  // Generate separate Typst source for each page
  return pages.map((pageProblems, pageIndex) =>
    generatePageTypst(config, pageProblems, pageIndex * problemsPerPage, rowsPerPage)
  )
}
