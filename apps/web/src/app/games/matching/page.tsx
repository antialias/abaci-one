import { MemoryPairsProvider } from './context/MemoryPairsContext'
import { MemoryPairsGame } from './components/MemoryPairsGame'

export default function MatchingPage() {
  return (
    <MemoryPairsProvider>
      <MemoryPairsGame />
    </MemoryPairsProvider>
  )
}