'use client'

import { useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  usePendingApprovalsForParent,
  useApproveEnrollmentRequestAsParent,
  useDenyEnrollmentRequestAsParent,
  type EnrollmentRequestWithRelations,
} from '@/hooks/useClassroom'
import { css } from '../../../styled-system/css'

/**
 * PendingApprovalsSection - Shows pending enrollment requests for parents
 *
 * When a teacher initiates enrollment for a parent's child, the parent
 * sees it here and can approve or deny.
 */
export function PendingApprovalsSection() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const { data: requests = [], isLoading } = usePendingApprovalsForParent()
  const approveRequest = useApproveEnrollmentRequestAsParent()
  const denyRequest = useDenyEnrollmentRequestAsParent()

  const handleApprove = useCallback(
    (requestId: string) => {
      approveRequest.mutate(requestId)
    },
    [approveRequest]
  )

  const handleDeny = useCallback(
    (requestId: string) => {
      denyRequest.mutate(requestId)
    },
    [denyRequest]
  )

  // Don't render if no pending requests
  if (isLoading || requests.length === 0) {
    return null
  }

  return (
    <section
      data-component="pending-approvals-section"
      className={css({
        padding: '20px',
        backgroundColor: isDark ? 'yellow.900/20' : 'yellow.50',
        borderRadius: '16px',
        border: '2px solid',
        borderColor: isDark ? 'yellow.700' : 'yellow.200',
        marginBottom: '24px',
      })}
    >
      <h2
        className={css({
          fontSize: '1.125rem',
          fontWeight: 'bold',
          color: isDark ? 'yellow.300' : 'yellow.700',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        })}
      >
        <span>📬</span>
        <span>Enrollment Requests</span>
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
          {requests.length}
        </span>
      </h2>

      <p
        className={css({
          fontSize: '0.875rem',
          color: isDark ? 'yellow.400' : 'yellow.700',
          marginBottom: '16px',
        })}
      >
        A teacher has requested to enroll your child in their classroom.
      </p>

      <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
        {requests.map((request) => (
          <PendingApprovalCard
            key={request.id}
            request={request}
            onApprove={() => handleApprove(request.id)}
            onDeny={() => handleDeny(request.id)}
            isApproving={approveRequest.isPending && approveRequest.variables === request.id}
            isDenying={denyRequest.isPending && denyRequest.variables === request.id}
            isDark={isDark}
          />
        ))}
      </div>
    </section>
  )
}

interface PendingApprovalCardProps {
  request: EnrollmentRequestWithRelations
  onApprove: () => void
  onDeny: () => void
  isApproving: boolean
  isDenying: boolean
  isDark: boolean
}

function PendingApprovalCard({
  request,
  onApprove,
  onDeny,
  isApproving,
  isDenying,
  isDark,
}: PendingApprovalCardProps) {
  const player = request.player
  const classroom = request.classroom

  return (
    <div
      data-element="pending-approval-card"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '16px',
        backgroundColor: isDark ? 'gray.800' : 'white',
        borderRadius: '12px',
        border: '1px solid',
        borderColor: isDark ? 'gray.700' : 'gray.200',
        '@media (min-width: 640px)': {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
      })}
    >
      <div className={css({ display: 'flex', alignItems: 'center', gap: '14px' })}>
        <span
          className={css({
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            flexShrink: 0,
          })}
          style={{ backgroundColor: player?.color ?? '#ccc' }}
        >
          {player?.emoji ?? '?'}
        </span>
        <div>
          <p
            className={css({
              fontWeight: 'bold',
              fontSize: '1rem',
              color: isDark ? 'white' : 'gray.800',
            })}
          >
            {player?.name ?? 'Unknown Student'}
          </p>
          <p
            className={css({
              fontSize: '0.875rem',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            Classroom: <strong>{classroom?.name ?? 'Unknown'}</strong>
          </p>
        </div>
      </div>

      <div
        className={css({
          display: 'flex',
          gap: '10px',
          '@media (max-width: 639px)': {
            width: '100%',
          },
        })}
      >
        <button
          type="button"
          onClick={onDeny}
          disabled={isDenying || isApproving}
          data-action="deny-enrollment-parent"
          className={css({
            flex: 1,
            padding: '10px 18px',
            backgroundColor: isDark ? 'gray.700' : 'gray.200',
            color: isDark ? 'gray.300' : 'gray.700',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.9375rem',
            fontWeight: 'medium',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            _hover: { backgroundColor: isDark ? 'gray.600' : 'gray.300' },
            _disabled: { opacity: 0.5, cursor: 'not-allowed' },
            '@media (min-width: 640px)': {
              flex: 'none',
            },
          })}
        >
          {isDenying ? 'Denying...' : 'Deny'}
        </button>
        <button
          type="button"
          onClick={onApprove}
          disabled={isApproving || isDenying}
          data-action="approve-enrollment-parent"
          className={css({
            flex: 1,
            padding: '10px 18px',
            backgroundColor: isDark ? 'green.700' : 'green.500',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.9375rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            _hover: { backgroundColor: isDark ? 'green.600' : 'green.600' },
            _disabled: { opacity: 0.5, cursor: 'not-allowed' },
            '@media (min-width: 640px)': {
              flex: 'none',
            },
          })}
        >
          {isApproving ? 'Approving...' : 'Approve'}
        </button>
      </div>
    </div>
  )
}
