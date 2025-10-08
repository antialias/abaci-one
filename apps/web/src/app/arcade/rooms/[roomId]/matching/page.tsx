'use client'

import { useParams } from 'next/navigation'
import { ArcadeGuardedPage } from '@/components/ArcadeGuardedPage'
import { MemoryPairsGame } from '@/app/arcade/matching/components/MemoryPairsGame'
import { ArcadeMemoryPairsProvider } from '@/app/arcade/matching/context/ArcadeMemoryPairsContext'

export default function RoomMatchingPage() {
  const params = useParams()
  const roomId = params.roomId as string

  // TODO Phase 4: Integrate room context with game state
  // - Connect to room socket events
  // - Sync game state across players
  // - Handle multiplayer moves

  return (
    <ArcadeGuardedPage>
      <ArcadeMemoryPairsProvider>
        <MemoryPairsGame />
      </ArcadeMemoryPairsProvider>
    </ArcadeGuardedPage>
  )
}
