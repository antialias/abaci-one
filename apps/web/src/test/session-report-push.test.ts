/**
 * @vitest-environment node
 *
 * Phase 4a of the session architecture (plan of record §4, §7): the report
 * routes and the push from the CAS commit path, against real migrations
 * (EphemeralDatabase) and the production write path.
 *
 * The socket server is a recorder installed in place of `@/lib/socket-io`:
 * every `io.to(room).emit(event, data)` lands in `emitted`, in order.
 */

import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import { getCurrentProblemInfo } from '@/db/schema/session-plan-helpers'
import type { SessionPart, SessionPlan, SlotResultSubmission } from '@/db/schema/session-plans'
import {
  abandonSessionPlan,
  completeSessionPlanEarly,
  getSessionPlan,
  recordSlotResult,
} from '@/lib/curriculum/session-planner'
import type { SessionReport } from '@/lib/curriculum/session-report'
import { registerSessionReportJoin } from '@/lib/curriculum/session-report-access'
import {
  flushSessionReportPushes,
  resetSessionReportPushState,
} from '@/lib/curriculum/session-report-server'
import { applySlotResultReview } from '@/lib/curriculum/session-review'
import { createSessionShare, revokeSessionShare } from '@/lib/session-share'
import {
  fixtureBreakGameResult,
  fixtureParts,
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

const { emitted, calls, members, fakeIo } = vi.hoisted(() => {
  const emitted: Array<{ room: string; event: string; data: any }> = []
  /** One entry per `io.to(...).emit(...)` call */
  const calls: Array<{ rooms: string[]; event: string; data: any }> = []
  /** Room membership of fake sockets (`join` in the gated-room tests) */
  const members = new Map<string, Set<{ received: Array<{ event: string; data: any }> }>>()
  const fakeIo = {
    to: (target: string | string[]) => ({
      emit: (event: string, data: unknown) => {
        const rooms = Array.isArray(target) ? target : [target]
        calls.push({ rooms, event, data })
        const delivered = new Set<{ received: Array<{ event: string; data: any }> }>()
        for (const room of rooms) {
          emitted.push({ room, event, data })
          for (const socket of members.get(room) ?? []) delivered.add(socket)
        }
        for (const socket of delivered) socket.received.push({ event, data })
      },
    }),
  }
  return { emitted, calls, members, fakeIo }
})
vi.mock('@/lib/socket-io', () => ({
  getSocketIO: async () => fakeIo,
  hasSocketIO: () => true,
}))
vi.mock('@/lib/classroom/presence-manager', () => ({
  getStudentPresence: async () => ({ classroomId: 'cls-1' }),
}))
// Lets a test make the report build throw (the end must still go out)
const { readTriesFails } = vi.hoisted(() => ({ readTriesFails: { on: false } }))
vi.mock('@/lib/curriculum/read-tries', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/curriculum/read-tries')>()
  return {
    ...real,
    readTries: async (plan: Parameters<typeof real.readTries>[0]) => {
      if (readTriesFails.on) throw new Error('report build failed (test)')
      return real.readTries(plan)
    },
  }
})

const { recordSkillAttemptsWithHelp } = vi.hoisted(() => ({
  recordSkillAttemptsWithHelp: vi.fn(async () => []),
}))
vi.mock('@/lib/curriculum/progress-manager', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/curriculum/progress-manager')>()),
  recordSkillAttemptsWithHelp,
}))

// The routes, without the auth layer
vi.mock('@/lib/auth/withAuth', () => ({ withAuth: (handler: unknown) => handler }))
vi.mock('@/lib/viewer', () => ({ getUserId: async () => 'viewer' }))
const { canPerformAction } = vi.hoisted(() => ({ canPerformAction: vi.fn(async () => true) }))
vi.mock('@/lib/classroom', () => ({ canPerformAction }))

const { GET: planReportGET } = await import(
  '@/app/api/curriculum/[playerId]/sessions/plans/[planId]/report/route'
)
const { GET: tokenReportGET } = await import('@/app/api/observe/[token]/report/route')

type RouteHandler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => any

async function callPlanReport(playerId: string, planId: string) {
  const res: Response = await (planReportGET as unknown as RouteHandler)(
    new Request('http://localhost/report'),
    { params: Promise.resolve({ playerId, planId }) }
  )
  return { status: res.status, body: await res.json() }
}

async function callTokenReport(token: string) {
  const res: Response = await (tokenReportGET as unknown as RouteHandler)(
    new Request('http://localhost/report'),
    { params: Promise.resolve({ token }) }
  )
  return { status: res.status, body: await res.json() }
}

const FIXED = new Date('2026-01-01T00:00:00.000Z')
let tryCounter = 0
const tid = () => `00000000-0000-4000-8000-${String(++tryCounter).padStart(12, '0')}`

async function insertLivePlan(playerId: string, parts: SessionPart[] = fixtureParts()) {
  const id = `rp-${Math.random().toString(36).slice(2, 10)}`
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
      parts,
      summary: {} as SessionPlan['summary'],
      masteredSkillIds: [],
      status: 'in_progress',
      flowState: 'practicing',
      flowUpdatedAt: FIXED,
      flowVersion: 0,
      currentPartIndex: 0,
      currentSlotIndex: 0,
      results: [],
      adjustments: [],
      createdAt: FIXED,
      approvedAt: FIXED,
      startedAt: FIXED,
    })
  return id
}

function submissionFor(plan: SessionPlan, correct: boolean, tryId = tid()): SlotResultSubmission {
  const info = getCurrentProblemInfo(plan)
  if (!info) throw new Error('client shows no problem')
  return {
    tryId,
    epochNumber: info.epochNumber,
    slotId: info.slotId,
    slotIndex: info.originalSlotIndex,
    problem: info.problem,
    studentAnswer: correct ? info.problem.answer : info.problem.answer + 1,
    isCorrect: correct,
    responseTimeMs: 3000,
    skillsExercised: info.problem.skillsRequired,
    usedOnScreenAbacus: false,
    hadHelp: false,
    incorrectAttempts: correct ? 0 : 1,
  }
}

async function answer(planId: string, correct: boolean) {
  const plan = (await getSessionPlan(planId))!
  return recordSlotResult(planId, submissionFor(plan, correct))
}

/** One-part plan of `n` slots, so a session can finish in a few tries. */
function onePart(n: number): SessionPart[] {
  const part = fixtureParts()[0]
  return [{ ...part, slots: part.slots.slice(0, n) }]
}

/** A fake connected socket: `join` adds it to `members`, `received` collects what it hears. */
function fakeSocket() {
  const handlers = new Map<string, (data: any) => Promise<void> | void>()
  const sock = {
    received: [] as Array<{ event: string; data: any }>,
    on: (event: string, handler: (data: any) => Promise<void> | void) => {
      handlers.set(event, handler)
    },
    join: (room: string) => {
      if (!members.has(room)) members.set(room, new Set())
      members.get(room)!.add(sock)
    },
    leave: (room: string) => {
      members.get(room)?.delete(sock)
    },
    emit: (event: string, data: unknown) => {
      sock.received.push({ event, data })
    },
    send: async (event: string, data: unknown) => handlers.get(event)!(data),
  }
  registerSessionReportJoin(sock)
  return sock
}

const reportsPushed = (planId: string): SessionReport[] =>
  emitted
    .filter((e) => e.event === 'session-report' && e.room === `session-report:${planId}`)
    .map((e) => e.data.report)

describe('Phase 4a: session report push and routes', () => {
  let eph: EphemeralDbResult
  let playerId: string
  let userId: string

  beforeEach(async () => {
    eph = createEphemeralDatabase()
    setCurrentEphemeralDb(eph.db)
    ;({ playerId, userId } = await createTestStudent(eph.db, 'report'))
    emitted.length = 0
    calls.length = 0
    members.clear()
    readTriesFails.on = false
    resetSessionReportPushState()
    canPerformAction.mockClear()
    canPerformAction.mockResolvedValue(true)
  })
  afterEach(async () => {
    await flushSessionReportPushes()
    setCurrentEphemeralDb(null)
    eph.cleanup()
  })

  describe('push from the CAS commit', () => {
    it('two writes push two reports with strictly increasing rowVersion', async () => {
      const planId = await insertLivePlan(playerId)
      await answer(planId, true)
      await answer(planId, false)
      await flushSessionReportPushes()

      const reports = reportsPushed(planId)
      expect(reports.map((r) => r.rowVersion)).toEqual([1, 2])
      expect(reports[1].totals).toMatchObject({ problems: 2, tries: 2, firstTryCorrect: 1 })
      expect(reports[1].position?.progress).toEqual({ done: 2, total: 10 })
      expect(emitted.some((e) => e.event === 'session-ended')).toBe(false)
    })

    it('a write that lost the race pushes nothing: four sends of one try, one push', async () => {
      const planId = await insertLivePlan(playerId)
      const plan = (await getSessionPlan(planId))!
      const submission = submissionFor(plan, true)
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const settled = await Promise.allSettled(
        [0, 1, 2, 3].map(() => recordSlotResult(planId, { ...submission }))
      )
      warn.mockRestore()
      await flushSessionReportPushes()

      expect(settled.some((s) => s.status === 'fulfilled')).toBe(true)
      const after = (await getSessionPlan(planId))!
      expect(after.rowVersion).toBe(1)
      expect(reportsPushed(planId).map((r) => r.rowVersion)).toEqual([1])
    })

    it('concurrent writes that all commit push in commit order, versions strictly increasing', async () => {
      const planId = await insertLivePlan(playerId, onePart(4))
      for (let i = 0; i < 4; i++) await answer(planId, false) // four wrong: retries queued
      emitted.length = 0
      const plan = (await getSessionPlan(planId))!
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      // Three adult reviews at once: each re-applies to the newer row (CAS)
      await Promise.allSettled(
        plan.results.slice(0, 3).map((r) =>
          applySlotResultReview({
            playerId,
            planId,
            target: { tryId: r.tryId! },
            action: { action: 'mark_correct' },
            reviewerUserId: userId,
          })
        )
      )
      warn.mockRestore()
      await flushSessionReportPushes()

      const after = (await getSessionPlan(planId))!
      const versions = reportsPushed(planId).map((r) => r.rowVersion)
      expect(versions.length).toBeGreaterThan(0)
      for (let i = 1; i < versions.length; i++) expect(versions[i]).toBeGreaterThan(versions[i - 1])
      expect(versions[versions.length - 1]).toBe(after.rowVersion)
    })

    it('natural completion pushes the final report, then session-ended to every room', async () => {
      const planId = await insertLivePlan(playerId, onePart(2))
      await answer(planId, true)
      await answer(planId, true)
      await flushSessionReportPushes()

      const after = (await getSessionPlan(planId))!
      expect(after.status).toBe('completed')
      const last = reportsPushed(planId).at(-1)!
      expect(last).toMatchObject({ outcome: 'completed', rowVersion: after.rowVersion })

      // One emit to the player, classroom and gated report rooms (deduped per socket);
      // nothing named session-ended to `session:<id>`, where observers stop on it (P4a-4)
      const ended = calls.filter((c) => c.event === 'session-ended')
      expect(ended).toHaveLength(1)
      expect([...ended[0].rooms].sort()).toEqual(
        ['classroom:cls-1', `player:${playerId}`, `session-report:${planId}`].sort()
      )
      expect(ended[0].data).toMatchObject({
        sessionId: planId,
        playerId,
        reason: 'completed',
        outcome: 'completed',
        rowVersion: after.rowVersion,
      })
      expect(emitted.filter((e) => e.room === `session:${planId}`)).toEqual([])
      const lastReportAt = calls.findIndex((c) => c.data?.report === last)
      expect(calls.findIndex((c) => c.event === 'session-ended')).toBeGreaterThan(lastReportAt)
    })

    it('session-ended still goes out when the report build fails', async () => {
      const planId = await insertLivePlan(playerId, onePart(1))
      readTriesFails.on = true
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      await answer(planId, true)
      await flushSessionReportPushes()
      error.mockRestore()

      expect(reportsPushed(planId)).toEqual([])
      const ended = calls.filter((c) => c.event === 'session-ended')
      expect(ended).toHaveLength(1)
      expect(ended[0].data).toMatchObject({ sessionId: planId, outcome: 'completed' })
    })

    it('end early and abandon emit session-ended once, with their reasons', async () => {
      const early = await insertLivePlan(playerId)
      await completeSessionPlanEarly(early, 'tired')
      await completeSessionPlanEarly(early, 'again') // already ended: no second end
      const gone = await insertLivePlan(playerId)
      await abandonSessionPlan(gone)
      await flushSessionReportPushes()

      const reasons = (planId: string) =>
        emitted
          .filter((e) => e.event === 'session-ended' && e.room === `player:${playerId}`)
          .filter((e) => e.data.sessionId === planId)
          .map((e) => e.data.reason)
      expect(reasons(early)).toEqual(['ended_early'])
      expect(reasons(gone)).toEqual(['abandoned'])
      expect(reportsPushed(early).at(-1)).toMatchObject({ outcome: 'completed', endedEarly: true })
    })
  })

  describe('routes', () => {
    async function insertFixture(): Promise<string> {
      const { plan } = tenProblemSession()
      await getCurrentEphemeralDb()
        .insert(schema.sessionPlans)
        .values({ ...plan, playerId })
      const g = fixtureBreakGameResult(plan.id)
      await getCurrentEphemeralDb()
        .insert(schema.gameResults)
        .values({
          id: g.id,
          playerId,
          gameName: g.gameName!,
          gameDisplayName: 'Memory Quiz',
          sessionType: 'practice-break',
          sessionId: plan.id,
          normalizedScore: 80,
          durationMs: g.durationMs,
          playedAt: g.playedAt as Date,
          fullReport: g.fullReport as never,
        })
      return plan.id
    }

    it('plan route: the fixture session reads back with the acceptance numbers', async () => {
      const planId = await insertFixture()
      const { status, body } = await callPlanReport(playerId, planId)
      expect(status).toBe(200)
      const report = body.report as SessionReport
      expect(report.totals).toMatchObject({
        problems: TEN_PROBLEM_EXPECTED.problems,
        tries: TEN_PROBLEM_EXPECTED.tries,
        firstTryAccuracy: TEN_PROBLEM_EXPECTED.firstTryAccuracy,
        fixedInRetries: TEN_PROBLEM_EXPECTED.fixedInRetries,
        finalAccuracy: TEN_PROBLEM_EXPECTED.finalAccuracy,
      })
      expect(report.time).toMatchObject({
        activeMs: TEN_PROBLEM_EXPECTED.activeMs,
        wallMs: TEN_PROBLEM_EXPECTED.wallMs,
        breakMs: TEN_PROBLEM_EXPECTED.breakMs,
      })
      expect(report.breaks).toHaveLength(1)
    })

    it('plan route: 403 without view access, 404 for another player’s plan', async () => {
      const planId = await insertFixture()
      canPerformAction.mockResolvedValueOnce(false)
      expect((await callPlanReport(playerId, planId)).status).toBe(403)
      expect((await callPlanReport('someone-else', planId)).status).toBe(404)
    })

    it('token route: serves a live session on an active token', async () => {
      const planId = await insertLivePlan(playerId)
      const share = await createSessionShare(planId, playerId, userId, '1h')
      const { status, body } = await callTokenReport(share.id)
      expect(status).toBe(200)
      expect(body.report).toMatchObject({ sessionId: planId, outcome: 'in_progress' })
    })

    it('token route: revoked refuses always; expired-by-completion serves only once ended', async () => {
      const planId = await insertLivePlan(playerId)
      const share = await createSessionShare(planId, playerId, userId, '1h')
      await revokeSessionShare(share.id)
      expect((await callTokenReport(share.id)).status).toBe(404)

      // An expired (not revoked) share before its expiresAt refuses a live session
      const liveShare = await createSessionShare(planId, playerId, userId, '1h')
      await getCurrentEphemeralDb()
        .update(schema.sessionObservationShares)
        .set({ status: 'expired' })
        .where(eq(schema.sessionObservationShares.id, liveShare.id))
      expect((await callTokenReport(liveShare.id)).status).toBe(410)

      // Completion expires the session's shares (revokeSharesForSession)
      const other = await insertLivePlan(playerId, onePart(1))
      const otherShare = await createSessionShare(other, playerId, userId, '1h')
      await answer(other, true)
      const [row] = await getCurrentEphemeralDb()
        .select()
        .from(schema.sessionObservationShares)
        .where(eq(schema.sessionObservationShares.id, otherShare.id))
      expect(row.status).toBe('expired')
      const ended = await callTokenReport(otherShare.id)
      expect(ended.status).toBe(200)
      expect(ended.body.report).toMatchObject({ sessionId: other, outcome: 'completed' })

      // A share an adult revoked by hand stays refused after the session ends
      await completeSessionPlanEarly(planId)
      expect((await callTokenReport(share.id)).status).toBe(404)
    })

    it('gated report room: an unauthorized join is refused and hears no report; an authorized one does', async () => {
      const planId = await insertLivePlan(playerId, onePart(2))
      const stranger = fakeSocket()
      const parent = fakeSocket()
      const otherShareHolder = fakeSocket()
      const shareHolder = fakeSocket()
      canPerformAction.mockResolvedValueOnce(false)
      await stranger.send('subscribe-session-report', {
        sessionId: planId,
        viewerId: 'x',
        playerId,
      })
      canPerformAction.mockResolvedValueOnce(true)
      await parent.send('subscribe-session-report', {
        sessionId: planId,
        viewerId: userId,
        playerId,
      })
      const otherPlan = await insertLivePlan(playerId)
      const otherShare = await createSessionShare(otherPlan, playerId, userId, '1h')
      await otherShareHolder.send('subscribe-session-report', {
        sessionId: planId,
        shareToken: otherShare.id,
      })
      const share = await createSessionShare(planId, playerId, userId, '1h')
      await shareHolder.send('subscribe-session-report', {
        sessionId: planId,
        shareToken: share.id,
      })

      expect(stranger.received.map((r) => r.event)).toEqual(['session-report-error'])
      expect(otherShareHolder.received.map((r) => r.event)).toEqual(['session-report-error'])
      expect(parent.received.map((r) => r.event)).toEqual(['session-report-subscribed'])
      expect(shareHolder.received.map((r) => r.event)).toEqual(['session-report-subscribed'])

      await answer(planId, true)
      await answer(planId, true)
      await flushSessionReportPushes()

      const heard = (sock: ReturnType<typeof fakeSocket>, event: string) =>
        sock.received.filter((r) => r.event === event)
      expect(heard(stranger, 'session-report')).toEqual([])
      expect(heard(otherShareHolder, 'session-report')).toEqual([])
      for (const sock of [parent, shareHolder]) {
        expect(heard(sock, 'session-report').length).toBeGreaterThanOrEqual(2)
        expect(heard(sock, 'session-report').at(-1)!.data.report.outcome).toBe('completed')
        expect(heard(sock, 'session-ended')).toHaveLength(1)
      }

      // After completion the session's shares are expired: they may still join the ended report
      const late = fakeSocket()
      await late.send('subscribe-session-report', { sessionId: planId, shareToken: share.id })
      expect(late.received.map((r) => r.event)).toEqual(['session-report-subscribed'])
    })

    it('token route: a share past its own expiry is refused even for an ended session', async () => {
      const planId = await insertFixture()
      const share = await createSessionShare(planId, playerId, userId, '1h')
      await getCurrentEphemeralDb()
        .update(schema.sessionObservationShares)
        .set({ status: 'expired', expiresAt: new Date(Date.now() - 1000) })
        .where(eq(schema.sessionObservationShares.id, share.id))
      expect((await callTokenReport(share.id)).status).toBe(404)
      expect((await callTokenReport('nosuchtokn')).status).toBe(404)
    })
  })
})
