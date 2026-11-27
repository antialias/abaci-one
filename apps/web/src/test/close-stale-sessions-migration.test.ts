/**
 * Phase 6b-0 data migration 0148 (session architecture §10 P6b-7, owner-approved
 * 2026-11-27): sessions left in progress from before Phase 3a are closed as
 * `abandonSessionPlan` closes one, with `completed_at` at the last activity.
 *
 * Against real migrations: the file's statements are run again on fixture rows
 * (the migrator ran them once on the empty tables), and the result is compared
 * with what `abandonSessionPlan` writes for a twin row.
 */

import fs from 'node:fs'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import type {
  BreakRecord,
  SessionPart,
  SessionSummary,
  SlotResult,
} from '@/db/schema/session-plans'
import { abandonSessionPlan, getRecentSessionResults } from '@/lib/curriculum/session-planner'
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

const MIGRATION = fs.readFileSync(
  path.resolve(__dirname, '../../drizzle/0148_close_stale_pre_3a_sessions.sql'),
  'utf8'
)

/** Run the migration's statements, as the migrator does */
function runMigration() {
  for (const statement of MIGRATION.split('--> statement-breakpoint')) {
    eph.sqlite.exec(statement)
  }
}

const STARTED = new Date('2026-11-20T15:00:00Z')
const CUTOFF = new Date('2026-11-26T00:00:00Z')

let eph: EphemeralDbResult
let playerId: string
let userId: string

beforeEach(async () => {
  eph = createEphemeralDatabase()
  setCurrentEphemeralDb(eph.db)
  ;({ playerId, userId } = await createTestStudent(eph.db, 'stale-kid'))
})

afterEach(() => {
  setCurrentEphemeralDb(null)
  eph.cleanup()
})

function aTry(slotIndex: number, timestamp: string | number, isCorrect = true): SlotResult {
  const problem = { terms: [slotIndex + 1, 1], answer: slotIndex + 2, skillsRequired: [] }
  return {
    partNumber: 1,
    slotIndex,
    problem,
    studentAnswer: isCorrect ? problem.answer : problem.answer + 1,
    isCorrect,
    responseTimeMs: 3000,
    skillsExercised: ['basic.directAddition'],
    usedOnScreenAbacus: false,
    hadHelp: false,
    incorrectAttempts: 0,
    timestamp,
  } as unknown as SlotResult
}

const parts: SessionPart[] = [
  {
    kind: 'arithmetic',
    partNumber: 1,
    type: 'abacus',
    format: 'vertical',
    useAbacus: true,
    estimatedMinutes: 3,
    slots: [0, 1, 2, 3].map((index) => ({
      slotId: `s${index}`,
      index,
      purpose: 'focus',
      constraints: {},
      problem: { terms: [index + 1, 1], answer: index + 2, skillsRequired: [] },
    })),
  } as SessionPart,
]

async function insertPlan(id: string, row: Partial<typeof schema.sessionPlans.$inferInsert> = {}) {
  await eph.db.insert(schema.sessionPlans).values({
    id,
    playerId,
    targetDurationMinutes: 10,
    estimatedProblemCount: 4,
    avgTimePerProblemSeconds: 5,
    parts,
    summary: {} as SessionSummary,
    status: 'in_progress',
    results: [],
    adjustments: [],
    createdAt: STARTED,
    startedAt: STARTED,
    flowUpdatedAt: STARTED,
    ...row,
  })
}

async function insertShare(id: string, sessionId: string) {
  await eph.db.insert(schema.sessionObservationShares).values({
    id,
    sessionId,
    playerId,
    createdBy: userId,
    createdAt: STARTED,
    expiresAt: new Date('2027-01-01T00:00:00Z'),
    status: 'active',
  })
}

async function rowOf(id: string) {
  const [row] = await eph.db
    .select()
    .from(schema.sessionPlans)
    .where(eq(schema.sessionPlans.id, id))
  return row
}

async function shareStatus(id: string) {
  const [row] = await eph.db
    .select()
    .from(schema.sessionObservationShares)
    .where(eq(schema.sessionObservationShares.id, id))
  return row.status
}

const sec = (iso: string) => new Date(Math.floor(new Date(iso).getTime() / 1000) * 1000)

describe('migration 0148: close stale sessions from before Phase 3a', () => {
  it('a stale row with tries: abandoned, completed at its last try (ISO and epoch-ms stamps), shares expired', async () => {
    const lastMs = new Date('2026-11-20T15:09:30.750Z').getTime()
    await insertPlan('stale-tries', {
      results: [
        aTry(0, '2026-11-20T15:01:00.000Z'),
        aTry(1, lastMs),
        aTry(2, '2026-11-20T15:05:12.400Z', false),
      ],
      currentSlotIndex: 3,
    })
    await insertShare('share-stale', 'stale-tries')

    runMigration()

    const row = await rowOf('stale-tries')
    expect(row).toMatchObject({
      status: 'abandoned',
      flowState: 'abandoned',
      flowVersion: 1,
      rowVersion: 1,
      breaks: [],
      completedAt: sec('2026-11-20T15:09:30.750Z'),
      // nothing else moves
      currentSlotIndex: 3,
      startedAt: STARTED,
    })
    expect(row.flowUpdatedAt.getTime()).toBeGreaterThan(CUTOFF.getTime())
    expect(await shareStatus('share-stale')).toBe('expired')
  })

  it('a stale row with no tries: completed at its start', async () => {
    await insertPlan('stale-empty')

    runMigration()

    expect(await rowOf('stale-empty')).toMatchObject({
      status: 'abandoned',
      flowState: 'abandoned',
      completedAt: STARTED,
      rowVersion: 1,
    })
  })

  it('odd results never abort the migrate or misdate a session: non-objects skipped, out-of-range times ignored', async () => {
    const LAST = '2026-11-20T15:04:00.000Z'
    await insertPlan('stale-odd', {
      results: [
        'not a try',
        42,
        null,
        aTry(0, Math.floor(new Date('2026-11-20T15:09:00Z').getTime() / 1000)), // seconds read as ms: 1970
        aTry(1, '2099-01-01T00:00:00.000Z'), // a bad clock: after now
        aTry(2, LAST),
      ] as unknown as SlotResult[],
    })
    await insertPlan('stale-only-odd', {
      results: ['x', aTry(0, 1_000)] as unknown as SlotResult[],
    })

    expect(() => runMigration()).not.toThrow()

    expect(await rowOf('stale-odd')).toMatchObject({ status: 'abandoned', completedAt: sec(LAST) })
    expect(await rowOf('stale-only-odd')).toMatchObject({
      status: 'abandoned',
      completedAt: STARTED,
    })
  })

  it('writes what abandonSessionPlan writes for a twin row, completed_at aside (an open break closed)', async () => {
    const openBreak: BreakRecord = {
      breakIndex: 0,
      afterPartIndex: 0,
      startedAt: '2026-11-20T15:10:00.000Z',
      game: 'memory-quiz',
    } as BreakRecord
    const twin = {
      results: [aTry(0, '2026-11-20T15:01:00.000Z')],
      flowState: 'break_active' as const,
      flowVersion: 4,
      breaks: [openBreak],
    }
    await insertPlan('by-migration', twin)
    await insertPlan('by-code', twin)
    await insertShare('share-m', 'by-migration')
    await insertShare('share-c', 'by-code')

    runMigration() // abandons both; the code twin is reset and abandoned by code below
    await eph.db
      .update(schema.sessionPlans)
      .set({ status: 'in_progress', rowVersion: 0, completedAt: null, ...twin })
      .where(eq(schema.sessionPlans.id, 'by-code'))
    await eph.db
      .update(schema.sessionObservationShares)
      .set({ status: 'active' })
      .where(eq(schema.sessionObservationShares.id, 'share-c'))
    await abandonSessionPlan('by-code')

    const [m, c] = [await rowOf('by-migration'), await rowOf('by-code')]
    const comparable = (row: typeof m) => ({
      status: row.status,
      flowState: row.flowState,
      flowVersion: row.flowVersion,
      rowVersion: row.rowVersion,
      breaks: row.breaks.map(({ endedAt, durationMs, ...rest }) => ({
        ...rest,
        closed: typeof endedAt === 'string' && typeof durationMs === 'number' && durationMs > 0,
      })),
    })
    expect(comparable(m)).toEqual(comparable(c))
    expect(comparable(m)).toMatchObject({ flowVersion: 5, rowVersion: 1 })
    expect(comparable(m).breaks).toEqual([expect.objectContaining({ closed: true })])
    // the end differs on purpose: last activity, not now
    expect(m.completedAt).toEqual(sec('2026-11-20T15:01:00.000Z'))
    expect(c.completedAt!.getTime()).toBeGreaterThan(CUTOFF.getTime())
    expect([await shareStatus('share-m'), await shareStatus('share-c')]).toEqual([
      'expired',
      'expired',
    ])
  })

  it('a row already in flow state abandoned keeps its flow version and time (flowMove)', async () => {
    await insertPlan('flow-abandoned', { flowState: 'abandoned', flowVersion: 2 })

    runMigration()

    expect(await rowOf('flow-abandoned')).toMatchObject({
      status: 'abandoned',
      flowVersion: 2,
      flowUpdatedAt: STARTED,
      rowVersion: 1,
    })
  })

  it('touches no other row: written since 3a, started on or after the cutoff, completed, draft, approved; nor their shares', async () => {
    const untouched: [string, Partial<typeof schema.sessionPlans.$inferInsert>][] = [
      ['since-3a', { rowVersion: 3 }],
      ['at-cutoff', { startedAt: CUTOFF, createdAt: CUTOFF }],
      ['after-cutoff', { startedAt: new Date('2026-11-27T09:00:00Z') }],
      ['completed', { status: 'completed', completedAt: STARTED }],
      ['draft', { status: 'draft', startedAt: null }],
      ['approved', { status: 'approved', startedAt: null }],
      ['draft-started', { status: 'draft' }],
    ]
    for (const [id, row] of untouched) {
      await insertPlan(id, { results: [aTry(0, '2026-11-20T15:01:00.000Z')], ...row })
      await insertShare(`share-${id}`, id)
    }
    const before = await eph.db.select().from(schema.sessionPlans)

    runMigration()

    expect(await eph.db.select().from(schema.sessionPlans)).toEqual(before)
    for (const [id] of untouched) expect(await shareStatus(`share-${id}`)).toBe('active')
  })

  it('a second run changes nothing', async () => {
    await insertPlan('stale-tries', { results: [aTry(0, '2026-11-20T15:01:00.000Z')] })
    await insertPlan('stale-empty')
    await insertShare('share-stale', 'stale-tries')
    runMigration()
    const plans = await eph.db.select().from(schema.sessionPlans)
    const shares = await eph.db.select().from(schema.sessionObservationShares)

    runMigration()

    expect(await eph.db.select().from(schema.sessionPlans)).toEqual(plans)
    expect(await eph.db.select().from(schema.sessionObservationShares)).toEqual(shares)
  })

  it('BKT evidence is unchanged: it reads completed and recency-refresh sessions only', async () => {
    await insertPlan('done', {
      status: 'completed',
      completedAt: new Date('2026-11-19T16:00:00Z'),
      results: [aTry(0, '2026-11-19T15:01:00.000Z'), aTry(1, '2026-11-19T15:02:00.000Z', false)],
    })
    await insertPlan('stale', {
      results: [aTry(0, '2026-11-20T15:01:00.000Z'), aTry(1, '2026-11-20T15:02:00.000Z')],
    })
    const before = await getRecentSessionResults(playerId)
    expect(before.map((r) => r.sessionId)).toEqual(['done', 'done'])

    runMigration()

    expect((await rowOf('stale')).status).toBe('abandoned')
    expect(await getRecentSessionResults(playerId)).toEqual(before)
  })
})
