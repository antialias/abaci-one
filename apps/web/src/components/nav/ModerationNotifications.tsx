import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as Toast from '@radix-ui/react-toast'
import { Modal } from '@/components/common/Modal'
import type { ModerationEvent } from '@/hooks/useRoomData'
import { useJoinRoom } from '@/hooks/useRoomData'

export interface ModerationNotificationsProps {
  /**
   * The moderation event to display
   */
  moderationEvent: ModerationEvent | null

  /**
   * Callback when the user acknowledges the event
   */
  onClose: () => void
}

/**
 * Displays moderation notifications (kicked, banned, report submitted)
 */
export function ModerationNotifications({
  moderationEvent,
  onClose,
}: ModerationNotificationsProps) {
  const router = useRouter()
  const [showToast, setShowToast] = useState(false)
  const [isAcceptingInvitation, setIsAcceptingInvitation] = useState(false)
  const { mutateAsync: joinRoom } = useJoinRoom()

  // Handle report toast (for hosts)
  useEffect(() => {
    if (moderationEvent?.type === 'report') {
      setShowToast(true)
      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => {
        setShowToast(false)
        onClose()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [moderationEvent, onClose])

  // Kicked modal
  if (moderationEvent?.type === 'kicked') {
    return (
      <Modal isOpen={true} onClose={() => {}}>
        <div
          style={{
            border: '2px solid rgba(251, 146, 60, 0.3)',
            borderRadius: '16px',
            textAlign: 'center',
            minWidth: '400px',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2
            style={{
              fontSize: '24px',
              fontWeight: 'bold',
              marginBottom: '12px',
              color: 'rgba(253, 186, 116, 1)',
            }}
          >
            Kicked from Room
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: 'rgba(209, 213, 219, 0.9)',
              marginBottom: '8px',
            }}
          >
            You were kicked from the room by{' '}
            <strong style={{ color: 'rgba(253, 186, 116, 1)' }}>
              {moderationEvent.data.kickedBy}
            </strong>
          </p>
          <p
            style={{
              fontSize: '13px',
              color: 'rgba(156, 163, 175, 1)',
              marginBottom: '24px',
            }}
          >
            You can rejoin if the host sends you a new invite
          </p>

          <button
            type="button"
            onClick={() => {
              onClose()
              router.push('/arcade')
            }}
            style={{
              width: '100%',
              padding: '12px',
              background:
                'linear-gradient(135deg, rgba(251, 146, 60, 0.8), rgba(249, 115, 22, 0.8))',
              color: 'white',
              border: '2px solid rgba(251, 146, 60, 0.6)',
              borderRadius: '10px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                'linear-gradient(135deg, rgba(251, 146, 60, 0.9), rgba(249, 115, 22, 0.9))'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                'linear-gradient(135deg, rgba(251, 146, 60, 0.8), rgba(249, 115, 22, 0.8))'
            }}
          >
            Return to Arcade
          </button>
        </div>
      </Modal>
    )
  }

  // Banned modal
  if (moderationEvent?.type === 'banned') {
    const reasonLabel = moderationEvent.data.reason?.replace(/-/g, ' ') || 'unspecified'

    return (
      <Modal isOpen={true} onClose={() => {}}>
        <div
          style={{
            border: '2px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            textAlign: 'center',
            minWidth: '400px',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</div>
          <h2
            style={{
              fontSize: '24px',
              fontWeight: 'bold',
              marginBottom: '12px',
              color: 'rgba(252, 165, 165, 1)',
            }}
          >
            Banned from Room
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: 'rgba(209, 213, 219, 0.9)',
              marginBottom: '8px',
            }}
          >
            You were banned from the room by{' '}
            <strong style={{ color: 'rgba(252, 165, 165, 1)' }}>
              {moderationEvent.data.bannedBy}
            </strong>
          </p>
          <p
            style={{
              fontSize: '13px',
              color: 'rgba(156, 163, 175, 1)',
              marginBottom: '4px',
            }}
          >
            Reason: <strong>{reasonLabel}</strong>
          </p>
          <p
            style={{
              fontSize: '13px',
              color: 'rgba(156, 163, 175, 1)',
              marginBottom: '24px',
            }}
          >
            You cannot rejoin this room
          </p>

          <button
            type="button"
            onClick={() => {
              onClose()
              router.push('/arcade')
            }}
            style={{
              width: '100%',
              padding: '12px',
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.8), rgba(220, 38, 38, 0.8))',
              color: 'white',
              border: '2px solid rgba(239, 68, 68, 0.6)',
              borderRadius: '10px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                'linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(220, 38, 38, 0.9))'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                'linear-gradient(135deg, rgba(239, 68, 68, 0.8), rgba(220, 38, 38, 0.8))'
            }}
          >
            Return to Arcade
          </button>
        </div>
      </Modal>
    )
  }

  // Report toast (for hosts)
  if (moderationEvent?.type === 'report') {
    return (
      <Toast.Provider swipeDirection="right" duration={5000}>
        <Toast.Root
          open={showToast}
          onOpenChange={(open) => {
            if (!open) {
              setShowToast(false)
              onClose()
            }
          }}
          onClick={() => {
            // Open moderation panel focused on reported player
            const reportedUserId = moderationEvent.data.reportedUserId
            if (reportedUserId && (window as any).__openModerationWithFocus) {
              ;(window as any).__openModerationWithFocus(reportedUserId)
              setShowToast(false)
              onClose()
            }
          }}
          style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.97), rgba(220, 38, 38, 0.97))',
            border: '2px solid rgba(239, 68, 68, 0.6)',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
            minWidth: '350px',
            maxWidth: '450px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.02)'
            e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.5)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4)'
          }}
        >
          <div style={{ fontSize: '24px', flexShrink: 0 }}>🚩</div>
          <div style={{ flex: 1 }}>
            <Toast.Title
              style={{
                fontSize: '15px',
                fontWeight: 'bold',
                color: 'white',
                marginBottom: '4px',
              }}
            >
              New Player Report
            </Toast.Title>
            <Toast.Description
              style={{
                fontSize: '13px',
                color: 'rgba(255, 255, 255, 0.9)',
                marginBottom: '4px',
              }}
            >
              <strong>{moderationEvent.data.reporterName}</strong> reported{' '}
              <strong>{moderationEvent.data.reportedUserName}</strong>
            </Toast.Description>
            <Toast.Description
              style={{
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.8)',
              }}
            >
              Reason: {moderationEvent.data.reason?.replace(/-/g, ' ')}
            </Toast.Description>
            <Toast.Description
              style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.7)',
                marginTop: '6px',
                fontStyle: 'italic',
              }}
            >
              👆 Click to view in moderation panel
            </Toast.Description>
          </div>
          <Toast.Close
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'white',
              fontSize: '16px',
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ×
          </Toast.Close>
        </Toast.Root>

        <Toast.Viewport
          style={{
            position: 'fixed',
            top: '80px',
            right: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            zIndex: 10001,
            maxWidth: '100vw',
            margin: 0,
            listStyle: 'none',
            outline: 'none',
          }}
        />

        <style
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes slideIn {
                from {
                  transform: translateX(calc(100% + 25px));
                }
                to {
                  transform: translateX(0);
                }
              }

              @keyframes slideOut {
                from {
                  transform: translateX(0);
                }
                to {
                  transform: translateX(calc(100% + 25px));
                }
              }

              @keyframes hide {
                from {
                  opacity: 1;
                }
                to {
                  opacity: 0;
                }
              }

              [data-state='open'] {
                animation: slideIn 150ms cubic-bezier(0.16, 1, 0.3, 1);
              }

              [data-state='closed'] {
                animation: hide 100ms ease-in, slideOut 200ms cubic-bezier(0.32, 0, 0.67, 0);
              }

              [data-swipe='move'] {
                transform: translateX(var(--radix-toast-swipe-move-x));
              }

              [data-swipe='cancel'] {
                transform: translateX(0);
                transition: transform 200ms ease-out;
              }

              [data-swipe='end'] {
                animation: slideOut 100ms ease-out;
              }
            `,
          }}
        />
      </Toast.Provider>
    )
  }

  // Invitation modal
  if (moderationEvent?.type === 'invitation') {
    const invitationType = moderationEvent.data.invitationType
    const isAutoUnban = invitationType === 'auto-unban'

    return (
      <Modal isOpen={true} onClose={() => {}}>
        <div
          style={{
            border: '2px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '16px',
            textAlign: 'center',
            minWidth: '400px',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>{isAutoUnban ? '🎉' : '✉️'}</div>
          <h2
            style={{
              fontSize: '24px',
              fontWeight: 'bold',
              marginBottom: '12px',
              color: 'rgba(147, 197, 253, 1)',
            }}
          >
            {isAutoUnban ? 'You have been unbanned!' : 'Room Invitation'}
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: 'rgba(209, 213, 219, 0.9)',
              marginBottom: '8px',
            }}
          >
            <strong style={{ color: 'rgba(147, 197, 253, 1)' }}>
              {moderationEvent.data.invitedByName}
            </strong>{' '}
            has invited you to rejoin the room
          </p>
          {moderationEvent.data.message && (
            <p
              style={{
                fontSize: '13px',
                color: 'rgba(156, 163, 175, 1)',
                marginBottom: '24px',
                fontStyle: 'italic',
              }}
            >
              "{moderationEvent.data.message}"
            </p>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={() => {
                onClose()
              }}
              style={{
                flex: 1,
                padding: '12px',
                background: 'rgba(75, 85, 99, 0.3)',
                color: 'rgba(209, 213, 219, 1)',
                border: '2px solid rgba(75, 85, 99, 0.5)',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(75, 85, 99, 0.4)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(75, 85, 99, 0.3)'
              }}
            >
              Decline
            </button>
            <button
              type="button"
              disabled={isAcceptingInvitation}
              onClick={async () => {
                const roomId = moderationEvent.data.roomId
                if (!roomId) return

                setIsAcceptingInvitation(true)
                try {
                  // Join the room
                  await joinRoom({ roomId })
                  // Close the modal
                  onClose()
                  // Navigate to the room
                  router.push('/arcade/room')
                } catch (error) {
                  console.error('Failed to join room:', error)
                  alert(error instanceof Error ? error.message : 'Failed to join room')
                  setIsAcceptingInvitation(false)
                }
              }}
              style={{
                flex: 1,
                padding: '12px',
                background: isAcceptingInvitation
                  ? 'rgba(75, 85, 99, 0.5)'
                  : 'linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(37, 99, 235, 0.8))',
                color: 'white',
                border: '2px solid rgba(59, 130, 246, 0.6)',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: isAcceptingInvitation ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: isAcceptingInvitation ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isAcceptingInvitation) {
                  e.currentTarget.style.background =
                    'linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9))'
                }
              }}
              onMouseLeave={(e) => {
                if (!isAcceptingInvitation) {
                  e.currentTarget.style.background =
                    'linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(37, 99, 235, 0.8))'
                }
              }}
            >
              {isAcceptingInvitation ? 'Joining...' : 'Accept & Join'}
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  return null
}
