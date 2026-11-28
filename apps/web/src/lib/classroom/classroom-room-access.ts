/**
 * Who may join a classroom's channel `classroom:<id>` and a player's channel
 * `player:<id>`, and who may send the skill tutorial's state and controls
 * through the classroom channel.
 *
 * - `classroom:<id>` carries the teacher's view (enrollment requests,
 *   presence, sessions started and ended) and the skill tutorial's relay. Its
 *   members are the classroom's teacher and the parents of its enrolled
 *   students (the student's own device, whose tutorial the teacher follows),
 *   as the classroom routes decide it (presence needs an enrollment).
 * - `player:<id>`: whoever may `view` that player (`canPerformAction`), as the
 *   player's HTTP routes decide it: a parent, or an enrolled student's teacher.
 * - `skill-tutorial-state`: only for a player the sender may `start-session`
 *   for (the kid's own device, or the teacher of a present student), and only
 *   into classrooms that player is enrolled in.
 * - `skill-tutorial-control`: only for a player the sender may
 *   `control-tutorial` (a parent, or the teacher of a present student). A
 *   classmate's device, though a member of the channel, cannot steer another
 *   child's tutorial.
 *
 * Every check uses the socket's verified viewer (`socket.data.viewer`); an id
 * in a payload is the subject of the check, never the one checked. A join
 * answers `channel-joined { channel, id }`; a refused one answers
 * `channel-error { channel, id, error }` and joins nothing.
 * Leaving is never checked: it only takes the socket out.
 */

import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import { type SocketViewerData, socketViewerId } from '@/lib/socket-viewer'
import { canPerformAction, getParentedPlayerIds } from './access-control'

/** A classroom's channel: the teacher's view and the skill tutorial relay. */
export function classroomRoom(classroomId: string): string {
  return `classroom:${classroomId}`
}

/** A player's channel: presence, enrollment and sessions of that player. */
export function playerRoom(playerId: string): string {
  return `player:${playerId}`
}

const CLASSROOM_PREFIX = 'classroom:'

/**
 * Whether `viewerId` belongs to the classroom: its teacher, or a parent of a
 * student enrolled in it.
 */
export async function mayJoinClassroom(
  viewerId: string | null,
  classroomId: string
): Promise<boolean> {
  if (!viewerId || typeof classroomId !== 'string' || !classroomId) return false
  const classroom = await db.query.classrooms.findFirst({
    where: eq(schema.classrooms.id, classroomId),
    columns: { teacherId: true },
  })
  if (!classroom) return false
  if (classroom.teacherId === viewerId) return true
  const children = await getParentedPlayerIds(viewerId)
  if (children.length === 0) return false
  const [enrolled] = await db
    .select({ id: schema.classroomEnrollments.id })
    .from(schema.classroomEnrollments)
    .where(
      and(
        eq(schema.classroomEnrollments.classroomId, classroomId),
        inArray(schema.classroomEnrollments.playerId, children)
      )
    )
    .limit(1)
  return !!enrolled
}

/** The classrooms a player is enrolled in. */
async function enrolledClassroomIds(playerId: string): Promise<Set<string>> {
  const rows = await db
    .select({ classroomId: schema.classroomEnrollments.classroomId })
    .from(schema.classroomEnrollments)
    .where(eq(schema.classroomEnrollments.playerId, playerId))
  return new Set(rows.map((r) => r.classroomId))
}

/** The socket surface these channels need (a socket.io `Socket`). */
export interface ClassroomChannelSocket {
  on(event: string, handler: (data: any) => void): unknown
  join(room: string): unknown
  leave(room: string): unknown
  emit(event: string, data: unknown): unknown
  to(room: string): { emit(event: string, data: unknown): unknown }
  rooms: Iterable<string>
  data: SocketViewerData
}

/** The server surface the tutorial control is sent through (a socket.io `Server`). */
export interface ClassroomChannelServer {
  to(room: string): { emit(event: string, data: unknown): unknown }
}

/** A skill tutorial broadcast or control: about one player. */
interface TutorialMessage {
  playerId: string
  [key: string]: unknown
}

/**
 * The classroom channels this socket joined that `playerId` is enrolled in:
 * where its tutorial's state and controls go.
 */
async function tutorialRoomsOf(socket: ClassroomChannelSocket, playerId: string) {
  const joined = [...socket.rooms].filter((room) => room.startsWith(CLASSROOM_PREFIX))
  if (joined.length === 0) return []
  const enrolled = await enrolledClassroomIds(playerId)
  return joined.filter((room) => enrolled.has(room.slice(CLASSROOM_PREFIX.length)))
}

/**
 * Register `join-classroom` / `leave-classroom`, `join-player` /
 * `leave-player`, `skill-tutorial-state` and `skill-tutorial-control`.
 */
export function registerClassroomChannels(
  socket: ClassroomChannelSocket,
  io: ClassroomChannelServer
): void {
  const refuse = (channel: 'classroom' | 'player', id: string, error: string) => {
    console.log(`⚠️ join-${channel} refused for ${id}: ${error}`)
    socket.emit('channel-error', { channel, id, error })
  }

  socket.on('join-classroom', async (request: { classroomId?: unknown }) => {
    const classroomId = typeof request?.classroomId === 'string' ? request.classroomId : ''
    try {
      if (!(await mayJoinClassroom(socketViewerId(socket), classroomId))) {
        refuse('classroom', classroomId, 'Not a member of this classroom')
        return
      }
      await socket.join(classroomRoom(classroomId))
      socket.emit('channel-joined', { channel: 'classroom', id: classroomId })
    } catch (error) {
      console.error('Error joining classroom channel:', error)
      refuse('classroom', classroomId, 'Failed to join classroom')
    }
  })

  socket.on('leave-classroom', async (request: { classroomId?: unknown }) => {
    if (typeof request?.classroomId !== 'string') return
    await socket.leave(classroomRoom(request.classroomId))
  })

  socket.on('join-player', async (request: { playerId?: unknown }) => {
    const playerId = typeof request?.playerId === 'string' ? request.playerId : ''
    const viewerId = socketViewerId(socket)
    try {
      if (!viewerId || !playerId || !(await canPerformAction(viewerId, playerId, 'view'))) {
        refuse('player', playerId, 'Not authorized to view this player')
        return
      }
      await socket.join(playerRoom(playerId))
      socket.emit('channel-joined', { channel: 'player', id: playerId })
    } catch (error) {
      console.error('Error joining player channel:', error)
      refuse('player', playerId, 'Failed to join player')
    }
  })

  socket.on('leave-player', async (request: { playerId?: unknown }) => {
    if (typeof request?.playerId !== 'string') return
    await socket.leave(playerRoom(request.playerId))
  })

  // The student's device tells the teacher where its tutorial is
  socket.on('skill-tutorial-state', async (data: TutorialMessage) => {
    const viewerId = socketViewerId(socket)
    const playerId = typeof data?.playerId === 'string' ? data.playerId : ''
    try {
      if (
        !viewerId ||
        !playerId ||
        !(await canPerformAction(viewerId, playerId, 'start-session'))
      ) {
        console.log(`⚠️ skill-tutorial-state dropped for ${playerId}: not the player's device`)
        return
      }
      for (const room of await tutorialRoomsOf(socket, playerId)) {
        socket.to(room).emit('skill-tutorial-state', data)
      }
    } catch (error) {
      console.error('Error relaying skill tutorial state:', error)
    }
  })

  // The teacher steers a present student's tutorial
  socket.on('skill-tutorial-control', async (data: TutorialMessage) => {
    const viewerId = socketViewerId(socket)
    const playerId = typeof data?.playerId === 'string' ? data.playerId : ''
    try {
      if (
        !viewerId ||
        !playerId ||
        !(await canPerformAction(viewerId, playerId, 'control-tutorial'))
      ) {
        console.log(`⚠️ skill-tutorial-control dropped for ${playerId}: may not control it`)
        return
      }
      for (const room of await tutorialRoomsOf(socket, playerId)) {
        io.to(room).emit('skill-tutorial-control', data)
      }
    } catch (error) {
      console.error('Error relaying skill tutorial control:', error)
    }
  })
}
