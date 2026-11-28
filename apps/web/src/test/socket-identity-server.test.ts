/**
 * @vitest-environment node
 *
 * The real socket server (`initializeSocketServer`) with real clients
 * (`socket.io-client`) and real cookies: every connection is its verified
 * viewer (`io.use` + `resolveSocketViewer`), re-derived on reconnect, and an
 * id a payload asserts grants nothing.
 * - `join-user-channel` joins only the socket's own `user:<id>`;
 * - `subscribe-child-sessions` checks the socket's viewer, not the payload's;
 * - arcade: `join-arcade-session`, `game-move`, `join-room` and
 *   `players-updated` need a member of the room, `cursor-update` is stamped
 *   with the sender's own id;
 * - co-play readiness is relayed as the sender (a socket with no viewer is dropped);
 * - an old tab's payload shape (with ids) is still accepted from its owner.
 * The session rooms' handlers are covered in session-room-access.test.ts
 * and session-report-push.test.ts.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import { createRoom } from '@/lib/arcade/room-manager'
import { addRoomMember } from '@/lib/arcade/room-membership'
import { NO_VIEWER_ERROR, NOT_A_MEMBER_ERROR } from '@/lib/arcade/socket-actor'
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
  drained,
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
// The server's background-task start-up is not under test
vi.mock('@/lib/task-manager', () => ({
  cleanupZombieTasks: async () => 0,
  registerTaskHooks: () => {},
  initCancellationSubscriber: () => {},
  initCancellationDbSync: () => {},
}))
const { isParentOf } = vi.hoisted(() => ({
  isParentOf: vi.fn(
    async (parent: string, child: string) => parent === 'parent' && child === 'kid'
  ),
}))
vi.mock('@/lib/classroom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/classroom')>()),
  isParentOf,
}))

let io: Awaited<ReturnType<typeof startSocketServer>>

describe('socket identity on the real server', () => {
  let eph: EphemeralDbResult

  beforeAll(async () => {
    io = await startSocketServer()
  })
  afterAll(async () => {
    await stopSocketServer()
  })
  beforeEach(async () => {
    eph = createEphemeralDatabase()
    setCurrentEphemeralDb(eph.db)
    for (const id of ['parent', 'stranger', 'member']) {
      await eph.db.insert(schema.users).values({ id, guestId: `guest-${id}` })
    }
    isParentOf.mockClear()
  })
  afterEach(() => {
    disconnectClients()
    setCurrentEphemeralDb(null)
    eph.cleanup()
  })

  it('join-user-channel joins the socket’s own channel, whatever id the payload names', async () => {
    const stranger = await client(await cookieFor('stranger'))
    stranger.emit('join-user-channel', { userId: 'parent' })
    await joined(stranger, 'user:stranger')
    expect((await roomsOf(stranger)).has('user:parent')).toBe(false)

    // The parent's notifications reach the parent's socket only
    const parent = await client(await cookieFor('parent'))
    parent.emit('join-user-channel', {})
    await joined(parent, 'user:parent')
    const heardByStranger = collect(stranger, 'notification')
    const heardByParent = next(parent, 'notification')
    io.to('user:parent').emit('notification', { n: 1 })
    // Sent to the stranger after the notification, so it arrives after it would have
    const marker = next(stranger, 'marker')
    io.to(stranger.id!).emit('marker', {})
    expect(await heardByParent).toEqual({ n: 1 })
    expect(await marker).toEqual({})
    expect(heardByStranger).toEqual([])
  })

  it('an anonymous socket joins no user channel', async () => {
    const anonymous = await client()
    anonymous.emit('join-user-channel', { userId: 'parent' })
    await drained(anonymous)
    const rooms = await roomsOf(anonymous)
    expect([...rooms].filter((r) => r.startsWith('user:'))).toEqual([])
  })

  it('subscribe-child-sessions checks the socket’s viewer, not the payload’s userId', async () => {
    const stranger = await client(await cookieFor('stranger'))
    stranger.emit('subscribe-child-sessions', { userId: 'parent', childIds: ['kid'] })
    await vi.waitFor(() => expect(isParentOf).toHaveBeenCalledWith('stranger', 'kid'), {
      timeout: 5000,
    })
    // The handler's answer, settled: a refusal joins nothing after it
    expect(await isParentOf.mock.results[0].value).toBe(false)
    expect((await roomsOf(stranger)).has('player:kid')).toBe(false)
    expect(isParentOf).not.toHaveBeenCalledWith('parent', 'kid')

    // The real parent, with an old tab's payload shape (its own id in it)
    const parent = await client(await cookieFor('parent'))
    parent.emit('subscribe-child-sessions', { userId: 'parent', childIds: ['kid'] })
    await joined(parent, 'player:kid')
  })

  it('a reconnect re-derives the viewer from the new handshake', async () => {
    const sock = await client(await cookieFor('stranger'))
    sock.emit('join-user-channel', {})
    await joined(sock, 'user:stranger')

    // Signed in as someone else in the meantime: the next handshake is that viewer
    sock.io.opts.extraHeaders = { cookie: await cookieFor('parent') }
    sock.disconnect()
    await new Promise<void>((resolve) => {
      sock.once('connect', () => resolve())
      sock.connect()
    })
    sock.emit('join-user-channel', {})
    await joined(sock, 'user:parent')
    expect((await roomsOf(sock)).has('user:stranger')).toBe(false)
  })

  it('co-play: the observer is the sender, never the payload; an anonymous socket is dropped', async () => {
    // The kid's tab listens in the session room (admission is session-room-access's job)
    const kid = await client(await cookieFor('member'))
    await io.in(kid.id!).socketsJoin('session:s1')
    const ready = collect(kid, 'observer-coplay-ready')
    const leave = collect(kid, 'observer-coplay-leave')
    const player = { name: 'Fake', emoji: 'x', color: '#000' }

    const anonymous = await client()
    anonymous.emit('observer-coplay-ready', { sessionId: 's1', observerId: 'parent', player })
    anonymous.emit('observer-coplay-leave', { sessionId: 's1', observerId: 'parent' })
    await drained(anonymous)

    // An admitted observer naming the parent: relayed as itself. Anything
    // the anonymous socket got relayed would have reached the kid before this
    // (who may offer at all is in socket-rooms-server.test.ts)
    const stranger = await client(await cookieFor('stranger'))
    await io.in(stranger.id!).socketsJoin('session:s1')
    const heard = next(kid, 'observer-coplay-ready', 5000)
    stranger.emit('observer-coplay-ready', { sessionId: 's1', observerId: 'parent', player })
    expect(await heard).toMatchObject({ sessionId: 's1', observerId: 'stranger', player })
    const left = next(kid, 'observer-coplay-leave', 5000)
    stranger.emit('observer-coplay-leave', { sessionId: 's1', observerId: 'parent' })
    expect(await left).toEqual({ sessionId: 's1', observerId: 'stranger' })

    expect(ready.map((r) => r.observerId)).toEqual(['stranger'])
    expect(leave.map((r) => r.observerId)).toEqual(['stranger'])
  })

  describe('arcade: own id plus room membership', () => {
    let roomId = ''
    beforeEach(async () => {
      const room = await createRoom({
        name: 'socket identity',
        createdBy: 'member',
        creatorName: 'Member',
        gameName: 'matching',
        gameConfig: {},
      })
      roomId = room.id
      await addRoomMember({ roomId, userId: 'member', displayName: 'Member', isCreator: true })
    })

    it('a non-member naming a member’s id joins nothing and moves nothing', async () => {
      const stranger = await client(await cookieFor('stranger'))

      const joinError = next(stranger, 'session-error')
      stranger.emit('join-arcade-session', { userId: 'member', roomId })
      expect(await joinError).toEqual({ error: NOT_A_MEMBER_ERROR })

      const roomError = next(stranger, 'room-error')
      stranger.emit('join-room', { userId: 'member', roomId })
      expect(await roomError).toEqual({ error: NOT_A_MEMBER_ERROR })

      const playersError = next(stranger, 'room-error')
      stranger.emit('players-updated', { userId: 'member', roomId })
      expect(await playersError).toEqual({ error: NOT_A_MEMBER_ERROR })

      const move = { type: 'FLIP_CARD', playerId: 'p', userId: 'member', timestamp: 1, data: {} }
      const rejected = next(stranger, 'move-rejected')
      stranger.emit('game-move', { userId: 'member', move, roomId })
      expect(await rejected).toMatchObject({ error: NOT_A_MEMBER_ERROR })

      const rooms = await roomsOf(stranger)
      expect(rooms.has(`game:${roomId}`)).toBe(false)
      expect(rooms.has(`room:${roomId}`)).toBe(false)
      expect(rooms.has('arcade:member')).toBe(false)
    })

    it('an anonymous socket is refused arcade joins', async () => {
      const anonymous = await client()
      const joinError = next(anonymous, 'session-error')
      anonymous.emit('join-arcade-session', { userId: 'member', roomId })
      expect(await joinError).toEqual({ error: NO_VIEWER_ERROR })
    })

    it('a member joins as itself; its cursor goes out under its own id, not the payload’s', async () => {
      // The member, with an old tab's payload shape
      const member = await client(await cookieFor('member'))
      const roomJoined = next(member, 'room-joined')
      member.emit('join-room', { userId: 'member', roomId })
      expect(await roomJoined).toMatchObject({ roomId })
      member.emit('join-arcade-session', { userId: 'someone-else', roomId })
      await joined(member, `game:${roomId}`)
      const rooms = await roomsOf(member)
      expect(rooms.has('arcade:member')).toBe(true)
      expect(rooms.has('arcade:someone-else')).toBe(false)

      // A second device of the same member watches the game room
      const other = await client(await cookieFor('member'))
      other.emit('join-arcade-session', { roomId })
      await joined(other, `game:${roomId}`)
      const cursors = collect(other, 'cursor-update')

      // A socket outside the game room cannot draw a cursor into it. Its
      // refused join-room is answered after its cursor was handled
      const stranger = await client(await cookieFor('stranger'))
      stranger.emit('cursor-update', {
        roomId,
        playerId: 'p1',
        userId: 'member',
        cursorPosition: { x: 9, y: 9 },
        hoveredRegionId: null,
      })
      const refused = next(stranger, 'room-error', 5000)
      stranger.emit('join-room', { roomId })
      expect(await refused).toEqual({ error: NOT_A_MEMBER_ERROR })

      // The member's cursor goes out stamped with its own id, whatever the payload says
      const cursor = next(other, 'cursor-update', 5000)
      member.emit('cursor-update', {
        roomId,
        playerId: 'p1',
        userId: 'stranger',
        cursorPosition: { x: 1, y: 2 },
        hoveredRegionId: null,
      })
      expect(await cursor).toMatchObject({ userId: 'member', playerId: 'p1' })
      // Only the member's cursor reached the room (a spoofed one would have come first)
      expect(cursors).toHaveLength(1)
    })
  })
})
