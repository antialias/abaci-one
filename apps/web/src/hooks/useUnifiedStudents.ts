'use client'

import { useMemo, useRef } from 'react'

// Stable empty array reference to avoid re-renders
const EMPTY_CHILD_IDS: string[] = []
import {
  useMyClassroom,
  useEnrolledStudents,
  useClassroomPresence,
  useActiveSessionsInClassroom,
  type ActiveSessionInfo,
  type PresenceStudent,
} from '@/hooks/useClassroom'
import { useChildSessionsSocket } from '@/hooks/useChildSessionsSocket'
import { usePlayersWithSkillData } from '@/hooks/useUserPlayers'
import type { StudentWithSkillData } from '@/utils/studentGrouping'
import type { UnifiedStudent, StudentRelationship, StudentActivity } from '@/types/student'

/**
 * Return type for useUnifiedStudents hook
 */
export interface UseUnifiedStudentsResult {
  /** Merged list of all students from all sources */
  students: UnifiedStudent[]
  /** Whether the current user is a teacher (has a classroom) */
  isTeacher: boolean
  /** Teacher's classroom code (for display) */
  classroomCode?: string
  /** Classroom ID (for actions) */
  classroomId?: string
  /** Whether any data is still loading */
  isLoading: boolean
}

/**
 * Hook to fetch and merge student data from multiple sources
 *
 * Combines:
 * - My children (from players API)
 * - Enrolled students (teacher's classroom)
 * - Present students (classroom presence)
 * - Active sessions (practicing status)
 *
 * Returns a unified list with relationship and activity status for each student.
 *
 * @param initialPlayers - Server-prefetched player data
 * @param userId - The current user's database ID (for parent session subscriptions)
 */
export function useUnifiedStudents(
  initialPlayers?: StudentWithSkillData[],
  userId?: string
): UseUnifiedStudentsResult {
  // Get classroom data (determines if user is a teacher)
  const { data: classroom, isLoading: isLoadingClassroom } = useMyClassroom()
  const isTeacher = !!classroom

  // Get my children (all users see this)
  const { data: myChildren = [], isLoading: isLoadingChildren } = usePlayersWithSkillData({
    initialData: initialPlayers,
  })

  // Get child IDs for parent session subscription
  const childIds = useMemo(() => myChildren.map((c) => c.id), [myChildren])

  // Get enrolled students (teachers only)
  const { data: enrolledStudents = [], isLoading: isLoadingEnrolled } = useEnrolledStudents(
    classroom?.id
  )

  // Get present students (teachers only)
  const { data: presentStudents = [], isLoading: isLoadingPresence } = useClassroomPresence(
    classroom?.id
  )

  // Get active sessions (teachers only - for students in their classroom)
  const { data: activeSessions = [], isLoading: isLoadingActiveSessions } =
    useActiveSessionsInClassroom(classroom?.id)

  // Get active sessions for parent's children (via WebSocket for real-time updates)
  // Only active for non-teachers (parents) who have children
  const { sessionMap: childSessionMap, isLoading: isLoadingChildSessions } = useChildSessionsSocket(
    !isTeacher ? userId : undefined,
    !isTeacher ? childIds : EMPTY_CHILD_IDS
  )

  // Build lookup maps for efficient merging
  const presenceMap = useMemo(() => {
    const map = new Map<string, PresenceStudent>()
    for (const student of presentStudents) {
      map.set(student.id, student)
    }
    return map
  }, [presentStudents])

  // Merge teacher's classroom sessions with parent's child sessions
  const sessionMap = useMemo(() => {
    const map = new Map<string, ActiveSessionInfo>()
    // Teacher sessions from classroom
    for (const session of activeSessions) {
      map.set(session.playerId, session)
    }
    // Parent sessions from WebSocket (convert ChildActiveSession to ActiveSessionInfo format)
    for (const [playerId, session] of childSessionMap) {
      if (!map.has(playerId)) {
        map.set(playerId, {
          sessionId: session.planId,
          playerId,
          startedAt: session.startedAt,
          completedProblems: session.completedSlots,
          totalProblems: session.totalSlots,
          currentPartIndex: 0,
          currentSlotIndex: session.completedSlots,
          totalParts: 1,
        })
      }
    }
    return map
  }, [activeSessions, childSessionMap])

  const enrolledIds = useMemo(() => {
    return new Set(enrolledStudents.map((s) => s.id))
  }, [enrolledStudents])

  // Merge all sources into unified students
  const students = useMemo(() => {
    const studentMap = new Map<string, UnifiedStudent>()

    // Add my children first (highest priority for data)
    for (const child of myChildren) {
      const relationship: StudentRelationship = {
        isMyChild: true,
        isEnrolled: enrolledIds.has(child.id),
        isPresent: presenceMap.has(child.id),
        enrollmentStatus: null, // TODO: Add pending enrollment lookup
      }

      const session = sessionMap.get(child.id)
      const activity: StudentActivity = session
        ? {
            status: 'practicing',
            sessionProgress: {
              current: session.completedProblems,
              total: session.totalProblems,
            },
            sessionId: session.sessionId,
          }
        : { status: 'idle' }

      studentMap.set(child.id, {
        ...child,
        relationship,
        activity,
      })
    }

    // Add enrolled students that aren't already in the map (teacher view)
    if (isTeacher) {
      for (const enrolled of enrolledStudents) {
        if (!studentMap.has(enrolled.id)) {
          const relationship: StudentRelationship = {
            isMyChild: false,
            isEnrolled: true,
            isPresent: presenceMap.has(enrolled.id),
            enrollmentStatus: null,
          }

          const session = sessionMap.get(enrolled.id)
          const activity: StudentActivity = session
            ? {
                status: 'practicing',
                sessionProgress: {
                  current: session.completedProblems,
                  total: session.totalProblems,
                },
                sessionId: session.sessionId,
              }
            : { status: 'idle' }

          studentMap.set(enrolled.id, {
            ...enrolled,
            relationship,
            activity,
          })
        }
      }

      // Add present students that aren't enrolled or my children
      // (edge case: student who somehow got presence without enrollment)
      for (const present of presentStudents) {
        if (!studentMap.has(present.id)) {
          const relationship: StudentRelationship = {
            isMyChild: false,
            isEnrolled: false,
            isPresent: true,
            enrollmentStatus: null,
          }

          const session = sessionMap.get(present.id)
          const activity: StudentActivity = session
            ? {
                status: 'practicing',
                sessionProgress: {
                  current: session.completedProblems,
                  total: session.totalProblems,
                },
                sessionId: session.sessionId,
              }
            : { status: 'idle' }

          studentMap.set(present.id, {
            ...present,
            relationship,
            activity,
          })
        }
      }
    }

    return Array.from(studentMap.values())
  }, [
    myChildren,
    enrolledStudents,
    presentStudents,
    isTeacher,
    enrolledIds,
    presenceMap,
    sessionMap,
  ])

  const isLoading =
    isLoadingClassroom ||
    isLoadingChildren ||
    (isTeacher && (isLoadingEnrolled || isLoadingPresence || isLoadingActiveSessions)) ||
    (!isTeacher && isLoadingChildSessions)

  return {
    students,
    isTeacher,
    classroomCode: classroom?.code,
    classroomId: classroom?.id,
    isLoading,
  }
}

/**
 * Filter students by view
 */
export function filterStudentsByView(
  students: UnifiedStudent[],
  view:
    | 'all'
    | 'my-children'
    | 'my-children-active'
    | 'enrolled'
    | 'in-classroom'
    | 'in-classroom-active'
    | 'needs-attention'
): UnifiedStudent[] {
  switch (view) {
    case 'all':
      return students
    case 'needs-attention':
      return students.filter((s) => s.intervention != null && !s.isArchived)
    case 'my-children':
      return students.filter((s) => s.relationship.isMyChild)
    case 'my-children-active':
      return students.filter((s) => s.relationship.isMyChild && s.activity?.status === 'practicing')
    case 'enrolled':
      return students.filter((s) => s.relationship.isEnrolled)
    case 'in-classroom':
      return students.filter((s) => s.relationship.isPresent)
    case 'in-classroom-active':
      return students.filter((s) => s.relationship.isPresent && s.activity?.status === 'practicing')
    default:
      return students
  }
}

/**
 * Compute view counts from unified students
 */
export function computeViewCounts(
  students: UnifiedStudent[],
  isTeacher: boolean
): Partial<
  Record<
    | 'all'
    | 'my-children'
    | 'my-children-active'
    | 'enrolled'
    | 'in-classroom'
    | 'in-classroom-active'
    | 'needs-attention',
    number
  >
> {
  const counts: Partial<
    Record<
      | 'all'
      | 'my-children'
      | 'my-children-active'
      | 'enrolled'
      | 'in-classroom'
      | 'in-classroom-active'
      | 'needs-attention',
      number
    >
  > = {
    all: students.length,
    'needs-attention': students.filter((s) => s.intervention != null && !s.isArchived).length,
    'my-children': students.filter((s) => s.relationship.isMyChild).length,
    'my-children-active': students.filter(
      (s) => s.relationship.isMyChild && s.activity?.status === 'practicing'
    ).length,
  }

  if (isTeacher) {
    counts.enrolled = students.filter((s) => s.relationship.isEnrolled).length
    counts['in-classroom'] = students.filter((s) => s.relationship.isPresent).length
    counts['in-classroom-active'] = students.filter(
      (s) => s.relationship.isPresent && s.activity?.status === 'practicing'
    ).length
  }

  return counts
}
