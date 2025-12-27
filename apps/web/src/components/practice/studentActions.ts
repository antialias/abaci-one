/**
 * Shared logic for student action menus
 *
 * Used by both StudentActionMenu (on tiles) and NotesModal (in quicklook)
 * to ensure consistent action visibility across the app.
 */

export interface StudentActionContext {
  /** Whether the viewer is a teacher */
  isTeacher: boolean
  /** Classroom ID if teacher has one */
  classroomId?: string
}

export interface StudentActionData {
  id: string
  name: string
  isArchived?: boolean
  relationship?: {
    isMyChild: boolean
    isEnrolled: boolean
    isPresent: boolean
    enrollmentStatus: string | null
  }
  activity?: {
    status: string
    sessionId?: string
  }
}

export interface AvailableActions {
  // Primary actions
  startPractice: boolean
  watchSession: boolean
  enterClassroom: boolean
  leaveClassroom: boolean
  removeFromClassroom: boolean

  // Enrollment actions
  enrollInClassroom: boolean
  unenrollStudent: boolean

  // Management actions
  shareAccess: boolean
  archive: boolean
  unarchive: boolean
}

/**
 * Compute which actions are available for a student
 */
export function getAvailableActions(
  student: StudentActionData,
  context: StudentActionContext,
  options: {
    hasEnrolledClassrooms?: boolean
  } = {}
): AvailableActions {
  const { relationship, activity, isArchived } = student
  const { isTeacher } = context
  const { hasEnrolledClassrooms = relationship?.isEnrolled } = options

  const isPracticing = activity?.status === 'practicing'
  const hasSessionId = !!activity?.sessionId
  const isPresent = !!relationship?.isPresent
  const isEnrolled = !!relationship?.isEnrolled
  const isMyChild = !!relationship?.isMyChild

  return {
    // Primary actions
    startPractice: true, // Always available
    watchSession: isPracticing && hasSessionId,
    // Parents can enter/leave their own children (even if they're also teachers)
    enterClassroom: isMyChild && !!hasEnrolledClassrooms && !isPresent,
    leaveClassroom: isMyChild && isPresent,
    // Teachers can remove students from their classroom
    removeFromClassroom: isTeacher && isPresent,

    // Enrollment actions
    // Parents can enroll their children (even if they're also teachers)
    enrollInClassroom: isMyChild && !isEnrolled,
    unenrollStudent: isTeacher && isEnrolled,

    // Management actions
    shareAccess: isMyChild,
    archive: !isArchived && isMyChild,
    unarchive: !!isArchived && isMyChild,
  }
}

/**
 * Action definitions for consistent rendering
 */
export const ACTION_DEFINITIONS = {
  startPractice: { icon: '▶️', label: 'Start Practice' },
  watchSession: { icon: '👁', label: 'Watch Session' },
  enterClassroom: { icon: '🏫', label: 'Enter Classroom' },
  leaveClassroom: { icon: '🚪', label: 'Leave Classroom' },
  removeFromClassroom: { icon: '🚪', label: 'Remove from Classroom' },
  enrollInClassroom: { icon: '➕', label: 'Enroll in Classroom' },
  unenrollStudent: { icon: '📋', label: 'Unenroll Student', variant: 'danger' as const },
  shareAccess: { icon: '🔗', label: 'Share Access' },
  archive: { icon: '📦', label: 'Archive' },
  unarchive: { icon: '📤', label: 'Unarchive' },
} as const
