/**
 * Session Summary Utilities
 *
 * Utilities for filtering and organizing session results for display.
 */

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
 * Build a list of all completed problems with their context.
 */
export function getProblemsWithContext(plan: SessionPlan): ProblemWithContext[] {
  const results = plan.results as SlotResult[]
  const resultMap = new Map<string, SlotResult>()

  // Build a map for quick lookup
  for (const result of results) {
    const key = `${result.partNumber}-${result.slotIndex}`
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
 * Get the skills that need the most work based on session results.
 * Returns skills with their accuracy, sorted by accuracy (lowest first).
 */
export function getSkillsNeedingWork(
  results: SlotResult[]
): Array<{ skillId: string; correct: number; total: number; accuracy: number }> {
  const skillStats = new Map<string, { correct: number; total: number }>()

  for (const result of results) {
    for (const skillId of result.skillsExercised) {
      const current = skillStats.get(skillId) ?? { correct: 0, total: 0 }
      current.total++
      if (result.isCorrect) current.correct++
      skillStats.set(skillId, current)
    }
  }

  const skills = Array.from(skillStats.entries()).map(([skillId, stats]) => ({
    skillId,
    correct: stats.correct,
    total: stats.total,
    accuracy: stats.total > 0 ? stats.correct / stats.total : 0,
  }))

  // Sort by accuracy (lowest first = needs most work)
  return skills.sort((a, b) => a.accuracy - b.accuracy)
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
