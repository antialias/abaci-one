/**
 * Access Control Module
 *
 * Determines what access a user has to a player based on:
 * - Parent-child relationship (always full access)
 * - Teacher-student relationship (enrolled students)
 * - Presence (student currently in teacher's classroom)
 *
 * Guest sharing rule:
 * Shared (non-owned) students expire for guest accounts after 24 hours.
 * This is enforced centrally via getValidParentLinks() and isValidParentOf().
 * All access checks and player listings go through these functions.
 */

import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import {
  classroomEnrollments,
  classroomPresence,
  classrooms,
  parentChild,
  players,
  type ParentChild,
  type Player,
  users,
} from '@/db/schema'

const GUEST_SHARE_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours

// ---------------------------------------------------------------------------
// Guest sharing expiry — single source of truth
// ---------------------------------------------------------------------------

/**
 * Get all valid parent_child links for a viewer.
 *
 * For authenticated users, all links are valid.
 * For guest users, shared (non-owned) student links expire after 24 hours.
 * Owned students (players.userId === viewerId) are always valid.
 */
export async function getValidParentLinks(viewerId: string): Promise<ParentChild[]> {
  const links = await db.query.parentChild.findMany({
    where: eq(parentChild.parentUserId, viewerId),
  })
  if (links.length === 0) return []

  const isGuest = await isGuestUser(viewerId)
  if (!isGuest) return links

  // Guest — need to check ownership to apply expiry
  const childIds = links.map((l) => l.childPlayerId)
  const linkedPlayers = await db.query.players.findMany({
    where: (p, { inArray }) => inArray(p.id, childIds),
    columns: { id: true, userId: true },
  })
  const ownerMap = new Map(linkedPlayers.map((p) => [p.id, p.userId]))
  const cutoff = new Date(Date.now() - GUEST_SHARE_EXPIRY_MS)

  return links.filter((link) => {
    const isOwner = ownerMap.get(link.childPlayerId) === viewerId
    if (isOwner) return true // owned — always valid
    return link.linkedAt >= cutoff // shared — must be within 24h
  })
}

/**
 * Check if a viewer has a valid parent link to a specific player.
 *
 * Same expiry rules as getValidParentLinks, but optimized for single-player checks.
 */
export async function isValidParentOf(viewerId: string, playerId: string): Promise<boolean> {
  // Check if viewer owns the player (always valid, regardless of parent_child links)
  const player = await db.query.players.findFirst({
    where: eq(players.id, playerId),
    columns: { userId: true },
  })
  if (player?.userId === viewerId) return true

  // Check parent_child link
  const link = await db.query.parentChild.findFirst({
    where: and(eq(parentChild.parentUserId, viewerId), eq(parentChild.childPlayerId, playerId)),
  })
  if (!link) return false

  // Shared student — check guest expiry
  const isGuest = await isGuestUser(viewerId)
  if (!isGuest) return true

  const cutoff = new Date(Date.now() - GUEST_SHARE_EXPIRY_MS)
  return link.linkedAt >= cutoff
}

/** Check if a user is a guest (not yet authenticated). */
async function isGuestUser(userId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { upgradedAt: true },
  })
  return !user?.upgradedAt
}

// ---------------------------------------------------------------------------
// Access levels and player access
// ---------------------------------------------------------------------------

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

  // Check parent relationship (with guest expiry)
  let t = performance.now()
  const isParent = await isValidParentOf(viewerId, playerId)
  timings.parentCheck = performance.now() - t

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

// ---------------------------------------------------------------------------
// Accessible players (bulk listing)
// ---------------------------------------------------------------------------

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
  // Own children: via parent_child links (with guest expiry) + directly owned players
  const validLinks = await getValidParentLinks(viewerId)
  const childIds = validLinks.map((l) => l.childPlayerId)

  // Also include players directly owned by the viewer (players.userId)
  // This covers cases where parent_child links are missing or point to old guest identities
  const ownedPlayers = await db.query.players.findMany({
    where: eq(players.userId, viewerId),
  })
  const allChildIds = new Set([...childIds, ...ownedPlayers.map((p) => p.id)])

  let ownChildren: Player[] = []
  if (allChildIds.size > 0) {
    ownChildren = await db.query.players.findMany({
      where: (p, { inArray }) => inArray(p.id, [...allChildIds]),
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

// ---------------------------------------------------------------------------
// Authorization errors (for API responses)
// ---------------------------------------------------------------------------

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
