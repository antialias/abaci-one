/**
 * @vitest-environment node
 *
 * The row-write commit listener (`setRowCommitListener` in `row-cas.ts`).
 * `row-cas` imports nothing socket-related, so the seed script, which
 * bundles it through the planner, never reaches the socket server's graph
 * (arcade games, page components, Panda CSS). The socket server registers
 * the report push at start; these tests pin the contract that push relies on.
 */

import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import type { SessionPlan } from '@/db/schema/session-plans'
import { noWrite, setRowCommitListener, withRowCas } from '@/lib/curriculum/row-cas'
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

describe('row commit listener', () => {
  let eph: EphemeralDbResult
  let planId: string

  beforeEach(async () => {
    eph = createEphemeralDatabase()
    setCurrentEphemeralDb(eph.db)
    const { playerId } = await createTestStudent(eph.db, 'listener')
    const { plan } = tenProblemSession()
    await eph.db.insert(schema.sessionPlans).values({ ...plan, playerId })
    planId = plan.id
  })
  afterEach(() => {
    setRowCommitListener(null)
    setCurrentEphemeralDb(null)
    eph.cleanup()
  })

  it('hears each committed write once, with the row read and the row written', async () => {
    const heard: Array<[SessionPlan, SessionPlan]> = []
    setRowCommitListener((before, after) => heard.push([before, after]))

    const result = await withRowCas(planId, () => ({ write: { status: 'in_progress' }, value: 1 }))

    expect(result.committed).toBe(true)
    expect(heard).toHaveLength(1)
    const [before, after] = heard[0]
    expect(after.rowVersion).toBe((before.rowVersion ?? 0) + 1)
    expect(after).toEqual(result.plan)
  })

  it('hears nothing when the writer decides not to write', async () => {
    const listener = vi.fn()
    setRowCommitListener(listener)

    const result = await withRowCas(planId, () => noWrite('skip'))

    expect(result.committed).toBe(false)
    expect(listener).not.toHaveBeenCalled()
  })

  it('writes without a listener (scripts, the seed), and stops hearing once cleared', async () => {
    const listener = vi.fn()
    setRowCommitListener(listener)
    setRowCommitListener(null)

    const result = await withRowCas(planId, () => ({ write: { status: 'in_progress' }, value: 1 }))

    expect(result.committed).toBe(true)
    expect(listener).not.toHaveBeenCalled()
  })

  it('a listener that throws does not fail the write', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    setRowCommitListener(() => {
      throw new Error('push blew up (test)')
    })

    const result = await withRowCas(planId, () => ({ write: { status: 'in_progress' }, value: 1 }))

    expect(result.committed).toBe(true)
    const [row] = await getCurrentEphemeralDb()
      .select({ status: schema.sessionPlans.status })
      .from(schema.sessionPlans)
      .where(eq(schema.sessionPlans.id, planId))
    expect(row.status).toBe('in_progress')
    expect(error).toHaveBeenCalledWith('[row-cas] commit listener threw', expect.anything())
    error.mockRestore()
  })
})
