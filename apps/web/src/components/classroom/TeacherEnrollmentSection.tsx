'use client'

import { useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/contexts/ThemeContext'
import {
  usePendingEnrollmentRequests,
  useAwaitingParentApproval,
  useApproveEnrollmentRequest,
  useDenyEnrollmentRequest,
  type EnrollmentRequestWithRelations,
} from '@/hooks/useClassroom'
import {
  StudentSelector,
  type EnrollmentActions,
  type StudentWithProgress,
} from '@/components/practice'
import { css } from '../../../styled-system/css'

interface TeacherEnrollmentSectionProps {
  classroomId: string
}

/**
 * Convert an enrollment request to a StudentWithProgress for display in StudentSelector
 */
function requestToStudent(
  request: EnrollmentRequestWithRelations,
  enrollmentStatus: 'pending-teacher' | 'pending-parent'
): StudentWithProgress | null {
  if (!request.player) return null

  return {
    ...request.player,
    // Mark as enrollment request for the action buttons
    enrollmentRequestId: request.id,
    // Set relationship data so action menu knows this is a pending enrollment
    relationship: {
      isMyChild: false, // Teacher viewing, not their child
      isEnrolled: false, // Not enrolled yet
      isPresent: false, // Not present in classroom
      enrollmentStatus, // Pending status disables most actions
    },
  }
}

/**
 * TeacherEnrollmentSection - Shows enrollment requests for teachers
 *
 * Two sections:
 * 1. Pending Requests (yellow) - Parent-initiated requests awaiting teacher approval
 * 2. Awaiting Parent (blue) - Teacher-initiated requests awaiting parent approval
 *
 * Uses StudentSelector with student tiles for consistent UI.
 */
export function TeacherEnrollmentSection({ classroomId }: TeacherEnrollmentSectionProps) {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Fetch enrollment requests
  const { data: pendingRequests = [], isLoading: loadingPending } =
    usePendingEnrollmentRequests(classroomId)
  const { data: awaitingParent = [], isLoading: loadingAwaiting } =
    useAwaitingParentApproval(classroomId)

  // Mutations
  const approveRequest = useApproveEnrollmentRequest()
  const denyRequest = useDenyEnrollmentRequest()

  // Convert pending requests to students (parent-initiated, awaiting teacher approval)
  const pendingStudents = useMemo(
    () =>
      pendingRequests
        .map((r) => requestToStudent(r, 'pending-teacher'))
        .filter((s): s is StudentWithProgress => s !== null),
    [pendingRequests]
  )

  // Convert awaiting parent requests to students (teacher-initiated, awaiting parent approval)
  const awaitingStudents = useMemo(
    () =>
      awaitingParent
        .map((r) => requestToStudent(r, 'pending-parent'))
        .filter((s): s is StudentWithProgress => s !== null),
    [awaitingParent]
  )

  // Enrollment actions for approve/deny buttons
  const enrollmentActions: EnrollmentActions = useMemo(
    () => ({
      onApprove: (requestId: string) => {
        approveRequest.mutate({ classroomId, requestId })
      },
      onDeny: (requestId: string) => {
        denyRequest.mutate({ classroomId, requestId })
      },
      approvingId: approveRequest.isPending ? (approveRequest.variables?.requestId ?? null) : null,
      denyingId: denyRequest.isPending ? (denyRequest.variables?.requestId ?? null) : null,
    }),
    [classroomId, approveRequest, denyRequest]
  )

  // Handle student selection - navigate to their dashboard
  const handleSelectStudent = useCallback(
    (student: StudentWithProgress) => {
      router.push(`/practice/${student.id}/dashboard`, { scroll: false })
    },
    [router]
  )

  // No-op for toggle selection (not used in this context)
  const handleToggleSelection = useCallback(() => {}, [])

  // Don't render if no requests
  const isLoading = loadingPending || loadingAwaiting
  if (isLoading || (pendingStudents.length === 0 && awaitingStudents.length === 0)) {
    return null
  }

  return (
    <div
      data-component="teacher-enrollment-section"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        marginBottom: '24px',
      })}
    >
      {/* Pending Enrollment Requests (parent-initiated, awaiting teacher) */}
      {pendingStudents.length > 0 && (
        <section
          data-section="pending-teacher-approvals"
          className={css({
            padding: '20px',
            backgroundColor: isDark ? 'yellow.900/20' : 'yellow.50',
            borderRadius: '16px',
            border: '2px solid',
            borderColor: isDark ? 'yellow.700' : 'yellow.200',
          })}
        >
          <h2
            className={css({
              fontSize: '1.125rem',
              fontWeight: 'bold',
              color: isDark ? 'yellow.300' : 'yellow.700',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            })}
          >
            <span>📬</span>
            <span>Pending Enrollment Requests</span>
            <span
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '24px',
                height: '24px',
                padding: '0 8px',
                borderRadius: '12px',
                backgroundColor: isDark ? 'yellow.700' : 'yellow.500',
                color: 'white',
                fontSize: '0.8125rem',
                fontWeight: 'bold',
              })}
            >
              {pendingStudents.length}
            </span>
          </h2>

          <p
            className={css({
              fontSize: '0.875rem',
              color: isDark ? 'yellow.400' : 'yellow.700',
              marginBottom: '8px',
            })}
          >
            Parents have requested to enroll their children in your classroom.
          </p>

          <StudentSelector
            students={pendingStudents}
            onSelectStudent={handleSelectStudent}
            onToggleSelection={handleToggleSelection}
            title=""
            hideAddButton
            enrollmentActions={enrollmentActions}
          />
        </section>
      )}

      {/* Awaiting Parent Approval (teacher-initiated, awaiting parent) */}
      {awaitingStudents.length > 0 && (
        <section
          data-section="awaiting-parent-approval"
          className={css({
            padding: '20px',
            backgroundColor: isDark ? 'blue.900/20' : 'blue.50',
            borderRadius: '16px',
            border: '2px solid',
            borderColor: isDark ? 'blue.700' : 'blue.200',
          })}
        >
          <h2
            className={css({
              fontSize: '1.125rem',
              fontWeight: 'bold',
              color: isDark ? 'blue.300' : 'blue.700',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            })}
          >
            <span>⏳</span>
            <span>Awaiting Parent Approval</span>
            <span
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '24px',
                height: '24px',
                padding: '0 8px',
                borderRadius: '12px',
                backgroundColor: isDark ? 'blue.700' : 'blue.500',
                color: 'white',
                fontSize: '0.8125rem',
                fontWeight: 'bold',
              })}
            >
              {awaitingStudents.length}
            </span>
          </h2>

          <p
            className={css({
              fontSize: '0.875rem',
              color: isDark ? 'blue.400' : 'blue.700',
              marginBottom: '8px',
            })}
          >
            You requested enrollment for these students. Waiting for parent approval.
          </p>

          {/* No enrollmentActions - just show tiles without approve/deny buttons */}
          <StudentSelector
            students={awaitingStudents}
            onSelectStudent={handleSelectStudent}
            onToggleSelection={handleToggleSelection}
            title=""
            hideAddButton
          />
        </section>
      )}
    </div>
  )
}
