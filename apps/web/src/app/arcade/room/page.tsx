'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useRoomData } from '@/hooks/useRoomData'
import { MemoryPairsGame } from '../matching/components/MemoryPairsGame'
import { ArcadeMemoryPairsProvider } from '../matching/context/ArcadeMemoryPairsContext'

/**
 * /arcade/room - Renders the game for the user's current room
 * Since users can only be in one room at a time, this is a simple singular route
 */
export default function RoomPage() {
  const router = useRouter()
  const { roomData, isLoading } = useRoomData()

  // Redirect to arcade if no room
  useEffect(() => {
    if (!isLoading && !roomData) {
      router.push('/arcade')
    }
  }, [isLoading, roomData, router])

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

  // Show nothing while redirecting
  if (!roomData) {
    return null
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
