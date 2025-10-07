import { ArcadeGuardedPage } from '@/components/ArcadeGuardedPage'
import { MemoryPairsGame } from './components/MemoryPairsGame'
import { ArcadeMemoryPairsProvider } from './context/ArcadeMemoryPairsContext'

export default function MatchingPage() {
  return (
    <ArcadeGuardedPage>
      <ArcadeMemoryPairsProvider>
        <MemoryPairsGame />
      </ArcadeMemoryPairsProvider>
    </ArcadeGuardedPage>
  )
}
