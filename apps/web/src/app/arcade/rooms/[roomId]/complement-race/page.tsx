'use client'

import { useParams } from 'next/navigation'
import { PageWithNav } from '@/components/PageWithNav'
import { ComplementRaceGame } from '@/app/arcade/complement-race/components/ComplementRaceGame'
import { ComplementRaceProvider } from '@/app/arcade/complement-race/context/ComplementRaceContext'

export default function RoomComplementRacePage() {
  const params = useParams()
  const roomId = params.roomId as string

  // TODO Phase 4: Integrate room context with game state
  // - Connect to room socket events
  // - Sync game state across players
  // - Handle multiplayer race dynamics

  return (
    <PageWithNav navTitle="Speed Complement Race" navEmoji="🏁">
      <ComplementRaceProvider>
        <ComplementRaceGame />
      </ComplementRaceProvider>
    </PageWithNav>
  )
}
