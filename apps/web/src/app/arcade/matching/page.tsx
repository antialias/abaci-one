import { ArcadeGuardedPage } from '@/components/ArcadeGuardedPage'
import { MemoryPairsGame } from './components/MemoryPairsGame'
import { RoomMemoryPairsProvider } from './context/RoomMemoryPairsProvider'

export default function MatchingPage() {
  return (
    <ArcadeGuardedPage>
      <RoomMemoryPairsProvider>
        <MemoryPairsGame />
      </RoomMemoryPairsProvider>
    </ArcadeGuardedPage>
  )
}
