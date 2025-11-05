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
  rowsPerPage: number,
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
  const gutterSize = 0.15 // inches between items
  const gutterHeightTotal = gutterSize * (actualRows - 1)
  const problemBoxHeight = (availableHeight - gutterHeightTotal) / actualRows

  const gutterWidthTotal = gutterSize * (config.cols - 1)
  const problemBoxWidth = (contentWidth - gutterWidthTotal) / config.cols

  // Calculate cell size to fit within problem box
  // Problem has 5 rows: carry boxes, first number, second number, line, answer boxes
  // Reserve space for problem number and insets
  const problemNumberHeight = 0.15
  const insetTotal = 0.05 * 2
  const availableCellHeight = problemBoxHeight - problemNumberHeight - insetTotal
  const cellSize = availableCellHeight / 5 // 5 rows in the grid, no max cap

  return String.raw`
// addition-worksheet-page.typ (auto-generated)

#set page(
  width: ${config.page.wIn}in,
  height: ${config.page.hIn}in,
  margin: ${margin}in,
  fill: white
)
#set text(size: ${config.fontSize}pt)

// Single non-breakable block to ensure one page
#block(breakable: false)[

#let cell-outline = ${config.showCellBorder ? '0.6pt' : 'none'}
#let heavy-stroke = 0.8pt
#let show-carries = ${config.showCarryBoxes ? 'true' : 'false'}

#let problem-box(problem, index) = {
  let a = problem.a
  let b = problem.b
  let aT = calc.floor(calc.rem(a, 100) / 10)
  let aO = calc.rem(a, 10)
  let bT = calc.floor(calc.rem(b, 100) / 10)
  let bO = calc.rem(b, 10)

  box(
    stroke: cell-outline,
    inset: 0.05in,
    width: ${problemBoxWidth}in,
    height: ${problemBoxHeight}in
  )[
    #align(center + horizon)[
      #block[
        #align(top + left)[
          #text(size: 0.5em, weight: "bold")[\##(index + 1).]
        ]

        #grid(
          columns: (0.5em, ${cellSize}in, ${cellSize}in, ${cellSize}in),
          gutter: 0pt,

          [],
          if show-carries { box(width: ${cellSize}in, height: ${cellSize}in, stroke: 0.5pt)[] } else { v(${cellSize}in) },
          if show-carries { box(width: ${cellSize}in, height: ${cellSize}in, stroke: 0.5pt)[] } else { v(${cellSize}in) },
          [],

          [],
          [],
          box(width: ${cellSize}in, height: ${cellSize}in)[#align(center + horizon)[#text(size: 1em)[#str(aT)]]],
          box(width: ${cellSize}in, height: ${cellSize}in)[#align(center + horizon)[#text(size: 1em)[#str(aO)]]],

          box(width: ${cellSize}in, height: ${cellSize}in)[#align(center + horizon)[#text(size: 1em)[+]]],
          [],
          box(width: ${cellSize}in, height: ${cellSize}in)[#align(center + horizon)[#text(size: 1em)[#str(bT)]]],
          box(width: ${cellSize}in, height: ${cellSize}in)[#align(center + horizon)[#text(size: 1em)[#str(bO)]]],

          [],
          line(length: ${cellSize}in, stroke: heavy-stroke),
          line(length: ${cellSize}in, stroke: heavy-stroke),
          line(length: ${cellSize}in, stroke: heavy-stroke),

          [],
          box(width: ${cellSize}in, height: ${cellSize}in, stroke: 0.5pt)[],
          box(width: ${cellSize}in, height: ${cellSize}in, stroke: 0.5pt)[],
          box(width: ${cellSize}in, height: ${cellSize}in, stroke: 0.5pt)[],
        )
      ]
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
  column-gutter: ${gutterSize}in,
  row-gutter: ${gutterSize}in,
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
export function generateTypstSource(config: WorksheetConfig, problems: AdditionProblem[]): string[] {
  // Determine rows per page based on orientation (portrait = tall, landscape = wide)
  const isPortrait = config.page.hIn > config.page.wIn
  const rowsPerPage = isPortrait ? 5 : 2
  const problemsPerPage = config.cols * rowsPerPage

  // Chunk problems into discrete pages
  const pages = chunkProblems(problems, problemsPerPage)

  // Generate separate Typst source for each page
  return pages.map((pageProblems, pageIndex) =>
    generatePageTypst(config, pageProblems, pageIndex * problemsPerPage, rowsPerPage),
  )
}
