'use client'

import { useMemo } from 'react'
import {
  useMyClassroom,
  useEnrolledStudents,
  useClassroomPresence,
  useActiveSessionsInClassroom,
  type ActiveSessionInfo,
  type PresenceStudent,
} from '@/hooks/useClassroom'
import {
  usePlayersWithSkillData,
  useChildrenActiveSessions,
  type ChildActiveSession,
} from '@/hooks/useUserPlayers'
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
 */
export function useUnifiedStudents(
  initialPlayers?: StudentWithSkillData[]
): UseUnifiedStudentsResult {
  // Get classroom data (determines if user is a teacher)
  const { data: classroom, isLoading: isLoadingClassroom } = useMyClassroom()
  const isTeacher = !!classroom

  // Get my children (all users see this)
  const { data: myChildren = [], isLoading: isLoadingChildren } = usePlayersWithSkillData({
    initialData: initialPlayers,
  })

  // Get active sessions for my children (polls every 10s)
  const childIds = useMemo(() => myChildren.map((c) => c.id), [myChildren])
  const { sessionMap: childSessionMap, isLoading: isLoadingChildSessions } =
    useChildrenActiveSessions(childIds)

  // Get enrolled students (teachers only)
  const { data: enrolledStudents = [], isLoading: isLoadingEnrolled } = useEnrolledStudents(
    classroom?.id
  )

  // Get present students (teachers only)
  const { data: presentStudents = [], isLoading: isLoadingPresence } = useClassroomPresence(
    classroom?.id
  )

  // Get active sessions in classroom (teachers only)
  const { data: activeSessions = [], isLoading: isLoadingActiveSessions } =
    useActiveSessionsInClassroom(classroom?.id)

  // Build lookup maps for efficient merging
  const presenceMap = useMemo(() => {
    const map = new Map<string, PresenceStudent>()
    for (const student of presentStudents) {
      map.set(student.id, student)
    }
    return map
  }, [presentStudents])

  const sessionMap = useMemo(() => {
    const map = new Map<string, ActiveSessionInfo>()
    for (const session of activeSessions) {
      map.set(session.playerId, session)
    }
    return map
  }, [activeSessions])

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

      // Check both classroom sessions (if teacher) and child-specific sessions (for parents)
      const classroomSession = sessionMap.get(child.id)
      const childSession = childSessionMap.get(child.id)
      const session = classroomSession || childSession

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
    childSessionMap,
  ])

  const isLoading =
    isLoadingClassroom ||
    isLoadingChildren ||
    isLoadingChildSessions ||
    (isTeacher && (isLoadingEnrolled || isLoadingPresence || isLoadingActiveSessions))

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
  view: 'all' | 'my-children' | 'enrolled' | 'in-classroom'
): UnifiedStudent[] {
  switch (view) {
    case 'all':
      return students
    case 'my-children':
      return students.filter((s) => s.relationship.isMyChild)
    case 'enrolled':
      return students.filter((s) => s.relationship.isEnrolled)
    case 'in-classroom':
      return students.filter((s) => s.relationship.isPresent)
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
): Partial<Record<'all' | 'my-children' | 'enrolled' | 'in-classroom', number>> {
  const counts: Partial<Record<'all' | 'my-children' | 'enrolled' | 'in-classroom', number>> = {
    all: students.length,
    'my-children': students.filter((s) => s.relationship.isMyChild).length,
  }

  if (isTeacher) {
    counts.enrolled = students.filter((s) => s.relationship.isEnrolled).length
    counts['in-classroom'] = students.filter((s) => s.relationship.isPresent).length
  }

  return counts
}
