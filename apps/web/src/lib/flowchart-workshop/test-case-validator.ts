/**
 * Test Case Validator for Flowchart Workshop
 *
 * Validates that display.answer produces the expected output for each test case.
 * This catches bugs like "4 1/1" instead of "5" before users encounter them.
 *
 * @module flowchart-workshop/test-case-validator
 */

import type {
  FlowchartDefinition,
  ProblemExample,
  ProblemValue,
  VariableDefinition,
} from '../flowcharts/schema'
import { evaluate, type EvalContext } from '../flowcharts/evaluator'
import { analyzeFlowchart, type FlowchartPath } from '../flowcharts/path-analysis'
import type { ExecutableFlowchart } from '../flowcharts/schema'
import { loadFlowchart } from '../flowcharts/loader'

// =============================================================================
// Types
// =============================================================================

/**
 * Result of running a single test case
 */
export interface TestResult {
  /** The example that was tested */
  example: ProblemExample
  /** The actual answer produced by display.answer */
  actualAnswer: string | null
  /** The expected answer from the test case */
  expectedAnswer: string
  /** Whether the test passed (actual === expected after trim) */
  passed: boolean
  /** Error message if evaluation failed */
  error?: string
}

/**
 * Report of path coverage by test cases
 */
export interface CoverageReport {
  /** Total number of unique paths through the flowchart */
  totalPaths: number
  /** Number of paths covered by at least one test case */
  coveredPaths: number
  /** Descriptions of paths not covered by any test */
  uncoveredPaths: string[]
  /** Percentage of paths covered */
  coveragePercent: number
}

/**
 * Complete validation report
 */
export interface ValidationReport {
  /** Whether all tests passed */
  passed: boolean
  /** Results for each test case */
  results: TestResult[]
  /** Path coverage information */
  coverage: CoverageReport
  /** Summary counts */
  summary: {
    total: number
    passed: number
    failed: number
    errors: number
  }
}

// =============================================================================
// Core Validation Functions
// =============================================================================

/**
 * Normalize example values to fix common LLM output issues:
 * 1. Convert string numbers to actual numbers ("1" -> 1)
 * 2. Strip wrapper quotes from strings ("'+'" -> "+")
 */
function normalizeExampleValues(
  values: Record<string, ProblemValue>
): Record<string, ProblemValue> {
  const normalized: Record<string, ProblemValue> = {}
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'string') {
      let processed = value.trim()

      // Strip wrapper quotes if present (LLM sometimes outputs "'+'" instead of "+")
      // Handles both single quotes ('x') and double quotes ("x")
      if (
        (processed.startsWith("'") && processed.endsWith("'")) ||
        (processed.startsWith('"') && processed.endsWith('"'))
      ) {
        processed = processed.slice(1, -1)
      }

      // Check if it's a valid number (integer or decimal)
      if (processed !== '' && !isNaN(Number(processed))) {
        normalized[key] = Number(processed)
      } else {
        normalized[key] = processed
      }
    } else {
      normalized[key] = value
    }
  }
  return normalized
}

/**
 * Initialize computed variables for a given set of problem values.
 * This mimics what the flowchart walker does at runtime.
 */
function initializeComputed(
  variables: Record<string, VariableDefinition>,
  problemValues: Record<string, ProblemValue>
): Record<string, ProblemValue> {
  const computed: Record<string, ProblemValue> = {}
  const context: EvalContext = {
    problem: problemValues,
    computed,
    userState: {},
  }

  // Initialize variables in order (earlier ones can reference earlier ones)
  for (const [name, def] of Object.entries(variables)) {
    try {
      computed[name] = evaluate(def.init, context)
    } catch (err) {
      // If a variable fails to initialize, set it to null and continue
      console.warn(`Failed to initialize variable ${name}:`, err)
      computed[name] = null as unknown as ProblemValue
    }
  }

  return computed
}

/**
 * Evaluate display.answer for a given set of problem values.
 * This is THE canonical function for computing answers from flowcharts.
 * Used by both worksheet generation and test validation.
 *
 * @param definition - The flowchart definition
 * @param exampleValues - Problem input values (will be normalized)
 * @returns The answer string and optional error
 */
export function evaluateDisplayAnswer(
  definition: FlowchartDefinition,
  exampleValues: Record<string, ProblemValue>
): { answer: string | null; error?: string } {
  // Normalize values - convert string numbers to actual numbers,
  // strip wrapper quotes from strings (LLM sometimes outputs "'+'" instead of "+")
  const normalizedValues = normalizeExampleValues(exampleValues)

  // display.answer is required for all flowcharts
  if (!definition.display?.answer) {
    return { answer: null, error: 'No display.answer defined' }
  }

  try {
    // Initialize computed variables
    const computed = initializeComputed(definition.variables, normalizedValues)

    // Create evaluation context
    const context: EvalContext = {
      problem: normalizedValues,
      computed,
      userState: {},
    }

    // Evaluate display.answer
    const result = evaluate(definition.display.answer, context)
    return { answer: String(result) }
  } catch (err) {
    return {
      answer: null,
      error: err instanceof Error ? err.message : 'Evaluation failed',
    }
  }
}

/**
 * Run a single test case and return the result
 * Uses FlowchartDefinition only - for quick validation without full flowchart
 */
export function runTestCase(definition: FlowchartDefinition, example: ProblemExample): TestResult {
  if (!example.expectedAnswer) {
    return {
      example,
      actualAnswer: null,
      expectedAnswer: '',
      passed: false,
      error: 'No expectedAnswer defined for this test case',
    }
  }

  const { answer, error } = evaluateDisplayAnswer(definition, example.values)

  if (error) {
    return {
      example,
      actualAnswer: null,
      expectedAnswer: example.expectedAnswer,
      passed: false,
      error,
    }
  }

  // Compare after trimming whitespace
  const normalizedActual = answer?.trim() ?? ''
  const normalizedExpected = example.expectedAnswer.trim()
  const passed = normalizedActual === normalizedExpected

  return {
    example,
    actualAnswer: answer,
    expectedAnswer: example.expectedAnswer,
    passed,
  }
}

/**
 * Run a single test case using an ExecutableFlowchart.
 * Uses evaluateDisplayAnswer - the canonical answer computation function.
 */
export function runTestCaseWithFlowchart(
  flowchart: ExecutableFlowchart,
  example: ProblemExample
): TestResult {
  if (!example.expectedAnswer) {
    return {
      example,
      actualAnswer: null,
      expectedAnswer: '',
      passed: false,
      error: 'No expectedAnswer defined for this test case',
    }
  }

  // Use evaluateDisplayAnswer - handles normalization internally
  const { answer, error } = evaluateDisplayAnswer(flowchart.definition, example.values)

  if (error) {
    return {
      example,
      actualAnswer: null,
      expectedAnswer: example.expectedAnswer,
      passed: false,
      error,
    }
  }

  // Compare after trimming whitespace
  const normalizedActual = answer?.trim() ?? ''
  const normalizedExpected = example.expectedAnswer.trim()
  const passed = normalizedActual === normalizedExpected

  return {
    example,
    actualAnswer: answer,
    expectedAnswer: example.expectedAnswer,
    passed,
  }
}

/**
 * Run all test cases for a flowchart definition
 */
export function validateTestCases(definition: FlowchartDefinition): ValidationReport {
  const examples = definition.problemInput.examples || []
  const results: TestResult[] = []

  // Run each test case that has an expectedAnswer
  for (const example of examples) {
    if (example.expectedAnswer) {
      results.push(runTestCase(definition, example))
    }
  }

  // Calculate summary
  const summary = {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed && !r.error).length,
    errors: results.filter((r) => r.error).length,
  }

  // Calculate coverage (simplified - we'll enhance this when we have an executable flowchart)
  const coverage: CoverageReport = {
    totalPaths: 0,
    coveredPaths: 0,
    uncoveredPaths: [],
    coveragePercent: 0,
  }

  return {
    passed: results.every((r) => r.passed),
    results,
    coverage,
    summary,
  }
}

/**
 * Validate test cases with full coverage analysis.
 * Uses evaluateDisplayAnswer for validation - the same function
 * that worksheet generation uses to compute answers.
 */
export async function validateTestCasesWithCoverage(
  definition: FlowchartDefinition,
  mermaidContent: string
): Promise<ValidationReport> {
  // Try to build executable flowchart for accurate validation
  try {
    const flowchart = await loadFlowchart(definition, mermaidContent)
    const examples = definition.problemInput.examples || []

    // Run tests using the SAME code path as worksheet generation
    const results: TestResult[] = []
    for (const example of examples) {
      if (example.expectedAnswer) {
        results.push(runTestCaseWithFlowchart(flowchart, example))
      }
    }

    // Calculate summary
    const summary = {
      total: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed && !r.error).length,
      errors: results.filter((r) => r.error).length,
    }

    // Calculate coverage
    const coverage = await checkCoverage(flowchart, examples)

    return {
      passed: results.every((r) => r.passed),
      results,
      coverage,
      summary,
    }
  } catch (err) {
    // If we can't build the flowchart, fall back to basic validation
    console.warn('Could not build flowchart for accurate validation:', err)
    return validateTestCases(definition)
  }
}

/**
 * Check test coverage against enumerated paths
 */
export async function checkCoverage(
  flowchart: ExecutableFlowchart,
  examples: ProblemExample[]
): Promise<CoverageReport> {
  // Get all paths through the flowchart
  const analysis = analyzeFlowchart(flowchart)
  const paths = analysis.paths

  // Track which paths are covered
  const coveredPathIndices = new Set<number>()

  // For each example with expectedAnswer, trace its path through the flowchart
  for (const example of examples) {
    if (!example.expectedAnswer) continue

    // Trace the path this example would take
    const pathIndex = findMatchingPath(flowchart, example, paths)
    if (pathIndex !== -1) {
      coveredPathIndices.add(pathIndex)
    }
  }

  // Build list of uncovered path descriptions
  const uncoveredPaths: string[] = []
  for (let i = 0; i < paths.length; i++) {
    if (!coveredPathIndices.has(i)) {
      uncoveredPaths.push(describeFlowchartPath(paths[i], flowchart))
    }
  }

  const totalPaths = paths.length
  const coveredPaths = coveredPathIndices.size
  const coveragePercent = totalPaths > 0 ? Math.round((coveredPaths / totalPaths) * 100) : 100

  return {
    totalPaths,
    coveredPaths,
    uncoveredPaths,
    coveragePercent,
  }
}

/**
 * Find which path an example would take through the flowchart.
 * Returns the path index or -1 if no match found.
 */
function findMatchingPath(
  flowchart: ExecutableFlowchart,
  example: ProblemExample,
  paths: FlowchartPath[]
): number {
  // Normalize values - convert string numbers to actual numbers
  const normalizedValues = normalizeExampleValues(example.values)

  // Initialize computed variables
  const computed = initializeComputed(flowchart.definition.variables, normalizedValues)
  const context: EvalContext = {
    problem: normalizedValues,
    computed,
    userState: {},
  }

  // For each path, check if all constraints are satisfied
  for (let i = 0; i < paths.length; i++) {
    const path = paths[i]
    let matches = true

    for (const constraint of path.constraints) {
      try {
        const result = evaluate(constraint.expression, context)
        const actualOutcome = Boolean(result)
        if (actualOutcome !== constraint.requiredOutcome) {
          matches = false
          break
        }
      } catch {
        // If evaluation fails, this constraint doesn't match
        matches = false
        break
      }
    }

    if (matches) {
      return i
    }
  }

  return -1
}

/**
 * Generate a human-readable description of a flowchart path
 */
function describeFlowchartPath(path: FlowchartPath, flowchart: ExecutableFlowchart): string {
  const parts: string[] = []

  for (const constraint of path.constraints) {
    if (constraint.optionValue === '__skip__' || constraint.optionValue === '__not_skipped__') {
      continue
    }

    const node = flowchart.nodes[constraint.nodeId]
    if (node?.definition.type === 'decision') {
      const decisionDef = node.definition
      const option = decisionDef.options.find((o) => o.value === constraint.optionValue)
      if (option?.pathLabel) {
        parts.push(option.pathLabel)
      } else if (option?.label) {
        parts.push(option.label.slice(0, 15))
      }
    }
  }

  return parts.length > 0 ? parts.join(' → ') : 'Default path'
}

// =============================================================================
// LLM Feedback Formatting
// =============================================================================

/**
 * Format validation failures as feedback for the LLM to fix
 */
export function formatFailuresForLLM(report: ValidationReport): string {
  if (report.passed) {
    return 'All test cases passed!'
  }

  const lines: string[] = ['## Test Case Failures\n']

  for (const result of report.results) {
    if (!result.passed) {
      lines.push(`### "${result.example.name}"`)
      lines.push(`- **Input values**: ${JSON.stringify(result.example.values)}`)
      lines.push(`- **Expected answer**: "${result.expectedAnswer}"`)

      if (result.error) {
        lines.push(`- **Error**: ${result.error}`)
      } else {
        lines.push(`- **Actual answer**: "${result.actualAnswer}"`)
        lines.push('')
        lines.push(
          'Please fix the `display.answer` expression so it produces the expected output for these inputs.'
        )
      }
      lines.push('')
    }
  }

  if (report.coverage.uncoveredPaths.length > 0) {
    lines.push('## Uncovered Paths')
    lines.push(
      'The following flowchart paths are not covered by any test case. Consider adding examples:'
    )
    for (const path of report.coverage.uncoveredPaths) {
      lines.push(`- ${path}`)
    }
  }

  return lines.join('\n')
}

/**
 * Format a single test failure for display in the UI
 */
export function formatTestFailure(result: TestResult): string {
  if (result.error) {
    return `Error: ${result.error}`
  }
  return `Expected "${result.expectedAnswer}" but got "${result.actualAnswer}"`
}
