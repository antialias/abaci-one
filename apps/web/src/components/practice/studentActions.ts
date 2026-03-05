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
  promptToEnter: boolean

  // Enrollment actions
  addToMyClassroom: boolean
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
    isEnrolledInMyClassroom?: boolean
  } = {}
): AvailableActions {
  const { relationship, activity, isArchived } = student
  const { isTeacher } = context
  const { hasEnrolledClassrooms = relationship?.isEnrolled, isEnrolledInMyClassroom } = options

  const isPracticing = activity?.status === 'practicing'
  const hasSessionId = !!activity?.sessionId
  const isPresent = !!relationship?.isPresent
  const isEnrolled = !!relationship?.isEnrolled
  const isMyChild = !!relationship?.isMyChild

  // Check if this is a pending enrollment request - disable most actions
  const isPendingEnrollment = relationship?.enrollmentStatus?.startsWith('pending') ?? false

  // For pending enrollment requests, only allow viewing (no actions)
  if (isPendingEnrollment) {
    return {
      startPractice: false,
      watchSession: false,
      enterClassroom: false,
      leaveClassroom: false,
      removeFromClassroom: false,
      promptToEnter: false,
      addToMyClassroom: false,
      enrollInClassroom: false,
      unenrollStudent: false,
      shareAccess: false,
      archive: false,
      unarchive: false,
    }
  }

  return {
    // Primary actions
    startPractice: true, // Always available for enrolled/owned students
    watchSession: isPracticing && hasSessionId,
    // Parents can enter/leave their own children (even if they're also teachers)
    enterClassroom: isMyChild && !!hasEnrolledClassrooms && !isPresent,
    leaveClassroom: isMyChild && isPresent,
    // Teachers can remove students from their classroom
    removeFromClassroom: isTeacher && isPresent,
    // Teachers can prompt parents to enter their enrolled students
    promptToEnter: isTeacher && isEnrolled && !isPresent,

    // Enrollment actions
    // Parent-teachers can directly add their own children to their classroom
    addToMyClassroom: isMyChild && isTeacher && !isEnrolledInMyClassroom,
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
  promptToEnter: { icon: '📣', label: 'Prompt to Enter' },
  addToMyClassroom: { icon: '🏫', label: 'Add to My Class' },
  enrollInClassroom: { icon: '➕', label: 'Enroll in Classroom' },
  unenrollStudent: {
    icon: '📋',
    label: 'Unenroll Student',
    variant: 'danger' as const,
  },
  shareAccess: { icon: '🔗', label: 'Share Access' },
  archive: { icon: '📦', label: 'Archive' },
  unarchive: { icon: '📤', label: 'Unarchive' },
} as const
