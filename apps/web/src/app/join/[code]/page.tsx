'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useGetRoomByCode, useJoinRoom, useRoomData } from '@/hooks/useRoomData'
import { getRoomDisplayWithEmoji } from '@/utils/room-display'

interface RoomSwitchConfirmationProps {
  currentRoom: { name: string | null; code: string; gameName: string }
  targetRoom: { name: string | null; code: string; gameName: string }
  onConfirm: () => void
  onCancel: () => void
}

function RoomSwitchConfirmation({
  currentRoom,
  targetRoom,
  onConfirm,
  onCancel,
}: RoomSwitchConfirmationProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.98), rgba(31, 41, 55, 0.98))',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '500px',
          width: '90%',
          border: '2px solid rgba(251, 146, 60, 0.3)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
      >
        <h2
          style={{
            fontSize: '24px',
            fontWeight: 'bold',
            marginBottom: '8px',
            color: 'rgba(253, 186, 116, 1)',
          }}
        >
          Switch Rooms?
        </h2>
        <p
          style={{
            fontSize: '14px',
            color: 'rgba(209, 213, 219, 0.8)',
            marginBottom: '24px',
          }}
        >
          You are currently in another room. Would you like to switch?
        </p>

        <div
          style={{
            background: 'rgba(251, 146, 60, 0.1)',
            border: '1px solid rgba(251, 146, 60, 0.3)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px',
          }}
        >
          <div style={{ marginBottom: '12px' }}>
            <div
              style={{
                fontSize: '12px',
                color: 'rgba(209, 213, 219, 0.6)',
                marginBottom: '4px',
              }}
            >
              Current Room
            </div>
            <div style={{ color: 'rgba(253, 186, 116, 1)', fontWeight: '600' }}>
              {getRoomDisplayWithEmoji({
                name: currentRoom.name,
                code: currentRoom.code,
                gameName: currentRoom.gameName,
              })}
            </div>
            <div
              style={{
                fontSize: '13px',
                color: 'rgba(209, 213, 219, 0.7)',
                fontFamily: 'monospace',
              }}
            >
              Code: {currentRoom.code}
            </div>
          </div>

          <div
            style={{
              height: '1px',
              background: 'rgba(251, 146, 60, 0.2)',
              margin: '12px 0',
            }}
          />

          <div>
            <div
              style={{
                fontSize: '12px',
                color: 'rgba(209, 213, 219, 0.6)',
                marginBottom: '4px',
              }}
            >
              New Room
            </div>
            <div style={{ color: 'rgba(134, 239, 172, 1)', fontWeight: '600' }}>
              {getRoomDisplayWithEmoji({
                name: targetRoom.name,
                code: targetRoom.code,
                gameName: targetRoom.gameName,
              })}
            </div>
            <div
              style={{
                fontSize: '13px',
                color: 'rgba(209, 213, 219, 0.7)',
                fontFamily: 'monospace',
              }}
            >
              Code: {targetRoom.code}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={onCancel}
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
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '12px',
              background:
                'linear-gradient(135deg, rgba(251, 146, 60, 0.8), rgba(249, 115, 22, 0.8))',
              color: 'rgba(255, 255, 255, 1)',
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
            Switch Rooms
          </button>
        </div>
      </div>
    </div>
  )
}

export default function JoinRoomPage({ params }: { params: { code: string } }) {
  const router = useRouter()
  const { roomData } = useRoomData()
  const { mutateAsync: getRoomByCode } = useGetRoomByCode()
  const { mutateAsync: joinRoom } = useJoinRoom()
  const [targetRoomData, setTargetRoomData] = useState<{
    id: string
    name: string | null
    code: string
    gameName: string
    accessMode: string
  } | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false)
  const [showApprovalPrompt, setShowApprovalPrompt] = useState(false)
  const [approvalRequested, setApprovalRequested] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isJoining, setIsJoining] = useState(false)
  const code = params.code.toUpperCase()

  const handleJoin = useCallback(
    async (targetRoomId: string, roomPassword?: string) => {
      setIsJoining(true)
      setError(null)

      try {
        await joinRoom({
          roomId: targetRoomId,
          displayName: 'Player',
          password: roomPassword,
        })
        // Navigate to the game
        router.push('/arcade/room')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to join room')
        setIsJoining(false)
      }
    },
    [joinRoom, router]
  )

  // Fetch target room data and handle join logic
  useEffect(() => {
    if (!code) return

    let mounted = true

    // Look up room by code
    getRoomByCode(code)
      .then((room) => {
        if (!mounted) return

        setTargetRoomData({
          id: room.id,
          name: room.name,
          code: room.code,
          gameName: room.gameName,
          accessMode: room.accessMode,
        })

        // If user is already in this exact room, just navigate to game
        if (roomData && roomData.id === room.id) {
          router.push('/arcade/room')
          return
        }

        // Check if room needs password
        if (room.accessMode === 'password') {
          setShowPasswordPrompt(true)
          return
        }

        // Check for other access modes
        if (room.accessMode === 'locked' || room.accessMode === 'retired') {
          setError('This room is no longer accepting new members')
          return
        }

        if (room.accessMode === 'restricted') {
          setError('This room is invitation-only')
          return
        }

        if (room.accessMode === 'approval-only') {
          setShowApprovalPrompt(true)
          return
        }

        // If user is in a different room, show confirmation
        if (roomData) {
          setShowConfirmation(true)
        } else {
          // Otherwise, auto-join (for open rooms)
          handleJoin(room.id)
        }
      })
      .catch((err) => {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Failed to load room')
      })

    return () => {
      mounted = false
    }
  }, [code, roomData, handleJoin, router, getRoomByCode])

  const handleConfirm = () => {
    if (targetRoomData) {
      if (targetRoomData.accessMode === 'password') {
        setShowConfirmation(false)
        setShowPasswordPrompt(true)
      } else {
        handleJoin(targetRoomData.id)
      }
    }
  }

  const handleCancel = () => {
    router.push('/arcade/room') // Stay in current room
  }

  const handlePasswordSubmit = () => {
    if (targetRoomData && password) {
      handleJoin(targetRoomData.id, password)
    }
  }

  const handleRequestApproval = async () => {
    if (!targetRoomData) return

    setIsJoining(true)
    setError(null)

    try {
      const res = await fetch(`/api/arcade/rooms/${targetRoomData.id}/join-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to request approval')
      }

      // Request sent successfully - show waiting state
      setApprovalRequested(true)
      setIsJoining(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request approval')
      setIsJoining(false)
    }
  }

  // Only show error page for non-password and non-approval errors
  if (error && !showPasswordPrompt && !showApprovalPrompt) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: '1rem',
        }}
      >
        <div style={{ fontSize: '18px', color: '#ef4444' }}>{error}</div>
        <a
          href="/arcade"
          style={{
            color: '#3b82f6',
            textDecoration: 'underline',
            fontSize: '16px',
          }}
        >
          Go to Champion Arena
        </a>
      </div>
    )
  }

  if (isJoining || !targetRoomData) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontSize: '18px',
          color: '#666',
        }}
      >
        {isJoining ? 'Joining room...' : 'Loading...'}
      </div>
    )
  }

  if (showConfirmation && roomData && targetRoomData) {
    return (
      <RoomSwitchConfirmation
        currentRoom={{ name: roomData.name, code: roomData.code, gameName: roomData.gameName }}
        targetRoom={{
          name: targetRoomData.name,
          code: targetRoomData.code,
          gameName: targetRoomData.gameName,
        }}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    )
  }

  if (showPasswordPrompt && targetRoomData) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3a 50%, #2d1b69 100%)',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.98), rgba(31, 41, 55, 0.98))',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '450px',
            width: '90%',
            border: '2px solid rgba(251, 191, 36, 0.3)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          }}
        >
          <h2
            style={{
              fontSize: '24px',
              fontWeight: 'bold',
              marginBottom: '8px',
              color: 'rgba(251, 191, 36, 1)',
            }}
          >
            🔑 Password Required
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: 'rgba(209, 213, 219, 0.8)',
              marginBottom: '20px',
            }}
          >
            This room is password protected. Enter the password to join.
          </p>

          <div
            style={{
              background: 'rgba(251, 191, 36, 0.1)',
              border: '1px solid rgba(251, 191, 36, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: '600', color: 'rgba(251, 191, 36, 1)' }}>
              {getRoomDisplayWithEmoji({
                name: targetRoomData.name,
                code: targetRoomData.code,
                gameName: targetRoomData.gameName,
              })}
            </div>
            <div
              style={{
                fontSize: '13px',
                color: 'rgba(209, 213, 219, 0.7)',
                fontFamily: 'monospace',
                marginTop: '4px',
              }}
            >
              Code: {targetRoomData.code}
            </div>
          </div>

          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError(null) // Clear error when user starts typing
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && password) {
                handlePasswordSubmit()
              }
            }}
            placeholder="Enter password"
            disabled={isJoining}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '2px solid rgba(251, 191, 36, 0.4)',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'rgba(251, 191, 36, 1)',
              fontSize: '16px',
              outline: 'none',
              marginBottom: '8px',
            }}
          />

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

          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button
              type="button"
              onClick={() => router.push('/arcade')}
              disabled={isJoining}
              style={{
                flex: 1,
                padding: '12px',
                background: 'rgba(75, 85, 99, 0.3)',
                color: 'rgba(209, 213, 219, 1)',
                border: '2px solid rgba(75, 85, 99, 0.5)',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: isJoining ? 'not-allowed' : 'pointer',
                opacity: isJoining ? 0.5 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePasswordSubmit}
              disabled={!password || isJoining}
              style={{
                flex: 1,
                padding: '12px',
                background:
                  password && !isJoining
                    ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.8), rgba(245, 158, 11, 0.8))'
                    : 'rgba(75, 85, 99, 0.3)',
                color: password && !isJoining ? 'rgba(255, 255, 255, 1)' : 'rgba(156, 163, 175, 1)',
                border:
                  password && !isJoining
                    ? '2px solid rgba(251, 191, 36, 0.6)'
                    : '2px solid rgba(75, 85, 99, 0.5)',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: password && !isJoining ? 'pointer' : 'not-allowed',
                opacity: password && !isJoining ? 1 : 0.5,
                transition: 'all 0.2s ease',
              }}
            >
              {isJoining ? 'Joining...' : 'Join Room'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (showApprovalPrompt && targetRoomData) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3a 50%, #2d1b69 100%)',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.98), rgba(31, 41, 55, 0.98))',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '450px',
            width: '90%',
            border: '2px solid rgba(59, 130, 246, 0.3)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          }}
        >
          {approvalRequested ? (
            // Waiting for approval state
            <>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
                <h2
                  style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    marginBottom: '8px',
                    color: 'rgba(96, 165, 250, 1)',
                  }}
                >
                  Waiting for Approval
                </h2>
                <p
                  style={{
                    fontSize: '14px',
                    color: 'rgba(209, 213, 219, 0.8)',
                  }}
                >
                  Your request has been sent to the room moderator.
                </p>
              </div>

              <div
                style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '20px',
                }}
              >
                <div
                  style={{ fontSize: '14px', fontWeight: '600', color: 'rgba(96, 165, 250, 1)' }}
                >
                  {getRoomDisplayWithEmoji({
                    name: targetRoomData.name,
                    code: targetRoomData.code,
                    gameName: targetRoomData.gameName,
                  })}
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    color: 'rgba(209, 213, 219, 0.7)',
                    fontFamily: 'monospace',
                    marginTop: '4px',
                  }}
                >
                  Code: {targetRoomData.code}
                </div>
              </div>

              <p
                style={{
                  fontSize: '13px',
                  color: 'rgba(156, 163, 175, 1)',
                  textAlign: 'center',
                  marginBottom: '20px',
                }}
              >
                You'll be able to join once the host approves your request. You can close this page
                and check back later.
              </p>

              <button
                type="button"
                onClick={() => router.push('/arcade')}
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
                Go to Champion Arena
              </button>
            </>
          ) : (
            // Request approval prompt
            <>
              <h2
                style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  marginBottom: '8px',
                  color: 'rgba(96, 165, 250, 1)',
                }}
              >
                ✋ Approval Required
              </h2>
              <p
                style={{
                  fontSize: '14px',
                  color: 'rgba(209, 213, 219, 0.8)',
                  marginBottom: '20px',
                }}
              >
                This room requires host approval to join. Send a request?
              </p>

              <div
                style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '20px',
                }}
              >
                <div
                  style={{ fontSize: '14px', fontWeight: '600', color: 'rgba(96, 165, 250, 1)' }}
                >
                  {getRoomDisplayWithEmoji({
                    name: targetRoomData.name,
                    code: targetRoomData.code,
                    gameName: targetRoomData.gameName,
                  })}
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    color: 'rgba(209, 213, 219, 0.7)',
                    fontFamily: 'monospace',
                    marginTop: '4px',
                  }}
                >
                  Code: {targetRoomData.code}
                </div>
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
                  onClick={() => router.push('/arcade')}
                  disabled={isJoining}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'rgba(75, 85, 99, 0.3)',
                    color: 'rgba(209, 213, 219, 1)',
                    border: '2px solid rgba(75, 85, 99, 0.5)',
                    borderRadius: '10px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: isJoining ? 'not-allowed' : 'pointer',
                    opacity: isJoining ? 0.5 : 1,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isJoining) {
                      e.currentTarget.style.background = 'rgba(75, 85, 99, 0.4)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isJoining) {
                      e.currentTarget.style.background = 'rgba(75, 85, 99, 0.3)'
                    }
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRequestApproval}
                  disabled={isJoining}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: isJoining
                      ? 'rgba(75, 85, 99, 0.3)'
                      : 'linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(37, 99, 235, 0.8))',
                    color: isJoining ? 'rgba(156, 163, 175, 1)' : 'rgba(255, 255, 255, 1)',
                    border: isJoining
                      ? '2px solid rgba(75, 85, 99, 0.5)'
                      : '2px solid rgba(59, 130, 246, 0.6)',
                    borderRadius: '10px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: isJoining ? 'not-allowed' : 'pointer',
                    opacity: isJoining ? 0.5 : 1,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isJoining) {
                      e.currentTarget.style.background =
                        'linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9))'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isJoining) {
                      e.currentTarget.style.background =
                        'linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(37, 99, 235, 0.8))'
                    }
                  }}
                >
                  {isJoining ? 'Sending...' : 'Request to Join'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return null
}
