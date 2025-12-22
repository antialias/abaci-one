/**
 * Access Control Module
 *
 * Determines what access a user has to a player based on:
 * - Parent-child relationship (always full access)
 * - Teacher-student relationship (enrolled students)
 * - Presence (student currently in teacher's classroom)
 */

import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import {
  classroomEnrollments,
  classroomPresence,
  classrooms,
  parentChild,
  type Player,
  players,
} from '@/db/schema'

/**
 * Access levels in order of increasing permissions:
 * - 'none': No access to this player
 * - 'teacher-enrolled': Can view history/skills (student is enrolled)
 * - 'teacher-present': Can run sessions, observe, control (student is present)
 * - 'parent': Full access always (parent-child relationship)
 */
export type AccessLevel = 'none' | 'teacher-enrolled' | 'teacher-present' | 'parent'

/**
 * Result of checking a user's access to a player
 */
export interface PlayerAccess {
  playerId: string
  accessLevel: AccessLevel
  isParent: boolean
  isTeacher: boolean
  isPresent: boolean
}

/**
 * Determine what access a viewer has to a player
 */
export async function getPlayerAccess(viewerId: string, playerId: string): Promise<PlayerAccess> {
  // Check parent relationship
  const parentLink = await db.query.parentChild.findFirst({
    where: and(eq(parentChild.parentUserId, viewerId), eq(parentChild.childPlayerId, playerId)),
  })
  const isParent = !!parentLink

  // Check teacher relationship (enrolled in their classroom)
  const classroom = await db.query.classrooms.findFirst({
    where: eq(classrooms.teacherId, viewerId),
  })

  let isTeacher = false
  let isPresent = false

  if (classroom) {
    const enrollment = await db.query.classroomEnrollments.findFirst({
      where: and(
        eq(classroomEnrollments.classroomId, classroom.id),
        eq(classroomEnrollments.playerId, playerId)
      ),
    })
    isTeacher = !!enrollment

    if (isTeacher) {
      const presence = await db.query.classroomPresence.findFirst({
        where: and(
          eq(classroomPresence.classroomId, classroom.id),
          eq(classroomPresence.playerId, playerId)
        ),
      })
      isPresent = !!presence
    }
  }

  // Determine access level (parent takes precedence)
  let accessLevel: AccessLevel = 'none'
  if (isParent) {
    accessLevel = 'parent'
  } else if (isPresent) {
    accessLevel = 'teacher-present'
  } else if (isTeacher) {
    accessLevel = 'teacher-enrolled'
  }

  return { playerId, accessLevel, isParent, isTeacher, isPresent }
}

/**
 * Actions that can be performed on a player
 */
export type PlayerAction =
  | 'view' // View skills, history, progress
  | 'start-session' // Start a practice session
  | 'observe' // Watch an active session
  | 'control-tutorial' // Control tutorial navigation
  | 'control-abacus' // Control the abacus display

/**
 * Check if viewer can perform action on player
 */
export async function canPerformAction(
  viewerId: string,
  playerId: string,
  action: PlayerAction
): Promise<boolean> {
  const access = await getPlayerAccess(viewerId, playerId)

  switch (action) {
    case 'view':
      // Parent or any teacher relationship (enrolled or present)
      return access.accessLevel !== 'none'

    case 'start-session':
    case 'observe':
    case 'control-tutorial':
    case 'control-abacus':
      // Parent always, or teacher with presence
      return access.isParent || access.isPresent

    default:
      return false
  }
}

/**
 * Result of getting all accessible players for a viewer
 */
export interface AccessiblePlayers {
  /** Children where viewer is a parent (full access) */
  ownChildren: Player[]
  /** Students enrolled in viewer's classroom (view only unless present) */
  enrolledStudents: Player[]
  /** Students currently present in viewer's classroom (full access) */
  presentStudents: Player[]
}

/**
 * Get all players accessible to a viewer
 *
 * Returns three categories:
 * - ownChildren: Viewer is a parent (always full access)
 * - enrolledStudents: Enrolled in viewer's classroom (can be view-only or full)
 * - presentStudents: Currently present in viewer's classroom (full access)
 *
 * Note: Own children who are also enrolled appear ONLY in ownChildren,
 * not duplicated in enrolledStudents.
 */
export async function getAccessiblePlayers(viewerId: string): Promise<AccessiblePlayers> {
  // Own children (via parent_child)
  const parentLinks = await db.query.parentChild.findMany({
    where: eq(parentChild.parentUserId, viewerId),
  })
  const childIds = parentLinks.map((l) => l.childPlayerId)

  let ownChildren: Player[] = []
  if (childIds.length > 0) {
    ownChildren = await db.query.players.findMany({
      where: (players, { inArray }) => inArray(players.id, childIds),
    })
  }
  const ownChildIds = new Set(ownChildren.map((c) => c.id))

  // Check if viewer is a teacher
  const classroom = await db.query.classrooms.findFirst({
    where: eq(classrooms.teacherId, viewerId),
  })

  let enrolledStudents: Player[] = []
  let presentStudents: Player[] = []

  if (classroom) {
    // Enrolled students (exclude own children to avoid duplication)
    const enrollments = await db.query.classroomEnrollments.findMany({
      where: eq(classroomEnrollments.classroomId, classroom.id),
    })
    const enrolledIds = enrollments.map((e) => e.playerId).filter((id) => !ownChildIds.has(id))

    if (enrolledIds.length > 0) {
      enrolledStudents = await db.query.players.findMany({
        where: (players, { inArray }) => inArray(players.id, enrolledIds),
      })
    }

    // Present students (subset of enrolled, for quick lookup)
    const presences = await db.query.classroomPresence.findMany({
      where: eq(classroomPresence.classroomId, classroom.id),
    })
    const presentIds = new Set(presences.map((p) => p.playerId))

    // Present students includes both own children and enrolled students
    presentStudents = [...ownChildren, ...enrolledStudents].filter((s) => presentIds.has(s.id))
  }

  return { ownChildren, enrolledStudents, presentStudents }
}

/**
 * Check if a user is a parent of a player
 */
export async function isParentOf(userId: string, playerId: string): Promise<boolean> {
  const link = await db.query.parentChild.findFirst({
    where: and(eq(parentChild.parentUserId, userId), eq(parentChild.childPlayerId, playerId)),
  })
  return !!link
}

/**
 * Check if a user is the teacher of a classroom where the player is enrolled
 */
export async function isTeacherOf(userId: string, playerId: string): Promise<boolean> {
  const classroom = await db.query.classrooms.findFirst({
    where: eq(classrooms.teacherId, userId),
  })

  if (!classroom) return false

  const enrollment = await db.query.classroomEnrollments.findFirst({
    where: and(
      eq(classroomEnrollments.classroomId, classroom.id),
      eq(classroomEnrollments.playerId, playerId)
    ),
  })

  return !!enrollment
}
