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
 * Uses the flowchart's `display.problem` expression if available,
 * otherwise falls back to schema-specific formatting.
 */
export function formatProblemDisplay(
  flowchart: ExecutableFlowchart,
  problem: Record<string, ProblemValue>
): string {
  // If the flowchart has a custom display.problem expression, evaluate it
  if (flowchart.definition.display?.problem) {
    try {
      const context: EvalContext = {
        problem,
        computed: {},
        userState: {},
      }
      const result = evaluate(flowchart.definition.display.problem, context)
      return String(result)
    } catch {
      // Fall through to schema-specific formatting on error
    }
  }

  const schema = flowchart.definition.problemInput.schema

  switch (schema) {
    case 'two-digit-subtraction': {
      return `${problem.minuend} − ${problem.subtrahend}`
    }
    case 'two-mixed-numbers-with-op': {
      const left = problem.left as MixedNumberValue
      const right = problem.right as MixedNumberValue
      const op = problem.op as string
      return `${formatMixedNumber(left)} ${op} ${formatMixedNumber(right)}`
    }
    case 'linear-equation': {
      const coef = problem.coefficient as number
      const op = problem.operation as string
      const constant = problem.constant as number
      const equals = problem.equals as number
      const coefStr = coef === 1 ? '' : String(coef)
      // Clean display: skip "+ 0" or "- 0" for multiplication-only problems
      if (constant === 0) {
        return `${coefStr}x = ${equals}`
      }
      return `${coefStr}x ${op} ${constant} = ${equals}`
    }
    case 'two-fractions-with-op': {
      const leftWhole = problem.leftWhole as number
      const leftNum = problem.leftNum as number
      const leftDenom = problem.leftDenom as number
      const op = problem.op as string
      const rightWhole = problem.rightWhole as number
      const rightNum = problem.rightNum as number
      const rightDenom = problem.rightDenom as number
      const leftStr =
        leftWhole > 0 ? `${leftWhole} ${leftNum}/${leftDenom}` : `${leftNum}/${leftDenom}`
      const rightStr =
        rightWhole > 0 ? `${rightWhole} ${rightNum}/${rightDenom}` : `${rightNum}/${rightDenom}`
      return `${leftStr} ${op} ${rightStr}`
    }
    default: {
      // Generic display: show values joined by spaces
      return Object.entries(problem)
        .map(([k, v]) => {
          if (typeof v === 'object' && v !== null && 'denom' in v) {
            return formatMixedNumber(v as MixedNumberValue)
          }
          return String(v)
        })
        .join(' ')
    }
  }
}
