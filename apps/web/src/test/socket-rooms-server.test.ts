/**
 * @vitest-environment node
 *
 * The rooms and relays that had no check, on the real socket server with real
 * clients and cookies (socket-server-harness.ts) and the real access rules
 * over an EphemeralDatabase:
 * - `classroom:<id>`: the teacher and the parents of enrolled students only;
 *   a classmate's device cannot steer, or speak for, another child's tutorial;
 * - `player:<id>`: whoever may `view` the player;
 * - the kid's session broadcasts and vision events: only from a socket that
 *   may act in the session, recorded under the session's own player;
 * - co-play offers: only from an observer admitted to the session;
 * - `task:*`: the task's owner, an admin, or (a worksheet) who may see its player.
 * Each flow that must keep working is driven as its client drives it, with an
 * old tab's payload ids where it sends them.
 */

import type { Socket as ClientSocket } from 'socket.io-client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import type { SessionPart, SessionPlan } from '@/db/schema/session-plans'
import { createRoom } from '@/lib/arcade/room-manager'
import { addRoomMember } from '@/lib/arcade/room-membership'
import { createGuestToken, GUEST_COOKIE_NAME } from '@/lib/guest-token'
import { createRemoteCameraSession } from '@/lib/remote-camera/session-manager'
import { createSessionShare } from '@/lib/session-share'
import { VisionRecorder } from '@/lib/vision/recording'
import { fixtureParts } from './fixtures/session-report'
import {
  createEphemeralDatabase,
  type EphemeralDbResult,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
} from './journey-simulator/EphemeralDatabase'
import {
  client,
  collect,
  cookieFor,
  disconnectClients,
  joined,
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
// The server's background-task start-up, and the task state it serves
const { taskManager } = vi.hoisted(() => ({
  taskManager: {
    getTaskStateForClient: vi.fn(async (id: string) => ({
      id,
      status: 'completed',
      progress: 100,
    })),
    getTaskEvents: vi.fn(async (_id: string) => [] as unknown[]),
    cancelTask: vi.fn(async (_id: string) => true),
  },
}))
vi.mock('@/lib/task-manager', () => ({
  cleanupZombieTasks: async () => 0,
  registerTaskHooks: () => {},
  initCancellationSubscriber: () => {},
  initCancellationDbSync: () => {},
  ...taskManager,
}))

const CLASSROOM = 'cls-1'

/** Users: a teacher, two parents whose kids are in the class, a stranger, an admin. */
async function seed(db: ReturnType<typeof getCurrentEphemeralDb>) {
  for (const id of ['teacher', 'parent-a', 'parent-b', 'stranger', 'admin']) {
    await db
      .insert(schema.users)
      .values({ id, guestId: `guest-${id}`, role: id === 'admin' ? 'admin' : 'user' })
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
  // kid-a is in class today (the teacher may observe and steer kid-a)
  await db
    .insert(schema.classroomPresence)
    .values({ playerId: 'kid-a', classroomId: CLASSROOM, enteredBy: 'parent-a' })
}

async function insertLivePlan(playerId: string, parts: SessionPart[] = fixtureParts()) {
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
      parts,
      summary: {} as SessionPlan['summary'],
      masteredSkillIds: [],
      status: 'in_progress',
      flowState: 'practicing',
      flowUpdatedAt: now,
      flowVersion: 0,
      currentPartIndex: 0,
      results: [],
      adjustments: [],
      createdAt: now,
      approvedAt: now,
      startedAt: now,
    })
  return id
}

/**
 * Wait until the server has finished everything this client sent so far,
 * including handlers that only await: a `join-player` of no player is
 * answered after the access check's database reads.
 */
async function settled(sock: ClientSocket) {
  const answer = next(sock, 'channel-error', 5000)
  sock.emit('join-player', { playerId: 'no-such-player' })
  expect(await answer).toMatchObject({ channel: 'player', id: 'no-such-player' })
}

/** The kid's session screen (`useSessionBroadcast`): `join-session`, admitted. */
async function kidScreen(cookie: string, sessionId: string, playerId = 'kid-a') {
  const kid = await client(cookie)
  const admitted = next(kid, 'session-room-joined', 5000)
  kid.emit('join-session', { sessionId, playerId })
  expect(await admitted).toEqual({ sessionId })
  return kid
}

/** An observer (`useSessionObserver`): `observe-session`, admitted to the live room. */
async function observer(cookie: string | undefined, request: Record<string, unknown>) {
  const sock = await client(cookie)
  sock.emit('observe-session', request)
  await joined(sock, `session:${request.sessionId}`)
  return sock
}

describe('PR 2: the rooms and relays that had no check', () => {
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
    for (const fn of Object.values(taskManager)) fn.mockClear()
  })
  afterEach(() => {
    disconnectClients()
    vi.restoreAllMocks()
    setCurrentEphemeralDb(null)
    eph.cleanup()
  })

  describe('classroom:<id>: the teacher and the parents of enrolled students', () => {
    it('the teacher and an enrolled kid’s device join; a stranger and an anonymous socket are refused', async () => {
      const teacher = await client(await cookieFor('teacher'))
      const ack = next(teacher, 'channel-joined', 5000)
      teacher.emit('join-classroom', { classroomId: CLASSROOM })
      expect(await ack).toEqual({ channel: 'classroom', id: CLASSROOM })
      await joined(teacher, `classroom:${CLASSROOM}`)

      const kidDevice = await client(await cookieFor('parent-a'))
      kidDevice.emit('join-classroom', { classroomId: CLASSROOM })
      await joined(kidDevice, `classroom:${CLASSROOM}`)

      for (const sock of [await client(await cookieFor('stranger')), await client()]) {
        const refused = next(sock, 'channel-error', 5000)
        sock.emit('join-classroom', { classroomId: CLASSROOM })
        expect(await refused).toMatchObject({ channel: 'classroom', id: CLASSROOM })
        expect((await roomsOf(sock)).has(`classroom:${CLASSROOM}`)).toBe(false)
      }

      // Leaving is never checked
      teacher.emit('leave-classroom', { classroomId: CLASSROOM })
      await vi.waitFor(async () =>
        expect((await roomsOf(teacher)).has(`classroom:${CLASSROOM}`)).toBe(false)
      )
    })

    it('a classmate’s device cannot steer another child’s tutorial; the teacher can', async () => {
      const kidA = await client(await cookieFor('parent-a'))
      const classmate = await client(await cookieFor('parent-b'))
      const teacher = await client(await cookieFor('teacher'))
      for (const sock of [kidA, classmate, teacher]) {
        sock.emit('join-classroom', { classroomId: CLASSROOM })
        await joined(sock, `classroom:${CLASSROOM}`)
      }
      const controls = collect(kidA, 'skill-tutorial-control')

      // The classmate is a member of the channel, and still may not
      classmate.emit('skill-tutorial-control', {
        playerId: 'kid-a',
        action: { type: 'skip-tutorial' },
      })
      await settled(classmate)

      // The teacher of the present student steers it (useTutorialControl)
      const steered = next(kidA, 'skill-tutorial-control', 5000)
      teacher.emit('skill-tutorial-control', { playerId: 'kid-a', action: { type: 'next-step' } })
      expect(await steered).toEqual({ playerId: 'kid-a', action: { type: 'next-step' } })
      expect(controls.map((c) => c.action.type)).toEqual(['next-step'])
    })

    it('the kid’s device tells the teacher where its tutorial is; a classmate cannot speak for it', async () => {
      const kidA = await client(await cookieFor('parent-a'))
      const classmate = await client(await cookieFor('parent-b'))
      const teacher = await client(await cookieFor('teacher'))
      for (const sock of [kidA, classmate, teacher]) {
        sock.emit('join-classroom', { classroomId: CLASSROOM })
        await joined(sock, `classroom:${CLASSROOM}`)
      }
      const states = collect(teacher, 'skill-tutorial-state')
      const state = (skillTitle: string) => ({
        playerId: 'kid-a',
        playerName: 'kid-a',
        launcherState: 'tutorial',
        skillId: 's',
        skillTitle,
      })

      classmate.emit('skill-tutorial-state', state('spoofed'))
      await settled(classmate)

      // useSkillTutorialBroadcast on kid-a's device
      const heard = next(teacher, 'skill-tutorial-state', 5000)
      kidA.emit('skill-tutorial-state', state('real'))
      expect(await heard).toMatchObject({ playerId: 'kid-a', skillTitle: 'real' })
      expect(states.map((s) => s.skillTitle)).toEqual(['real'])
    })
  })

  describe('player:<id>: whoever may view the player', () => {
    it('the parent and the enrolled kid’s teacher join; a classmate’s parent and a stranger are refused', async () => {
      for (const id of ['parent-a', 'teacher']) {
        const sock = await client(await cookieFor(id))
        const ack = next(sock, 'channel-joined', 5000)
        sock.emit('join-player', { playerId: 'kid-a' })
        expect(await ack).toEqual({ channel: 'player', id: 'kid-a' })
        expect((await roomsOf(sock)).has('player:kid-a')).toBe(true)
      }
      for (const sock of [
        await client(await cookieFor('parent-b')),
        await client(await cookieFor('stranger')),
        await client(),
      ]) {
        const refused = next(sock, 'channel-error', 5000)
        sock.emit('join-player', { playerId: 'kid-a' })
        expect(await refused).toMatchObject({ channel: 'player', id: 'kid-a' })
        expect((await roomsOf(sock)).has('player:kid-a')).toBe(false)
      }
    })
  })

  describe('the kid’s session broadcasts', () => {
    let sessionId = ''
    beforeEach(async () => {
      sessionId = await insertLivePlan('kid-a')
    })

    it('reach a parent observing on another device; a stranger’s are dropped', async () => {
      const kid = await kidScreen(await cookieFor('parent-a'), sessionId)
      // The parent's phone, observing (an old tab sends its observerId)
      const parentPhone = await observer(await cookieFor('parent-a'), {
        sessionId,
        observerId: 'parent-a',
        playerId: 'kid-a',
      })
      const transitions = collect(parentPhone, 'part-transition')

      // A stranger in no room names the session
      const stranger = await client(await cookieFor('stranger'))
      stranger.emit('part-transition', { sessionId, fake: true })
      stranger.emit('session-flow-state', { sessionId, flowState: 'fake' })
      await settled(stranger)

      for (const [event, data] of [
        [
          'part-transition',
          { sessionId, previousPartType: 'abacus', nextPartType: 'visualization' },
        ],
        ['part-transition-complete', { sessionId }],
        ['session-flow-state', { sessionId, flowState: 'practicing' }],
        ['tutorial-state', { sessionId, currentStep: 1, totalSteps: 3, content: null }],
      ] as const) {
        const heard = next(parentPhone, event, 5000)
        kid.emit(event, data)
        expect(await heard).toEqual(data)
      }
      expect(transitions).toHaveLength(1)
      expect(transitions[0].fake).toBeUndefined()
    })

    it('a broadcast sent while the kid’s join is still being checked is relayed once admitted', async () => {
      const parentPhone = await observer(await cookieFor('parent-a'), {
        sessionId,
        playerId: 'kid-a',
      })
      const kid = await client(await cookieFor('parent-a'))
      const heard = next(parentPhone, 'part-transition', 5000)
      // useSessionBroadcast's connect handler: join, then broadcast at once
      kid.emit('join-session', { sessionId, playerId: 'kid-a' })
      kid.emit('part-transition', { sessionId, early: true })
      expect(await heard).toEqual({ sessionId, early: true })
    })

    it('a teacher observes a present classroom student', async () => {
      const kid = await kidScreen(await cookieFor('parent-a'), sessionId)
      const teacher = await observer(await cookieFor('teacher'), { sessionId, playerId: 'kid-a' })
      const heard = next(teacher, 'practice-state', 5000)
      kid.emit('practice-state', { sessionId, sessionParts: [], slotResults: [] })
      expect(await heard).toMatchObject({ sessionId })
    })

    it('a share-link observer hears the kid; its own broadcasts and recording requests are dropped', async () => {
      const share = await createSessionShare(sessionId, 'kid-a', 'parent-a', '1h')
      const kid = await kidScreen(await cookieFor('parent-a'), sessionId)
      // PublicObservationClient: anonymous, with the token (and an empty observerId)
      const holder = await observer(undefined, { sessionId, shareToken: share.id, observerId: '' })
      const kidHeard = collect(kid, 'part-transition')
      const start = vi.spyOn(VisionRecorder.getInstance(), 'startSession')

      holder.emit('part-transition', { sessionId, fromHolder: true })
      holder.emit('start-vision-recording', { sessionId, playerId: 'kid-a' })
      await settled(holder)
      expect(kidHeard).toEqual([])
      expect(start).not.toHaveBeenCalled()

      const heard = next(holder, 'session-flow-state', 5000)
      kid.emit('session-flow-state', { sessionId, flowState: 'practicing' })
      expect(await heard).toEqual({ sessionId, flowState: 'practicing' })

      // It may ask for the DVR's state (an admitted member)
      const info = next(holder, 'vision-buffer-info', 5000)
      holder.emit('vision-buffer-info', { sessionId })
      expect(await info).toMatchObject({ sessionId, available: false })
    })
  })

  describe('vision: the kid’s screen only, under the session’s own player', () => {
    let sessionId = ''
    beforeEach(async () => {
      sessionId = await insertLivePlan('kid-a')
    })

    it('recording starts under the session’s player whatever the payload names; a stranger’s is dropped', async () => {
      const recorder = VisionRecorder.getInstance()
      const start = vi.spyOn(recorder, 'startSession')
      vi.spyOn(recorder, 'stopSession').mockResolvedValue()

      const stranger = await client(await cookieFor('stranger'))
      stranger.emit('start-vision-recording', { sessionId, playerId: 'kid-b' })
      stranger.emit('vision-problem-marker', {
        sessionId,
        problemNumber: 1,
        partIndex: 0,
        eventType: 'problem-shown',
        playerId: 'kid-b',
      })
      await settled(stranger)
      expect(start).not.toHaveBeenCalled()

      const kid = await kidScreen(await cookieFor('parent-a'), sessionId)
      const started = next(kid, 'vision-recording-started', 5000)
      kid.emit('start-vision-recording', { sessionId, playerId: 'kid-b' })
      expect(await started).toEqual({ sessionId })
      expect(start).toHaveBeenCalledWith(sessionId, 'kid-a')

      const stopped = next(kid, 'vision-recording-stopped', 5000)
      kid.emit('stop-vision-recording', { sessionId })
      expect(await stopped).toEqual({ sessionId })
    })

    it('a metadata-only marker auto-starts under the session’s player', async () => {
      const start = vi.spyOn(VisionRecorder.getInstance(), 'startSession')
      vi.spyOn(VisionRecorder.getInstance(), 'onProblemMarker').mockResolvedValue()
      const kid = await kidScreen(await cookieFor('parent-a'), sessionId)
      kid.emit('vision-problem-marker', {
        sessionId,
        problemNumber: 1,
        partIndex: 0,
        eventType: 'problem-shown',
        playerId: 'kid-b',
      })
      await vi.waitFor(() => expect(start).toHaveBeenCalledWith(sessionId, 'kid-a'))
    })

    it('the remote-camera phone streams to the kid’s screen, which relays its frames to observers', async () => {
      const kid = await kidScreen(await cookieFor('parent-a'), sessionId)
      const parentPhone = await observer(await cookieFor('parent-a'), {
        sessionId,
        playerId: 'kid-a',
      })

      // The phone: a signed-out browser with its middleware guest cookie, and the token
      const camera = await createRemoteCameraSession()
      const phone = await client(`${GUEST_COOKIE_NAME}=${await createGuestToken('phone-sid')}`)
      const connected = next(kid, 'remote-camera:connected', 5000)
      kid.emit('remote-camera:subscribe', { sessionId: camera.id })
      await joined(kid, `remote-camera:${camera.id}`)
      phone.emit('remote-camera:join', { sessionId: camera.id })
      expect(await connected).toMatchObject({ phoneConnected: true })

      const frame = next(kid, 'remote-camera:frame', 5000)
      phone.emit('remote-camera:frame', {
        sessionId: camera.id,
        imageData: 'data:image/jpeg;base64,AA',
        timestamp: 1,
        mode: 'cropped',
      })
      expect(await frame).toMatchObject({ imageData: 'data:image/jpeg;base64,AA' })

      // The phone itself sends no vision-* event; the kid's screen forwards
      const relayed = next(parentPhone, 'vision-frame', 5000)
      const visionFrame = {
        sessionId,
        imageData: 'data:image/jpeg;base64,AA',
        detectedValue: 3,
        confidence: 0.9,
        timestamp: 2,
      }
      kid.emit('vision-frame', visionFrame)
      expect(await relayed).toEqual(visionFrame)
    })
  })

  describe('co-play offers: admitted observers only', () => {
    it('an admitted observer’s offer reaches the kid as that observer; a non-member’s is dropped', async () => {
      const sessionId = await insertLivePlan('kid-a')
      const kid = await kidScreen(await cookieFor('parent-a'), sessionId)
      const offers = collect(kid, 'observer-coplay-ready')
      const leaves = collect(kid, 'observer-coplay-leave')
      const player = { name: 'Mom', emoji: '👩', color: '#f00' }

      const stranger = await client(await cookieFor('stranger'))
      stranger.emit('observer-coplay-ready', { sessionId, observerId: 'parent-a', player })
      stranger.emit('observer-coplay-leave', { sessionId, observerId: 'parent-a' })
      await settled(stranger)

      // The parent's phone: observes, then offers at once (SessionObserverModal)
      const parentPhone = await client(await cookieFor('parent-a'))
      const offered = next(kid, 'observer-coplay-ready', 5000)
      parentPhone.emit('observe-session', { sessionId, playerId: 'kid-a' })
      parentPhone.emit('observer-coplay-ready', { sessionId, observerId: 'someone', player })
      expect(await offered).toMatchObject({ sessionId, observerId: 'parent-a', player })

      const left = next(kid, 'observer-coplay-leave', 5000)
      parentPhone.emit('observer-coplay-leave', { sessionId })
      expect(await left).toEqual({ sessionId, observerId: 'parent-a' })
      expect(offers).toHaveLength(1)
      expect(leaves).toHaveLength(1)
    })
  })

  describe('task:*: the owner, an admin, or who may see the worksheet’s player', () => {
    async function insertTask(id: string, type: string, userId: string | null, input: unknown) {
      await eph.db.insert(schema.backgroundTasks).values({
        id,
        type: type as never,
        status: 'completed',
        input: input as never,
        userId,
      })
    }

    it('the owner and an admin follow a task; a stranger hears “not found” and joins nothing', async () => {
      await insertTask('t-own', 'flowchart-generate', 'parent-a', { userId: 'parent-a' })
      for (const id of ['parent-a', 'admin']) {
        const sock = await client(await cookieFor(id))
        const state = next(sock, 'task:state', 5000)
        sock.emit('task:subscribe', 't-own')
        expect(await state).toMatchObject({ id: 't-own' })
        expect((await roomsOf(sock)).has('task:t-own')).toBe(true)
      }
      const stranger = await client(await cookieFor('stranger'))
      const error = next(stranger, 'task:error', 5000)
      stranger.emit('task:subscribe', 't-own')
      expect(await error).toEqual({ taskId: 't-own', error: 'Task not found' })
      expect((await roomsOf(stranger)).has('task:t-own')).toBe(false)
    })

    it('a workshop task started before its owner was recorded is followed by the user its input names', async () => {
      await insertTask('t-old', 'flowchart-refine', null, { userId: 'parent-a' })
      const sock = await client(await cookieFor('parent-a'))
      const state = next(sock, 'task:state', 5000)
      sock.emit('task:subscribe', 't-old')
      expect(await state).toMatchObject({ id: 't-old' })
    })

    it('a worksheet parse: the kid’s parent follows and cancels it, the teacher follows it, a stranger neither', async () => {
      await insertTask('t-ws', 'worksheet-parse', null, { playerId: 'kid-a', attachmentId: 'a1' })
      const parent = await client(await cookieFor('parent-a'))
      const state = next(parent, 'task:state', 5000)
      parent.emit('task:subscribe', 't-ws')
      expect(await state).toMatchObject({ id: 't-ws' })

      const teacher = await client(await cookieFor('teacher'))
      const teacherState = next(teacher, 'task:state', 5000)
      teacher.emit('task:subscribe', 't-ws')
      expect(await teacherState).toMatchObject({ id: 't-ws' })

      const stranger = await client(await cookieFor('stranger'))
      const refused = next(stranger, 'task:error', 5000)
      stranger.emit('task:cancel', 't-ws')
      expect(await refused).toEqual({ taskId: 't-ws', error: 'Cannot cancel task' })
      expect(taskManager.cancelTask).not.toHaveBeenCalled()

      parent.emit('task:cancel', 't-ws')
      await vi.waitFor(() => expect(taskManager.cancelTask).toHaveBeenCalledWith('t-ws'))
    })

    it('an admin tool’s task (no owner) is an admin’s only', async () => {
      await insertTask('t-admin', 'blog-image-generate', null, {})
      const user = await client(await cookieFor('parent-a'))
      const refused = next(user, 'task:error', 5000)
      user.emit('task:subscribe', 't-admin')
      expect(await refused).toEqual({ taskId: 't-admin', error: 'Task not found' })
      const admin = await client(await cookieFor('admin'))
      const state = next(admin, 'task:state', 5000)
      admin.emit('task:subscribe', 't-admin')
      expect(await state).toMatchObject({ id: 't-admin' })
    })
  })

  it('the nightly smoke: a guest-owned debug player with a parent_child link, its session, its game-break room', async () => {
    // /api/debug/practice-session: the guest owns the player and is linked to it
    const sid = 'smoke-guest-sid'
    const guestCookie = `${GUEST_COOKIE_NAME}=${await createGuestToken(sid)}`
    await eph.db.insert(schema.users).values({ id: 'smoke-guest', guestId: sid })
    await eph.db.insert(schema.players).values({
      id: 'debug-kid',
      userId: 'smoke-guest',
      name: 'Debug',
      emoji: '🐞',
      color: '#000',
      isActive: true,
    })
    await eph.db
      .insert(schema.parentChild)
      .values({ parentUserId: 'smoke-guest', childPlayerId: 'debug-kid' })
    const sessionId = await insertLivePlan('debug-kid')

    const kid = await kidScreen(guestCookie, sessionId, 'debug-kid')
    const watcher = await observer(guestCookie, { sessionId, playerId: 'debug-kid' })
    const flow = next(watcher, 'session-flow-state', 5000)
    kid.emit('session-flow-state', { sessionId, flowState: 'game_break' })
    expect(await flow).toEqual({ sessionId, flowState: 'game_break' })

    // The game-break room, as POST /api/arcade/rooms makes it
    const room = await createRoom({
      name: "Debug's Game Break",
      createdBy: 'smoke-guest',
      creatorName: 'Debug',
      gameName: 'matching',
      gameConfig: {},
    })
    await addRoomMember({
      roomId: room.id,
      userId: 'smoke-guest',
      displayName: 'Debug',
      isCreator: true,
    })
    const roomJoined = next(kid, 'room-joined', 5000)
    kid.emit('join-room', { userId: 'smoke-guest', roomId: room.id })
    expect(await roomJoined).toMatchObject({ roomId: room.id })
  })
})
