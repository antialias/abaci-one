/**
 * @vitest-environment node
 *
 * Practice-kinds K2: today's open tabs, with their real request bodies.
 *
 * `fixtures/captured-k1-client/*.json` were captured by
 * `e2e/retry-redo-attribution.spec.ts` (`CAPTURE_TRY_BODIES`) against a build
 * of 208433adb, the K1 client and server: each scenario's plan as it started,
 * every `record` / `record_redo` body and flow event the page sent with the
 * status the K1 server answered, and the plan the K1 server ended with.
 *
 * Each is replayed through the K2 routes on `EphemeralDatabase`, as the old
 * bundle sent it and as the K2 bundle would (the superset body): every reply
 * has the status K1 gave, and the stored rows are K1's, field for field but
 * the timestamp. A timing-capped variant (the client's capture-time guard, and
 * a stale client past the server's ceiling) goes through K2 in both bodies and
 * through the K1 recorder logic (`pre-k2/recorders.ts`), giving one row.
 */

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { getTableColumns } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import type { SessionPlan, SlotResult, SlotResultSubmission } from '@/db/schema/session-plans'
import { getSessionPlan } from '@/lib/curriculum/session-planner'
import { MAX_RESPONSE_TIME_CAP_MS } from '@/lib/curriculum/timing/constants'
import { applyResponseTimeGuard } from '@/lib/curriculum/timing/response-time-guard'
import { supersetBodyOf } from '@/lib/curriculum/try-wire'
import {
  createEphemeralDatabase,
  createTestStudent,
  type EphemeralDbResult,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
} from './journey-simulator/EphemeralDatabase'
import * as k1 from './pre-k2/recorders'

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
vi.mock('@/lib/auth/withAuth', () => ({ withAuth: (handler: unknown) => handler }))
vi.mock('@/lib/viewer', () => ({ getUserId: async () => 'adult' }))
vi.mock('@/lib/classroom', () => ({ canPerformAction: async () => true }))
vi.mock('@/lib/classroom/socket-emitter', () => ({ emitSessionStartedToPlayer: vi.fn() }))

// After the mocks: the routes load `@/db`
const { PATCH } = await import('@/app/api/curriculum/[playerId]/sessions/plans/[planId]/route')
const { POST: postFlowEvent } = await import(
  '@/app/api/curriculum/[playerId]/sessions/plans/[planId]/flow-events/route'
)

interface Captured {
  title: string
  start: Record<string, unknown> & { id: string }
  writes: { route: 'plan' | 'flow-events'; body: Record<string, unknown>; status: number }[]
  end: Pick<SessionPlan, 'status' | 'flowState' | 'currentPartIndex' | 'partStates'> & {
    results: Record<string, unknown>[]
  }
}

const DIR = path.join(__dirname, 'fixtures/captured-k1-client')
const CAPTURED: Captured[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => JSON.parse(readFileSync(path.join(DIR, f), 'utf8')))

const COLUMNS = getTableColumns(schema.sessionPlans)

/** The captured start plan as a row of this database (for this player). */
async function insertStart(c: Captured, playerId: string): Promise<string> {
  const values: Record<string, unknown> = {}
  for (const [key, column] of Object.entries(COLUMNS)) {
    if (!(key in c.start)) continue
    const v = c.start[key]
    // the timestamp columns (`flowUpdatedAt`, `createdAt`, …) arrive as epoch ms
    values[key] = column.columnType === 'SQLiteTimestamp' && v != null ? new Date(v as number) : v
  }
  await getCurrentEphemeralDb()
    .insert(schema.sessionPlans)
    .values({ ...values, playerId } as typeof schema.sessionPlans.$inferInsert)
  return c.start.id
}

async function send(
  playerId: string,
  planId: string,
  route: 'plan' | 'flow-events',
  body: unknown
) {
  const url = `http://test/api/curriculum/${playerId}/sessions/plans/${planId}`
  const ctx = { params: Promise.resolve({ playerId, planId }) } as never
  const init = { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  const res =
    route === 'plan'
      ? await PATCH(new Request(url, { method: 'PATCH', ...init }) as never, ctx)
      : await postFlowEvent(
          new Request(`${url}/flow-events`, { method: 'POST', ...init }) as never,
          ctx
        )
  return res.status
}

/** A record / record_redo body as the K2 bundle sends it. */
function asSuperset(body: Record<string, unknown>): Record<string, unknown> {
  if (body.action !== 'record' && body.action !== 'record_redo') return body
  const result = body.result as SlotResultSubmission
  return { ...body, result: supersetBodyOf(result) }
}

/** A stored row as JSON, without the time it was written. */
const comparable = (rows: readonly unknown[]) =>
  (JSON.parse(JSON.stringify(rows)) as Record<string, unknown>[]).map(
    ({ timestamp: _t, ...rest }) => rest
  )

describe('K2 records the K1 client as K1 did (captured request bodies)', () => {
  let eph: EphemeralDbResult
  let playerId: string

  beforeEach(async () => {
    eph = createEphemeralDatabase()
    setCurrentEphemeralDb(eph.db)
    ;({ playerId } = await createTestStudent(eph.db, 'k2-captured'))
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
    setCurrentEphemeralDb(null)
    eph.cleanup()
  })

  it('has the captures it relies on: first tries, retries, do-overs, flow events', () => {
    const actions = CAPTURED.flatMap((c) =>
      c.writes.map((w) => (w.route === 'plan' ? w.body.action : 'flow'))
    )
    expect(new Set(actions)).toEqual(new Set(['record', 'record_redo', 'flow']))
    const kinds = new Set(CAPTURED.flatMap((c) => c.end.results.map((r) => r.kind)))
    expect(kinds).toEqual(new Set(['first', 'retry', 'do_over']))
  })

  for (const body of ['as the old bundle sent it', 'as the K2 superset body'] as const) {
    describe(body, () => {
      for (const c of CAPTURED) {
        it(c.title, async () => {
          const planId = await insertStart(c, playerId)
          const statuses: number[] = []
          for (const w of c.writes) {
            const sent = body === 'as the K2 superset body' ? asSuperset(w.body) : w.body
            statuses.push(await send(playerId, planId, w.route, sent))
          }
          expect(statuses).toEqual(c.writes.map((w) => w.status))

          const after = (await getSessionPlan(planId))!
          expect(comparable(after.results)).toEqual(comparable(c.end.results))
          expect(after.partStates).toEqual(c.end.partStates)
          expect([after.status, after.flowState, after.currentPartIndex]).toEqual([
            c.end.status,
            c.end.flowState,
            c.end.currentPartIndex,
          ])
        })
      }
    })
  }

  describe('a timing-capped first try', () => {
    const c = CAPTURED.find((x) => x.writes[0]?.body.action === 'record')!
    const first = c.writes[0].body.result as SlotResultSubmission
    const AUTO_PAUSE_MS = 30_000
    const variants: [string, SlotResultSubmission][] = [
      // What handleSubmit sends after an idle stretch (the client's guard, #156)
      [
        'capped by the client',
        { ...first, ...applyResponseTimeGuard(10 * 60_000, AUTO_PAUSE_MS, 'client') },
      ],
      // A stale client that never capped, past the server's ceiling
      ['uncapped, past the ceiling', { ...first, responseTimeMs: MAX_RESPONSE_TIME_CAP_MS * 3 }],
    ]

    for (const [name, capped] of variants) {
      it(`${name}: one row from the old body, the superset body and the K1 recorder logic`, async () => {
        const rows: SlotResult[] = []
        for (const sender of ['legacy', 'superset', 'k1'] as const) {
          eph.cleanup()
          eph = createEphemeralDatabase()
          setCurrentEphemeralDb(eph.db)
          ;({ playerId } = await createTestStudent(eph.db, `k2-capped-${sender}`))
          const planId = await insertStart(c, playerId)
          if (sender === 'k1') await k1.recordSlotResult(planId, capped)
          else {
            const result = sender === 'superset' ? supersetBodyOf(capped) : capped
            expect(await send(playerId, planId, 'plan', { action: 'record', result })).toBe(200)
          }
          rows.push((await getSessionPlan(planId))!.results[0])
        }
        const [legacy, superset, k1Row] = comparable(rows)
        expect(superset).toEqual(legacy)
        expect(k1Row).toEqual(legacy)
        expect(legacy).toMatchObject(
          name === 'capped by the client'
            ? {
                responseTimeMs: AUTO_PAUSE_MS,
                responseTimeMsRaw: 10 * 60_000,
                wasIdleCapped: true,
                capReason: 'idle-exceeded',
                capSource: 'client',
              }
            : {
                responseTimeMs: MAX_RESPONSE_TIME_CAP_MS,
                responseTimeMsRaw: MAX_RESPONSE_TIME_CAP_MS * 3,
                wasIdleCapped: true,
                capReason: 'clock-anomaly',
                capSource: 'server',
              }
        )
      })
    }
  })
})
