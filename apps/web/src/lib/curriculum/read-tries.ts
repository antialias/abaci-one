/**
 * The try store seam (session architecture §6, Phase 4a).
 *
 * Every reader that needs a session's tries as records (the session report,
 * and from the ledger rebase on, review and idempotency) reads them here.
 * Today the store is the plan's `results` array, normalized by
 * `normalizeTries` (legacy rows included, sentinel rows skipped). After ledger
 * phase 4b it becomes `foldAttempts(readEventsBySession(planId))`; the
 * signature is async for that reason, so callers do not change then.
 *
 * Drizzle-free today; keep it importable from the pure report builder's tests.
 */

import { normalizeTries, type Try } from '@/db/schema/session-plan-normalize'
import type { SessionPlan } from '@/db/schema/session-plans'

export type TrySource = Pick<SessionPlan, 'id' | 'parts' | 'results'>

/** A session's tries, in recorded order (voided tries included; readers skip them). */
export async function readTries(plan: TrySource): Promise<Try[]> {
  return readTriesSync(plan)
}

/** The same, for the pure paths that hold the row already (tests, fixtures). */
export function readTriesSync(plan: TrySource): Try[] {
  return normalizeTries(plan.id, plan.parts ?? [], plan.results ?? [])
}
