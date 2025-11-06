// Typst document generator for addition worksheets

import type { AdditionProblem, WorksheetConfig } from './types'
import { generateTypstHelpers, generateProblemStackFunction } from './typstHelpers'

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
  // Total with ten-frames: 5.8 rows, reduced breathing room to maximize size
  const cellSize = config.showTenFrames ? problemBoxHeight / 6.0 : problemBoxHeight / 4.5

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

${generateTypstHelpers(cellSize)}

${generateProblemStackFunction(cellSize)}

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
      #problem-stack(a, b, aT, aO, bT, bO, index)
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
