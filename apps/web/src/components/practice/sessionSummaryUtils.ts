/**
 * Session Summary Utilities
 *
 * Utilities for filtering and organizing session results for display.
 */

import { countedTries } from '@/db/schema/session-plan-helpers'
import type { ProblemSlot, SessionPart, SessionPlan, SlotResult } from '@/db/schema/session-plans'

// ============================================================================
// Types
// ============================================================================

/**
 * A problem result with its associated slot and part information
 */
export interface ProblemWithContext {
  /** The result data (if completed) */
  result: SlotResult
  /** The problem slot */
  slot: ProblemSlot
  /** The session part this problem belongs to */
  part: SessionPart
  /** Global problem number (1-based, across all parts) */
  problemNumber: number
}

/**
 * Reason why a problem needs attention
 */
export type AttentionReason = 'incorrect' | 'slow' | 'help-used'

/**
 * A problem that needs the student's attention
 */
export interface ProblemNeedingAttention extends ProblemWithContext {
  /** Why this problem needs attention */
  reasons: AttentionReason[]
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Each problem's verdict row: the latest counted try per (partNumber,
 * slotIndex), with its position among the counted tries. A practice-only
 * do-over never becomes a problem's verdict.
 */
export function buildResultMap(
  results: readonly SlotResult[]
): Map<string, { result: SlotResult; position: number }> {
  const map = new Map<string, { result: SlotResult; position: number }>()
  countedTries(results).forEach((result, position) => {
    map.set(`${result.partNumber}-${result.slotIndex}`, { result, position })
  })
  return map
}

/**
 * The latest counted try for one problem (results are appended in order, so
 * the last match is the most recent, e.g. a redo after the original).
 */
export function getResultForProblem(
  results: readonly SlotResult[],
  partNumber: number,
  slotIndex: number
): SlotResult | undefined {
  const counted = countedTries(results)
  for (let i = counted.length - 1; i >= 0; i--) {
    const r = counted[i]
    if (r.partNumber === partNumber && r.slotIndex === slotIndex) return r
  }
  return undefined
}

/**
 * Build a list of all completed problems with their context.
 */
export function getProblemsWithContext(plan: SessionPlan): ProblemWithContext[] {
  const resultMap = new Map<string, SlotResult>()
  for (const [key, { result }] of buildResultMap(plan.results as SlotResult[])) {
    resultMap.set(key, result)
  }

  const problems: ProblemWithContext[] = []
  let globalNumber = 0

  for (const part of plan.parts) {
    for (const slot of part.slots) {
      globalNumber++
      const key = `${part.partNumber}-${slot.index}`
      const result = resultMap.get(key)

      if (result) {
        problems.push({
          result,
          slot,
          part,
          problemNumber: globalNumber,
        })
      }
    }
  }

  return problems
}

/**
 * Filter problems that need the student's attention.
 *
 * Criteria:
 * - Incorrect answer
 * - Slow response (would have triggered auto-pause threshold)
 * - Used significant help (level 3+)
 */
export function filterProblemsNeedingAttention(
  problems: ProblemWithContext[],
  autoPauseThresholdMs: number
): ProblemNeedingAttention[] {
  const needsAttention: ProblemNeedingAttention[] = []

  for (const problem of problems) {
    const reasons: AttentionReason[] = []

    // Check if incorrect
    if (!problem.result.isCorrect) {
      reasons.push('incorrect')
    }

    // Check if slow (would have triggered auto-pause)
    if (problem.result.responseTimeMs > autoPauseThresholdMs) {
      reasons.push('slow')
    }

    // Check if used help
    if (problem.result.hadHelp) {
      reasons.push('help-used')
    }

    // Only include if there's at least one reason
    if (reasons.length > 0) {
      needsAttention.push({
        ...problem,
        reasons,
      })
    }
  }

  // Sort by severity: incorrect first, then by multiple reasons
  return needsAttention.sort((a, b) => {
    // Incorrect problems always first
    const aIncorrect = a.reasons.includes('incorrect') ? 0 : 1
    const bIncorrect = b.reasons.includes('incorrect') ? 0 : 1
    if (aIncorrect !== bIncorrect) return aIncorrect - bIncorrect

    // Then by number of reasons (more = more attention needed)
    if (b.reasons.length !== a.reasons.length) {
      return b.reasons.length - a.reasons.length
    }

    // Finally by problem number
    return a.problemNumber - b.problemNumber
  })
}

/**
 * Group problems by part for display.
 */
export function groupProblemsByPart(
  problems: ProblemWithContext[]
): Map<SessionPart, ProblemWithContext[]> {
  const grouped = new Map<SessionPart, ProblemWithContext[]>()

  for (const problem of problems) {
    const existing = grouped.get(problem.part) ?? []
    existing.push(problem)
    grouped.set(problem.part, existing)
  }

  return grouped
}

/**
 * Check if a problem is from a vertical part (abacus/visualization)
 */
export function isVerticalPart(type: SessionPart['type']): boolean {
  return type === 'abacus' || type === 'visualization'
}

/**
 * Get a human-readable label for part type
 */
export function getPartTypeLabel(type: SessionPart['type']): string {
  switch (type) {
    case 'abacus':
      return 'Abacus'
    case 'visualization':
      return 'Visualize'
    case 'linear':
      return 'Mental Math'
    default:
      return type
  }
}

/**
 * Format a problem as a simple equation string
 */
export function formatProblemAsEquation(terms: number[], answer: number): string {
  const parts = terms.map((term, i) => {
    if (i === 0) return String(term)
    return term < 0 ? ` − ${Math.abs(term)}` : ` + ${term}`
  })
  return `${parts.join('')} = ${answer}`
}
