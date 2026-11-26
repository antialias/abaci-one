/**
 * @vitest-environment node
 *
 * Rows inserted without `adjustments` (the offline-session route, the recency
 * sentinel) store the JSON string `"[]"`: the column's default is the string
 * `'[]'`, and drizzle runs it through the JSON mode. Read back, the value is
 * the string `'[]'`. Phase 4a's report called `.some` on it and threw; the
 * end-early event spread it into `['[', ']', adjustment]`. Every reader now
 * goes through `adjustmentsOf`.
 */

import { eq, sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import { refreshSkillRecency } from '@/lib/curriculum/progress-manager'
import { completeSessionPlanEarly } from '@/lib/curriculum/session-planner'
import { getSessionReport } from '@/lib/curriculum/session-report-server'
import { tenProblemSession } from './fixtures/session-report'
import {
  createEphemeralDatabase,
  createTestStudent,
  type EphemeralDbResult,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
} from './journey-simulator/EphemeralDatabase'

vi.mock('server-only', () => ({}))

vi.mock('@/db', () => ({
  get db() {
    return getCurrentEphemeralDb()
  },
  schema,
}))

vi.mock('@/lib/session-share', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/session-share')>()),
  revokeSharesForSession: vi.fn(async () => {}),
}))

describe('rows stored with the JSON-string adjustments default', () => {
  let eph: EphemeralDbResult
  let planId: string

  beforeEach(async () => {
    eph = createEphemeralDatabase()
    setCurrentEphemeralDb(eph.db)
    const { playerId } = await createTestStudent(eph.db, 'adjustments')
    const { plan } = tenProblemSession()
    const { adjustments: _omitted, ...withoutAdjustments } = plan
    await eph.db.insert(schema.sessionPlans).values({ ...withoutAdjustments, playerId })
    planId = plan.id
  })
  afterEach(() => {
    setCurrentEphemeralDb(null)
    eph.cleanup()
  })

  async function storedAdjustments(): Promise<string> {
    const [row] = await getCurrentEphemeralDb()
      .select({ raw: sql<string>`${schema.sessionPlans.adjustments}` })
      .from(schema.sessionPlans)
      .where(eq(schema.sessionPlans.id, planId))
    return row.raw
  }

  it('an insert without adjustments stores the JSON string "[]" (the cause)', async () => {
    expect(await storedAdjustments()).toBe('"[]"')
  })

  it('the session report builds for such a row', async () => {
    const report = await getSessionReport(planId)
    expect(report?.endedEarly).toBe(false)
    expect(report?.totals.problems).toBe(10)
  })

  it('ending early stores a clean list with the one adjustment', async () => {
    await getCurrentEphemeralDb()
      .update(schema.sessionPlans)
      .set({ status: 'in_progress', completedAt: null, flowState: 'practicing' })
      .where(eq(schema.sessionPlans.id, planId))

    const ended = await completeSessionPlanEarly(planId, 'bedtime')

    expect(ended.adjustments.map((a) => [a.type, a.reason])).toEqual([['ended_early', 'bedtime']])
    expect(JSON.parse(await storedAdjustments())).toHaveLength(1)
    expect((await getSessionReport(planId))?.endedEarly).toBe(true)
  })

  it('the recency sentinel now writes real lists', async () => {
    const { playerId } = await createTestStudent(getCurrentEphemeralDb(), 'sentinel')
    await getCurrentEphemeralDb()
      .insert(schema.playerSkillMastery)
      .values({ playerId, skillId: 'basic.directAddition' })
    const refreshed = await refreshSkillRecency(playerId, 'basic.directAddition')
    expect(refreshed).not.toBeNull()
    const sessionId = refreshed!.sessionId
    const [row] = await getCurrentEphemeralDb()
      .select({
        adjustments: sql<string>`${schema.sessionPlans.adjustments}`,
        mastered: sql<string>`${schema.sessionPlans.masteredSkillIds}`,
      })
      .from(schema.sessionPlans)
      .where(eq(schema.sessionPlans.id, sessionId))
    expect(row).toEqual({ adjustments: '[]', mastered: '[]' })
  })
})
