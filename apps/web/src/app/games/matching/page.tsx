import { PageWithNav } from '@/components/PageWithNav'
import { MemoryPairsProvider } from './context/MemoryPairsContext'
import { MemoryPairsGame } from './components/MemoryPairsGame'

export default function MatchingPage() {
  return (
    <PageWithNav navTitle="Memory Pairs" navEmoji="🧩">
      <MemoryPairsProvider>
        <MemoryPairsGame />
      </MemoryPairsProvider>
    </PageWithNav>
  )
}