// Typst document generator for addition worksheets

import type { WorksheetConfig, WorksheetProblem } from '@/app/create/worksheets/types'
import { resolveDisplayForProblem } from './displayRules'
import { analyzeProblem, analyzeSubtractionProblem } from './problemAnalysis'
import { generateQRCodeSVG } from './qrCodeGenerator'
import {
  generatePlaceValueColors,
  generateProblemStackFunction,
  generateSubtractionProblemStackFunction,
  generateTypstHelpers,
} from './typstHelpers'

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
    if (problem.operator === 'add') {
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
 * @param qrCodeSvg - Optional raw SVG string for QR code to embed
 * @param shareCode - Optional share code to display under QR code (e.g., "k7mP2qR")
 */
function generatePageTypst(
  config: WorksheetConfig,
  pageProblems: WorksheetProblem[],
  problemOffset: number,
  rowsPerPage: number,
  qrCodeSvg?: string,
  shareCode?: string
): string {
  // Calculate maximum digits for proper column layout
  const maxDigits = calculateMaxDigits(pageProblems)

  // Enrich problems with display options based on mode
  const enrichedProblems = pageProblems.map((p, index) => {
    if (config.mode === 'custom' || config.mode === 'mastery') {
      // Custom & Mastery modes: Per-problem conditional display based on problem complexity
      // Both modes use displayRules for conditional scaffolding
      const meta =
        p.operator === 'add'
          ? analyzeProblem(p.a, p.b)
          : analyzeSubtractionProblem(p.minuend, p.subtrahend)

      // Choose display rules based on operator (for mastery+mixed mode)
      let rulesForProblem = config.displayRules as any

      if (config.mode === 'mastery') {
        const masteryConfig = config as any
        // If we have operator-specific rules (mastery+mixed), use them
        if (p.operator === 'add' && masteryConfig.additionDisplayRules) {
          console.log(
            `[typstGenerator] Problem ${index}: Using additionDisplayRules for ${p.operator} problem`
          )
          rulesForProblem = masteryConfig.additionDisplayRules
        } else if (p.operator === 'sub' && masteryConfig.subtractionDisplayRules) {
          console.log(
            `[typstGenerator] Problem ${index}: Using subtractionDisplayRules for ${p.operator} problem`
          )
          rulesForProblem = masteryConfig.subtractionDisplayRules
        } else {
          console.log(
            `[typstGenerator] Problem ${index}: Using global displayRules for ${p.operator} problem`
          )
        }
      }

      console.log(`[typstGenerator] Problem ${index} display rules:`, {
        operator: p.operator,
        rulesForProblem,
      })

      const displayOptions = resolveDisplayForProblem(rulesForProblem, meta)

      console.log(`[typstGenerator] Problem ${index} resolved display options:`, displayOptions)

      return {
        ...p,
        ...displayOptions, // Now includes showBorrowNotation and showBorrowingHints from resolved rules
      }
    } else {
      // Manual mode: Per-problem conditional display using displayRules (same as Custom/Mastery)
      const meta =
        p.operator === 'add'
          ? analyzeProblem(p.a, p.b)
          : analyzeSubtractionProblem(p.minuend, p.subtrahend)

      const displayOptions = resolveDisplayForProblem(config.displayRules as any, meta)

      return {
        ...p,
        ...displayOptions,
      }
    }
  })

  // Generate Typst problem data with per-problem display flags
  const problemsTypst = enrichedProblems
    .map((p) => {
      if (p.operator === 'add') {
        return `  (operator: "+", a: ${p.a}, b: ${p.b}, showCarryBoxes: ${p.showCarryBoxes}, showAnswerBoxes: ${p.showAnswerBoxes}, showPlaceValueColors: ${p.showPlaceValueColors}, showTenFrames: ${p.showTenFrames}, showProblemNumbers: ${p.showProblemNumbers}, showCellBorder: ${p.showCellBorder}, showBorrowNotation: ${p.showBorrowNotation}, showBorrowingHints: ${p.showBorrowingHints}),`
      } else {
        return `  (operator: "−", minuend: ${p.minuend}, subtrahend: ${p.subtrahend}, showCarryBoxes: ${p.showCarryBoxes}, showAnswerBoxes: ${p.showAnswerBoxes}, showPlaceValueColors: ${p.showPlaceValueColors}, showTenFrames: ${p.showTenFrames}, showProblemNumbers: ${p.showProblemNumbers}, showCellBorder: ${p.showCellBorder}, showBorrowNotation: ${p.showBorrowNotation}, showBorrowingHints: ${p.showBorrowingHints}),`
      }
    })
    .join('\n')

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
          problem.showCarryBoxes,      // show-borrows (whether to show borrow boxes)
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

// Compact header - name on left, date and QR code with share code on right
#grid(
  columns: (1fr, auto, auto),
  column-gutter: 0.15in,
  align: (left, right, right),
  text(size: 0.75em, weight: "bold")[${config.name}],
  text(size: 0.65em)[${config.date}],
  ${
    qrCodeSvg
      ? `stack(dir: ttb, spacing: 2pt, align(center)[#image.decode("${qrCodeSvg.replace(/"/g, '\\"').replace(/\n/g, '')}", width: 0.35in, height: 0.35in)], align(center)[#text(size: 6pt, font: "Courier New")[${shareCode || 'PREVIEW'}]])`
      : `[]`
  }
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
 * Calculate the answer for a problem
 */
function calculateAnswer(problem: WorksheetProblem): number {
  if (problem.operator === 'add') {
    return problem.a + problem.b
  } else {
    return problem.minuend - problem.subtrahend
  }
}

/**
 * Format a problem as a string for the answer key
 * Example: "45 + 27 = 72" or "89 − 34 = 55"
 */
function formatProblemWithAnswer(
  problem: WorksheetProblem,
  index: number,
  showNumber: boolean
): string {
  const answer = calculateAnswer(problem)
  if (problem.operator === 'add') {
    const prefix = showNumber ? `*${index + 1}.* ` : ''
    return `${prefix}${problem.a} + ${problem.b} = *${answer}*`
  } else {
    const prefix = showNumber ? `*${index + 1}.* ` : ''
    return `${prefix}${problem.minuend} − ${problem.subtrahend} = *${answer}*`
  }
}

/**
 * Generate Typst source code for answer key page(s)
 * Displays problems with answers grouped by worksheet page
 * @param qrCodeSvg - Optional raw SVG string for QR code to embed
 * @param shareCode - Optional share code to display under QR code
 */
function generateAnswerKeyTypst(
  config: WorksheetConfig,
  problems: WorksheetProblem[],
  showProblemNumbers: boolean,
  qrCodeSvg?: string,
  shareCode?: string
): string[] {
  const { problemsPerPage } = config
  const worksheetPageCount = Math.ceil(problems.length / problemsPerPage)

  // Group problems by worksheet page
  const worksheetPages: WorksheetProblem[][] = []
  for (let i = 0; i < problems.length; i += problemsPerPage) {
    worksheetPages.push(problems.slice(i, i + problemsPerPage))
  }

  // Generate answer sections for each worksheet page
  // Each section is wrapped in a non-breakable block to keep page answers together
  const generatePageSection = (
    pageProblems: WorksheetProblem[],
    worksheetPageNum: number,
    globalOffset: number
  ): string => {
    const answers = pageProblems
      .map((problem, i) => {
        const globalIndex = globalOffset + i
        return formatProblemWithAnswer(problem, globalIndex, showProblemNumbers)
      })
      .join(' \\\n')

    // Only show page header if there are multiple worksheet pages
    // Wrap in block(breakable: false) to prevent splitting across columns/pages
    if (worksheetPageCount > 1) {
      return `#block(breakable: false)[
  #text(size: 10pt, weight: "bold")[Page ${worksheetPageNum}] \\
  ${answers}
]`
    }
    return answers
  }

  // Generate all page sections
  const allSections = worksheetPages.map((pageProblems, idx) =>
    generatePageSection(pageProblems, idx + 1, idx * problemsPerPage)
  )

  // Combine sections with spacing between page groups
  const combinedAnswers =
    worksheetPageCount > 1 ? allSections.join('\n\n#v(0.5em)\n\n') : allSections[0]

  // For now, generate a single answer key page
  // TODO: If content exceeds page height, could split into multiple pages
  const pageTypst = String.raw`
// answer-key-page.typ (auto-generated)

#set page(
  width: ${config.page.wIn}in,
  height: ${config.page.hIn}in,
  margin: 0.5in,
  fill: white
)
#set text(size: 11pt, font: "New Computer Modern Math")

// Header - matches worksheet header format
#grid(
  columns: (1fr, 1fr),
  align: (left, right),
  text(size: 0.75em, weight: "bold")[${config.name}],
  text(size: 0.65em)[${config.date}]
)
#v(0.15in)
#align(center)[
  #text(size: 14pt, weight: "bold")[Answer Key]
]
#v(0.25in)

// Answers in 3 columns, grouped by worksheet page
#columns(3, gutter: 1.5em)[
  #set par(leading: 0.8em)
  ${combinedAnswers}
]

${
  qrCodeSvg
    ? `// QR code linking to shared worksheet with share code below
#place(bottom + left, dx: 0.1in, dy: -0.1in)[
  #stack(dir: ttb, spacing: 2pt, align(center)[#image.decode("${qrCodeSvg.replace(/"/g, '\\"').replace(/\n/g, '')}", width: 0.5in, height: 0.5in)], align(center)[#text(size: 7pt, font: "Courier New")[${shareCode || 'PREVIEW'}]])
]`
    : ''
}
`

  return [pageTypst]
}

/**
 * Extract share code from a share URL
 * @param shareUrl - Full URL like "https://abaci.one/worksheets/shared/k7mP2qR"
 * @returns The share code (e.g., "k7mP2qR") or undefined
 */
function extractShareCode(shareUrl?: string): string | undefined {
  if (!shareUrl) return undefined
  // URL format: https://abaci.one/worksheets/shared/{shareCode}
  const match = shareUrl.match(/\/worksheets\/shared\/([a-zA-Z0-9]+)$/)
  return match ? match[1] : undefined
}

/**
 * Generate Typst source code for the worksheet (returns array of page sources)
 * @param shareUrl - Optional share URL for QR code embedding (required if config.includeQRCode is true)
 */
export async function generateTypstSource(
  config: WorksheetConfig,
  problems: WorksheetProblem[],
  shareUrl?: string
): Promise<string[]> {
  // Use the problemsPerPage directly from config (primary state)
  const problemsPerPage = config.problemsPerPage
  const rowsPerPage = problemsPerPage / config.cols

  // Generate QR code if enabled and shareUrl is provided
  let qrCodeSvg: string | undefined
  let shareCode: string | undefined
  if (config.includeQRCode && shareUrl) {
    qrCodeSvg = await generateQRCodeSVG(shareUrl, 200) // Higher res for print quality
    shareCode = extractShareCode(shareUrl)
  }

  // Chunk problems into discrete pages
  const pages = chunkProblems(problems, problemsPerPage)

  // Generate separate Typst source for each worksheet page
  const worksheetPages = pages.map((pageProblems, pageIndex) =>
    generatePageTypst(
      config,
      pageProblems,
      pageIndex * problemsPerPage,
      rowsPerPage,
      qrCodeSvg,
      shareCode
    )
  )

  // If answer key is requested, append answer key page(s)
  if (config.includeAnswerKey) {
    // Check if problem numbers are shown (from displayRules)
    const showProblemNumbers = config.displayRules?.problemNumbers !== 'never'
    const answerKeyPages = generateAnswerKeyTypst(
      config,
      problems,
      showProblemNumbers,
      qrCodeSvg,
      shareCode
    )
    return [...worksheetPages, ...answerKeyPages]
  }

  return worksheetPages
}
