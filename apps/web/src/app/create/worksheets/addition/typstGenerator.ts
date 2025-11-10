// Typst document generator for addition worksheets

import type { WorksheetProblem, WorksheetConfig } from './types'
import {
  generateTypstHelpers,
  generateProblemStackFunction,
  generateSubtractionProblemStackFunction,
  generatePlaceValueColors,
} from './typstHelpers'
import { analyzeProblem, analyzeSubtractionProblem } from './problemAnalysis'
import { resolveDisplayForProblem } from './displayRules'

/**
 * Chunk array into pages of specified size
 */
function chunkProblems(problems: WorksheetProblem[], pageSize: number): WorksheetProblem[][] {
  const pages: WorksheetProblem[][] = []
  for (let i = 0; i < problems.length; i += pageSize) {
    pages.push(problems.slice(i, i + pageSize))
  }
  return pages
}

/**
 * Calculate maximum number of digits in any problem on this page
 * Returns max digits across all operands (handles both addition and subtraction)
 */
function calculateMaxDigits(problems: WorksheetProblem[]): number {
  let maxDigits = 1
  for (const problem of problems) {
    if (problem.operator === '+') {
      const digitsA = problem.a.toString().length
      const digitsB = problem.b.toString().length
      const maxProblemDigits = Math.max(digitsA, digitsB)
      maxDigits = Math.max(maxDigits, maxProblemDigits)
    } else {
      // Subtraction
      const digitsMinuend = problem.minuend.toString().length
      const digitsSubtrahend = problem.subtrahend.toString().length
      const maxProblemDigits = Math.max(digitsMinuend, digitsSubtrahend)
      maxDigits = Math.max(maxDigits, maxProblemDigits)
    }
  }
  return maxDigits
}

/**
 * Generate Typst source code for a single page
 */
function generatePageTypst(
  config: WorksheetConfig,
  pageProblems: WorksheetProblem[],
  problemOffset: number,
  rowsPerPage: number
): string {
  // Calculate maximum digits for proper column layout
  const maxDigits = calculateMaxDigits(pageProblems)

  // Enrich problems with display options based on mode
  const enrichedProblems = pageProblems.map((p, index) => {
    if (config.mode === 'smart' || config.mode === 'mastery') {
      // Smart & Mastery modes: Per-problem conditional display based on problem complexity
      // Both modes use displayRules for conditional scaffolding
      const meta =
        p.operator === '+'
          ? analyzeProblem(p.a, p.b)
          : analyzeSubtractionProblem(p.minuend, p.subtrahend)

      // Choose display rules based on operator (for mastery+mixed mode)
      let rulesForProblem = config.displayRules as any

      if (config.mode === 'mastery') {
        const masteryConfig = config as any
        // If we have operator-specific rules (mastery+mixed), use them
        if (p.operator === '+' && masteryConfig.additionDisplayRules) {
          rulesForProblem = masteryConfig.additionDisplayRules
          console.log(
            `[TYPST PROBLEM ${index}] Using additionDisplayRules for ${p.a} + ${p.b}`,
            rulesForProblem
          )
        } else if (p.operator === '-' && masteryConfig.subtractionDisplayRules) {
          rulesForProblem = masteryConfig.subtractionDisplayRules
          console.log(
            `[TYPST PROBLEM ${index}] Using subtractionDisplayRules for ${p.minuend} - ${p.subtrahend}`,
            rulesForProblem
          )
        }
      }

      const displayOptions = resolveDisplayForProblem(rulesForProblem, meta)

      if (p.operator === '-') {
        console.log(`[TYPST PROBLEM ${index}] Subtraction resolved display:`, {
          problem: `${p.minuend} - ${p.subtrahend}`,
          meta,
          rulesUsed: rulesForProblem,
          resolved: displayOptions,
        })
      }

      return {
        ...p,
        ...displayOptions, // Now includes showBorrowNotation and showBorrowingHints from resolved rules
      }
    } else {
      // Manual mode: Uniform display across all problems using boolean flags
      return {
        ...p,
        showCarryBoxes: config.showCarryBoxes,
        showAnswerBoxes: config.showAnswerBoxes,
        showPlaceValueColors: config.showPlaceValueColors,
        showTenFrames: config.showTenFrames,
        showProblemNumbers: config.showProblemNumbers,
        showCellBorder: config.showCellBorder,
        showBorrowNotation: 'showBorrowNotation' in config ? config.showBorrowNotation : true,
        showBorrowingHints: 'showBorrowingHints' in config ? config.showBorrowingHints : false,
      }
    }
  })

  // DEBUG: Show first 3 problems' ten-frames status
  console.log(
    '[TYPST DEBUG] First 3 enriched problems:',
    enrichedProblems.slice(0, 3).map((p, i) => ({
      index: i,
      problem: p.operator === '+' ? `${p.a} + ${p.b}` : `${p.minuend} − ${p.subtrahend}`,
      showTenFrames: p.showTenFrames,
    }))
  )

  // Generate Typst problem data with per-problem display flags
  const problemsTypst = enrichedProblems
    .map((p) => {
      if (p.operator === '+') {
        return `  (operator: "+", a: ${p.a}, b: ${p.b}, showCarryBoxes: ${p.showCarryBoxes}, showAnswerBoxes: ${p.showAnswerBoxes}, showPlaceValueColors: ${p.showPlaceValueColors}, showTenFrames: ${p.showTenFrames}, showProblemNumbers: ${p.showProblemNumbers}, showCellBorder: ${p.showCellBorder}, showBorrowNotation: ${p.showBorrowNotation}, showBorrowingHints: ${p.showBorrowingHints}),`
      } else {
        return `  (operator: "−", minuend: ${p.minuend}, subtrahend: ${p.subtrahend}, showCarryBoxes: ${p.showCarryBoxes}, showAnswerBoxes: ${p.showAnswerBoxes}, showPlaceValueColors: ${p.showPlaceValueColors}, showTenFrames: ${p.showTenFrames}, showProblemNumbers: ${p.showProblemNumbers}, showCellBorder: ${p.showCellBorder}, showBorrowNotation: ${p.showBorrowNotation}, showBorrowingHints: ${p.showBorrowingHints}),`
      }
    })
    .join('\n')

  // DEBUG: Show Typst problem data for first problem
  console.log('[TYPST DEBUG] First problem Typst data:', problemsTypst.split('\n')[0])

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

  // Calculate cell size assuming MAXIMUM possible embellishments
  // Check if ANY problem on this page might show ten-frames
  const anyProblemMayShowTenFrames = enrichedProblems.some((p) => p.showTenFrames)

  // Calculate cell size to fill the entire problem box
  // Base vertical stack: carry row + addend1 + addend2 + line + answer = 5 rows
  // With ten-frames: add 0.8 * cellSize row
  // Total with ten-frames: ~5.8 rows
  //
  // Horizontal constraint: maxDigits columns + 1 for + sign
  // Cell size must fit: (maxDigits + 1) * cellSize <= problemBoxWidth
  const maxCellSizeForWidth = problemBoxWidth / (maxDigits + 1)
  const maxCellSizeForHeight = anyProblemMayShowTenFrames
    ? problemBoxHeight / 6.0
    : problemBoxHeight / 4.5

  // Use the smaller of width/height constraints
  const cellSize = Math.min(maxCellSizeForWidth, maxCellSizeForHeight)

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

#let heavy-stroke = 0.8pt
#let show-ten-frames-for-all = ${
    config.mode === 'manual'
      ? config.showTenFramesForAll
        ? 'true'
        : 'false'
      : config.displayRules.tenFrames === 'always'
        ? 'true'
        : 'false'
  }

${generatePlaceValueColors()}

${generateTypstHelpers(cellSize)}

${generateProblemStackFunction(cellSize, maxDigits)}

${generateSubtractionProblemStackFunction(cellSize, maxDigits)}

#let problem-box(problem, index) = {
  // Extract per-problem display flags
  let grid-stroke = if problem.showCellBorder { (thickness: 1pt, dash: "dashed", paint: gray.darken(20%)) } else { none }

  box(
    inset: 0pt,
    width: ${problemBoxWidth}in,
    height: ${problemBoxHeight}in,
    stroke: grid-stroke
  )[
    #align(center + horizon)[
      #if problem.operator == "+" {
        problem-stack(
          problem.a, problem.b, index,
          problem.showCarryBoxes,
          problem.showAnswerBoxes,
          problem.showPlaceValueColors,
          problem.showTenFrames,
          problem.showProblemNumbers
        )
      } else {
        subtraction-problem-stack(
          problem.minuend, problem.subtrahend, index,
          problem.showBorrowNotation,  // show-borrows (whether to show borrow boxes)
          problem.showAnswerBoxes,
          problem.showPlaceValueColors,
          problem.showTenFrames,
          problem.showProblemNumbers,
          problem.showBorrowNotation,  // show-borrow-notation (scratch work boxes in minuend)
          problem.showBorrowingHints   // show-borrowing-hints (hints with arrows)
        )
      }
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
  problems: WorksheetProblem[]
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
