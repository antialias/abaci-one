'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import {
  useEnrolledClassrooms,
  useEnterClassroom,
  useLeaveClassroom,
  useMyClassroom,
} from '@/hooks/useClassroom'
import { useUpdatePlayer } from '@/hooks/useUserPlayers'
import {
  getAvailableActions,
  type AvailableActions,
  type StudentActionData,
} from '@/components/practice/studentActions'

export type { StudentActionData, AvailableActions }

export interface StudentActionHandlers {
  startPractice: () => void
  watchSession: () => void
  enterClassroom: () => Promise<void>
  leaveClassroom: () => Promise<void>
  toggleArchive: () => Promise<void>
  openShareAccess: () => void
  openEnrollModal: () => void
}

export interface StudentActionModals {
  shareAccess: {
    isOpen: boolean
    open: () => void
    close: () => void
  }
  enroll: {
    isOpen: boolean
    open: () => void
    close: () => void
  }
}

export interface UseStudentActionsResult {
  /** Which actions are available based on student state and user context */
  actions: AvailableActions
  /** Pre-built handlers for each action */
  handlers: StudentActionHandlers
  /** Modal state for sub-modals (Share Access, Enroll) */
  modals: StudentActionModals
  /** Whether any action is currently loading */
  isLoading: boolean
  /** The student data being operated on */
  student: StudentActionData
}

/**
 * Hook that encapsulates all student action logic
 *
 * Provides:
 * - Available actions (computed from student state + user context)
 * - Pre-built handlers for all actions
 * - Modal state for sub-modals
 *
 * Used by both StudentActionMenu (on tiles) and NotesModal (in quicklook)
 * to ensure consistent behavior across the app.
 */
export function useStudentActions(
  student: StudentActionData,
  options?: {
    /** Optional callback when observe session is clicked (for external handling) */
    onObserveSession?: (sessionId: string) => void
  }
): UseStudentActionsResult {
  const router = useRouter()
  const { onObserveSession } = options ?? {}

  // ========== Context hooks ==========
  const { data: classroom } = useMyClassroom()
  const isTeacher = !!classroom

  // ========== Action hooks ==========
  const { data: enrolledClassrooms = [] } = useEnrolledClassrooms(student.id)
  const updatePlayer = useUpdatePlayer()
  const enterClassroom = useEnterClassroom()
  const leaveClassroom = useLeaveClassroom()

  // ========== Modal state ==========
  const [showShareAccess, setShowShareAccess] = useState(false)
  const [showEnrollModal, setShowEnrollModal] = useState(false)

  // ========== Compute available actions ==========
  const actions = useMemo(() => {
    const context = { isTeacher, classroomId: classroom?.id }
    return getAvailableActions(student, context, {
      hasEnrolledClassrooms: enrolledClassrooms.length > 0,
    })
  }, [student, isTeacher, classroom?.id, enrolledClassrooms.length])

  // ========== Action handlers ==========
  const handleStartPractice = useCallback(() => {
    router.push(`/practice/${student.id}/dashboard?startPractice=true`)
  }, [router, student.id])

  const handleWatchSession = useCallback(() => {
    if (student.activity?.sessionId) {
      if (onObserveSession) {
        onObserveSession(student.activity.sessionId)
      } else {
        // TODO: Default navigation to session observer
        console.log('Watch session:', student.activity.sessionId)
      }
    }
  }, [student.activity?.sessionId, onObserveSession])

  const handleEnterClassroom = useCallback(async () => {
    if (enrolledClassrooms.length > 0) {
      const classroomId = enrolledClassrooms[0].id
      await enterClassroom.mutateAsync({ classroomId, playerId: student.id })
    }
  }, [enrolledClassrooms, enterClassroom, student.id])

  const handleLeaveClassroom = useCallback(async () => {
    if (enrolledClassrooms.length > 0 && student.relationship?.isPresent) {
      const classroomId = enrolledClassrooms[0].id
      await leaveClassroom.mutateAsync({ classroomId, playerId: student.id })
    }
  }, [enrolledClassrooms, leaveClassroom, student.relationship?.isPresent, student.id])

  const handleToggleArchive = useCallback(async () => {
    await updatePlayer.mutateAsync({
      id: student.id,
      updates: { isArchived: !student.isArchived },
    })
  }, [student.id, student.isArchived, updatePlayer])

  // ========== Memoized result ==========
  const handlers: StudentActionHandlers = useMemo(
    () => ({
      startPractice: handleStartPractice,
      watchSession: handleWatchSession,
      enterClassroom: handleEnterClassroom,
      leaveClassroom: handleLeaveClassroom,
      toggleArchive: handleToggleArchive,
      openShareAccess: () => setShowShareAccess(true),
      openEnrollModal: () => setShowEnrollModal(true),
    }),
    [
      handleStartPractice,
      handleWatchSession,
      handleEnterClassroom,
      handleLeaveClassroom,
      handleToggleArchive,
    ]
  )

  const modals: StudentActionModals = useMemo(
    () => ({
      shareAccess: {
        isOpen: showShareAccess,
        open: () => setShowShareAccess(true),
        close: () => setShowShareAccess(false),
      },
      enroll: {
        isOpen: showEnrollModal,
        open: () => setShowEnrollModal(true),
        close: () => setShowEnrollModal(false),
      },
    }),
    [showShareAccess, showEnrollModal]
  )

  const isLoading =
    updatePlayer.isPending || enterClassroom.isPending || leaveClassroom.isPending

  return {
    actions,
    handlers,
    modals,
    isLoading,
    student,
  }
}
