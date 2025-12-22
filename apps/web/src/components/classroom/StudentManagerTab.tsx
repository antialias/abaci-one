'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import type { Classroom, Player } from '@/db/schema'
import { useTheme } from '@/contexts/ThemeContext'
import {
  useEnrolledStudents,
  usePendingEnrollmentRequests,
  useApproveEnrollmentRequest,
  useDenyEnrollmentRequest,
  useUnenrollStudent,
  type EnrollmentRequestWithRelations,
} from '@/hooks/useClassroom'
import { css } from '../../../styled-system/css'
import { ClassroomCodeShare } from './ClassroomCodeShare'

interface StudentManagerTabProps {
  classroom: Classroom
}

/**
 * StudentManagerTab - Manage enrolled students
 *
 * Shows all students enrolled in the classroom with options to:
 * - View student progress (links to student page)
 * - Approve/deny pending enrollment requests
 * - Unenroll students
 */
export function StudentManagerTab({ classroom }: StudentManagerTabProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Fetch enrolled students and pending requests
  const { data: students = [], isLoading: loadingStudents } = useEnrolledStudents(classroom.id)
  const { data: pendingRequests = [], isLoading: loadingRequests } = usePendingEnrollmentRequests(
    classroom.id
  )

  // Mutations
  const approveRequest = useApproveEnrollmentRequest()
  const denyRequest = useDenyEnrollmentRequest()
  const unenrollStudent = useUnenrollStudent()

  // Confirmation state
  const [confirmUnenroll, setConfirmUnenroll] = useState<string | null>(null)

  const handleApprove = useCallback(
    (request: EnrollmentRequestWithRelations) => {
      approveRequest.mutate({
        classroomId: classroom.id,
        requestId: request.id,
      })
    },
    [approveRequest, classroom.id]
  )

  const handleDeny = useCallback(
    (request: EnrollmentRequestWithRelations) => {
      denyRequest.mutate({
        classroomId: classroom.id,
        requestId: request.id,
      })
    },
    [denyRequest, classroom.id]
  )

  const handleUnenroll = useCallback(
    (playerId: string) => {
      unenrollStudent.mutate({
        classroomId: classroom.id,
        playerId,
      })
      setConfirmUnenroll(null)
    },
    [unenrollStudent, classroom.id]
  )

  const isLoading = loadingStudents || loadingRequests
  const isEmpty = students.length === 0 && pendingRequests.length === 0

  return (
    <div
      data-component="student-manager-tab"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      })}
    >
      {/* Pending Enrollment Requests */}
      {pendingRequests.length > 0 && (
        <section
          data-section="pending-requests"
          className={css({
            padding: '20px',
            backgroundColor: isDark ? 'yellow.900/20' : 'yellow.50',
            borderRadius: '12px',
            border: '1px solid',
            borderColor: isDark ? 'yellow.700' : 'yellow.200',
          })}
        >
          <h3
            className={css({
              fontSize: '1rem',
              fontWeight: 'bold',
              color: isDark ? 'yellow.300' : 'yellow.700',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            })}
          >
            <span>Pending Enrollment Requests</span>
            <span
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '22px',
                height: '22px',
                padding: '0 6px',
                borderRadius: '11px',
                backgroundColor: isDark ? 'yellow.700' : 'yellow.500',
                color: 'white',
                fontSize: '0.75rem',
                fontWeight: 'bold',
              })}
            >
              {pendingRequests.length}
            </span>
          </h3>

          <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
            {pendingRequests.map((request) => (
              <EnrollmentRequestCard
                key={request.id}
                request={request}
                onApprove={() => handleApprove(request)}
                onDeny={() => handleDeny(request)}
                isApproving={
                  approveRequest.isPending && approveRequest.variables?.requestId === request.id
                }
                isDenying={denyRequest.isPending && denyRequest.variables?.requestId === request.id}
                isDark={isDark}
              />
            ))}
          </div>
        </section>
      )}

      {/* Enrolled Students */}
      {students.length > 0 && (
        <section data-section="enrolled-students">
          <h3
            className={css({
              fontSize: '1rem',
              fontWeight: 'bold',
              color: isDark ? 'white' : 'gray.800',
              marginBottom: '16px',
            })}
          >
            Enrolled Students ({students.length})
          </h3>

          <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
            {students.map((student) => (
              <EnrolledStudentCard
                key={student.id}
                student={student}
                onUnenroll={() => setConfirmUnenroll(student.id)}
                isConfirming={confirmUnenroll === student.id}
                onConfirmUnenroll={() => handleUnenroll(student.id)}
                onCancelUnenroll={() => setConfirmUnenroll(null)}
                isUnenrolling={
                  unenrollStudent.isPending && unenrollStudent.variables?.playerId === student.id
                }
                isDark={isDark}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {isEmpty && !isLoading && (
        <div
          className={css({
            textAlign: 'center',
            padding: '48px 24px',
            backgroundColor: isDark ? 'gray.800' : 'gray.50',
            borderRadius: '16px',
            border: '2px dashed',
            borderColor: isDark ? 'gray.700' : 'gray.200',
          })}
        >
          <div className={css({ fontSize: '3rem', marginBottom: '16px' })}>👥</div>
          <h3
            className={css({
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: isDark ? 'white' : 'gray.800',
              marginBottom: '8px',
            })}
          >
            No Students Enrolled
          </h3>
          <p
            className={css({
              fontSize: '0.9375rem',
              color: isDark ? 'gray.400' : 'gray.600',
              marginBottom: '24px',
              maxWidth: '400px',
              marginLeft: 'auto',
              marginRight: 'auto',
            })}
          >
            Parents can enroll their children using your classroom code. Once enrolled, you can view
            their progress and skills here.
          </p>

          <ClassroomCodeShare code={classroom.code} />
        </div>
      )}

      {/* Info section */}
      {students.length > 0 && (
        <div
          className={css({
            padding: '16px 20px',
            backgroundColor: isDark ? 'blue.900/30' : 'blue.50',
            borderRadius: '12px',
            border: '1px solid',
            borderColor: isDark ? 'blue.800' : 'blue.200',
          })}
        >
          <p
            className={css({
              fontSize: '0.875rem',
              color: isDark ? 'blue.200' : 'blue.700',
            })}
          >
            Click on a student to view their skills and practice history. Need more students? Share
            your classroom code: <strong>{classroom.code}</strong>
          </p>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

interface EnrollmentRequestCardProps {
  request: EnrollmentRequestWithRelations
  onApprove: () => void
  onDeny: () => void
  isApproving: boolean
  isDenying: boolean
  isDark: boolean
}

function EnrollmentRequestCard({
  request,
  onApprove,
  onDeny,
  isApproving,
  isDenying,
  isDark,
}: EnrollmentRequestCardProps) {
  const player = request.player

  return (
    <div
      data-element="enrollment-request-card"
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        backgroundColor: isDark ? 'gray.800' : 'white',
        borderRadius: '10px',
        border: '1px solid',
        borderColor: isDark ? 'gray.700' : 'gray.200',
      })}
    >
      <div className={css({ display: 'flex', alignItems: 'center', gap: '12px' })}>
        <span
          className={css({
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem',
          })}
          style={{ backgroundColor: player?.color ?? '#ccc' }}
        >
          {player?.emoji ?? '?'}
        </span>
        <div>
          <p
            className={css({
              fontWeight: 'medium',
              color: isDark ? 'white' : 'gray.800',
            })}
          >
            {player?.name ?? 'Unknown Student'}
          </p>
          <p
            className={css({
              fontSize: '0.8125rem',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            Enrollment requested by parent
          </p>
        </div>
      </div>

      <div className={css({ display: 'flex', gap: '8px' })}>
        <button
          type="button"
          onClick={onDeny}
          disabled={isDenying || isApproving}
          data-action="deny-enrollment"
          className={css({
            padding: '8px 14px',
            backgroundColor: isDark ? 'gray.700' : 'gray.200',
            color: isDark ? 'gray.300' : 'gray.700',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: 'medium',
            cursor: 'pointer',
            _hover: { backgroundColor: isDark ? 'gray.600' : 'gray.300' },
            _disabled: { opacity: 0.5, cursor: 'not-allowed' },
          })}
        >
          {isDenying ? 'Denying...' : 'Deny'}
        </button>
        <button
          type="button"
          onClick={onApprove}
          disabled={isApproving || isDenying}
          data-action="approve-enrollment"
          className={css({
            padding: '8px 14px',
            backgroundColor: isDark ? 'green.700' : 'green.500',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: 'medium',
            cursor: 'pointer',
            _hover: { backgroundColor: isDark ? 'green.600' : 'green.600' },
            _disabled: { opacity: 0.5, cursor: 'not-allowed' },
          })}
        >
          {isApproving ? 'Approving...' : 'Approve'}
        </button>
      </div>
    </div>
  )
}

interface EnrolledStudentCardProps {
  student: Player
  onUnenroll: () => void
  isConfirming: boolean
  onConfirmUnenroll: () => void
  onCancelUnenroll: () => void
  isUnenrolling: boolean
  isDark: boolean
}

function EnrolledStudentCard({
  student,
  onUnenroll,
  isConfirming,
  onConfirmUnenroll,
  onCancelUnenroll,
  isUnenrolling,
  isDark,
}: EnrolledStudentCardProps) {
  return (
    <div
      data-element="enrolled-student-card"
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        backgroundColor: isDark ? 'gray.800' : 'white',
        borderRadius: '10px',
        border: '1px solid',
        borderColor: isDark ? 'gray.700' : 'gray.200',
        transition: 'all 0.15s ease',
      })}
    >
      <Link
        href={`/practice/${student.id}/resume`}
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          textDecoration: 'none',
          flex: 1,
          _hover: { opacity: 0.8 },
        })}
      >
        <span
          className={css({
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem',
          })}
          style={{ backgroundColor: student.color }}
        >
          {student.emoji}
        </span>
        <div>
          <p
            className={css({
              fontWeight: 'medium',
              color: isDark ? 'white' : 'gray.800',
            })}
          >
            {student.name}
          </p>
          <p
            className={css({
              fontSize: '0.8125rem',
              color: isDark ? 'blue.400' : 'blue.600',
            })}
          >
            View progress
          </p>
        </div>
      </Link>

      {/* Unenroll actions */}
      <div className={css({ display: 'flex', gap: '8px' })}>
        {isConfirming ? (
          <>
            <button
              type="button"
              onClick={onCancelUnenroll}
              disabled={isUnenrolling}
              data-action="cancel-unenroll"
              className={css({
                padding: '8px 14px',
                backgroundColor: isDark ? 'gray.700' : 'gray.200',
                color: isDark ? 'gray.300' : 'gray.700',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: 'medium',
                cursor: 'pointer',
                _hover: { backgroundColor: isDark ? 'gray.600' : 'gray.300' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirmUnenroll}
              disabled={isUnenrolling}
              data-action="confirm-unenroll"
              className={css({
                padding: '8px 14px',
                backgroundColor: isDark ? 'red.700' : 'red.500',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: 'medium',
                cursor: 'pointer',
                _hover: { backgroundColor: isDark ? 'red.600' : 'red.600' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              {isUnenrolling ? 'Removing...' : 'Confirm'}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onUnenroll}
            data-action="unenroll-student"
            className={css({
              padding: '8px 14px',
              backgroundColor: 'transparent',
              color: isDark ? 'gray.400' : 'gray.500',
              border: '1px solid',
              borderColor: isDark ? 'gray.700' : 'gray.300',
              borderRadius: '6px',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              _hover: {
                backgroundColor: isDark ? 'gray.700' : 'gray.100',
                borderColor: isDark ? 'gray.600' : 'gray.400',
                color: isDark ? 'gray.300' : 'gray.700',
              },
            })}
          >
            Unenroll
          </button>
        )}
      </div>
    </div>
  )
}
