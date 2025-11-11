// API route for generating compact addition problem examples for display option previews
//
// REUSABLE FOR BLOG POSTS: The generateExampleTypst function below is also used
// to generate static single-problem examples for blog posts. See:
// - scripts/generateTenFrameExamples.ts for the blog post example generator
// - scripts/generateBlogExamples.ts for difficulty progression examples
//
// This ensures blog post examples use the EXACT same rendering as the live UI preview,
// maintaining consistency between what users see in documentation vs. the actual tool.

import { execSync } from 'child_process'
import { type NextRequest, NextResponse } from 'next/server'
import {
  generateProblems,
  generateSubtractionProblems,
} from '@/app/create/worksheets/problemGenerator'
import type { WorksheetOperator } from '@/app/create/worksheets/types'
import {
  generateProblemStackFunction,
  generateSubtractionProblemStackFunction,
  generateTypstHelpers,
  generatePlaceValueColors,
} from '@/app/create/worksheets/typstHelpers'

export const dynamic = 'force-dynamic'

interface ExampleRequest {
  showCarryBoxes?: boolean
  showAnswerBoxes?: boolean
  showPlaceValueColors?: boolean
  showProblemNumbers?: boolean
  showCellBorder?: boolean
  showTenFrames?: boolean
  showTenFramesForAll?: boolean
  showBorrowNotation?: boolean
  showBorrowingHints?: boolean
  fontSize?: number
  operator?: WorksheetOperator
  // For addition
  addend1?: number
  addend2?: number
  // For subtraction
  minuend?: number
  subtrahend?: number
}

/**
 * Generate a single compact problem example showing the combined display options
 * Uses the EXACT same Typst structure as the full worksheet generator
 */
function generateExampleTypst(config: ExampleRequest): string {
  const operator = config.operator ?? 'addition'
  const fontSize = config.fontSize || 14
  const cellSize = 0.35 // Compact cell size for examples

  // Boolean flags matching worksheet generator
  const showCarries = config.showCarryBoxes ?? false
  const showAnswers = config.showAnswerBoxes ?? false
  const showColors = config.showPlaceValueColors ?? false
  const showNumbers = config.showProblemNumbers ?? false
  const showTenFrames = config.showTenFrames ?? false
  const showTenFramesForAll = config.showTenFramesForAll ?? false
  const showBorrowNotation = config.showBorrowNotation ?? true
  const showBorrowingHints = config.showBorrowingHints ?? false

  if (operator === 'addition') {
    // Use custom addends if provided, otherwise generate a problem
    let a: number
    let b: number

    if (config.addend1 !== undefined && config.addend2 !== undefined) {
      a = config.addend1
      b = config.addend2
    } else {
      // Generate a simple 2-digit + 2-digit problem with carries
      const problems = generateProblems(1, 0.8, 0.5, false, 12345)
      const problem = problems[0]
      a = problem.a
      b = problem.b
    }

    return String.raw`
#set page(width: auto, height: auto, margin: 8pt, fill: white)
#set text(size: ${fontSize}pt, font: "New Computer Modern Math")

#let heavy-stroke = 0.8pt
#let show-carries = ${showCarries ? 'true' : 'false'}
#let show-answers = ${showAnswers ? 'true' : 'false'}
#let show-colors = ${showColors ? 'true' : 'false'}
#let show-numbers = ${showNumbers ? 'true' : 'false'}
#let show-ten-frames = ${showTenFrames ? 'true' : 'false'}
#let show-ten-frames-for-all = ${showTenFramesForAll ? 'true' : 'false'}

${generatePlaceValueColors()}

${generateTypstHelpers(cellSize)}

${generateProblemStackFunction(cellSize, 3)}

#let a = ${a}
#let b = ${b}

#align(center + horizon)[
  #problem-stack(a, b, if show-numbers { 0 } else { none }, show-carries, show-answers, show-colors, show-ten-frames, show-numbers)
]
`
  } else {
    // Subtraction
    let minuend: number
    let subtrahend: number

    if (config.minuend !== undefined && config.subtrahend !== undefined) {
      minuend = config.minuend
      subtrahend = config.subtrahend
    } else {
      // Generate a simple 2-digit - 2-digit problem with borrows
      const digitRange = { min: 2, max: 2 }
      const problems = generateSubtractionProblems(1, digitRange, 0.8, 0.5, false, 12345)
      const problem = problems[0]
      minuend = problem.minuend
      subtrahend = problem.subtrahend
    }

    return String.raw`
#set page(width: auto, height: auto, margin: 8pt, fill: white)
#set text(size: ${fontSize}pt, font: "New Computer Modern Math")

#let heavy-stroke = 0.8pt
#let show-borrows = ${showCarries ? 'true' : 'false'}
#let show-answers = ${showAnswers ? 'true' : 'false'}
#let show-colors = ${showColors ? 'true' : 'false'}
#let show-numbers = ${showNumbers ? 'true' : 'false'}
#let show-ten-frames = ${showTenFrames ? 'true' : 'false'}
#let show-ten-frames-for-all = ${showTenFramesForAll ? 'true' : 'false'}
#let show-borrow-notation = ${showBorrowNotation ? 'true' : 'false'}
#let show-borrowing-hints = ${showBorrowingHints ? 'true' : 'false'}

${generatePlaceValueColors()}

${generateTypstHelpers(cellSize)}

${generateSubtractionProblemStackFunction(cellSize, 3)}

#let minuend = ${minuend}
#let subtrahend = ${subtrahend}

#align(center + horizon)[
  #subtraction-problem-stack(minuend, subtrahend, if show-numbers { 0 } else { none }, show-borrows, show-answers, show-colors, show-ten-frames, show-numbers, show-borrow-notation, show-borrowing-hints)
]
`
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ExampleRequest = await request.json()

    // Generate Typst source with all display options
    const typstSource = generateExampleTypst(body)

    // Compile to SVG
    const svg = execSync('typst compile --format svg - -', {
      input: typstSource,
      encoding: 'utf8',
      maxBuffer: 2 * 1024 * 1024,
    })

    return NextResponse.json({ svg })
  } catch (error) {
    console.error('Error generating example:', error)

    const errorMessage = error instanceof Error ? error.message : String(error)

    return NextResponse.json(
      {
        error: 'Failed to generate example',
        message: errorMessage,
      },
      { status: 500 }
    )
  }
}
