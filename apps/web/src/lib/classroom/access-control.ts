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
  /** Classroom ID if the viewer is a teacher */
  classroomId?: string
}

/**
 * Determine what access a viewer has to a player
 */
export async function getPlayerAccess(viewerId: string, playerId: string): Promise<PlayerAccess> {
  const start = performance.now()
  const timings: Record<string, number> = {}

  // Check parent relationship
  let t = performance.now()
  const parentLink = await db.query.parentChild.findFirst({
    where: and(eq(parentChild.parentUserId, viewerId), eq(parentChild.childPlayerId, playerId)),
  })
  timings.parentCheck = performance.now() - t
  const isParent = !!parentLink

  // Check teacher relationship (enrolled in their classroom)
  t = performance.now()
  const classroom = await db.query.classrooms.findFirst({
    where: eq(classrooms.teacherId, viewerId),
  })
  timings.classroomCheck = performance.now() - t

  let isTeacher = false
  let isPresent = false

  if (classroom) {
    t = performance.now()
    const enrollment = await db.query.classroomEnrollments.findFirst({
      where: and(
        eq(classroomEnrollments.classroomId, classroom.id),
        eq(classroomEnrollments.playerId, playerId)
      ),
    })
    timings.enrollmentCheck = performance.now() - t
    isTeacher = !!enrollment

    if (isTeacher) {
      t = performance.now()
      const presence = await db.query.classroomPresence.findFirst({
        where: and(
          eq(classroomPresence.classroomId, classroom.id),
          eq(classroomPresence.playerId, playerId)
        ),
      })
      timings.presenceCheck = performance.now() - t
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

  const total = performance.now() - start
  console.log(
    `[PERF] getPlayerAccess: ${total.toFixed(1)}ms | ` +
      `parent=${timings.parentCheck?.toFixed(1)}ms, ` +
      `classroom=${timings.classroomCheck?.toFixed(1)}ms` +
      (timings.enrollmentCheck ? `, enrollment=${timings.enrollmentCheck.toFixed(1)}ms` : '') +
      (timings.presenceCheck ? `, presence=${timings.presenceCheck.toFixed(1)}ms` : '')
  )

  return {
    playerId,
    accessLevel,
    isParent,
    isTeacher,
    isPresent,
    classroomId: classroom?.id,
  }
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
  const start = performance.now()
  const access = await getPlayerAccess(viewerId, playerId)
  const accessTime = performance.now() - start

  let result: boolean
  switch (action) {
    case 'view':
      // Parent or any teacher relationship (enrolled or present)
      result = access.accessLevel !== 'none'
      break

    case 'start-session':
    case 'observe':
    case 'control-tutorial':
    case 'control-abacus':
      // Parent always, or teacher with presence
      result = access.isParent || access.isPresent
      break

    default:
      result = false
  }

  console.log(
    `[PERF] canPerformAction(${action}): ${(performance.now() - start).toFixed(1)}ms | getPlayerAccess=${accessTime.toFixed(1)}ms, result=${result}`
  )

  return result
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

/**
 * Remediation types for authorization errors
 */
export type RemediationType =
  | 'send-entry-prompt' // Teacher needs student to enter classroom
  | 'enroll-student' // Teacher needs to enroll student first
  | 'link-via-family-code' // User can link via family code
  | 'create-classroom' // User needs to create a classroom to be a teacher
  | 'no-access' // No remediation available

/**
 * Structured authorization error for API responses
 */
export interface AuthorizationError {
  error: string
  message: string
  accessLevel: AccessLevel
  remediation: {
    type: RemediationType
    description: string
    /** For send-entry-prompt: the classroom to send the prompt from */
    classroomId?: string
    /** For send-entry-prompt/enroll-student: the player to act on */
    playerId?: string
    /** Label for the action button in the UI */
    actionLabel?: string
  }
}

/**
 * Generate a personalized authorization error based on the user's relationship
 * with the student and the action they're trying to perform.
 */
export function generateAuthorizationError(
  access: PlayerAccess,
  action: PlayerAction,
  context?: { actionDescription?: string }
): AuthorizationError {
  const actionDesc = context?.actionDescription ?? action

  // Case 1: Teacher with enrolled student, but student not present
  // This is the most common case - teacher needs student to enter classroom
  if (access.accessLevel === 'teacher-enrolled' && !access.isPresent) {
    return {
      error: 'Student not in classroom',
      message: `This student is enrolled in your classroom but not currently present. To ${actionDesc}, they need to enter your classroom first.`,
      accessLevel: access.accessLevel,
      remediation: {
        type: 'send-entry-prompt',
        description:
          "Send a notification to the student's parent to have them enter your classroom.",
        classroomId: access.classroomId,
        playerId: access.playerId,
        actionLabel: 'Send Entry Prompt',
      },
    }
  }

  // Case 2: User has a classroom but student is not enrolled
  if (access.accessLevel === 'none' && access.classroomId) {
    return {
      error: 'Student not enrolled',
      message: 'This student is not enrolled in your classroom.',
      accessLevel: access.accessLevel,
      remediation: {
        type: 'enroll-student',
        description:
          'You need to enroll this student in your classroom first. Ask their parent for their family code to send an enrollment request.',
        classroomId: access.classroomId,
        playerId: access.playerId,
        actionLabel: 'Enroll Student',
      },
    }
  }

  // Case 3: User has no classroom and no parent relationship
  if (access.accessLevel === 'none') {
    return {
      error: 'No access to this student',
      message: 'Your account is not linked to this student.',
      accessLevel: access.accessLevel,
      remediation: {
        type: 'link-via-family-code',
        description:
          "To access this student, you need their Family Code. Ask their parent to share it with you from the student's profile page.",
        playerId: access.playerId,
        actionLabel: 'Enter Family Code',
      },
    }
  }

  // Fallback for any other case
  return {
    error: 'Not authorized',
    message: `You do not have permission to ${actionDesc} for this student.`,
    accessLevel: access.accessLevel,
    remediation: {
      type: 'no-access',
      description: "Contact the student's parent or your administrator for access.",
      playerId: access.playerId,
    },
  }
}
