'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useGetRoomByCode, useJoinRoom, useRoomData } from '@/hooks/useRoomData'

interface RoomSwitchConfirmationProps {
  currentRoom: { name: string; code: string }
  targetRoom: { name: string; code: string }
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
              {currentRoom.name}
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
              {targetRoom.name}
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
    name: string
    code: string
  } | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isJoining, setIsJoining] = useState(false)
  const code = params.code.toUpperCase()

  const handleJoin = useCallback(
    async (targetRoomId: string) => {
      setIsJoining(true)
      setError(null)

      try {
        await joinRoom({ roomId: targetRoomId, displayName: 'Player' })
        // Navigate to the game
        router.push('/arcade/room')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to join room')
      } finally {
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
        })

        // If user is already in this exact room, just navigate to game
        if (roomData && roomData.id === room.id) {
          router.push('/arcade/room')
          return
        }

        // If user is in a different room, show confirmation
        if (roomData) {
          setShowConfirmation(true)
        } else {
          // Otherwise, auto-join
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
      handleJoin(targetRoomData.id)
    }
  }

  const handleCancel = () => {
    router.push('/arcade/room') // Stay in current room
  }

  if (error) {
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

  if (showConfirmation && roomData) {
    return (
      <RoomSwitchConfirmation
        currentRoom={{ name: roomData.name, code: roomData.code }}
        targetRoom={{ name: targetRoomData.name, code: targetRoomData.code }}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    )
  }

  return null
}
