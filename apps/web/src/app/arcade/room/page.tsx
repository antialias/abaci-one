'use client'

import { useRoomData } from '@/hooks/useRoomData'
import { MemoryPairsGame } from '../matching/components/MemoryPairsGame'
import { ArcadeMemoryPairsProvider } from '../matching/context/ArcadeMemoryPairsContext'

/**
 * /arcade/room - Renders the game for the user's current room
 * Since users can only be in one room at a time, this is a simple singular route
 *
 * Note: We don't redirect to /arcade if no room exists because:
 * - It would conflict with arcade session redirects and create loops
 * - useArcadeRedirect on /arcade page handles redirecting to active sessions
 */
export default function RoomPage() {
  const { roomData, isLoading } = useRoomData()

  // Show loading state
  if (isLoading) {
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
        Loading room...
      </div>
    )
  }

  // Show error if no room (instead of redirecting)
  if (!roomData) {
    return (
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
    )
  }

  // Render the appropriate game based on room's gameName
  // Note: We don't use ArcadeGuardedPage here because room-based games
  // have their own navigation logic via useRoomData
  switch (roomData.gameName) {
    case 'matching':
      return (
        <ArcadeMemoryPairsProvider>
          <MemoryPairsGame />
        </ArcadeMemoryPairsProvider>
      )

    // TODO: Add other games (complement-race, memory-quiz, etc.)
    default:
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
          Game "{roomData.gameName}" not yet supported
        </div>
      )
  }
}
