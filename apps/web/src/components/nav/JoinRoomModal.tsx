import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { Modal } from '@/components/common/Modal'
import type { schema } from '@/db'
import { useRoomData } from '@/hooks/useRoomData'

export interface JoinRoomModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean

  /**
   * Callback when modal should close
   */
  onClose: () => void

  /**
   * Optional callback when room is successfully joined
   */
  onSuccess?: () => void
}

/**
 * Modal for joining a room by entering a 6-character code
 */
export function JoinRoomModal({ isOpen, onClose, onSuccess }: JoinRoomModalProps) {
  const { getRoomByCode, joinRoom } = useRoomData()
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [roomInfo, setRoomInfo] = useState<schema.ArcadeRoom | null>(null)
  const [needsPassword, setNeedsPassword] = useState(false)
  const [needsApproval, setNeedsApproval] = useState(false)
  const [approvalRequested, setApprovalRequested] = useState(false)

  const handleClose = () => {
    setCode('')
    setPassword('')
    setError('')
    setIsLoading(false)
    setRoomInfo(null)
    setNeedsPassword(false)
    setNeedsApproval(false)
    setApprovalRequested(false)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const normalizedCode = code.trim().toUpperCase()
    if (normalizedCode.length !== 6) {
      setError('Code must be 6 characters')
      return
    }

    setIsLoading(true)

    try {
      // Look up room by code
      const room = await getRoomByCode(normalizedCode)
      setRoomInfo(room)

      // Check access mode
      if (room.accessMode === 'retired') {
        setError('This room has been retired and is no longer accepting members')
        setIsLoading(false)
        return
      }

      if (room.accessMode === 'locked') {
        setError('This room is locked and not accepting new members')
        setIsLoading(false)
        return
      }

      if (room.accessMode === 'restricted') {
        setError('This room is invitation-only. Please ask the host for an invitation.')
        setIsLoading(false)
        return
      }

      if (room.accessMode === 'approval-only') {
        setNeedsApproval(true)
        setIsLoading(false)
        return
      }

      if (room.accessMode === 'password') {
        // Check if password is provided
        if (!needsPassword) {
          setNeedsPassword(true)
          setIsLoading(false)
          return
        }

        if (!password) {
          setError('Password is required')
          setIsLoading(false)
          return
        }
      }

      // Join the room (with password if needed)
      await joinRoom(room.id, password || undefined)

      // Success! Close modal
      handleClose()
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRequestAccess = async () => {
    if (!roomInfo) return

    setIsLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/arcade/rooms/${roomInfo.id}/join-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to request access')
      }

      // Success! Show waiting state
      setApprovalRequested(true)
      setIsLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request access')
      setIsLoading(false)
    }
  }

  // Socket listener for approval notifications
  useEffect(() => {
    if (!approvalRequested || !roomInfo) return

    console.log('[JoinRoomModal] Setting up approval listener for room:', roomInfo.id)

    // Socket listener for real-time approval notification
    const socket = io({ path: '/api/socket' })

    socket.on('connect', () => {
      console.log('[JoinRoomModal] Socket connected')
    })

    socket.on('join-request-approved', async (data: { roomId: string; requestId: string }) => {
      console.log('[JoinRoomModal] Request approved via socket!', data)
      if (data.roomId === roomInfo.id) {
        console.log('[JoinRoomModal] Joining room automatically...')
        try {
          await joinRoom(roomInfo.id)
          handleClose()
          onSuccess?.()
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to join room')
          setIsLoading(false)
        }
      }
    })

    socket.on('connect_error', (error) => {
      console.error('[JoinRoomModal] Socket connection error:', error)
    })

    return () => {
      console.log('[JoinRoomModal] Cleaning up approval listener')
      socket.disconnect()
    }
  }, [approvalRequested, roomInfo, joinRoom, handleClose, onSuccess])

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div
        style={{
          border: '2px solid rgba(139, 92, 246, 0.3)',
          borderRadius: '16px',
        }}
      >
        <h2
          style={{
            fontSize: '24px',
            fontWeight: 'bold',
            marginBottom: '8px',
            color: 'rgba(196, 181, 253, 1)',
          }}
        >
          {needsApproval ? 'Request to Join Room' : 'Join Room by Code'}
        </h2>
        <p
          style={{
            fontSize: '14px',
            color: 'rgba(209, 213, 219, 0.8)',
            marginBottom: '24px',
          }}
        >
          {needsApproval
            ? approvalRequested
              ? 'Your request has been sent to the room moderator.'
              : 'This room requires host approval. Send a request to join?'
            : needsPassword
              ? 'This room is password protected'
              : 'Enter the 6-character room code'}
        </p>

        {needsApproval ? (
          // Approval request UI
          <div>
            {approvalRequested ? (
              // Waiting for approval state
              <>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
                  <h3
                    style={{
                      fontSize: '18px',
                      fontWeight: 'bold',
                      marginBottom: '8px',
                      color: 'rgba(96, 165, 250, 1)',
                    }}
                  >
                    Waiting for Approval
                  </h3>
                </div>

                <div
                  style={{
                    padding: '16px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '8px',
                    marginBottom: '20px',
                  }}
                >
                  <p
                    style={{
                      fontSize: '14px',
                      color: 'rgba(209, 213, 219, 1)',
                      marginBottom: '8px',
                    }}
                  >
                    <strong>{roomInfo?.name}</strong>
                  </p>
                  <p style={{ fontSize: '13px', color: 'rgba(156, 163, 175, 1)' }}>
                    Code: {roomInfo?.code}
                  </p>
                </div>

                <p
                  style={{
                    fontSize: '13px',
                    color: 'rgba(156, 163, 175, 1)',
                    textAlign: 'center',
                    marginBottom: '20px',
                  }}
                >
                  You'll be able to join once the host approves your request. You can close this
                  dialog and check back later.
                </p>

                <button
                  type="button"
                  onClick={handleClose}
                  style={{
                    width: '100%',
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
                  Close
                </button>
              </>
            ) : (
              // Initial request prompt
              <>
                <div
                  style={{
                    padding: '16px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '8px',
                    marginBottom: '20px',
                  }}
                >
                  <p
                    style={{
                      fontSize: '14px',
                      color: 'rgba(209, 213, 219, 1)',
                      marginBottom: '8px',
                    }}
                  >
                    <strong>{roomInfo?.name}</strong>
                  </p>
                  <p style={{ fontSize: '13px', color: 'rgba(156, 163, 175, 1)' }}>
                    Code: {roomInfo?.code}
                  </p>
                </div>

                {error && (
                  <p
                    style={{
                      fontSize: '13px',
                      color: 'rgba(248, 113, 113, 1)',
                      marginBottom: '16px',
                      textAlign: 'center',
                    }}
                  >
                    {error}
                  </p>
                )}

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isLoading}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: 'rgba(75, 85, 99, 0.3)',
                      color: 'rgba(209, 213, 219, 1)',
                      border: '2px solid rgba(75, 85, 99, 0.5)',
                      borderRadius: '10px',
                      fontSize: '15px',
                      fontWeight: '600',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      opacity: isLoading ? 0.5 : 1,
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isLoading) {
                        e.currentTarget.style.background = 'rgba(75, 85, 99, 0.4)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isLoading) {
                        e.currentTarget.style.background = 'rgba(75, 85, 99, 0.3)'
                      }
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRequestAccess}
                    disabled={isLoading}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: isLoading
                        ? 'rgba(75, 85, 99, 0.3)'
                        : 'linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(37, 99, 235, 0.8))',
                      color: isLoading ? 'rgba(156, 163, 175, 1)' : 'rgba(255, 255, 255, 1)',
                      border: isLoading
                        ? '2px solid rgba(75, 85, 99, 0.5)'
                        : '2px solid rgba(59, 130, 246, 0.6)',
                      borderRadius: '10px',
                      fontSize: '15px',
                      fontWeight: '600',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      opacity: isLoading ? 0.5 : 1,
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isLoading) {
                        e.currentTarget.style.background =
                          'linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9))'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isLoading) {
                        e.currentTarget.style.background =
                          'linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(37, 99, 235, 0.8))'
                      }
                    }}
                  >
                    {isLoading ? 'Sending...' : 'Send Request'}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          // Standard join form
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase())
                setError('')
                setNeedsPassword(false)
                setNeedsApproval(false)
              }}
              placeholder="ABC123"
              maxLength={6}
              disabled={isLoading || needsPassword}
              style={{
                width: '100%',
                padding: '14px',
                border: error
                  ? '2px solid rgba(239, 68, 68, 0.6)'
                  : '2px solid rgba(139, 92, 246, 0.4)',
                borderRadius: '10px',
                fontSize: '18px',
                fontWeight: 'bold',
                fontFamily: 'monospace',
                textAlign: 'center',
                letterSpacing: '4px',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'rgba(196, 181, 253, 1)',
                outline: 'none',
                marginBottom: '8px',
              }}
            />

            {needsPassword && (
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError('')
                }}
                placeholder="Enter password"
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '14px',
                  border: error
                    ? '2px solid rgba(239, 68, 68, 0.6)'
                    : '2px solid rgba(251, 191, 36, 0.4)',
                  borderRadius: '10px',
                  fontSize: '16px',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'rgba(251, 191, 36, 1)',
                  outline: 'none',
                  marginBottom: '8px',
                  marginTop: '12px',
                }}
              />
            )}

            {error && (
              <p
                style={{
                  fontSize: '13px',
                  color: 'rgba(248, 113, 113, 1)',
                  marginBottom: '16px',
                  textAlign: 'center',
                }}
              >
                {error}
              </p>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                type="button"
                onClick={handleClose}
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'rgba(75, 85, 99, 0.3)',
                  color: 'rgba(209, 213, 219, 1)',
                  border: '2px solid rgba(75, 85, 99, 0.5)',
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.5 : 1,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.background = 'rgba(75, 85, 99, 0.4)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.background = 'rgba(75, 85, 99, 0.3)'
                  }
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={code.trim().length !== 6 || isLoading}
                style={{
                  flex: 1,
                  padding: '12px',
                  background:
                    code.trim().length === 6 && !isLoading
                      ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(37, 99, 235, 0.8))'
                      : 'rgba(75, 85, 99, 0.3)',
                  color:
                    code.trim().length === 6 && !isLoading
                      ? 'rgba(255, 255, 255, 1)'
                      : 'rgba(156, 163, 175, 1)',
                  border:
                    code.trim().length === 6 && !isLoading
                      ? '2px solid rgba(59, 130, 246, 0.6)'
                      : '2px solid rgba(75, 85, 99, 0.5)',
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: code.trim().length === 6 && !isLoading ? 'pointer' : 'not-allowed',
                  opacity: code.trim().length === 6 && !isLoading ? 1 : 0.5,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (code.trim().length === 6 && !isLoading) {
                    e.currentTarget.style.background =
                      'linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9))'
                  }
                }}
                onMouseLeave={(e) => {
                  if (code.trim().length === 6 && !isLoading) {
                    e.currentTarget.style.background =
                      'linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(37, 99, 235, 0.8))'
                  }
                }}
              >
                {isLoading ? 'Joining...' : needsPassword ? 'Join with Password' : 'Join Room'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  )
}
