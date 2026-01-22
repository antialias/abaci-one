/**
 * Flowchart Worksheet Generator
 *
 * Server-side generation of PDF worksheets from flowchart examples.
 * Uses Typst for high-quality print-ready output.
 *
 * @module flowcharts/worksheet-generator
 */

import { execSync } from 'child_process'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { getFlowchartByIdAsync } from './definitions'
import { loadFlowchart } from './loader'
import {
  generateDiverseExamples,
  type GeneratedExample,
  DEFAULT_CONSTRAINTS,
} from './example-generator'
import { formatProblemDisplay } from './formatting'
import type { ExecutableFlowchart, ProblemValue } from './schema'
import { evaluateDisplayAnswer } from '../flowchart-workshop/test-case-validator'

// =============================================================================
// Types
// =============================================================================

export interface WorksheetConfig {
  /** Distribution of problems by difficulty tier */
  distribution: {
    easy: number
    medium: number
    hard: number
  }
  /** Total number of problems */
  problemCount: number
  /** Number of pages */
  pageCount: number
  /** Whether to include an answer key */
  includeAnswerKey: boolean
  /** Optional custom title */
  title?: string
  /** Order problems by progressive difficulty (easy → medium → hard) */
  orderByDifficulty?: boolean
}

export interface WorksheetProblem {
  /** Problem values */
  values: Record<string, ProblemValue>
  /** Display string (e.g., "45 − 27") */
  display: string
  /** Difficulty tier */
  tier: 'easy' | 'medium' | 'hard'
  /** Answer (computed from flowchart) - plain text */
  answer: string
  /** Answer formatted as Typst math mode (for PDF answer key) */
  typstAnswer: string
}

// =============================================================================
// Tier Classification
// =============================================================================

/**
 * Get difficulty tier for an example based on its complexity score
 */
function getTier(
  example: GeneratedExample,
  range: { min: number; max: number }
): 'easy' | 'medium' | 'hard' {
  const score = example.complexity.decisions + example.complexity.checkpoints
  if (range.max === range.min) return 'easy'
  const normalized = (score - range.min) / (range.max - range.min)
  if (normalized < 0.25) return 'easy'
  if (normalized < 0.75) return 'medium'
  return 'hard'
}

/**
 * Calculate difficulty range from examples
 */
function calculateDifficultyRange(examples: GeneratedExample[]): { min: number; max: number } {
  if (examples.length === 0) return { min: 0, max: 0 }
  const scores = examples.map((ex) => ex.complexity.decisions + ex.complexity.checkpoints)
  return { min: Math.min(...scores), max: Math.max(...scores) }
}

// =============================================================================
// Problem Selection
// =============================================================================

/**
 * Select problems from examples based on distribution
 */
function selectProblems(
  flowchart: ExecutableFlowchart,
  examples: GeneratedExample[],
  config: WorksheetConfig
): WorksheetProblem[] {
  const range = calculateDifficultyRange(examples)

  // Classify all examples by tier
  const byTier: Record<'easy' | 'medium' | 'hard', GeneratedExample[]> = {
    easy: [],
    medium: [],
    hard: [],
  }

  for (const example of examples) {
    const tier = getTier(example, range)
    byTier[tier].push(example)
  }

  // Shuffle each tier
  for (const tier of ['easy', 'medium', 'hard'] as const) {
    byTier[tier] = shuffleArray(byTier[tier])
  }

  // Calculate how many from each tier
  const targetCounts = {
    easy: Math.round((config.distribution.easy / 100) * config.problemCount),
    hard: Math.round((config.distribution.hard / 100) * config.problemCount),
    medium: 0, // Calculated to make total exact
  }
  targetCounts.medium = config.problemCount - targetCounts.easy - targetCounts.hard

  // Select problems, filling from other tiers if needed
  const selected: WorksheetProblem[] = []
  const remaining: GeneratedExample[] = []

  for (const tier of ['easy', 'medium', 'hard'] as const) {
    const available = byTier[tier]
    const target = targetCounts[tier]
    const toTake = Math.min(target, available.length)

    for (let i = 0; i < toTake; i++) {
      selected.push(exampleToProblem(flowchart, available[i], tier))
    }

    // Save extras for potential fill
    for (let i = toTake; i < available.length; i++) {
      remaining.push(available[i])
    }
  }

  // Fill remaining slots from any tier
  while (selected.length < config.problemCount && remaining.length > 0) {
    const example = remaining.shift()!
    const tier = getTier(example, range)
    selected.push(exampleToProblem(flowchart, example, tier))
  }

  // Either sort by difficulty or shuffle to mix tiers
  if (config.orderByDifficulty) {
    // Sort by tier: easy → medium → hard
    const tierOrder = { easy: 0, medium: 1, hard: 2 }
    return selected.sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier])
  } else {
    // Shuffle to mix tiers randomly
    return shuffleArray(selected)
  }
}

/**
 * Convert an example to a worksheet problem
 */
function exampleToProblem(
  flowchart: ExecutableFlowchart,
  example: GeneratedExample,
  tier: 'easy' | 'medium' | 'hard'
): WorksheetProblem {
  const display = formatProblemDisplay(flowchart, example.values)

  // Use evaluateDisplayAnswer to compute the answer using the flowchart's display.answer
  const { answer: computedAnswer } = evaluateDisplayAnswer(flowchart.definition, example.values)
  const answer = computedAnswer ?? '?'

  // Convert plain text answer to Typst format
  // For fractions (e.g., "3/4" or "2 1/2"), convert to Typst math mode
  const typstAnswer = convertToTypstAnswer(answer)

  return {
    values: example.values,
    display,
    tier,
    answer,
    typstAnswer,
  }
}

/**
 * Convert a plain text answer to Typst math mode format.
 *
 * Handles:
 * - Simple numbers: "42" → "42"
 * - Decimals: "0.375" → "0.375"
 * - Simple fractions: "3/4" → "$frac(3, 4)$"
 * - Mixed numbers: "2 1/2" → "$2 frac(1, 2)$"
 * - Negative fractions: "-3/4" → "$-frac(3, 4)$"
 * - Linear equation answers: "x = 5" → "$x = 5$"
 */
function convertToTypstAnswer(answer: string): string {
  // If it's "?" or empty, return as-is
  if (answer === '?' || !answer) return answer

  // Check for "x = N" pattern (linear equations)
  const xEqualsMatch = answer.match(/^x\s*=\s*(-?\d+(?:\.\d+)?)$/)
  if (xEqualsMatch) {
    return `$x = ${xEqualsMatch[1]}$`
  }

  // Check for mixed number pattern: "N M/D" (e.g., "2 1/2" or "-3 1/4")
  const mixedMatch = answer.match(/^(-?)(\d+)\s+(\d+)\/(\d+)$/)
  if (mixedMatch) {
    const [, sign, whole, num, denom] = mixedMatch
    return `$${sign}${whole} frac(${num}, ${denom})$`
  }

  // Check for simple fraction pattern: "N/D" (e.g., "3/4" or "-1/2")
  const fractionMatch = answer.match(/^(-?)(\d+)\/(\d+)$/)
  if (fractionMatch) {
    const [, sign, num, denom] = fractionMatch
    return `$${sign}frac(${num}, ${denom})$`
  }

  // For simple numbers (integers or decimals), return as-is
  // This handles cases like "42", "0.375", "-7", etc.
  return answer
}

// =============================================================================
// Typst Template Generation
// =============================================================================

/**
 * Generate Typst source for the worksheet
 */
export function generateWorksheetTypst(
  flowchart: ExecutableFlowchart,
  problems: WorksheetProblem[],
  config: WorksheetConfig
): string {
  const title = config.title || flowchart.definition.title
  const problemsPerPage = Math.ceil(problems.length / config.pageCount)
  const schema = flowchart.definition.problemInput.schema

  // Choose formatter based on schema
  const formatProblem = getSchemaFormatter(schema)

  // Split into pages
  const pages: WorksheetProblem[][] = []
  for (let i = 0; i < problems.length; i += problemsPerPage) {
    pages.push(problems.slice(i, i + problemsPerPage))
  }

  // Build Typst source
  let typst = `
#set page(paper: "us-letter", margin: (x: 0.5in, y: 0.75in))
#set text(size: 11pt)

// Title
#align(center)[
  #text(size: 22pt, weight: "bold")[${escapeTypst(title)}]
  #v(0.1in)
  #text(size: 10pt, fill: rgb("#666666"))[Practice Worksheet]
]

#v(0.3in)

// Name line
#grid(
  columns: (auto, 1fr),
  gutter: 0.3in,
  [*Name:*],
  [#line(length: 100%, stroke: 0.5pt + rgb("#cccccc"))]
)

#v(0.4in)
`

  // Problem pages
  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const pageProblems = pages[pageIdx]

    if (pageIdx > 0) {
      typst += `\n#pagebreak()\n\n`
    }

    // Determine grid layout based on problem count per page
    const cols = pageProblems.length <= 8 ? 2 : 3
    const cellWidth = cols === 2 ? '45%' : '30%'

    typst += `
// Problem Grid - Page ${pageIdx + 1}
#grid(
  columns: (${Array(cols).fill(cellWidth).join(', ')}),
  gutter: 0.3in,
  row-gutter: 0.5in,
`

    for (let i = 0; i < pageProblems.length; i++) {
      const problem = pageProblems[i]
      const problemNum = pageIdx * problemsPerPage + i + 1

      // Get difficulty indicator
      const difficultyDot = getDifficultyDot(problem.tier)

      typst += `
  // Problem ${problemNum}
  [
    #align(center)[
      #box(
        stroke: 1pt + rgb("#e5e7eb"),
        radius: 8pt,
        inset: 12pt,
        width: 100%,
      )[
        #grid(
          columns: (auto, 1fr, auto),
          align: (left, center, right),
          [#text(size: 9pt, fill: rgb("#9ca3af"))[${problemNum}.]],
          [],
          [${difficultyDot}]
        )
        #v(0.15in)
        ${formatProblem(problem)}
        #v(0.2in)
        #line(length: 60%, stroke: 0.5pt + rgb("#d1d5db"))
      ]
    ]
  ],
`
    }

    typst += `)\n`
  }

  // Answer key
  if (config.includeAnswerKey) {
    typst += `
#pagebreak()

// Answer Key
#align(center)[
  #text(size: 18pt, weight: "bold")[Answer Key]
]

#v(0.3in)

#grid(
  columns: (1fr, 1fr, 1fr, 1fr),
  gutter: 0.2in,
`

    for (let i = 0; i < problems.length; i++) {
      const problem = problems[i]
      // Use typstAnswer for proper fraction rendering in the PDF
      typst += `
  [
    #text(size: 10pt)[
      *${i + 1}.* ${problem.typstAnswer}
    ]
  ],
`
    }

    typst += `)\n`
  }

  // Footer
  typst += `
#v(1fr)
#align(center)[
  #text(size: 8pt, fill: rgb("#9ca3af"))[
    Generated by abaci.one
  ]
]
`

  return typst
}

/**
 * Get schema-specific problem formatter
 */
function getSchemaFormatter(schema: string): (problem: WorksheetProblem) => string {
  switch (schema) {
    case 'two-digit-subtraction':
      return formatSubtractionProblem
    case 'two-fractions-with-op':
      return formatFractionProblem
    case 'linear-equation':
      return formatLinearEquationProblem
    default:
      return formatGenericProblem
  }
}

/**
 * Format a subtraction problem as vertical stack
 */
function formatSubtractionProblem(problem: WorksheetProblem): string {
  const minuend = problem.values.minuend as number
  const subtrahend = problem.values.subtrahend as number

  return `
        #align(center)[
          #stack(
            dir: ttb,
            spacing: 4pt,
            align(right)[#text(size: 18pt)[${minuend}]],
            align(right)[
              #text(size: 18pt)[−]#h(0.1in)#text(size: 18pt)[${subtrahend}]
            ],
            line(length: 50pt, stroke: 1.5pt),
          )
        ]
`
}

/**
 * Format a fraction problem
 */
function formatFractionProblem(problem: WorksheetProblem): string {
  const leftWhole = (problem.values.leftWhole as number) || 0
  const leftNum = (problem.values.leftNum as number) || 0
  const leftDenom = (problem.values.leftDenom as number) || 1
  const rightWhole = (problem.values.rightWhole as number) || 0
  const rightNum = (problem.values.rightNum as number) || 0
  const rightDenom = (problem.values.rightDenom as number) || 1
  const op = problem.values.op as string

  // Helper to format a mixed number or fraction in Typst math mode
  // In math mode, use frac(num, denom) without the # prefix
  const formatMixed = (whole: number, num: number, denom: number) => {
    if (whole > 0 && num > 0) {
      return `${whole} frac(${num}, ${denom})`
    } else if (whole > 0) {
      return `${whole}`
    } else if (num > 0) {
      return `frac(${num}, ${denom})`
    } else {
      return `0`
    }
  }

  const left = formatMixed(leftWhole, leftNum, leftDenom)
  const right = formatMixed(rightWhole, rightNum, rightDenom)
  const opSymbol = op === '+' ? '+' : '-'

  return `
        #align(center)[
          #text(size: 16pt)[
            $${left} ${opSymbol} ${right} = $
            #box(width: 40pt, stroke: (bottom: 0.5pt))
          ]
        ]
`
}

/**
 * Format a linear equation problem
 */
function formatLinearEquationProblem(problem: WorksheetProblem): string {
  const coefficient = problem.values.coefficient as number
  const operation = problem.values.operation as string
  const constant = problem.values.constant as number
  const equals = problem.values.equals as number

  const opSymbol = operation === '+' ? '+' : '−'
  const coeffStr = coefficient === 1 ? '' : String(coefficient)

  return `
        #align(center)[
          #text(size: 16pt)[
            $${coeffStr}x ${opSymbol} ${constant} = ${equals}$
          ]
          #v(0.15in)
          #text(size: 12pt)[$x = $]
          #box(width: 40pt, stroke: (bottom: 0.5pt))
        ]
`
}

/**
 * Format a generic problem (fallback)
 */
function formatGenericProblem(problem: WorksheetProblem): string {
  return `
        #align(center)[
          #text(size: 16pt)[${escapeTypst(problem.display)}]
          #v(0.2in)
          #box(width: 60pt, stroke: (bottom: 0.5pt))
        ]
`
}

/**
 * Get difficulty indicator dot in Typst
 */
function getDifficultyDot(tier: 'easy' | 'medium' | 'hard'): string {
  const colors = {
    easy: '#10b981', // emerald-500
    medium: '#f59e0b', // amber-500
    hard: '#ef4444', // red-500
  }
  return `#circle(radius: 3pt, fill: rgb("${colors[tier]}"))`
}

// =============================================================================
// PDF Generation
// =============================================================================

/**
 * Generate a worksheet PDF from a flowchart ID
 *
 * @param flowchartId - ID of the flowchart (database or hardcoded)
 * @param config - Worksheet configuration
 * @returns PDF buffer
 */
export async function generateWorksheetPDF(
  flowchartId: string,
  config: WorksheetConfig
): Promise<Buffer> {
  // Load flowchart
  const flowchartData = await getFlowchartByIdAsync(flowchartId)
  if (!flowchartData) {
    throw new Error(`Flowchart not found: ${flowchartId}`)
  }

  const flowchart = await loadFlowchart(flowchartData.definition, flowchartData.mermaid)

  return generateWorksheetPDFFromFlowchart(flowchart, config)
}

/**
 * Generate a worksheet PDF from an ExecutableFlowchart directly
 *
 * This is useful for workshop drafts that haven't been saved to the database yet.
 *
 * @param flowchart - The executable flowchart
 * @param config - Worksheet configuration
 * @returns PDF buffer
 */
export async function generateWorksheetPDFFromFlowchart(
  flowchart: ExecutableFlowchart,
  config: WorksheetConfig
): Promise<Buffer> {
  // Generate examples
  const exampleCount = Math.max(config.problemCount * 3, 100) // Generate extra for variety
  const examples = generateDiverseExamples(flowchart, exampleCount, DEFAULT_CONSTRAINTS)

  if (examples.length === 0) {
    throw new Error('Could not generate any examples for this flowchart')
  }

  // Select problems
  const problems = selectProblems(flowchart, examples, config)

  if (problems.length < config.problemCount) {
    console.warn(
      `Could only generate ${problems.length} problems (requested ${config.problemCount})`
    )
  }

  // Generate Typst
  const typstSource = generateWorksheetTypst(flowchart, problems, config)

  // Compile to PDF
  const tmpDir = os.tmpdir()
  const timestamp = Date.now()
  const typstFile = path.join(tmpDir, `worksheet-${timestamp}.typ`)
  const pdfFile = path.join(tmpDir, `worksheet-${timestamp}.pdf`)

  try {
    await fs.writeFile(typstFile, typstSource, 'utf-8')

    execSync(`typst compile "${typstFile}" "${pdfFile}"`, {
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const pdfBuffer = await fs.readFile(pdfFile)
    return pdfBuffer
  } finally {
    // Cleanup
    try {
      await fs.unlink(typstFile)
    } catch {
      // Ignore
    }
    try {
      await fs.unlink(pdfFile)
    } catch {
      // Ignore
    }
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/** Shuffle array in place (Fisher-Yates) */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** Escape special characters for Typst */
function escapeTypst(str: string): string {
  return str.replace(/[#$@\\]/g, '\\$&').replace(/"/g, '\\"')
}
