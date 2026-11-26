/**
 * Compare-and-set for every writer of a `session_plans` row (session
 * architecture plan of record D2, §3.3, Phase 3a).
 *
 * `withRowCas(planId, decide)` loads the row, asks `decide` what to write, and
 * writes it only if nobody else wrote in between:
 * `UPDATE … SET …, row_version = read + 1 WHERE id = ? AND row_version = read`.
 * When that matches no row, it reloads and decides again, immediately (no
 * timer, no backoff), at most `ROW_CAS_ATTEMPTS` times in all; then it throws
 * `WriteContentionError`, which routes answer 503 `write_contention`.
 *
 * `decide` must be a pure function of the row it is given: it runs again on
 * every retry, against the newer row, so an idempotency check inside it (a
 * try id already recorded) sees the winner's write. Side effects (skill
 * attempts, share revocation) belong after the commit, run by the caller
 * only when `committed` is true. The session report push is the helper's own
 * (`afterCommit`), so every writer pushes and none can forget to.
 *
 * Old images (a rolling deploy, a rollback) neither check nor bump
 * `row_version`; see §7 Phase 3a "Rollout window".
 */

import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { NewSessionPlan, SessionPlan } from '@/db/schema/session-plans'
import { hasSocketIO } from '@/lib/socket-io'
import { pushSessionReportAfterCommit } from './session-report-server'

export const ROW_CAS_ATTEMPTS = 3

/** The row fields a writer may set (the id and row version are the helper's). */
export type SessionPlanPatch = Partial<Omit<NewSessionPlan, 'id' | 'rowVersion'>>

/** What a writer decided for the row it was given. */
export type RowCasDecision<T> = { write: SessionPlanPatch; value: T } | { write: null; value: T }

export interface RowCasResult<T> {
  /** The committed row, or the row as read when nothing was written */
  plan: SessionPlan
  value: T
  committed: boolean
}

/** Every attempt lost the race to another writer. Routes answer 503 `write_contention`. */
export class WriteContentionError extends Error {
  readonly code = 'write_contention'
  readonly status = 503
  constructor(
    public readonly planId: string,
    public readonly attempts: number
  ) {
    super(`Session ${planId} is being written by someone else; gave up after ${attempts} attempts`)
    this.name = 'WriteContentionError'
  }
}

export class PlanNotFoundError extends Error {
  constructor(public readonly planId: string) {
    super(`Plan not found: ${planId}`)
    this.name = 'PlanNotFoundError'
  }
}

async function loadPlan(planId: string): Promise<SessionPlan | null> {
  const row = await db.query.sessionPlans.findFirst({
    where: eq(schema.sessionPlans.id, planId),
  })
  return row ?? null
}

/**
 * After a committed write, and only then: push the session's report (and
 * `session-ended` when this write ended it) to its rooms (§4 "Push", Phase
 * 4a). `before` is the row this attempt read, so the pair is exactly the
 * transition that committed. Skipped when no socket server runs in this
 * process; queued synchronously, so in commit order, and never awaited by
 * the writer.
 */
function afterCommit(before: SessionPlan, after: SessionPlan) {
  if (!hasSocketIO()) return
  pushSessionReportAfterCommit(before, after)
}

/** No write; the decision's value with the row as read. */
export function noWrite<T>(value: T): RowCasDecision<T> {
  return { write: null, value }
}

export async function withRowCas<T>(
  planId: string,
  decide: (plan: SessionPlan) => RowCasDecision<T> | Promise<RowCasDecision<T>>
): Promise<RowCasResult<T>> {
  for (let attempt = 1; attempt <= ROW_CAS_ATTEMPTS; attempt++) {
    const plan = await loadPlan(planId)
    if (!plan) throw new PlanNotFoundError(planId)

    const decision = await decide(plan)
    if (decision.write === null) return { plan, value: decision.value, committed: false }

    const readVersion = plan.rowVersion ?? 0
    const [updated] = await db
      .update(schema.sessionPlans)
      .set({ ...decision.write, rowVersion: readVersion + 1 })
      .where(
        and(eq(schema.sessionPlans.id, planId), eq(schema.sessionPlans.rowVersion, readVersion))
      )
      .returning()
    if (updated) {
      afterCommit(plan, updated)
      return { plan: updated, value: decision.value, committed: true }
    }

    console.warn('[withRowCas] lost a write race; re-reading', { planId, attempt })
  }
  throw new WriteContentionError(planId, ROW_CAS_ATTEMPTS)
}

/** A writer that sets fixed fields (no read-dependent logic beyond the row existing). */
export async function setPlanFields(
  planId: string,
  write: SessionPlanPatch | ((plan: SessionPlan) => SessionPlanPatch)
): Promise<SessionPlan> {
  const { plan } = await withRowCas(planId, (p) => ({
    write: typeof write === 'function' ? write(p) : write,
    value: undefined,
  }))
  return plan
}
