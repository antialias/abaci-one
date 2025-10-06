import { ArcadeGuardedPage } from '@/components/ArcadeGuardedPage'
import { ArcadeMemoryPairsProvider } from './context/ArcadeMemoryPairsContext'
import { MemoryPairsGame } from './components/MemoryPairsGame'

export default function MatchingPage() {
  return (
    <ArcadeGuardedPage>
      <ArcadeMemoryPairsProvider>
        <MemoryPairsGame />
      </ArcadeMemoryPairsProvider>
    </ArcadeGuardedPage>
  )
}