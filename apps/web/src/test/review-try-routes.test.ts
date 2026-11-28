/**
 * @vitest-environment node
 *
 * The review route (#158; session architecture §10 P6b1-12): `tries/[tryId]`,
 * the only one since P6b1-12b deleted `results/[resultIndex]`. Auth, the CAS
 * write, and the response the clients read. A row recorded before Phase 1 has
 * no stored `tryId`; it is addressed as `legacy:<planId>:<index>`, the id
 * `tryIdOf` gives it, so the clients can address every try they show.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import { tryIdOf } from '@/db/schema/session-plan-normalize'
import type { SessionPart, SessionSummary, SlotResult } from '@/db/schema/session-plans'
import { getTimingReviewData } from '@/lib/curriculum/progress-manager'
import { reviewTryPath } from '@/lib/curriculum/review-try-path'
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
vi.mock('@/lib/auth/withAuth', () => ({ withAuth: (handler: unknown) => handler }))
vi.mock('@/lib/viewer', () => ({ getUserId: async () => 'adult' }))
const allowed = vi.hoisted(() => ({ value: true }))
vi.mock('@/lib/classroom', () => ({ canPerformAction: async () => allowed.value }))

// After the mocks: the route loads `@/db` (the factory reads the imports above)
const { PATCH: byTryId } = await import(
  '@/app/api/curriculum/[playerId]/sessions/plans/[planId]/tries/[tryId]/route'
)

const STORED_ID = '7d0c5a2e-1b3f-4c6d-8e9f-0a1b2c3d4e5f'
const NOW = new Date('2026-11-27T12:00:00Z')

let eph: EphemeralDbResult
let playerId: string

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  allowed.value = true
  eph = createEphemeralDatabase()
  setCurrentEphemeralDb(eph.db)
  ;({ playerId } = await createTestStudent(eph.db, 'review-kid'))
})

afterEach(() => {
  setCurrentEphemeralDb(null)
  eph.cleanup()
  vi.useRealTimers()
})

/** Two wrong first tries: the first with a stored id, the second from before Phase 1 (none) */
function tries(): SlotResult[] {
  return [0, 1].map((i) => {
    const problem = { terms: [i + 1, 1], answer: i + 2, skillsRequired: [] }
    return {
      ...(i === 0 && { tryId: STORED_ID }),
      slotId: `s${i}`,
      partNumber: 1,
      slotIndex: i,
      problem,
      studentAnswer: problem.answer + 1,
      isCorrect: false,
      responseTimeMs: 3000,
      skillsExercised: [],
      usedOnScreenAbacus: false,
      hadHelp: false,
      incorrectAttempts: 0,
      timestamp: new Date('2026-11-01T15:00:00Z'),
      epochNumber: 0,
    } as unknown as SlotResult
  })
}

function partsFor(results: SlotResult[]): SessionPart[] {
  return [
    {
      kind: 'arithmetic',
      partNumber: 1,
      type: 'abacus',
      format: 'vertical',
      useAbacus: true,
      estimatedMinutes: 3,
      slots: results.map((r, index) => ({
        slotId: `s${index}`,
        index,
        purpose: 'focus',
        constraints: {},
        problem: r.problem,
      })),
    } as SessionPart,
  ]
}

async function insertPlan(id: string, over: Partial<SlotResult> = {}) {
  const results = tries().map((r) => ({ ...r, ...over }))
  await eph.db.insert(schema.sessionPlans).values({
    id,
    playerId,
    targetDurationMinutes: 10,
    estimatedProblemCount: results.length,
    avgTimePerProblemSeconds: 5,
    parts: partsFor(results),
    summary: {} as SessionSummary,
    status: 'completed',
    results,
    adjustments: [],
    createdAt: new Date('2026-11-01T15:00:00Z'),
    completedAt: new Date('2026-11-01T15:10:00Z'),
  })
}

type Handler = (request: Request, context: { params: Promise<unknown> }) => Promise<Response>

/** PATCH a route handler as Next calls it; the status and the JSON body */
async function patch(handler: unknown, params: Record<string, string>, body: unknown) {
  const response = await (handler as Handler)(
    new Request('http://localhost/api', { method: 'PATCH', body: JSON.stringify(body) }),
    { params: Promise.resolve({ playerId, ...params }) }
  )
  return { status: response.status, body: await response.json() }
}

/** Review try `index` of a fresh plan as the clients address it: the id `tryIdOf` gives, URL-encoded */
async function review(index: number, body: unknown) {
  await insertPlan('plan-new')
  const tryId = tryIdOf(tries()[index], index, 'plan-new')
  const encoded = reviewTryPath(playerId, 'plan-new', tryId).split('/tries/')[1]
  return { tryId, answer: await patch(byTryId, { planId: 'plan-new', tryId: encoded }, body) }
}

describe('review route: tries/[tryId]', () => {
  it('a try with a stored id: mark_correct', async () => {
    const { answer } = await review(0, { action: 'mark_correct' })
    expect(answer.status).toBe(200)
    expect(answer.body.plan.results[0]).toMatchObject({ isCorrect: true, tryId: STORED_ID })
    expect(answer.body.plan.rowVersion).toBe(1)
  })

  it('a try from before Phase 1 (no stored id), by its legacy id: exclude, then include', async () => {
    const { tryId, answer } = await review(1, { action: 'exclude' })
    expect(tryId).toBe('legacy:plan-new:1')
    expect(answer.status).toBe(200)
    expect(answer.body.plan.results[1]).not.toHaveProperty('tryId') // no id is stamped on it
    expect(answer.body.plan.results[1].source).toBe('teacher-excluded')

    const included = await patch(byTryId, { planId: 'plan-new', tryId }, { action: 'include' })
    expect(included.status).toBe(200)
    expect(included.body.plan.results[1].source).not.toBe('teacher-excluded')
    expect(included.body.plan.rowVersion).toBe(2)
  })

  it('the timing actions the review page sends (set_time, confirm_timing)', async () => {
    const set = await review(1, { action: 'set_time', adjustedResponseTimeMs: 4000 })
    expect(set.answer.status).toBe(200)
    expect(set.answer.body.plan.results[1].timingReview?.adjustedResponseTimeMs).toBe(4000)
    const confirm = await patch(
      byTryId,
      { planId: 'plan-new', tryId: STORED_ID },
      { action: 'confirm_timing' }
    )
    expect(confirm.status).toBe(200)
    expect(confirm.body.plan.results[0].timingReview?.timingConfirmed).toBe(true)
  })

  it('the plan it answers carries no legacy wire field (P6b1-16 removed them)', async () => {
    const { answer } = await review(0, { action: 'exclude' })
    for (const field of ['currentSlotIndex', 'retryState', 'breakStartedAt', 'breakResults']) {
      expect(answer.body.plan).not.toHaveProperty(field)
    }
  })

  it('refuses: not authorized (403), not the player (404), an unknown id (404)', async () => {
    await insertPlan('plan-new')
    allowed.value = false
    expect(
      await patch(byTryId, { planId: 'plan-new', tryId: STORED_ID }, { action: 'exclude' })
    ).toEqual({ status: 403, body: { error: 'Not authorized' } })
    allowed.value = true

    const elsewhere = { playerId: 'someone-else', planId: 'plan-new' }
    const notYours = await patch(byTryId, { ...elsewhere, tryId: STORED_ID }, { action: 'exclude' })
    expect(notYours.status).toBe(404)

    expect(
      await patch(
        byTryId,
        { planId: 'plan-new', tryId: 'legacy:plan-new:9' },
        { action: 'exclude' }
      )
    ).toEqual({ status: 404, body: { error: 'Try not found' } })
  })

  it('the review page gets each flagged try with the id its card sends (stored or legacy)', async () => {
    // 8h a try: flagged (Tier 1) whatever the child's pace
    await insertPlan('plan-new', { responseTimeMs: 28_860_000 })
    const { flagged } = await getTimingReviewData(playerId)
    expect(flagged.map((f) => f.tryId)).toEqual(
      expect.arrayContaining([STORED_ID, 'legacy:plan-new:1'])
    )
    for (const f of flagged) {
      const omitted = await patch(
        byTryId,
        { planId: f.sessionId, tryId: encodeURIComponent(f.tryId) },
        { action: 'exclude', scope: 'timing' }
      )
      expect(omitted.status).toBe(200)
      const index = omitted.body.plan.results.findIndex(
        (r: SlotResult, i: number) => tryIdOf(r, i, f.sessionId) === f.tryId
      )
      expect(omitted.body.plan.results[index].timingReview?.omitFromTiming).toBe(true)
    }
  })
})
