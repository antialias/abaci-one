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
 * Uses the flowchart's `display.problem` expression.
 * All flowcharts MUST define display.problem for proper rendering.
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
      // Fall through to generic display
    }
  } else {
    // Log warning for flowcharts missing display.problem
    console.warn(
      `Flowchart "${flowchart.definition.id}" is missing display.problem expression. ` +
        'Define display.problem for proper problem formatting.'
    )
  }

  // Generic fallback: show problem values in a basic format
  // This should only happen for misconfigured flowcharts
  return Object.entries(problem)
    .map(([, v]) => {
      if (typeof v === 'object' && v !== null && 'denom' in v) {
        return formatMixedNumber(v as MixedNumberValue)
      }
      return String(v)
    })
    .join(' ')
}
