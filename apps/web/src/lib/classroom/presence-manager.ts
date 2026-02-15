/**
 * Presence Manager Module
 *
 * Manages ephemeral "in classroom" state:
 * - Enter student into classroom
 * - Leave classroom
 * - Query current presence
 *
 * Presence is different from enrollment:
 * - Enrollment: persistent registration in a classroom
 * - Presence: currently active in the classroom for a live session
 *
 * A student can only be present in one classroom at a time.
 */

import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import {
  classroomEnrollments,
  classroomPresence,
  classrooms,
  players,
  type ClassroomPresence,
  type Classroom,
  type Player,
} from '@/db/schema'
import { getSocketIO } from '@/lib/socket-io'

// ============================================================================
// Enter/Leave Classroom
// ============================================================================

export interface EnterClassroomParams {
  playerId: string
  classroomId: string
  enteredBy: string
}

export interface EnterClassroomResult {
  success: boolean
  presence?: ClassroomPresence
  error?: string
}

/**
 * Enter a student into a classroom
 *
 * Requirements:
 * - Student must be enrolled in the classroom
 * - Student cannot be in another classroom (must leave first)
 *
 * If student is already in this classroom, the timestamp is updated.
 */
export async function enterClassroom(params: EnterClassroomParams): Promise<EnterClassroomResult> {
  const { playerId, classroomId, enteredBy } = params

  // Check if student is enrolled
  const enrollment = await db.query.classroomEnrollments.findFirst({
    where: and(
      eq(classroomEnrollments.classroomId, classroomId),
      eq(classroomEnrollments.playerId, playerId)
    ),
  })

  if (!enrollment) {
    return { success: false, error: 'Student not enrolled in this classroom' }
  }

  // Check if already in another classroom
  const currentPresence = await db.query.classroomPresence.findFirst({
    where: eq(classroomPresence.playerId, playerId),
  })

  if (currentPresence && currentPresence.classroomId !== classroomId) {
    return {
      success: false,
      error: 'Student is in another classroom. Must leave first.',
    }
  }

  // Upsert presence
  if (currentPresence) {
    // Already in this classroom, update timestamp
    const [updated] = await db
      .update(classroomPresence)
      .set({ enteredAt: new Date(), enteredBy })
      .where(eq(classroomPresence.playerId, playerId))
      .returning()
    return { success: true, presence: updated }
  }

  // Insert new presence
  const [inserted] = await db
    .insert(classroomPresence)
    .values({
      playerId,
      classroomId,
      enteredBy,
    })
    .returning()

  // Emit socket event for real-time updates to teacher
  const io = await getSocketIO()
  if (io) {
    // Get player name for the event
    const player = await db.query.players.findFirst({
      where: eq(players.id, playerId),
    })
    io.to(`classroom:${classroomId}`).emit('student-entered', {
      playerId,
      playerName: player?.name ?? 'Unknown',
      enteredBy,
    })
  }

  return { success: true, presence: inserted }
}

/**
 * Remove a student from their current classroom
 */
export async function leaveClassroom(playerId: string): Promise<void> {
  // Get current presence before deleting (need classroomId for socket event)
  const presence = await db.query.classroomPresence.findFirst({
    where: eq(classroomPresence.playerId, playerId),
  })

  if (!presence) return

  await db.delete(classroomPresence).where(eq(classroomPresence.playerId, playerId))

  // Emit socket event for real-time updates to teacher
  const io = await getSocketIO()
  if (io) {
    const player = await db.query.players.findFirst({
      where: eq(players.id, playerId),
    })
    io.to(`classroom:${presence.classroomId}`).emit('student-left', {
      playerId,
      playerName: player?.name ?? 'Unknown',
    })
  }
}

/**
 * Remove a student from a specific classroom (if they're in it)
 *
 * @param removedBy - Who initiated the removal: 'teacher' or 'self'
 */
export async function leaveSpecificClassroom(
  playerId: string,
  classroomId: string,
  removedBy: 'teacher' | 'self' = 'self'
): Promise<void> {
  const deleted = await db
    .delete(classroomPresence)
    .where(
      and(eq(classroomPresence.playerId, playerId), eq(classroomPresence.classroomId, classroomId))
    )
    .returning()

  // Only emit if something was actually deleted
  if (deleted.length > 0) {
    const io = await getSocketIO()
    if (io) {
      const player = await db.query.players.findFirst({
        where: eq(players.id, playerId),
      })
      // Notify the classroom (for teacher's view)
      io.to(`classroom:${classroomId}`).emit('student-left', {
        playerId,
        playerName: player?.name ?? 'Unknown',
      })
      // Notify the player (for student's view)
      io.to(`player:${playerId}`).emit('presence-removed', {
        classroomId,
        removedBy,
      })
    }
  }
}

/**
 * Remove all students from a classroom
 *
 * Useful for "end class" functionality.
 */
export async function clearClassroomPresence(classroomId: string): Promise<number> {
  const result = await db
    .delete(classroomPresence)
    .where(eq(classroomPresence.classroomId, classroomId))
    .returning()

  return result.length
}

// ============================================================================
// Query Presence
// ============================================================================

export interface PresenceWithClassroom extends ClassroomPresence {
  classroom?: Classroom
}

export interface PresenceWithPlayer extends ClassroomPresence {
  player?: Player
}

/**
 * Get a student's current presence (which classroom they're in)
 */
export async function getStudentPresence(playerId: string): Promise<PresenceWithClassroom | null> {
  const map = await batchGetStudentPresence([playerId])
  return map.get(playerId) ?? null
}

/**
 * Batch-fetch presence for multiple players in two queries.
 *
 * Returns a Map<playerId, PresenceWithClassroom>.
 * Players not present in any classroom are omitted from the map.
 */
export async function batchGetStudentPresence(
  playerIds: string[]
): Promise<Map<string, PresenceWithClassroom>> {
  const result = new Map<string, PresenceWithClassroom>()
  if (playerIds.length === 0) return result

  // Single query: all presence records for these players
  const presences = await db.query.classroomPresence.findMany({
    where: inArray(classroomPresence.playerId, playerIds),
  })

  if (presences.length === 0) return result

  // Collect unique classroom IDs
  const classroomIds = [...new Set(presences.map((p) => p.classroomId))]

  // Single query: all classrooms
  const classroomList = await db.query.classrooms.findMany({
    where: (c, { inArray: inArr }) => inArr(c.id, classroomIds),
  })
  const classroomMap = new Map(classroomList.map((c) => [c.id, c]))

  // Assemble results
  for (const presence of presences) {
    result.set(presence.playerId, {
      ...presence,
      classroom: classroomMap.get(presence.classroomId),
    })
  }

  return result
}

/**
 * Check if a student is present in any classroom
 */
export async function isStudentPresent(playerId: string): Promise<boolean> {
  const presence = await db.query.classroomPresence.findFirst({
    where: eq(classroomPresence.playerId, playerId),
  })
  return !!presence
}

/**
 * Check if a student is present in a specific classroom
 */
export async function isStudentPresentIn(playerId: string, classroomId: string): Promise<boolean> {
  const presence = await db.query.classroomPresence.findFirst({
    where: and(
      eq(classroomPresence.playerId, playerId),
      eq(classroomPresence.classroomId, classroomId)
    ),
  })
  return !!presence
}

/**
 * Get all students currently present in a classroom
 */
export async function getClassroomPresence(classroomId: string): Promise<PresenceWithPlayer[]> {
  const presences = await db.query.classroomPresence.findMany({
    where: eq(classroomPresence.classroomId, classroomId),
  })

  if (presences.length === 0) return []

  const playerIds = presences.map((p) => p.playerId)
  const players = await db.query.players.findMany({
    where: (players, { inArray }) => inArray(players.id, playerIds),
  })
  const playerMap = new Map(players.map((p) => [p.id, p]))

  return presences.map((p) => ({
    ...p,
    player: playerMap.get(p.playerId),
  }))
}

/**
 * Get count of students present in a classroom
 */
export async function getPresenceCount(classroomId: string): Promise<number> {
  const presences = await db.query.classroomPresence.findMany({
    where: eq(classroomPresence.classroomId, classroomId),
  })
  return presences.length
}

/**
 * Get all player IDs present in a classroom
 */
export async function getPresentPlayerIds(classroomId: string): Promise<string[]> {
  const presences = await db.query.classroomPresence.findMany({
    where: eq(classroomPresence.classroomId, classroomId),
  })
  return presences.map((p) => p.playerId)
}
