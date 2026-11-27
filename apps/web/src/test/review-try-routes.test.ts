/**
 * @vitest-environment node
 *
 * The two review routes (#158; session architecture §10 P6b1-12):
 * `tries/[tryId]`, which every client uses since P6b1-12, and
 * `results/[resultIndex]`, kept for open tabs on older bundles (D9). Both hand
 * the request to `reviewTry`, so for the same try they answer the same: auth,
 * the CAS write, and the response the clients read. A row recorded before
 * Phase 1 has no stored `tryId`; it is addressed as `legacy:<planId>:<index>`,
 * the id `tryIdOf` gives it, so the clients can address every try they show.
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

// After the mocks: the routes load `@/db` (the factory reads the imports above)
const { PATCH: byIndex } = await import(
  '@/app/api/curriculum/[playerId]/sessions/plans/[planId]/results/[resultIndex]/route'
)
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

/** The same try reviewed through each route, on twin plans; the answers with the ids aligned */
async function bothRoutes(index: number, body: unknown) {
  await insertPlan('plan-new')
  await insertPlan('plan-old')
  const results = tries()
  // what the clients send: the try id the views give (`tryIdOf`), URL-encoded
  const tryId = tryIdOf(results[index], index, 'plan-new')
  const encoded = reviewTryPath(playerId, 'plan-new', tryId).split('/tries/')[1]
  const viaTryId = await patch(byTryId, { planId: 'plan-new', tryId: encoded }, body)
  const viaIndex = await patch(byIndex, { planId: 'plan-old', resultIndex: String(index) }, body)
  return {
    tryId,
    viaTryId,
    viaIndex: JSON.parse(JSON.stringify(viaIndex).replaceAll('plan-old', 'plan-new')),
  }
}

describe('review routes: tries/[tryId] and results/[resultIndex] answer the same', () => {
  it('a try with a stored id: mark_correct', async () => {
    const { viaTryId, viaIndex } = await bothRoutes(0, { action: 'mark_correct' })
    expect(viaTryId.status).toBe(200)
    expect(viaTryId).toEqual(viaIndex)
    expect(viaTryId.body.plan.results[0]).toMatchObject({ isCorrect: true, tryId: STORED_ID })
    expect(viaTryId.body.plan.rowVersion).toBe(1)
  })

  it('a try from before Phase 1 (no stored id), by its legacy id: exclude, then include', async () => {
    const { tryId, viaTryId, viaIndex } = await bothRoutes(1, { action: 'exclude' })
    expect(tryId).toBe('legacy:plan-new:1')
    expect(viaTryId.status).toBe(200)
    expect(viaTryId).toEqual(viaIndex)
    expect(viaTryId.body.plan.results[1]).not.toHaveProperty('tryId') // no id is stamped on it
    expect(viaTryId.body.plan.results[1].source).toBe('teacher-excluded')

    const included = await patch(byTryId, { planId: 'plan-new', tryId }, { action: 'include' })
    const includedOld = await patch(
      byIndex,
      { planId: 'plan-old', resultIndex: '1' },
      { action: 'include' }
    )
    expect(included).toEqual(
      JSON.parse(JSON.stringify(includedOld).replaceAll('plan-old', 'plan-new'))
    )
    expect(included.body.plan.rowVersion).toBe(2)
  })

  it('the timing actions the review page sends (set_time, confirm_timing)', async () => {
    const set = await bothRoutes(1, { action: 'set_time', adjustedResponseTimeMs: 4000 })
    expect(set.viaTryId.status).toBe(200)
    expect(set.viaTryId).toEqual(set.viaIndex)
    const confirm = await patch(
      byTryId,
      { planId: 'plan-new', tryId: STORED_ID },
      { action: 'confirm_timing' }
    )
    const confirmOld = await patch(
      byIndex,
      { planId: 'plan-old', resultIndex: '0' },
      { action: 'confirm_timing' }
    )
    expect(confirm).toEqual(
      JSON.parse(JSON.stringify(confirmOld).replaceAll('plan-old', 'plan-new'))
    )
  })

  it('refuse alike: not authorized (403), not the player (404); only the miss differs', async () => {
    await insertPlan('plan-new')
    allowed.value = false
    const denied = await patch(
      byTryId,
      { planId: 'plan-new', tryId: STORED_ID },
      { action: 'exclude' }
    )
    const deniedOld = await patch(
      byIndex,
      { planId: 'plan-new', resultIndex: '0' },
      { action: 'exclude' }
    )
    expect(denied).toEqual({ status: 403, body: { error: 'Not authorized' } })
    expect(deniedOld).toEqual(denied)
    allowed.value = true

    const elsewhere = { playerId: 'someone-else', planId: 'plan-new' }
    const notYours = await patch(byTryId, { ...elsewhere, tryId: STORED_ID }, { action: 'exclude' })
    const notYoursOld = await patch(
      byIndex,
      { ...elsewhere, resultIndex: '0' },
      { action: 'exclude' }
    )
    expect(notYours.status).toBe(404)
    expect(notYoursOld).toEqual(notYours)

    // An unknown id is a 404; an index past the end a 400 (the old route's own check)
    expect(
      await patch(
        byTryId,
        { planId: 'plan-new', tryId: 'legacy:plan-new:9' },
        { action: 'exclude' }
      )
    ).toEqual({
      status: 404,
      body: { error: 'Try not found' },
    })
    expect(
      await patch(byIndex, { planId: 'plan-new', resultIndex: '9' }, { action: 'exclude' })
    ).toEqual({ status: 400, body: { error: 'Result index out of bounds' } })
  })

  it('the review page gets each flagged try with the id its card sends (stored or legacy)', async () => {
    // 8h a try: flagged (Tier 1) whatever the child's pace
    await insertPlan('plan-new', { responseTimeMs: 28_860_000 })
    const { flagged } = await getTimingReviewData(playerId)
    expect(flagged.map((f) => [f.tryId, f.resultIndex])).toEqual(
      expect.arrayContaining([
        [STORED_ID, 0],
        ['legacy:plan-new:1', 1],
      ])
    )
    for (const f of flagged) {
      const omitted = await patch(
        byTryId,
        { planId: f.sessionId, tryId: encodeURIComponent(f.tryId) },
        { action: 'exclude', scope: 'timing' }
      )
      expect(omitted.status).toBe(200)
      expect(omitted.body.plan.results[f.resultIndex].timingReview?.omitFromTiming).toBe(true)
    }
  })
})
