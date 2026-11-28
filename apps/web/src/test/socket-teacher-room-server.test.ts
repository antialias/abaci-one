/**
 * @vitest-environment node
 *
 * Socket identity PR 3: `classroom:<id>` is the teacher-only room, on the
 * real socket server with real clients and cookies (socket-server-harness.ts),
 * the real emitters and the real access rules over an EphemeralDatabase.
 *
 * - Who hears what: a classmate's parent (parent-b, whose kid-b is in the
 *   class) hears none of the teacher's feed about kid-a, whatever its device
 *   joins; the teacher hears all of it.
 * - The skill tutorial: the kid's state goes to the teacher rooms of its
 *   enrolled classrooms, decided by enrollment on the server (its first frame
 *   needs no join first); the teacher's controls go to the kid's `player:<id>`.
 * - Old tabs: an old kid tab (joins `classroom:`, listens there for controls)
 *   and an old teacher tab (joins `classroom:` before steering) against this
 *   server.
 */

import type { Socket as ClientSocket } from 'socket.io-client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import type { SessionPlan } from '@/db/schema/session-plans'
import { enterClassroom, leaveClassroom } from '@/lib/classroom/presence-manager'
import {
  emitEnrollmentCompleted,
  emitEnrollmentRequestApproved,
  emitEnrollmentRequestCreated,
  emitEnrollmentRequestDenied,
  emitEntryPromptAccepted,
  emitStudentUnenrolled,
} from '@/lib/classroom/socket-emitter'
import { abandonSessionPlan, startSessionPlan } from '@/lib/curriculum/session-planner'
import { flushSessionReportPushes } from '@/lib/curriculum/session-report-server'
import { fixtureParts } from './fixtures/session-report'
import {
  createEphemeralDatabase,
  type EphemeralDbResult,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
} from './journey-simulator/EphemeralDatabase'
import {
  client,
  cookieFor,
  disconnectClients,
  next,
  roomsOf,
  startSocketServer,
  stopSocketServer,
} from './socket-server-harness'

vi.mock('server-only', () => ({}))
vi.mock('@/db', () => ({
  get db() {
    return getCurrentEphemeralDb()
  },
  schema,
}))
vi.mock('@/lib/task-manager', () => ({
  cleanupZombieTasks: async () => 0,
  registerTaskHooks: () => {},
  initCancellationSubscriber: () => {},
  initCancellationDbSync: () => {},
}))

const CLASSROOM = 'cls-1'

/** A teacher, two parents whose kids are enrolled (kid-a present today), a stranger. */
async function seed(db: ReturnType<typeof getCurrentEphemeralDb>) {
  for (const id of ['teacher', 'parent-a', 'parent-b', 'stranger']) {
    await db.insert(schema.users).values({ id, guestId: `guest-${id}` })
  }
  for (const [id, userId] of [
    ['kid-a', 'parent-a'],
    ['kid-b', 'parent-b'],
  ]) {
    await db
      .insert(schema.players)
      .values({ id, userId, name: id, emoji: '🧒', color: '#000', isActive: true })
  }
  await db
    .insert(schema.classrooms)
    .values({ id: CLASSROOM, teacherId: 'teacher', name: 'Class', code: 'CLS-1' })
  for (const playerId of ['kid-a', 'kid-b']) {
    await db.insert(schema.classroomEnrollments).values({ classroomId: CLASSROOM, playerId })
  }
  await db
    .insert(schema.classroomPresence)
    .values({ playerId: 'kid-a', classroomId: CLASSROOM, enteredBy: 'parent-a' })
}

async function insertApprovedPlan(playerId: string): Promise<string> {
  const id = `plan-${Math.random().toString(36).slice(2, 10)}`
  const now = new Date()
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
      status: 'approved',
      flowState: 'practicing',
      flowUpdatedAt: now,
      flowVersion: 0,
      currentPartIndex: 0,
      results: [],
      adjustments: [],
      createdAt: now,
      approvedAt: now,
    })
  return id
}

/**
 * Wait until the server has handled everything this client sent so far, and
 * delivered to it everything emitted to it before (one connection is in
 * order): a `join-player` of no player is answered after its database reads.
 */
async function settled(sock: ClientSocket) {
  const answer = next(sock, 'channel-error', 5000)
  sock.emit('join-player', { playerId: 'no-such-player' })
  expect(await answer).toMatchObject({ channel: 'player', id: 'no-such-player' })
}

/** A join of `classroom:` or `player:`, answered either way. */
async function joinChannel(sock: ClientSocket, channel: 'classroom' | 'player', id: string) {
  const answer = new Promise<string>((resolve) => {
    const on = (event: string) => (ack: { channel: string; id: string }) => {
      if (ack?.channel !== channel || ack.id !== id) return
      sock.off('channel-joined', joinedOn)
      sock.off('channel-error', errorOn)
      resolve(event)
    }
    const joinedOn = on('channel-joined')
    const errorOn = on('channel-error')
    sock.on('channel-joined', joinedOn)
    sock.on('channel-error', errorOn)
  })
  sock.emit(channel === 'classroom' ? 'join-classroom' : 'join-player', {
    [channel === 'classroom' ? 'classroomId' : 'playerId']: id,
  })
  return answer
}

/** Every event a client hears from now on, by name. */
function hearing(sock: ClientSocket) {
  const heard: Array<{ event: string; data: any }> = []
  sock.onAny((event: string, data: unknown) => heard.push({ event, data }))
  return heard
}

/** The teacher's classroom view (`useClassroomSocket`): in `classroom:<id>`. */
async function teacherView() {
  const teacher = await client(await cookieFor('teacher'))
  expect(await joinChannel(teacher, 'classroom', CLASSROOM)).toBe('channel-joined')
  return teacher
}

/** A kid's device on the new client (`useSkillTutorialBroadcast`): in its own `player:<id>`. */
async function kidDevice(parent: string, playerId: string) {
  const sock = await client(await cookieFor(parent))
  expect(await joinChannel(sock, 'player', playerId)).toBe('channel-joined')
  return sock
}

const tutorialState = (playerId: string, skillTitle: string) => ({
  playerId,
  playerName: playerId,
  launcherState: 'tutorial',
  skillId: 's',
  skillTitle,
})

const ACKS = new Set(['channel-joined', 'channel-error'])

describe('PR 3: classroom:<id> is the teacher-only room', () => {
  let eph: EphemeralDbResult

  beforeAll(async () => {
    await startSocketServer()
  })
  afterAll(async () => {
    await stopSocketServer()
  })
  beforeEach(async () => {
    eph = createEphemeralDatabase()
    setCurrentEphemeralDb(eph.db)
    await seed(eph.db)
  })
  afterEach(async () => {
    await flushSessionReportPushes()
    disconnectClients()
    vi.restoreAllMocks()
    setCurrentEphemeralDb(null)
    eph.cleanup()
  })

  describe('who hears what: the teacher hears all of it, a classmate’s parent none', () => {
    /** parent-b's device, doing everything a parent-b tab does today and did before. */
    async function classmateParent() {
      const sock = await client(await cookieFor('parent-b'))
      const heard = hearing(sock)
      // An old kid tab, and every kid tab before PR 3, joined the classroom
      expect(await joinChannel(sock, 'classroom', CLASSROOM)).toBe('channel-error')
      // Its own kid's channel (dashboard, history, the new tutorial hook)
      expect(await joinChannel(sock, 'player', 'kid-b')).toBe('channel-joined')
      expect((await roomsOf(sock)).has(`classroom:${CLASSROOM}`)).toBe(false)
      return { sock, heard }
    }
    const notAck = (heard: Array<{ event: string }>) => heard.filter((h) => !ACKS.has(h.event))

    const enrollment = {
      requestId: 'req-1',
      classroomId: CLASSROOM,
      classroomName: 'Class',
      playerId: 'kid-a',
      playerName: 'kid-a',
    }
    const fromEmitter: Array<[string, () => Promise<void>]> = [
      [
        'enrollment-request-created',
        () =>
          emitEnrollmentRequestCreated(
            { ...enrollment, requestedByRole: 'parent' },
            { classroomId: CLASSROOM }
          ),
      ],
      [
        'enrollment-request-approved',
        () =>
          emitEnrollmentRequestApproved(
            { ...enrollment, approvedBy: 'parent' },
            { classroomId: CLASSROOM }
          ),
      ],
      [
        'enrollment-request-denied',
        () =>
          emitEnrollmentRequestDenied(
            { ...enrollment, deniedBy: 'parent' },
            { classroomId: CLASSROOM }
          ),
      ],
      [
        'enrollment-approved',
        () => emitEnrollmentCompleted(enrollment, { classroomId: CLASSROOM }),
      ],
      [
        'student-unenrolled',
        () =>
          emitStudentUnenrolled(
            { ...enrollment, unenrolledBy: 'teacher' },
            { classroomId: CLASSROOM }
          ),
      ],
      [
        'entry-prompt-accepted',
        () =>
          emitEntryPromptAccepted(
            { ...enrollment, promptId: 'p-1', acceptedBy: 'parent-a' },
            'teacher'
          ),
      ],
      ['student-left', () => leaveClassroom('kid-a')],
    ]

    it.each(fromEmitter)('%s (emitToRecipients, presence, entry prompts)', async (event, fire) => {
      const teacher = await teacherView()
      const { sock: parentB, heard } = await classmateParent()
      const heardByTeacher = next(teacher, event, 5000)
      await fire()
      expect(await heardByTeacher).toMatchObject({})
      await settled(parentB)
      expect(notAck(heard)).toEqual([])
    })

    it('student-entered', async () => {
      await leaveClassroom('kid-a')
      const teacher = await teacherView()
      const { sock: parentB, heard } = await classmateParent()
      const entered = next(teacher, 'student-entered', 5000)
      expect(
        await enterClassroom({ playerId: 'kid-a', classroomId: CLASSROOM, enteredBy: 'parent-a' })
      ).toMatchObject({ success: true })
      expect(await entered).toMatchObject({ playerId: 'kid-a' })
      await settled(parentB)
      expect(notAck(heard)).toEqual([])
    })

    it('another kid’s session-started, classroom-session-summary and session-ended', async () => {
      const teacher = await teacherView()
      const { sock: parentB, heard } = await classmateParent()
      const planId = await insertApprovedPlan('kid-a')

      const started = next(teacher, 'session-started', 5000)
      const summary = next(teacher, 'classroom-session-summary', 5000)
      await startSessionPlan(planId)
      expect(await started).toMatchObject({ sessionId: planId, playerId: 'kid-a' })
      expect(await summary).toMatchObject({
        sessionId: planId,
        playerId: 'kid-a',
        outcome: 'in_progress',
        totalProblems: 10,
      })

      const ended = next(teacher, 'session-ended', 5000)
      await abandonSessionPlan(planId)
      expect(await ended).toMatchObject({ sessionId: planId, reason: 'abandoned' })
      await flushSessionReportPushes()
      await settled(parentB)
      expect(notAck(heard)).toEqual([])
    })

    it('another kid’s skill-tutorial-state, and every skill-tutorial-control', async () => {
      const teacher = await teacherView()
      const { sock: parentB, heard } = await classmateParent()
      const kidA = await kidDevice('parent-a', 'kid-a')

      const state = next(teacher, 'skill-tutorial-state', 5000)
      kidA.emit('skill-tutorial-state', tutorialState('kid-a', 'real'))
      expect(await state).toMatchObject({ playerId: 'kid-a', skillTitle: 'real' })

      const control = next(kidA, 'skill-tutorial-control', 5000)
      teacher.emit('skill-tutorial-control', { playerId: 'kid-a', action: { type: 'next-step' } })
      expect(await control).toEqual({ playerId: 'kid-a', action: { type: 'next-step' } })

      // parent-b may not steer or speak for kid-a either
      const teacherStates = hearing(teacher)
      const kidAHeard = hearing(kidA)
      parentB.emit('skill-tutorial-state', tutorialState('kid-a', 'spoofed'))
      parentB.emit('skill-tutorial-control', {
        playerId: 'kid-a',
        action: { type: 'skip-tutorial' },
      })
      await settled(parentB)
      await settled(teacher)
      await settled(kidA)
      expect(notAck(teacherStates)).toEqual([])
      expect(notAck(kidAHeard)).toEqual([])
      expect(notAck(heard)).toEqual([])
    })
  })

  describe('the teacher’s feed: every enrolled student, present or not', () => {
    it('an absent enrolled student’s start, summaries and end reach the teacher; a parent of another kid hears none', async () => {
      const teacher = await teacherView()
      const parentA = await kidDevice('parent-a', 'kid-a')
      const heardByA = hearing(parentA)
      const planId = await insertApprovedPlan('kid-b')
      const summaries: any[] = []
      teacher.on('classroom-session-summary', (s) => summaries.push(s))

      const started = next(teacher, 'session-started', 5000)
      await startSessionPlan(planId)
      expect(await started).toMatchObject({ sessionId: planId, playerId: 'kid-b' })
      const ended = next(teacher, 'session-ended', 5000)
      await abandonSessionPlan(planId)
      expect(await ended).toMatchObject({ sessionId: planId, playerId: 'kid-b' })
      await flushSessionReportPushes()
      await settled(teacher)
      expect(summaries.map((s) => s.outcome)).toEqual(['in_progress', 'abandoned'])
      expect(summaries[1].rowVersion).toBeGreaterThan(summaries[0].rowVersion)

      await settled(parentA)
      expect(heardByA.filter((h) => !ACKS.has(h.event))).toEqual([])
    })
  })

  describe('the skill tutorial', () => {
    it('the kid’s first frame reaches the teacher by construction: sent with no join finished', async () => {
      const teacher = await teacherView()
      const kid = await client(await cookieFor('parent-a'))
      const first = next(teacher, 'skill-tutorial-state', 5000)
      // useSkillTutorialBroadcast's connect handler: join-player, then broadcast at once
      kid.emit('join-player', { playerId: 'kid-a' })
      kid.emit('skill-tutorial-state', tutorialState('kid-a', 'first'))
      expect(await first).toMatchObject({ playerId: 'kid-a', skillTitle: 'first' })
    })

    it('a teacher drives a present student’s tutorial; of an absent one, not', async () => {
      const teacher = await client(await cookieFor('teacher'))
      const kidA = await kidDevice('parent-a', 'kid-a')
      const kidB = await kidDevice('parent-b', 'kid-b')
      const kidBHeard = hearing(kidB)
      // The new teacher tab sends with no room joined (useTutorialControl)
      const steered = next(kidA, 'skill-tutorial-control', 5000)
      teacher.emit('skill-tutorial-control', { playerId: 'kid-a', action: { type: 'next-step' } })
      expect(await steered).toEqual({ playerId: 'kid-a', action: { type: 'next-step' } })

      teacher.emit('skill-tutorial-control', { playerId: 'kid-b', action: { type: 'next-step' } })
      await settled(teacher)
      await settled(kidB)
      expect(kidBHeard.filter((h) => !ACKS.has(h.event))).toEqual([])
    })

    it('a parent at home still steers their own kid’s tutorial (control-tutorial)', async () => {
      const kidB = await kidDevice('parent-b', 'kid-b')
      const parentPhone = await client(await cookieFor('parent-b'))
      const steered = next(kidB, 'skill-tutorial-control', 5000)
      parentPhone.emit('skill-tutorial-control', {
        playerId: 'kid-b',
        action: { type: 'previous-step' },
      })
      expect(await steered).toEqual({ playerId: 'kid-b', action: { type: 'previous-step' } })
    })
  })

  describe('old tabs against this server (they work again after a reload)', () => {
    it('an old kid tab: its join-classroom is refused, its state still reaches the teacher, controls do not reach it', async () => {
      const teacher = await teacherView()
      const oldKid = await client(await cookieFor('parent-a'))
      const oldKidHeard = hearing(oldKid)
      // The old useSkillTutorialBroadcast: join-classroom, then broadcast at once
      const state = next(teacher, 'skill-tutorial-state', 5000)
      oldKid.emit('join-classroom', { classroomId: CLASSROOM })
      oldKid.emit('skill-tutorial-state', tutorialState('kid-a', 'old tab'))
      expect(await state).toMatchObject({ playerId: 'kid-a', skillTitle: 'old tab' })

      // It listens on classroom:, which it is not in, so the teacher's steering is lost
      teacher.emit('skill-tutorial-control', { playerId: 'kid-a', action: { type: 'next-step' } })
      await settled(teacher)
      await settled(oldKid)
      expect(oldKidHeard.map((h) => h.event)).toEqual(['channel-error', 'channel-error'])
      expect(oldKidHeard[0].data).toMatchObject({ channel: 'classroom', id: CLASSROOM })
    })

    it('an old teacher tab: joins classroom: (still the teacher’s), steers, and hears the feed', async () => {
      const kidA = await kidDevice('parent-a', 'kid-a')
      const oldTeacher = await client(await cookieFor('teacher'))
      // The old useTutorialControl: join-classroom, then send
      expect(await joinChannel(oldTeacher, 'classroom', CLASSROOM)).toBe('channel-joined')
      const steered = next(kidA, 'skill-tutorial-control', 5000)
      oldTeacher.emit('skill-tutorial-control', {
        playerId: 'kid-a',
        action: { type: 'next-step' },
      })
      expect(await steered).toMatchObject({ playerId: 'kid-a' })

      // The old useClassroomSocket: no listener for classroom-session-summary
      // (it kept its 15 s poll), but session-started/ended still reach it
      const planId = await insertApprovedPlan('kid-a')
      const started = next(oldTeacher, 'session-started', 5000)
      await startSessionPlan(planId)
      expect(await started).toMatchObject({ sessionId: planId })
    })
  })
})
