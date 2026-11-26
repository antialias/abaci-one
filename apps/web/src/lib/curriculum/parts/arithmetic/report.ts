/**
 * Arithmetic part progress (session architecture §1.2, Phase 2).
 *
 * `reportContribution` (the part's rows of the session report) lands with the
 * report builder in Phase 4a (§10 P2-1). Moved helpers are unchanged and are
 * re-exported from `db/schema/session-plan-helpers.ts` until Phase 5.
 *
 * Client-safe: only `import type` from schema files.
 */

import type { SessionPlan } from '@/db/schema/session-plans'
import type { PartProgress } from '../kind'
import type { ArithmeticContent, ArithmeticState } from './state'

/**
 * Progress through one part: original slots passed of slots planned (the
 * slot-index count today's views show; retries are not planned items).
 */
export function arithmeticProgress(slots: ArithmeticContent, state: ArithmeticState): PartProgress {
  return { done: Math.min(state.slotIndex, slots.length), total: slots.length }
}

/**
 * Calculate total problems including pending retries for progress display
 */
export function calculateTotalProblemsWithRetries(plan: SessionPlan): number {
  let total = 0
  for (let partIndex = 0; partIndex < plan.parts.length; partIndex++) {
    const part = plan.parts[partIndex]
    total += part.slots.length
    const retryState = plan.retryState?.[partIndex]
    if (retryState) {
      total += retryState.currentEpochItems.length
      total += retryState.pendingRetries.length
    }
  }
  return total
}
