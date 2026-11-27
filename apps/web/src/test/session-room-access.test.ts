/**
 * @vitest-environment node
 *
 * Phase 4c (session architecture §10 P4a-9, P4c-*): the live session room
 * `session:<id>` is gated like the report room. An unauthorized
 * `join-session` / `subscribe-session-stats` / observer join is refused and
 * hears no `practice-state`; each real caller (the kid's screen, a parent or
 * teacher, a share holder, the history list's stats subscriber) still joins;
 * and the room hears `session-ended` at natural completion, end early and
 * abandon. Real migrations (EphemeralDatabase), the production write path.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import type { SessionPart, SessionPlan, SlotResultSubmission } from '@/db/schema/session-plans'
import {
  authorizeSessionRoomJoin,
  registerObserveSession,
  registerPracticeStateRelay,
  registerSessionControls,
  registerSessionRoomJoins,
  type SharedSessionsData,
  sessionRoom,
  sessionStatsRoom,
} from '@/lib/classroom/session-room-access'
import { getCurrentProblemInfo } from '@/lib/curriculum/parts/arithmetic/state'
import { setRowCommitListener } from '@/lib/curriculum/row-cas'
import {
  abandonSessionPlan,
  completeSessionPlanEarly,
  getSessionPlan,
  recordSlotResult,
} from '@/lib/curriculum/session-planner'
import {
  flushSessionReportPushes,
  registerSessionReportPush,
  resetSessionReportPushState,
} from '@/lib/curriculum/session-report-server'
import { createSessionShare } from '@/lib/session-share'
import { fixtureParts } from './fixtures/session-report'
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

/** A fake connected socket with the session-room joins registered. */
function fakeSocket() {
  const handlers = new Map<string, (data: any) => Promise<void> | void>()
  const sock = {
    received: [] as Array<{ event: string; data: any }>,
    on: (event: string, handler: (data: any) => Promise<void> | void) => {
      handlers.set(event, handler)
    },
    rooms: new Set<string>(),
    data: {} as SharedSessionsData,
    /** `socket.to(room)`: everyone in the room but this socket */
    to: (room: string) => ({
      emit: (event: string, data: unknown) => {
        emitted.push({ room, event, data })
        for (const other of members.get(room) ?? []) {
          if (other !== sock) other.received.push({ event, data })
        }
      },
    }),
    join: (room: string) => {
      if (!members.has(room)) members.set(room, new Set())
      members.get(room)!.add(sock)
      sock.rooms.add(room)
    },
    leave: (room: string) => {
      members.get(room)?.delete(sock)
      sock.rooms.delete(room)
    },
    emit: (event: string, data: unknown) => {
      sock.received.push({ event, data })
    },
    send: async (event: string, data: unknown) => handlers.get(event)!(data),
  }
  // The socket server's registrations, as `socket-server.ts` makes them
  registerSessionRoomJoins(sock)
  registerObserveSession(sock, () => {})
  registerSessionControls(sock, fakeIo)
  registerPracticeStateRelay(sock)
  return sock
}

/** A `practice-state` broadcast: the live answer, the parts and tries. */
function practiceState(planId: string) {
  return {
    sessionId: planId,
    studentAnswer: '15',
    sessionParts: [],
    slotResults: [{ isCorrect: true }],
  }
}

/** The kid's screen sends its state through the real relay. */
async function broadcastPracticeState(from: ReturnType<typeof fakeSocket>, planId: string) {
  await from.send('practice-state', practiceState(planId))
}

/** The kid's screen, admitted to the live room by `join-session`. */
async function admittedKid(planId: string, playerId: string, userId: string) {
  const kid = fakeSocket()
  await kid.send('join-session', { sessionId: planId, viewerId: userId, playerId })
  return kid
}

const heard = (sock: ReturnType<typeof fakeSocket>, event: string) =>
  sock.received.filter((r) => r.event === event)

describe('Phase 4c: the live session room is gated', () => {
  let eph: EphemeralDbResult
  let playerId: string
  let userId: string

  beforeEach(async () => {
    eph = createEphemeralDatabase()
    setCurrentEphemeralDb(eph.db)
    ;({ playerId, userId } = await createTestStudent(eph.db, 'room'))
    emitted.length = 0
    calls.length = 0
    members.clear()
    readTriesFails.on = false
    resetSessionReportPushState()
    // What the socket server does at start
    registerSessionReportPush()
    canPerformAction.mockReset()
    canPerformAction.mockResolvedValue(true)
  })
  afterEach(async () => {
    await flushSessionReportPushes()
    setRowCommitListener(null)
    setCurrentEphemeralDb(null)
    eph.cleanup()
  })

  it.each(['join-session', 'subscribe-session-stats'])(
    '%s: an unauthorized join is refused and hears no practice-state',
    async (event) => {
      const planId = await insertLivePlan(playerId)
      const kid = await admittedKid(planId, playerId, userId)
      const stranger = fakeSocket()
      const anonymous = fakeSocket()
      const otherShareHolder = fakeSocket()
      canPerformAction.mockResolvedValue(false)
      await stranger.send(event, { sessionId: planId, viewerId: 'stranger', playerId })
      await anonymous.send(event, { sessionId: planId })
      const otherPlan = await insertLivePlan(playerId)
      const otherShare = await createSessionShare(otherPlan, playerId, userId, '1h')
      await otherShareHolder.send(event, { sessionId: planId, shareToken: otherShare.id })

      await broadcastPracticeState(kid, planId)

      for (const sock of [stranger, anonymous, otherShareHolder]) {
        expect(sock.received.map((r) => r.event)).toEqual(['session-room-error'])
      }
      expect(canPerformAction).toHaveBeenCalledWith(
        'stranger',
        playerId,
        event === 'join-session' ? 'observe' : 'view'
      )
    }
  )

  it('each real caller joins its room: live room hears practice-state, stats feed hears session-stats', async () => {
    const planId = await insertLivePlan(playerId)
    const share = await createSessionShare(planId, playerId, userId, '1h')
    // The kid's own screen: the viewer that is practicing, with the player
    const kid = await admittedKid(planId, playerId, userId)
    expect(heard(kid, 'session-room-joined')).toEqual([
      { event: 'session-room-joined', data: { sessionId: planId } },
    ])
    // A share holder enters the live room through observe-session
    const shareHolder = fakeSocket()
    await shareHolder.send('observe-session', { sessionId: planId, shareToken: share.id })
    // The history list's stats subscriber names only the session: checked
    // against the session's own player, at `view`
    const stats = fakeSocket()
    await stats.send('subscribe-session-stats', { sessionId: planId, viewerId: userId })

    await broadcastPracticeState(kid, planId)

    expect(heard(shareHolder, 'observe-error')).toEqual([])
    expect(heard(shareHolder, 'practice-state').map((r) => r.data)).toEqual([practiceState(planId)])
    // The sender does not hear its own broadcast
    expect(heard(kid, 'practice-state')).toEqual([])
    expect(heard(stats, 'session-room-error')).toEqual([])
    expect(heard(stats, 'practice-state')).toEqual([])
    expect(heard(stats, 'session-stats').map((r) => r.data)).toEqual([
      { sessionId: planId, sessionParts: [], slotResults: [{ isCorrect: true }] },
    ])
    expect(canPerformAction).toHaveBeenCalledWith(userId, playerId, 'observe')
    expect(canPerformAction).toHaveBeenCalledWith(userId, playerId, 'view')

    // Leaving stops it
    await stats.send('unsubscribe-session-stats', { sessionId: planId })
    await broadcastPracticeState(kid, planId)
    expect(heard(stats, 'session-stats')).toHaveLength(1)
    expect(heard(shareHolder, 'practice-state')).toHaveLength(2)
  })

  it('a viewer with view but not observe (an enrolled, absent teacher) gets stats, not practice-state', async () => {
    const planId = await insertLivePlan(playerId)
    const kid = await admittedKid(planId, playerId, userId)
    canPerformAction.mockImplementation(
      async (_viewer: string, _player: string, action: string) => action === 'view'
    )
    const teacher = fakeSocket()
    await teacher.send('subscribe-session-stats', { sessionId: planId, viewerId: 'teacher' })
    await teacher.send('join-session', { sessionId: planId, viewerId: 'teacher', playerId })

    await broadcastPracticeState(kid, planId)

    expect(heard(teacher, 'session-stats')).toHaveLength(1)
    expect(heard(teacher, 'practice-state')).toEqual([])
    // The live-room join was refused at `observe`
    expect(heard(teacher, 'session-room-error').map((r) => r.data.error)).toEqual([
      'Not authorized to observe this session',
    ])
  })

  describe('controls need an admitted socket', () => {
    it.each([
      ['session-pause', 'session-paused'],
      ['session-resume', 'session-resumed'],
      ['abacus-control', 'abacus-control'],
      ['tutorial-control', 'tutorial-control'],
    ])(
      '%s: a refused socket is dropped, an admitted observer goes through',
      async (event, relayed) => {
        const planId = await insertLivePlan(playerId)
        const kid = fakeSocket()
        await kid.send('join-session', { sessionId: planId, viewerId: userId, playerId })
        // Refused (no observe), then tries a control anyway
        canPerformAction.mockResolvedValue(false)
        const stranger = fakeSocket()
        await stranger.send('join-session', { sessionId: planId, viewerId: 'stranger', playerId })
        await stranger.send(event, { sessionId: planId, action: 'skip' })
        expect(heard(kid, relayed)).toEqual([])

        // Admitted observer, through observe-session
        canPerformAction.mockResolvedValue(true)
        const observer = fakeSocket()
        await observer.send('observe-session', {
          sessionId: planId,
          observerId: userId,
          playerId,
        })
        await observer.send(event, { sessionId: planId, action: 'skip' })
        expect(heard(kid, relayed)).toEqual([
          { event: relayed, data: { sessionId: planId, action: 'skip' } },
        ])

        // A share holder admitted through observe-session stays view-only,
        // even after it observes another session with credentials
        const share = await createSessionShare(planId, playerId, userId, '1h')
        const shareHolder = fakeSocket()
        await shareHolder.send('observe-session', { sessionId: planId, shareToken: share.id })
        expect(shareHolder.rooms.has(sessionRoom(planId))).toBe(true)
        const otherPlan = await insertLivePlan(playerId)
        await shareHolder.send('observe-session', {
          sessionId: otherPlan,
          observerId: userId,
          playerId,
        })
        await shareHolder.send(event, { sessionId: planId, action: 'skip' })
        expect(heard(kid, relayed)).toHaveLength(1)
      }
    )
  })

  it('join-session refuses a share token (share holders observe through observe-session)', async () => {
    const planId = await insertLivePlan(playerId)
    const kid = await admittedKid(planId, playerId, userId)
    const share = await createSessionShare(planId, playerId, userId, '1h')
    const sock = fakeSocket()
    await sock.send('join-session', { sessionId: planId, shareToken: share.id })
    expect(sock.received.map((r) => r.event)).toEqual(['session-room-error'])
    expect(sock.rooms.has(sessionRoom(planId))).toBe(false)
    // So it cannot pause either
    await sock.send('session-pause', { sessionId: planId, reason: 'x' })
    expect(heard(kid, 'session-paused')).toEqual([])
  })

  describe('the practice-state relay', () => {
    it('one broadcast in: practice-state on session:<id>, session-stats (no live answer) on session-stats:<id>', async () => {
      const planId = await insertLivePlan(playerId)
      const kid = await admittedKid(planId, playerId, userId)
      emitted.length = 0
      await broadcastPracticeState(kid, planId)
      expect(emitted.map((e) => [e.room, e.event])).toEqual([
        [sessionRoom(planId), 'practice-state'],
        [sessionStatsRoom(planId), 'session-stats'],
      ])
      expect(emitted[0].data).toEqual(practiceState(planId))
      expect(emitted[1].data).toEqual({
        sessionId: planId,
        sessionParts: [],
        slotResults: [{ isCorrect: true }],
      })
      expect(emitted[1].data).not.toHaveProperty('studentAnswer')
    })

    it("a stranger's or a share holder's practice-state is dropped", async () => {
      const planId = await insertLivePlan(playerId)
      const kid = await admittedKid(planId, playerId, userId)
      const share = await createSessionShare(planId, playerId, userId, '1h')
      const shareHolder = fakeSocket()
      await shareHolder.send('observe-session', { sessionId: planId, shareToken: share.id })
      const stranger = fakeSocket()
      emitted.length = 0
      await stranger.send('practice-state', { ...practiceState(planId), studentAnswer: 'spoof' })
      await shareHolder.send('practice-state', { ...practiceState(planId), studentAnswer: 'spoof' })
      expect(emitted).toEqual([])
      expect(heard(kid, 'practice-state')).toEqual([])
    })
  })

  it('a stats subscriber of an unknown session is refused', async () => {
    const sock = fakeSocket()
    await sock.send('subscribe-session-stats', { sessionId: 'no-such-plan', viewerId: userId })
    expect(sock.received).toEqual([
      {
        event: 'session-room-error',
        data: { sessionId: 'no-such-plan', error: 'Session not found' },
      },
    ])
  })

  it('observer joins (observe-session) use the same check', async () => {
    const planId = await insertLivePlan(playerId)
    const share = await createSessionShare(planId, playerId, userId, '1h')
    const otherPlan = await insertLivePlan(playerId)
    const otherShare = await createSessionShare(otherPlan, playerId, userId, '1h')

    expect(
      await authorizeSessionRoomJoin({ sessionId: planId, viewerId: userId, playerId })
    ).toMatchObject({ ok: true })
    expect(
      await authorizeSessionRoomJoin({ sessionId: planId, shareToken: share.id })
    ).toMatchObject({ ok: true })
    // Another session's share
    expect(
      await authorizeSessionRoomJoin({ sessionId: planId, shareToken: otherShare.id })
    ).toMatchObject({ ok: false })
    // No credential at all (the old handler let a join without a player through)
    expect(await authorizeSessionRoomJoin({ sessionId: planId })).toMatchObject({ ok: false })
    canPerformAction.mockResolvedValue(false)
    expect(
      await authorizeSessionRoomJoin({ sessionId: planId, viewerId: 'stranger', playerId })
    ).toMatchObject({ ok: false, error: 'Not authorized to observe this session' })
  })

  describe('the room hears session-ended (P4a-4)', () => {
    async function joinedObserver(planId: string) {
      const sock = fakeSocket()
      await sock.send('join-session', { sessionId: planId, viewerId: userId, playerId })
      return sock
    }

    it('at natural completion', async () => {
      const planId = await insertLivePlan(playerId, onePart(2))
      const observer = await joinedObserver(planId)
      const stats = fakeSocket()
      await stats.send('subscribe-session-stats', { sessionId: planId, viewerId: userId })
      await answer(planId, true)
      await answer(planId, true)
      await flushSessionReportPushes()
      for (const sock of [observer, stats]) {
        expect(heard(sock, 'session-ended').map((r) => r.data)).toEqual([
          expect.objectContaining({ sessionId: planId, reason: 'completed', outcome: 'completed' }),
        ])
      }
      // Reports stay in the gated report room
      expect(heard(observer, 'session-report')).toEqual([])
    })

    it('at end early', async () => {
      const planId = await insertLivePlan(playerId)
      const observer = await joinedObserver(planId)
      await answer(planId, true)
      await completeSessionPlanEarly(planId)
      await flushSessionReportPushes()
      expect(heard(observer, 'session-ended').map((r) => r.data)).toEqual([
        expect.objectContaining({ sessionId: planId, reason: 'ended_early' }),
      ])
    })

    it('at abandon', async () => {
      const planId = await insertLivePlan(playerId)
      const observer = await joinedObserver(planId)
      await abandonSessionPlan(planId)
      await flushSessionReportPushes()
      expect(heard(observer, 'session-ended').map((r) => r.data)).toEqual([
        expect.objectContaining({ sessionId: planId, reason: 'abandoned' }),
      ])
    })
  })
})
