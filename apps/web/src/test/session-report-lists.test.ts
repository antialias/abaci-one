/**
 * @vitest-environment node
 *
 * Phase 4d (session architecture §4): the dashboard list, the classroom and
 * parent active sessions, and the MCP tools read the session report.
 *
 * Against the real query path (EphemeralDatabase), from the shared fixture:
 * - list rows (`getRecentSessions`, `getPaginatedSessions`) carry exactly the
 *   report's numbers, built from the slim `parts` projection: equal to the
 *   report built from the full row, for the fixture, legacy, abandoned and
 *   offline sessions (§10 P4d-1);
 * - the classroom active-sessions route and `players/[id]/active-session`
 *   answer the live report's progress and totals; the latter never returns
 *   an ended row (no `completedAt` guard before);
 * - `get_practice_sessions` and `get_active_session` answer the report's
 *   numbers, labelled (structured snapshots).
 */

import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import { summarizeSessionReport } from '@/lib/curriculum/session-report'
import {
  abandonedSession,
  doOverSession,
  legacyTenProblemSession,
  liveTenProblemSession,
  mismatchedSlotIdSession,
  missingSlotIdSession,
  offlineSession,
  reportOf,
  type SessionReportFixture,
  TEN_PROBLEM_EXPECTED,
  tenProblemSession,
} from './fixtures/session-report'
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
vi.mock('@/lib/viewer', () => ({ getUserId: async () => 'teacher-user' }))
const classroomState = vi.hoisted(() => ({ playerIds: [] as string[], present: [] as string[] }))
vi.mock('@/lib/classroom', () => ({
  canPerformAction: async () => true,
  getTeacherClassroom: async () => ({ id: 'cls-1' }),
  getEnrolledStudents: async () => classroomState.playerIds.map((id) => ({ id })),
  getClassroomPresence: async () => classroomState.present.map((id) => ({ player: { id } })),
}))

// Lets a test make one row's report build throw (the batch isolates it)
const { failingIds } = vi.hoisted(() => ({ failingIds: new Set<string>() }))
vi.mock('@/lib/curriculum/read-tries', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/curriculum/read-tries')>()
  return {
    ...real,
    readTries: async (plan: Parameters<typeof real.readTries>[0]) => {
      if (failingIds.has(plan.id)) throw new Error('report build failed (test)')
      return real.readTries(plan)
    },
  }
})

const { getRecentSessions, getPaginatedSessions } = await import(
  '@/lib/curriculum/progress-manager'
)
const { GET: activeSessionsGET } = await import(
  '@/app/api/classrooms/[classroomId]/presence/active-sessions/route'
)
const { GET: playerActiveSessionGET } = await import('@/app/api/players/[id]/active-session/route')
const { getPracticeSessions, getActiveSession } = await import('@/lib/mcp/tools')

let eph: EphemeralDbResult
let playerId: string

beforeEach(async () => {
  eph = createEphemeralDatabase()
  setCurrentEphemeralDb(eph.db)
  ;({ playerId } = await createTestStudent(eph.db, 'lists'))
  classroomState.playerIds = [playerId]
  classroomState.present = [playerId]
  failingIds.clear()
})

afterEach(() => {
  setCurrentEphemeralDb(null)
  eph.cleanup()
})

/** Insert a fixture's row (as this test's player) and its break game result. */
async function insertFixture(fixture: SessionReportFixture): Promise<void> {
  const db = getCurrentEphemeralDb()
  await db.insert(schema.sessionPlans).values({ ...fixture.plan, playerId })
  for (const g of fixture.gameResults) {
    await db.insert(schema.gameResults).values({
      id: g.id,
      playerId,
      gameName: g.gameName!,
      gameDisplayName: 'Memory Quiz',
      sessionType: 'practice-break',
      sessionId: fixture.plan.id,
      normalizedScore: 80,
      durationMs: g.durationMs,
      playedAt: g.playedAt as Date,
      fullReport: g.fullReport as never,
    })
  }
}

/** The summary the full-row builder makes for a fixture, as this test's player. */
function expectedSummary(fixture: SessionReportFixture) {
  return summarizeSessionReport(
    reportOf({ ...fixture, plan: { ...fixture.plan, playerId }, song: null })
  )
}

describe('dashboard list rows read the report', () => {
  it('the fixture row: report numbers, legacy fields filled from them', async () => {
    await insertFixture(tenProblemSession())
    const [row] = await getRecentSessions(playerId, 10)
    expect(row.report).toEqual(expectedSummary(tenProblemSession()))
    expect(row.report.totals).toMatchObject({
      problems: TEN_PROBLEM_EXPECTED.problems,
      tries: TEN_PROBLEM_EXPECTED.tries,
      firstTryCorrect: TEN_PROBLEM_EXPECTED.firstTryCorrect,
      finalCorrect: TEN_PROBLEM_EXPECTED.finalCorrect,
    })
    expect(row.report.time).toMatchObject({
      activeMs: TEN_PROBLEM_EXPECTED.activeMs,
      wallMs: TEN_PROBLEM_EXPECTED.wallMs,
      breakMs: TEN_PROBLEM_EXPECTED.breakMs,
    })
    // Legacy fields: problems, first-try correct, active time
    expect(row.problemsAttempted).toBe(10)
    expect(row.problemsCorrect).toBe(7)
    expect(row.totalTimeMs).toBe(TEN_PROBLEM_EXPECTED.activeMs)
  })

  it('slim parts projection = full row, for every fixture (legacy, abandoned, offline, stale/missing slotId, do-over)', async () => {
    const fixtures = [
      tenProblemSession(),
      legacyTenProblemSession(),
      abandonedSession(),
      offlineSession(),
      mismatchedSlotIdSession(),
      missingSlotIdSession(),
      doOverSession(),
    ]
    for (const f of fixtures) await insertFixture(f)
    const rows = await getRecentSessions(playerId, 10)
    const paginated = (await getPaginatedSessions(playerId, 10)).sessions
    for (const f of fixtures) {
      const expected = expectedSummary(f)
      expect(rows.find((r) => r.id === f.plan.id)?.report).toEqual(expected)
      expect(paginated.find((r) => r.id === f.plan.id)?.report).toEqual(expected)
    }
    // Item identity from the slim part's slot and problem: stale or missing
    // slotIds still make ten items; a do-over adds a try and no verdict
    const totalsOf = (id: string) => rows.find((r) => r.id === id)!.report.totals
    const ten = totalsOf('fx-ten-problems')
    expect(totalsOf('fx-mismatched-slot')).toEqual(ten)
    expect(totalsOf('fx-missing-slot')).toEqual(ten)
    expect(totalsOf('fx-do-over')).toEqual({ ...ten, tries: ten.tries + 1 })
  })
})

describe('the batch isolates a bad row', () => {
  it('one report that cannot be built is logged and skipped; the rest of the list stands', async () => {
    await insertFixture(tenProblemSession())
    await insertFixture(abandonedSession())
    failingIds.add('fx-abandoned')
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const rows = await getRecentSessions(playerId, 10)
    expect(rows.map((r) => r.id)).toEqual(['fx-ten-problems'])
    expect(rows[0].report).toEqual(expectedSummary(tenProblemSession()))
    expect(error).toHaveBeenCalledWith(
      '[session-report] report not built',
      expect.objectContaining({ sessionId: 'fx-abandoned' })
    )
    error.mockRestore()
  })
})

describe('classroom active sessions read the live report', () => {
  it('progress and totals from the report; ended rows are not active', async () => {
    const live = liveTenProblemSession()
    await insertFixture(live)
    await insertFixture(tenProblemSession())
    const res = await (activeSessionsGET as any)(new Request('http://x'), {
      params: Promise.resolve({ classroomId: 'cls-1' }),
    })
    const { sessions } = await res.json()
    expect(sessions).toHaveLength(1)
    const now = summarizeSessionReport(
      reportOf({ ...live, plan: { ...live.plan, playerId }, now: Date.now() })
    )
    expect(sessions[0]).toMatchObject({
      sessionId: live.plan.id,
      playerId,
      completedProblems: 7,
      totalProblems: 10,
      outcome: 'in_progress',
      totals: now.totals,
      rowVersion: 11,
      isPresent: true,
    })
  })
})

describe('players/[id]/active-session', () => {
  async function get() {
    const res = await (playerActiveSessionGET as any)(new Request('http://x'), {
      params: Promise.resolve({ id: playerId }),
    })
    return (await res.json()).session
  }

  it('answers the live report: progress, totals, the real start time', async () => {
    const live = liveTenProblemSession()
    await insertFixture(live)
    const session = await get()
    expect(session).toMatchObject({
      sessionId: live.plan.id,
      status: 'in_progress',
      outcome: 'in_progress',
      completedProblems: 7,
      totalProblems: 10,
      startedAt: (live.plan.startedAt as Date).toISOString(),
    })
    expect(session.totals).toMatchObject({ problems: 7, tries: 9, firstTryCorrect: 5 })
  })

  it('never returns an ended session, even one whose status still says in progress', async () => {
    const live = liveTenProblemSession()
    await insertFixture(live)
    await getCurrentEphemeralDb()
      .update(schema.sessionPlans)
      .set({ completedAt: new Date() })
      .where(eq(schema.sessionPlans.id, live.plan.id))
    expect(await get()).toBeNull()
  })
})

describe('MCP tools answer the report', () => {
  it('get_practice_sessions: the fixture session, labelled report numbers', async () => {
    await insertFixture(tenProblemSession())
    const sessions = await getPracticeSessions(playerId, 3650)
    expect(sessions).toMatchInlineSnapshot(`
      [
        {
          "activeMinutes": 1,
          "breakMinutes": 5,
          "completedAt": 2026-01-05T15:12:00.000Z,
          "date": 2026-01-05T15:00:00.000Z,
          "endedEarly": false,
          "finalCorrect": 10,
          "finalPercent": 100,
          "firstTryCorrect": 7,
          "firstTryPercent": 70,
          "fixedInRetries": 3,
          "glitches": 0,
          "outcome": "completed",
          "plannedProblems": 10,
          "problems": 10,
          "sessionId": "fx-ten-problems",
          "timeEstimated": true,
          "tries": 13,
          "unresolved": 0,
          "wallMinutes": 12,
        },
      ]
    `)
  })

  it('get_active_session: progress and counts from the live report', async () => {
    await insertFixture(liveTenProblemSession())
    const result = await getActiveSession(playerId)
    expect(result.hasActiveSession).toBe(true)
    const { progress } = result as { progress: Record<string, unknown> }
    // Wall time runs to now for a live session; everything else is fixed
    expect({ ...progress, wallMinutes: '<now>' }).toMatchInlineSnapshot(`
      {
        "activeMinutes": 0.7,
        "breakMinutes": 5,
        "completedProblems": 7,
        "currentPart": 3,
        "endedEarly": false,
        "finalCorrect": 7,
        "finalPercent": 100,
        "firstTryCorrect": 5,
        "firstTryPercent": 71,
        "fixedInRetries": 2,
        "outcome": "in_progress",
        "plannedProblems": 10,
        "problems": 7,
        "segment": "part",
        "timeEstimated": true,
        "totalProblems": 10,
        "tries": 9,
        "unresolved": 0,
        "wallMinutes": "<now>",
      }
    `)
  })
})
