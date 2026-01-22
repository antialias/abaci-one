/**
 * Flowchart Doctor - Validates flowchart definitions and identifies issues
 *
 * Provides structured error reporting with provenance information
 * to help identify exactly where problems exist in flowchart configurations.
 */

import type { FlowchartDefinition } from './schema'
import { parseMermaidFile } from './parser'

// =============================================================================
// Types
// =============================================================================

export type DiagnosticSeverity = 'error' | 'warning' | 'info'

export interface DiagnosticLocation {
  /** Top-level section of the flowchart definition */
  section:
    | 'problemInput'
    | 'variables'
    | 'nodes'
    | 'generation'
    | 'constraints'
    | 'display'
    | 'mermaid'
  /** Specific field path within the section (e.g., "derived.answer" or "fields[0]") */
  path?: string
  /** Human-readable description of the location */
  description: string
}

export interface FlowchartDiagnostic {
  /** Unique code for this diagnostic type */
  code: string
  /** Severity level */
  severity: DiagnosticSeverity
  /** Short summary of the issue */
  title: string
  /** Detailed explanation of the problem */
  message: string
  /** Where in the flowchart the issue was found */
  location: DiagnosticLocation
  /** Optional suggestion for how to fix the issue */
  suggestion?: string
}

export interface DiagnosticReport {
  /** Whether the flowchart passed all checks */
  isHealthy: boolean
  /** Number of errors found */
  errorCount: number
  /** Number of warnings found */
  warningCount: number
  /** All diagnostics found */
  diagnostics: FlowchartDiagnostic[]
}

// =============================================================================
// Diagnostic Codes
// =============================================================================

export const DiagnosticCodes = {
  // Derived field issues (DRV-xxx)
  DERIVED_REFERENCES_VARIABLE: 'DRV-001',
  DERIVED_REFERENCES_UNKNOWN: 'DRV-002',
  DERIVED_REFERENCES_LATER: 'DRV-003',

  // Generation config issues (GEN-xxx)
  GENERATION_MISSING_PREFERRED: 'GEN-001',
  GENERATION_MISSING_FIELD: 'GEN-002',

  // Node issues (NODE-xxx)
  NODE_MISSING_NEXT: 'NODE-001',
  NODE_INVALID_REFERENCE: 'NODE-002',

  // Variable issues (VAR-xxx)
  VARIABLE_INVALID_EXPRESSION: 'VAR-001',

  // Display issues (DISP-xxx)
  DISPLAY_MISSING_ANSWER: 'DISP-001',
  DISPLAY_DIVISION_WITHOUT_HANDLER: 'DISP-002',
  DISPLAY_MISSING_PROBLEM: 'DISP-003',

  // Mermaid issues (MERM-xxx)
  MERMAID_ESCAPED_QUOTES: 'MERM-001',
  MERMAID_NODE_MISMATCH: 'MERM-002',

  // Test coverage issues (TEST-xxx)
  TEST_NO_EXPECTED_ANSWERS: 'TEST-001',
  TEST_INCOMPLETE_COVERAGE: 'TEST-002',
  TEST_FAILING: 'TEST-003',
} as const

// =============================================================================
// Built-in Functions (shared with evaluator)
// =============================================================================

const BUILT_IN_FUNCTIONS = new Set([
  'true',
  'false',
  'null',
  'Math',
  'abs',
  'floor',
  'ceil',
  'round',
  'min',
  'max',
  'gcd',
  'lcm',
  'sign',
  'mod',
  'pow',
  'sqrt',
])

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract variable references from an expression.
 * Returns identifiers that are NOT function calls, property access, built-ins, or string literals.
 */
function extractVariableReferences(expr: string): string[] {
  const refs: string[] = []

  // First, remove string literals from the expression to avoid matching identifiers inside them
  // This handles both single and double quoted strings
  const exprWithoutStrings = expr
    .replace(/"(?:[^"\\]|\\.)*"/g, '""') // Remove double-quoted strings
    .replace(/'(?:[^'\\]|\\.)*'/g, "''") // Remove single-quoted strings

  const identifierPattern = /[a-zA-Z_][a-zA-Z0-9_]*/g
  let match

  while ((match = identifierPattern.exec(exprWithoutStrings)) !== null) {
    const identifier = match[0]
    const startIndex = match.index

    // Skip if preceded by a dot (property access like obj.prop)
    if (startIndex > 0 && exprWithoutStrings[startIndex - 1] === '.') {
      continue
    }

    // Skip if followed by open paren (function call like func())
    const afterMatch = exprWithoutStrings.slice(startIndex + identifier.length)
    if (/^\s*\(/.test(afterMatch)) {
      continue
    }

    // Skip built-ins
    if (BUILT_IN_FUNCTIONS.has(identifier)) {
      continue
    }

    refs.push(identifier)
  }

  return refs
}

// =============================================================================
// Validation Checks
// =============================================================================

/**
 * Check derived fields for invalid references
 */
function checkDerivedFields(definition: FlowchartDefinition): FlowchartDiagnostic[] {
  const diagnostics: FlowchartDiagnostic[] = []

  const derived = definition.generation?.derived
  if (!derived || Object.keys(derived).length === 0) {
    return diagnostics
  }

  // Collect input field names
  const inputFieldNames = new Set(definition.problemInput.fields.map((f) => f.name))

  // Collect variable names (these are NOT allowed in derived expressions)
  const variableNames = new Set(Object.keys(definition.variables))

  // Track derived field names as we process them
  const processedDerivedNames = new Set<string>()

  for (const [fieldName, expression] of Object.entries(derived)) {
    const references = extractVariableReferences(expression)

    for (const identifier of references) {
      const isInputField = inputFieldNames.has(identifier)
      const isPreviousDerived = processedDerivedNames.has(identifier)
      const isVariable = variableNames.has(identifier)
      const isLaterDerived = !isPreviousDerived && identifier in derived

      if (!isInputField && !isPreviousDerived) {
        if (isVariable) {
          // References a computed variable - this is the main bug we're catching
          diagnostics.push({
            code: DiagnosticCodes.DERIVED_REFERENCES_VARIABLE,
            severity: 'error',
            title: 'Derived field references computed variable',
            message: `The derived field "${fieldName}" references "${identifier}" which is a computed variable defined in the variables section. Derived fields are computed during example generation, before the flowchart executes, so they cannot access computed variables.`,
            location: {
              section: 'generation',
              path: `derived.${fieldName}`,
              description: `generation.derived["${fieldName}"]`,
            },
            suggestion: `Either move the computation to the variables section, or rewrite the expression to only use input fields: ${[...inputFieldNames].join(', ')}`,
          })
        } else if (isLaterDerived) {
          // Check if it's a self-reference (circular)
          const isSelfReference = identifier === fieldName
          diagnostics.push({
            code: DiagnosticCodes.DERIVED_REFERENCES_LATER,
            severity: 'error',
            title: isSelfReference
              ? 'Derived field references itself (circular)'
              : 'Derived field references later-defined field',
            message: isSelfReference
              ? `The derived field "${fieldName}" references itself. This creates a circular reference that cannot be computed.`
              : `The derived field "${fieldName}" references "${identifier}" which is defined later in the derived fields list. Derived fields are processed in order, so earlier fields cannot reference later ones.`,
            location: {
              section: 'generation',
              path: `derived.${fieldName}`,
              description: `generation.derived["${fieldName}"]`,
            },
            suggestion: isSelfReference
              ? `Replace the self-reference with the actual computation. For example, if "${fieldName}" should be computed from input fields, write the formula instead of just "${fieldName}".`
              : `Reorder the derived fields so that "${identifier}" is defined before "${fieldName}"`,
          })
        } else {
          // References an unknown identifier
          diagnostics.push({
            code: DiagnosticCodes.DERIVED_REFERENCES_UNKNOWN,
            severity: 'error',
            title: 'Derived field references unknown identifier',
            message: `The derived field "${fieldName}" references "${identifier}" which is not a known input field or previously-defined derived field.`,
            location: {
              section: 'generation',
              path: `derived.${fieldName}`,
              description: `generation.derived["${fieldName}"]`,
            },
            suggestion: `Valid references are input fields (${[...inputFieldNames].join(', ')}) and previously-defined derived fields (${[...processedDerivedNames].join(', ') || 'none yet'})`,
          })
        }
      }
    }

    processedDerivedNames.add(fieldName)
  }

  return diagnostics
}

/**
 * Check for missing display.answer configuration.
 *
 * All flowcharts MUST have a display.answer expression defined.
 * Without it, worksheet/PDF generation shows "?" for answers.
 */
function checkDisplayAnswer(definition: FlowchartDefinition): FlowchartDiagnostic[] {
  const diagnostics: FlowchartDiagnostic[] = []

  if (!definition.display?.answer) {
    diagnostics.push({
      code: DiagnosticCodes.DISPLAY_MISSING_ANSWER,
      severity: 'error',
      title: 'Missing display.answer expression',
      message:
        'This flowchart has no display.answer expression. Worksheets and PDFs will show "?" for all answers.',
      location: {
        section: 'display',
        path: 'answer',
        description: 'display.answer (missing)',
      },
      suggestion:
        'Add a "display.answer" expression that computes the answer string from your variables. Example: "display": { "answer": "finalNum + \\"/\\" + finalDenom" }',
    })
  }

  return diagnostics
}

/**
 * Check for missing display.problem configuration.
 *
 * All flowcharts SHOULD have a display.problem expression defined.
 * Without it, the system falls back to schema-specific formatting which
 * is an anti-pattern and will be removed in the future.
 */
function checkDisplayProblem(definition: FlowchartDefinition): FlowchartDiagnostic[] {
  const diagnostics: FlowchartDiagnostic[] = []

  if (!definition.display?.problem) {
    diagnostics.push({
      code: DiagnosticCodes.DISPLAY_MISSING_PROBLEM,
      severity: 'warning',
      title: 'Missing display.problem expression',
      message:
        'This flowchart has no display.problem expression. The system falls back to schema-specific formatting which is deprecated. Define an explicit display.problem expression for consistent behavior.',
      location: {
        section: 'display',
        path: 'problem',
        description: 'display.problem (missing)',
      },
      suggestion:
        'Add a "display.problem" expression that formats the problem for display. Example for fractions: "display": { "problem": "(leftWhole > 0 ? leftWhole + \' \' : \'\') + leftNum + \'/\' + leftDenom + \' \' + op + \' \' + (rightWhole > 0 ? rightWhole + \' \' : \'\') + rightNum + \'/\' + rightDenom" }',
    })
  }

  return diagnostics
}

/**
 * Check that generation.preferred has entries for all input fields
 */
function checkGenerationPreferred(definition: FlowchartDefinition): FlowchartDiagnostic[] {
  const diagnostics: FlowchartDiagnostic[] = []

  const preferred = definition.generation?.preferred
  const fields = definition.problemInput.fields

  if (!preferred) {
    // No generation config at all - this might be intentional for some flowcharts
    return diagnostics
  }

  const preferredFieldNames = new Set(Object.keys(preferred))

  for (const field of fields) {
    if (!preferredFieldNames.has(field.name)) {
      diagnostics.push({
        code: DiagnosticCodes.GENERATION_MISSING_FIELD,
        severity: 'warning',
        title: 'Missing preferred values for input field',
        message: `The input field "${field.name}" does not have preferred values defined in generation.preferred. Example generation may produce less pedagogically useful values.`,
        location: {
          section: 'generation',
          path: 'preferred',
          description: `generation.preferred (missing "${field.name}")`,
        },
        suggestion: `Add preferred values: { "key": "${field.name}", "values": [...] }`,
      })
    }
  }

  return diagnostics
}

/**
 * Generate a context-aware suggestion for division-by-zero handling.
 *
 * Tries to detect patterns like:
 * - Fraction numerator/denominator pairs (simpNum/simpDenom, answerNum/answerDenom)
 * - Single value divisions (x = a / b)
 *
 * Returns a suggestion using the actual variable names from the flowchart.
 */
function generateDivisionSuggestion(
  target: string,
  expr: string,
  variables: Record<string, { init: string }>
): string {
  // Pattern 1: Fraction - target ends in "Num" and there's a matching "Denom"
  // e.g., simpNum -> simpDenom, answerNum -> answerDenom
  if (target.endsWith('Num')) {
    const prefix = target.slice(0, -3) // Remove "Num"
    const denomVar = `${prefix}Denom`
    if (denomVar in variables) {
      return `This looks like a fraction answer. Add display.answer to show the full fraction:
"display": {
  "answer": "${target} + '/' + ${denomVar}"
}`
    }
  }

  // Pattern 2: Try to extract the divisor from the expression
  // Match patterns like "foo / bar" or "foo/bar"
  const divisionMatch = expr.match(/(\w+)\s*\/\s*(\w+)/)
  if (divisionMatch) {
    const divisor = divisionMatch[2]
    return `Add a display.answer expression that handles when ${divisor} is zero:
"display": {
  "answer": "${divisor} != 0 ? ${target} : 'undefined'"
}`
  }

  // Fallback: generic suggestion using the actual target variable
  return `Add a display.answer expression that handles the division-by-zero case:
"display": {
  "answer": "${target}"
}

Or if you need to handle the zero case:
"display": {
  "answer": "divisor != 0 ? ${target} : 'undefined'"
}`
}

/**
 * Check for potential division by zero in generation.target without display.answer.
 *
 * When generation.target points to a variable that involves division,
 * the answer can become NaN if the divisor is zero. Without a display.answer
 * expression to handle this case, worksheets will show "NaN" for such problems.
 */
function checkDivisionInTarget(definition: FlowchartDefinition): FlowchartDiagnostic[] {
  const diagnostics: FlowchartDiagnostic[] = []

  const target = definition.generation?.target
  if (!target) {
    return diagnostics
  }

  // If display.answer exists, assume it handles edge cases
  if (definition.display?.answer) {
    return diagnostics
  }

  // Get the target variable's init expression
  const targetVar = definition.variables[target]
  if (!targetVar) {
    return diagnostics
  }

  // Check if the init expression contains division
  // Simple heuristic: look for / that's not inside a comment or string
  const expr = targetVar.init
  if (expr.includes('/')) {
    // More precise check: ensure it's actually a division operator
    // Skip if it's just part of a string like '/' or a comment
    const hasDivision = /[^'"]\/[^'"]/.test(expr) || /^\s*[^'"]*\//.test(expr)

    if (hasDivision) {
      // Generate a context-aware suggestion based on the actual variables
      // Check if this looks like a fraction (target ends in Num and there's a matching Denom)
      const suggestion = generateDivisionSuggestion(target, expr, definition.variables)

      diagnostics.push({
        code: DiagnosticCodes.DISPLAY_DIVISION_WITHOUT_HANDLER,
        severity: 'warning',
        title: 'Answer variable contains division without display.answer handler',
        message: `The generation.target "${target}" is computed using division (${expr}). When the divisor is zero, this produces NaN. Without a display.answer expression to handle this case, worksheets will show "NaN" for affected problems.`,
        location: {
          section: 'display',
          path: 'answer',
          description: `generation.target "${target}" → variables["${target}"].init`,
        },
        suggestion,
      })
    }
  }

  return diagnostics
}

// =============================================================================
// Mermaid Content Checks
// =============================================================================

/**
 * Check for escaped quotes in mermaid content.
 *
 * LLMs sometimes generate escaped quotes like `\"` which break mermaid parsing.
 * Mermaid expects node content in double quotes: `NODE["content"]`
 * If the content itself contains `\"`, mermaid can't parse it.
 */
function checkMermaidEscapedQuotes(mermaidContent: string): FlowchartDiagnostic[] {
  const diagnostics: FlowchartDiagnostic[] = []

  // Check for escaped double quotes (common LLM mistake)
  if (mermaidContent.includes('\\"') || mermaidContent.includes("\\'")) {
    // Find the line number where this occurs
    const lines = mermaidContent.split('\n')
    let lineNumber = 0
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('\\"') || lines[i].includes("\\'")) {
        lineNumber = i + 1
        break
      }
    }

    diagnostics.push({
      code: DiagnosticCodes.MERMAID_ESCAPED_QUOTES,
      severity: 'error',
      title: 'Escaped quotes in mermaid content',
      message:
        'The mermaid content contains escaped quotes (backslash-quote) which break parsing. Use single quotes or rephrase to avoid quotes entirely.',
      location: {
        section: 'mermaid',
        path: `line ${lineNumber}`,
        description: `Line ${lineNumber} of mermaid content`,
      },
      suggestion:
        "Replace escaped quotes with single quotes (') or remove quotes. Example: change 'same \"state\"' to 'same state' or \"same 'state'\"",
    })
  }

  return diagnostics
}

/**
 * Check that all nodes defined in the JSON exist in the mermaid content.
 * A mismatch here will cause rendering failures because the loader creates
 * placeholder content for missing nodes, but decision options and navigation
 * will be broken.
 */
function checkMermaidNodeConsistency(
  definition: FlowchartDefinition,
  mermaidContent: string
): FlowchartDiagnostic[] {
  const diagnostics: FlowchartDiagnostic[] = []

  // Parse mermaid to get node IDs
  const parsedMermaid = parseMermaidFile(mermaidContent)
  const mermaidNodeIds = new Set(Object.keys(parsedMermaid.nodes))
  const jsonNodeIds = Object.keys(definition.nodes)

  // Find JSON nodes missing from mermaid
  const missingInMermaid = jsonNodeIds.filter((id) => !mermaidNodeIds.has(id))

  if (missingInMermaid.length > 0) {
    // Get the mermaid node IDs to suggest what might be the intended mapping
    const mermaidIdsArray = Array.from(mermaidNodeIds)

    diagnostics.push({
      code: DiagnosticCodes.MERMAID_NODE_MISMATCH,
      severity: 'error',
      title: 'JSON and mermaid node IDs do not match',
      message: `${missingInMermaid.length} node(s) defined in JSON are not found in mermaid: ${missingInMermaid.slice(0, 5).join(', ')}${missingInMermaid.length > 5 ? '...' : ''}. Mermaid has these nodes: ${mermaidIdsArray.slice(0, 5).join(', ')}${mermaidIdsArray.length > 5 ? '...' : ''}`,
      location: {
        section: 'mermaid',
        description: 'Node ID mapping between JSON and mermaid',
      },
      suggestion: `The node IDs in the JSON "nodes" object must EXACTLY match the node IDs in the mermaid flowchart. For example, if your JSON has "nodes": { "START": {...} }, then the mermaid must have START["..."] or START{"..."} etc. REGENERATE the mermaid content using the SAME node IDs as defined in the JSON: ${jsonNodeIds.slice(0, 8).join(', ')}${jsonNodeIds.length > 8 ? '...' : ''}`,
    })
  }

  return diagnostics
}

// =============================================================================
// Test Coverage Checks
// =============================================================================

/**
 * ValidationReport type (matches test-case-validator.ts)
 * Defined here to avoid circular imports
 */
interface ValidationReportForDoctor {
  passed: boolean
  results: Array<{
    example: { name: string; expectedAnswer?: string }
    actualAnswer: string | null
    expectedAnswer: string
    passed: boolean
    error?: string
  }>
  coverage: {
    totalPaths: number
    coveredPaths: number
    uncoveredPaths: string[]
    coveragePercent: number
  }
  summary: {
    total: number
    passed: number
    failed: number
    errors: number
  }
}

/**
 * Check test coverage and generate diagnostics for issues.
 *
 * This converts a validation report into doctor diagnostics so that
 * coverage issues appear alongside other flowchart problems.
 */
export function checkTestCoverage(
  definition: FlowchartDefinition,
  validationReport: ValidationReportForDoctor
): FlowchartDiagnostic[] {
  const diagnostics: FlowchartDiagnostic[] = []

  const examples = definition.problemInput.examples || []
  const examplesWithTests = examples.filter((ex) => ex.expectedAnswer)

  // Check 1: No test cases at all
  if (examplesWithTests.length === 0) {
    diagnostics.push({
      code: DiagnosticCodes.TEST_NO_EXPECTED_ANSWERS,
      severity: 'warning',
      title: 'No test cases with expected answers',
      message:
        'None of the examples in problemInput.examples have expectedAnswer defined. Without test cases, display.answer bugs cannot be automatically detected.',
      location: {
        section: 'problemInput',
        path: 'examples',
        description: 'problemInput.examples',
      },
      suggestion:
        'Add expectedAnswer to each example that shows the exact string display.answer should produce. For example: { "name": "Simple case", "values": {...}, "expectedAnswer": "5" }',
    })
    return diagnostics // No point checking other things if there are no tests
  }

  // Check 2: Failing tests
  const failingTests = validationReport.results.filter((r) => !r.passed)
  if (failingTests.length > 0) {
    for (const failure of failingTests) {
      const errorDetail = failure.error
        ? `Error: ${failure.error}`
        : `Expected "${failure.expectedAnswer}" but got "${failure.actualAnswer}"`

      diagnostics.push({
        code: DiagnosticCodes.TEST_FAILING,
        severity: 'error',
        title: `Test "${failure.example.name}" is failing`,
        message: `${errorDetail}. The display.answer expression does not produce the expected output for this test case.`,
        location: {
          section: 'display',
          path: 'answer',
          description: `display.answer (test: "${failure.example.name}")`,
        },
        suggestion: `Fix the display.answer expression so it produces "${failure.expectedAnswer}" when evaluated with the test inputs. Check for issues like: wrong conditional logic, missing whole number handling, or incorrect string formatting.`,
      })
    }
  }

  // Check 3: Incomplete path coverage
  const { totalPaths, coveredPaths, uncoveredPaths, coveragePercent } = validationReport.coverage
  if (totalPaths > 0 && coveredPaths < totalPaths) {
    const uncoveredList =
      uncoveredPaths.length > 0
        ? uncoveredPaths.slice(0, 3).join(', ') +
          (uncoveredPaths.length > 3 ? ` and ${uncoveredPaths.length - 3} more` : '')
        : 'some paths'

    diagnostics.push({
      code: DiagnosticCodes.TEST_INCOMPLETE_COVERAGE,
      severity: 'warning',
      title: `Test coverage is ${coveragePercent}% (${coveredPaths}/${totalPaths} paths)`,
      message: `Not all flowchart paths are covered by test cases. Uncovered paths: ${uncoveredList}. Bugs in display.answer for these paths may go undetected.`,
      location: {
        section: 'problemInput',
        path: 'examples',
        description: 'problemInput.examples (coverage)',
      },
      suggestion: `Add test cases for the uncovered paths. Each example should exercise a different path through the flowchart to ensure display.answer works correctly for all cases.`,
    })
  }

  return diagnostics
}

// =============================================================================
// Main Doctor Function
// =============================================================================

/**
 * Run all diagnostic checks on a flowchart definition.
 *
 * @param definition - The flowchart definition to validate
 * @param mermaidContent - Optional mermaid content to check for syntax issues
 * @returns A diagnostic report with all found issues
 */
export function diagnoseFlowchart(
  definition: FlowchartDefinition,
  mermaidContent?: string
): DiagnosticReport {
  const diagnostics: FlowchartDiagnostic[] = []

  // Run definition checks
  diagnostics.push(...checkDerivedFields(definition))
  diagnostics.push(...checkDisplayAnswer(definition))
  diagnostics.push(...checkDisplayProblem(definition))
  diagnostics.push(...checkDivisionInTarget(definition))
  diagnostics.push(...checkGenerationPreferred(definition))

  // Run mermaid content checks if provided
  if (mermaidContent) {
    diagnostics.push(...checkMermaidEscapedQuotes(mermaidContent))
    diagnostics.push(...checkMermaidNodeConsistency(definition, mermaidContent))
  }

  // Count by severity
  const errorCount = diagnostics.filter((d) => d.severity === 'error').length
  const warningCount = diagnostics.filter((d) => d.severity === 'warning').length

  return {
    isHealthy: errorCount === 0,
    errorCount,
    warningCount,
    diagnostics,
  }
}

/**
 * Get only errors (not warnings) from a diagnostic report
 */
export function getErrors(report: DiagnosticReport): FlowchartDiagnostic[] {
  return report.diagnostics.filter((d) => d.severity === 'error')
}

/**
 * Get only warnings from a diagnostic report
 */
export function getWarnings(report: DiagnosticReport): FlowchartDiagnostic[] {
  return report.diagnostics.filter((d) => d.severity === 'warning')
}

/**
 * Format a diagnostic for display in console or logs
 */
export function formatDiagnostic(diagnostic: FlowchartDiagnostic): string {
  const severityIcon =
    diagnostic.severity === 'error' ? '❌' : diagnostic.severity === 'warning' ? '⚠️' : 'ℹ️'
  return `${severityIcon} [${diagnostic.code}] ${diagnostic.title}
   Location: ${diagnostic.location.description}
   ${diagnostic.message}${diagnostic.suggestion ? `\n   💡 ${diagnostic.suggestion}` : ''}`
}

/**
 * Format a diagnostic as an LLM refinement prompt.
 * This creates clear, actionable instructions for the LLM to fix the issue.
 */
export function formatDiagnosticForRefinement(diagnostic: FlowchartDiagnostic): string {
  const parts: string[] = []

  // Start with clear instruction
  parts.push(`Fix the following ${diagnostic.severity} in the flowchart configuration:`)
  parts.push('')

  // The issue
  parts.push(`**Issue:** ${diagnostic.title}`)
  parts.push(`**Location:** ${diagnostic.location.description}`)
  parts.push(`**Details:** ${diagnostic.message}`)

  // The fix
  if (diagnostic.suggestion) {
    parts.push('')
    parts.push(`**How to fix:** ${diagnostic.suggestion}`)
  }

  return parts.join('\n')
}

/**
 * Format multiple diagnostics for LLM refinement.
 * Groups them logically and provides context.
 */
export function formatDiagnosticsForRefinement(diagnostics: FlowchartDiagnostic[]): string {
  if (diagnostics.length === 0) return ''

  if (diagnostics.length === 1) {
    return formatDiagnosticForRefinement(diagnostics[0])
  }

  const parts: string[] = []
  parts.push(`Fix the following ${diagnostics.length} issues in the flowchart configuration:`)
  parts.push('')

  for (let i = 0; i < diagnostics.length; i++) {
    const d = diagnostics[i]
    parts.push(`### Issue ${i + 1}: ${d.title}`)
    parts.push(`- **Location:** ${d.location.description}`)
    parts.push(`- **Details:** ${d.message}`)
    if (d.suggestion) {
      parts.push(`- **How to fix:** ${d.suggestion}`)
    }
    parts.push('')
  }

  return parts.join('\n')
}
