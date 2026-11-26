/**
 * @vitest-environment node
 *
 * Phase 4c: `GET /api/observe/[token]` and the share page decide live /
 * ended / not started from the session row, by the token rule (§10 P4a-5):
 * 200 live, 410 ended, 425 not started, 404 revoked or past expiry; the
 * page opens the ended session after completion expired the share, and is
 * not found for a revoked or expired share. Real migrations (EphemeralDatabase).
 */

import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import type { SessionPlan } from '@/db/schema/session-plans'
import { completeSessionPlanEarly } from '@/lib/curriculum/session-planner'
import { flushSessionReportPushes } from '@/lib/curriculum/session-report-server'
import { createSessionShare, revokeSessionShare } from '@/lib/session-share'
import { fixtureParts } from '@/test/fixtures/session-report'
import {
  createEphemeralDatabase,
  createTestStudent,
  type EphemeralDbResult,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
} from '@/test/journey-simulator/EphemeralDatabase'

vi.mock('server-only', () => ({}))
vi.mock('@/db', () => ({
  get db() {
    return getCurrentEphemeralDb()
  },
  schema,
}))
vi.mock('@/lib/socket-io', () => ({ getSocketIO: async () => null }))
vi.mock('@/lib/classroom/presence-manager', () => ({ getStudentPresence: async () => null }))
vi.mock('@/lib/auth/withAuth', () => ({ withAuth: (handler: unknown) => handler }))
vi.mock('@/lib/viewer', () => ({
  getViewer: async () => ({ kind: 'guest' }),
  getUserId: async () => 'viewer',
}))
vi.mock('@/lib/classroom', () => ({ canPerformAction: async () => false }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))
// The page's client components: only which one it returns matters here
vi.mock('../SessionEndedClient', () => ({ SessionEndedClient: () => null }))
vi.mock('../PublicObservationClient', () => ({ PublicObservationClient: () => null }))

const { GET } = await import('@/app/api/observe/[token]/route')
const { default: PublicObservationPage } = await import('../page')
const { SessionEndedClient } = await import('../SessionEndedClient')
const { PublicObservationClient } = await import('../PublicObservationClient')

type RouteHandler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => any

async function callRoute(token: string) {
  const res: Response = await (GET as unknown as RouteHandler)(new Request('http://localhost/'), {
    params: Promise.resolve({ token }),
  })
  return { status: res.status, body: await res.json() }
}

async function renderPage(token: string) {
  return PublicObservationPage({ params: Promise.resolve({ token }) })
}

const FIXED = new Date('2026-01-01T00:00:00.000Z')

async function insertPlan(playerId: string, started: boolean) {
  const id = `sh-${Math.random().toString(36).slice(2, 10)}`
  await getCurrentEphemeralDb()
    .insert(schema.sessionPlans)
    .values({
      id,
      playerId,
      targetDurationMinutes: 6,
      estimatedProblemCount: 10,
      avgTimePerProblemSeconds: 20,
      gameBreakSettings: {
        enabled: false,
        maxDurationMinutes: 5,
        selectionMode: 'kid-chooses',
        selectedGame: null,
      },
      parts: fixtureParts(),
      summary: {} as SessionPlan['summary'],
      masteredSkillIds: [],
      status: started ? 'in_progress' : 'approved',
      flowState: started ? 'practicing' : 'idle',
      flowUpdatedAt: FIXED,
      flowVersion: 0,
      currentPartIndex: 0,
      currentSlotIndex: 0,
      results: [],
      adjustments: [],
      createdAt: FIXED,
      approvedAt: FIXED,
      startedAt: started ? FIXED : null,
    } as typeof schema.sessionPlans.$inferInsert)
  return id
}

describe('share link: route and page by the session row', () => {
  let eph: EphemeralDbResult
  let playerId: string
  let userId: string

  beforeEach(async () => {
    eph = createEphemeralDatabase()
    setCurrentEphemeralDb(eph.db)
    ;({ playerId, userId } = await createTestStudent(eph.db, 'share'))
  })
  afterEach(async () => {
    await flushSessionReportPushes()
    setCurrentEphemeralDb(null)
    eph.cleanup()
  })

  it('live: 200 with the session row; the page is the live observer', async () => {
    const planId = await insertPlan(playerId, true)
    const share = await createSessionShare(planId, playerId, userId, '1h')
    const res = await callRoute(share.id)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      valid: true,
      session: { id: planId, playerId, startedAt: FIXED.getTime() },
    })
    expect((await renderPage(share.id)).type).toBe(PublicObservationClient)
  })

  it('ended: 410; the page still opens the ended session (completion expired the share)', async () => {
    const planId = await insertPlan(playerId, true)
    const share = await createSessionShare(planId, playerId, userId, '1h')
    await completeSessionPlanEarly(planId)
    expect((await callRoute(share.id)).status).toBe(410)
    const page = await renderPage(share.id)
    expect(page.type).toBe(SessionEndedClient)
    expect(page.props.report).toMatchObject({ outcome: 'completed', endedEarly: true })
  })

  it('not started: 425; the page shows "not started" (no report)', async () => {
    const planId = await insertPlan(playerId, false)
    const share = await createSessionShare(planId, playerId, userId, '1h')
    expect((await callRoute(share.id)).status).toBe(425)
    const page = await renderPage(share.id)
    expect(page.type).toBe(SessionEndedClient)
    expect(page.props.report).toBeNull()
  })

  it('revoked: 404 and the page is not found', async () => {
    const planId = await insertPlan(playerId, true)
    const share = await createSessionShare(planId, playerId, userId, '1h')
    await revokeSessionShare(share.id)
    expect((await callRoute(share.id)).status).toBe(404)
    await expect(renderPage(share.id)).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('past its expiry: 404 and the page is not found, even for an ended session', async () => {
    const planId = await insertPlan(playerId, true)
    const share = await createSessionShare(planId, playerId, userId, '1h')
    await completeSessionPlanEarly(planId)
    await getCurrentEphemeralDb()
      .update(schema.sessionObservationShares)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.sessionObservationShares.id, share.id))
    expect((await callRoute(share.id)).status).toBe(404)
    await expect(renderPage(share.id)).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
