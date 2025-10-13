'use client'

import { useRoomData } from '@/hooks/useRoomData'
import { ModerationNotifications } from '@/components/nav/ModerationNotifications'
import { MemoryPairsGame } from '../matching/components/MemoryPairsGame'
import { RoomMemoryPairsProvider } from '../matching/context/RoomMemoryPairsProvider'

/**
 * /arcade/room - Renders the game for the user's current room
 * Since users can only be in one room at a time, this is a simple singular route
 *
 * Note: We don't redirect to /arcade if no room exists to avoid navigation loops.
 * Instead, we show a friendly message with a link back to the Champion Arena.
 */
export default function RoomPage() {
  const { roomData, isLoading, moderationEvent, clearModerationEvent } = useRoomData()

  // Show loading state
  if (isLoading) {
    return (
      <>
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
          Loading room...
        </div>
        <ModerationNotifications moderationEvent={moderationEvent} onClose={clearModerationEvent} />
      </>
    )
  }

  // Show error if no room (instead of redirecting)
  if (!roomData) {
    return (
      <>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            fontSize: '18px',
            color: '#666',
            gap: '1rem',
          }}
        >
          <div>No active room found</div>
          <a
            href="/arcade"
            style={{
              color: '#3b82f6',
              textDecoration: 'underline',
            }}
          >
            Go to Champion Arena
          </a>
        </div>
        <ModerationNotifications moderationEvent={moderationEvent} onClose={clearModerationEvent} />
      </>
    )
  }

  // Render the appropriate game based on room's gameName
  switch (roomData.gameName) {
    case 'matching':
      return (
        <>
          <RoomMemoryPairsProvider>
            <MemoryPairsGame />
          </RoomMemoryPairsProvider>
          <ModerationNotifications
            moderationEvent={moderationEvent}
            onClose={clearModerationEvent}
          />
        </>
      )

    // TODO: Add other games (complement-race, memory-quiz, etc.)
    default:
      return (
        <>
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
            Game "{roomData.gameName}" not yet supported
          </div>
          <ModerationNotifications
            moderationEvent={moderationEvent}
            onClose={clearModerationEvent}
          />
        </>
      )
  }
}
