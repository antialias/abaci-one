/**
 * Flowchart Formatting Utilities
 *
 * Functions for formatting flowchart problem values for display.
 *
 * @module flowcharts/formatting
 */

import type { ExecutableFlowchart, ProblemValue, MixedNumberValue } from './schema'
import { evaluate, type EvalContext } from './evaluator'

// =============================================================================
// Template Interpolation
// =============================================================================

/**
 * Interpolate a template string with values.
 *
 * Supports two syntaxes:
 * - `{{name}}` - Simple variable substitution from values
 * - `{{=expr}}` - Expression evaluation using the evaluator
 *
 * @example
 * ```ts
 * interpolateTemplate("x = {{answer}}", { answer: 5 })
 * // Returns: "x = 5"
 *
 * interpolateTemplate("Sum: {{=a + b}}", { a: 2, b: 3 })
 * // Returns: "Sum: 5"
 * ```
 */
export function interpolateTemplate(
  template: string,
  values: Record<string, ProblemValue>
): string {
  // Match {{...}} patterns
  return template.replace(/\{\{([^}]+)\}\}/g, (match, content: string) => {
    const trimmed = content.trim()

    // Check if it's an expression (starts with =)
    if (trimmed.startsWith('=')) {
      const expr = trimmed.slice(1).trim()
      try {
        const context: EvalContext = {
          problem: values,
          computed: values, // In new model, values contains everything
          userState: {},
        }
        const result = evaluate(expr, context)
        return formatValueForDisplay(result)
      } catch (error) {
        console.error(`Template expression error: ${expr}`, error)
        return match // Return original on error
      }
    }

    // Simple variable substitution
    if (trimmed in values) {
      return formatValueForDisplay(values[trimmed])
    }

    // Variable not found - return original
    console.warn(`Template variable not found: ${trimmed}`)
    return match
  })
}

/**
 * Format a ProblemValue for display in templates.
 */
function formatValueForDisplay(value: ProblemValue): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'object' && 'denom' in value) {
    return formatMixedNumber(value as MixedNumberValue)
  }
  return String(value)
}

// =============================================================================
// Mixed Number Helpers
// =============================================================================

/**
 * Create a mixed number value
 */
export function createMixedNumber(whole: number, num: number, denom: number): MixedNumberValue {
  return { whole, num, denom }
}

/**
 * Format a mixed number for display
 */
export function formatMixedNumber(mn: MixedNumberValue): string {
  if (mn.whole === 0) {
    return `${mn.num}/${mn.denom}`
  }
  if (mn.num === 0) {
    return String(mn.whole)
  }
  return `${mn.whole} ${mn.num}/${mn.denom}`
}

// =============================================================================
// Problem Display Formatting
// =============================================================================

/**
 * Format problem input for display.
 *
 * If flowchart has `display.problem` expression, evaluates it.
 * Otherwise falls back to showing problem values joined together.
 */
export function formatProblemDisplay(
  flowchart: ExecutableFlowchart,
  problem: Record<string, ProblemValue>
): string {
  // If the flowchart has a display.problem expression, evaluate it
  if (flowchart.definition.display?.problem) {
    try {
      const context: EvalContext = {
        problem,
        computed: {},
        userState: {},
      }
      const result = evaluate(flowchart.definition.display.problem, context)
      return String(result)
    } catch (error) {
      console.error(
        `Error evaluating display.problem for flowchart "${flowchart.definition.id}":`,
        error
      )
      // Fall through to fallback
    }
  }

  // Fallback: show problem values in a basic format
  return Object.entries(problem)
    .map(([, v]) => {
      if (typeof v === 'object' && v !== null && 'denom' in v) {
        return formatMixedNumber(v as MixedNumberValue)
      }
      return String(v)
    })
    .join(' ')
}
