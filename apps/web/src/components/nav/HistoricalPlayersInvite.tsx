import { useState, useEffect } from 'react'
import { useRoomData } from '@/hooks/useRoomData'
import { useToast } from '@/components/common/ToastContext'

interface HistoricalMember {
  userId: string
  displayName: string
  firstJoinedAt: string
  lastSeenAt: string
  status: 'active' | 'banned' | 'kicked' | 'left'
  isCurrentlyInRoom: boolean
  isBanned: boolean
}

/**
 * Component to show historical players who are not currently in the room
 * with invite buttons to bring them back
 */
export function HistoricalPlayersInvite() {
  const { roomData } = useRoomData()
  const [historicalMembers, setHistoricalMembers] = useState<HistoricalMember[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null)
  const { showSuccess, showError } = useToast()

  // Fetch historical members
  useEffect(() => {
    if (!roomData?.id) return

    const loadHistoricalMembers = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/arcade/rooms/${roomData.id}/history`)
        if (res.ok) {
          const data = await res.json()
          // Filter to only show members who are NOT currently in the room and NOT banned
          const notInRoom = (data.historicalMembers || []).filter(
            (m: HistoricalMember) => !m.isCurrentlyInRoom && !m.isBanned
          )
          setHistoricalMembers(notInRoom)
        }
      } catch (err) {
        console.error('Failed to load historical members:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadHistoricalMembers()
  }, [roomData?.id])

  const handleInvite = async (userId: string, displayName: string) => {
    if (!roomData?.id) return

    setInvitingUserId(userId)
    try {
      const res = await fetch(`/api/arcade/rooms/${roomData.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userName: displayName }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to send invitation')
      }

      showSuccess(`Invitation sent to ${displayName}`)

      // Remove from list after inviting
      setHistoricalMembers((prev) => prev.filter((m) => m.userId !== userId))
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to send invitation')
    } finally {
      setInvitingUserId(null)
    }
  }

  if (!roomData?.id) {
    return null
  }

  if (isLoading) {
    return (
      <div
        style={{
          padding: '16px',
          textAlign: 'center',
          fontSize: '13px',
          color: '#6b7280',
        }}
      >
        Loading past players...
      </div>
    )
  }

  if (historicalMembers.length === 0) {
    return null
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div
        style={{
          fontSize: '12px',
          fontWeight: 700,
          color: '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        Past Players
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {historicalMembers.map((member) => (
          <div
            key={member.userId}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              background: 'rgba(255, 255, 255, 0.5)',
              borderRadius: '8px',
              border: '1px solid rgba(139, 92, 246, 0.2)',
            }}
          >
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#1e293b',
                }}
              >
                {member.displayName}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: '#64748b',
                  marginTop: '2px',
                }}
              >
                Last seen: {new Date(member.lastSeenAt).toLocaleDateString()}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleInvite(member.userId, member.displayName)}
              disabled={invitingUserId === member.userId}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                background:
                  invitingUserId === member.userId
                    ? '#d1d5db'
                    : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                color: 'white',
                cursor: invitingUserId === member.userId ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: invitingUserId === member.userId ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (invitingUserId !== member.userId) {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #7c3aed, #6d28d9)'
                  e.currentTarget.style.transform = 'scale(1.05)'
                }
              }}
              onMouseLeave={(e) => {
                if (invitingUserId !== member.userId) {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #8b5cf6, #7c3aed)'
                  e.currentTarget.style.transform = 'scale(1)'
                }
              }}
            >
              {invitingUserId === member.userId ? 'Inviting...' : 'Invite'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
