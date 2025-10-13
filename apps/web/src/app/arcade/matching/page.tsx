import { MemoryPairsGame } from './components/MemoryPairsGame'
import { LocalMemoryPairsProvider } from './context/LocalMemoryPairsProvider'

export default function MatchingPage() {
  return (
    <LocalMemoryPairsProvider>
      <MemoryPairsGame />
    </LocalMemoryPairsProvider>
  )
}
