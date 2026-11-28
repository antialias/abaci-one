/**
 * Who may join a classroom's channel `classroom:<id>` and a player's channel
 * `player:<id>`, and where the skill tutorial's state and controls go.
 *
 * - `classroom:<id>` is the teacher-only room (§10 P4d-8, P4d-9): its only
 *   member is the classroom's teacher. It carries the teacher's view:
 *   enrollment requests, presence, every enrolled student's session starts,
 *   summaries and ends, entry prompts and the students' tutorial states.
 *   Students' devices do not join it.
 * - `player:<id>`: whoever may `view` that player (`canPerformAction`), as the
 *   player's HTTP routes decide it: a parent, or an enrolled student's teacher.
 *   The student's own device joins it to hear the teacher's tutorial controls.
 * - `skill-tutorial-state`: only for a player the sender may `start-session`
 *   for (the kid's own device, or the teacher of a present student). The
 *   server sends it to `classroom:<id>` of every classroom that player is
 *   enrolled in, decided by enrollment here, not by any room the sender
 *   joined: the first frame needs no join to finish first.
 * - `skill-tutorial-control`: only for a player the sender may
 *   `control-tutorial` (a parent, or the teacher of a present student), sent
 *   to that player's `player:<id>`.
 *
 * Every check uses the socket's verified viewer (`socket.data.viewer`); an id
 * in a payload is the subject of the check, never the one checked. A join
 * answers `channel-joined { channel, id }`; a refused one answers
 * `channel-error { channel, id, error }` and joins nothing.
 * Leaving is never checked: it only takes the socket out.
 */

import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { type SocketViewerData, socketViewerId } from '@/lib/socket-viewer'
import { canPerformAction } from './access-control'

/** A classroom's channel: the teacher-only room. */
export function classroomRoom(classroomId: string): string {
  return `classroom:${classroomId}`
}

/** A player's channel: presence, enrollment, sessions and tutorial controls of that player. */
export function playerRoom(playerId: string): string {
  return `player:${playerId}`
}

/** Whether `viewerId` teaches the classroom: the only member of `classroom:<id>`. */
export async function mayJoinClassroom(
  viewerId: string | null,
  classroomId: string
): Promise<boolean> {
  if (!viewerId || typeof classroomId !== 'string' || !classroomId) return false
  const classroom = await db.query.classrooms.findFirst({
    where: eq(schema.classrooms.id, classroomId),
    columns: { teacherId: true },
  })
  return classroom?.teacherId === viewerId
}

/** The teacher rooms of every classroom a player is enrolled in, present or not. */
export async function teacherRoomsOf(playerId: string): Promise<string[]> {
  const rows = await db
    .select({ classroomId: schema.classroomEnrollments.classroomId })
    .from(schema.classroomEnrollments)
    .where(eq(schema.classroomEnrollments.playerId, playerId))
  return rows.map((r) => classroomRoom(r.classroomId))
}

/** The socket surface these channels need (a socket.io `Socket`). */
export interface ClassroomChannelSocket {
  on(event: string, handler: (data: any) => void): unknown
  join(room: string): unknown
  leave(room: string): unknown
  emit(event: string, data: unknown): unknown
  to(room: string | string[]): { emit(event: string, data: unknown): unknown }
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
        refuse('classroom', classroomId, 'Not the teacher of this classroom')
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

  // The student's device tells its teachers where its tutorial is
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
      const rooms = await teacherRoomsOf(playerId)
      if (rooms.length > 0) socket.to(rooms).emit('skill-tutorial-state', data)
    } catch (error) {
      console.error('Error relaying skill tutorial state:', error)
    }
  })

  // The teacher steers a present student's tutorial, on the student's channel
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
      io.to(playerRoom(playerId)).emit('skill-tutorial-control', data)
    } catch (error) {
      console.error('Error relaying skill tutorial control:', error)
    }
  })
}
