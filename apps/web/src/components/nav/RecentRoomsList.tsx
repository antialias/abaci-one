import React from 'react'
import { getRoomDisplayWithEmoji } from '@/utils/room-display'

interface RecentRoom {
  code: string
  name: string | null
  gameName: string
  joinedAt: number
}

interface RecentRoomsListProps {
  onSelectRoom: (code: string) => void
}

const STORAGE_KEY = 'arcade_recent_rooms'
const MAX_RECENT_ROOMS = 3

export function RecentRoomsList({ onSelectRoom }: RecentRoomsListProps) {
  const [recentRooms, setRecentRooms] = React.useState<RecentRoom[]>([])

  // Load recent rooms from localStorage
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const rooms: RecentRoom[] = JSON.parse(stored)
        setRecentRooms(rooms.slice(0, MAX_RECENT_ROOMS))
      }
    } catch (err) {
      console.error('Failed to load recent rooms:', err)
    }
  }, [])

  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)

    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
    return `${Math.floor(seconds / 86400)} days ago`
  }

  if (recentRooms.length === 0) {
    return null
  }

  return (
    <div>
      <div
        style={{
          fontSize: '11px',
          fontWeight: '600',
          color: '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '8px',
        }}
      >
        ⏱️ Recent Rooms
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        {recentRooms.map((room) => (
          <button
            key={room.code}
            type="button"
            onClick={() => onSelectRoom(room.code)}
            style={{
              padding: '10px 12px',
              background: 'transparent',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f9fafb'
              e.currentTarget.style.borderColor = '#d1d5db'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = '#e5e7eb'
            }}
          >
            <div
              style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>🏟️</span>
              <span>
                {getRoomDisplayWithEmoji({
                  name: room.name,
                  code: room.code,
                  gameName: room.gameName,
                })}
              </span>
            </div>
            <div
              style={{
                fontSize: '12px',
                color: '#6b7280',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{room.code}</span>
              <span>·</span>
              <span>{formatTimeAgo(room.joinedAt)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// Helper function to add a room to recent rooms
export function addToRecentRooms(room: {
  code: string
  name: string | null
  gameName: string
}): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    const rooms: RecentRoom[] = stored ? JSON.parse(stored) : []

    // Remove if already exists (to update timestamp)
    const filtered = rooms.filter((r) => r.code !== room.code)

    // Add to front
    const updated = [
      {
        ...room,
        joinedAt: Date.now(),
      },
      ...filtered,
    ].slice(0, MAX_RECENT_ROOMS)

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (err) {
    console.error('Failed to save recent room:', err)
  }
}
