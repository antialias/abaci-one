// API route for generating compact addition problem examples for display option previews

import { type NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { generateProblems } from '@/app/create/worksheets/addition/problemGenerator'
import {
  generateTypstHelpers,
  generateProblemStackFunction,
} from '@/app/create/worksheets/addition/typstHelpers'

export const dynamic = 'force-dynamic'

interface ExampleRequest {
  showCarryBoxes?: boolean
  showAnswerBoxes?: boolean
  showPlaceValueColors?: boolean
  showProblemNumbers?: boolean
  showCellBorder?: boolean
  showTenFrames?: boolean
  showTenFramesForAll?: boolean
  fontSize?: number
}

/**
 * Generate a single compact problem example showing the combined display options
 * Uses the EXACT same Typst structure as the full worksheet generator
 */
function generateExampleTypst(config: ExampleRequest): string {
  // Generate a simple 2-digit + 2-digit problem with carries
  const problems = generateProblems(1, 0.8, 0.5, false, 12345)
  const problem = problems[0]

  const fontSize = config.fontSize || 14
  const cellSize = 0.35 // Compact cell size for examples

  // Boolean flags matching worksheet generator
  const showCarries = config.showCarryBoxes ?? false
  const showAnswers = config.showAnswerBoxes ?? false
  const showColors = config.showPlaceValueColors ?? false
  const showNumbers = config.showProblemNumbers ?? false
  const showTenFrames = config.showTenFrames ?? false
  const showTenFramesForAll = config.showTenFramesForAll ?? false

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

${generateTypstHelpers(cellSize)}

${generateProblemStackFunction(cellSize)}

#let a = ${problem.a}
#let b = ${problem.b}
#let aT = calc.floor(calc.rem(a, 100) / 10)
#let aO = calc.rem(a, 10)
#let bT = calc.floor(calc.rem(b, 100) / 10)
#let bO = calc.rem(b, 10)

#align(center + horizon)[
  #problem-stack(a, b, aT, aO, bT, bO, if show-numbers { 0 } else { none })
]
`
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
