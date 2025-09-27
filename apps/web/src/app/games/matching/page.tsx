import { MemoryPairsProvider } from './context/MemoryPairsContext'
import { UserProfileProvider } from '../../../contexts/UserProfileContext'
import { MemoryPairsGame } from './components/MemoryPairsGame'

export default function MatchingPage() {
  return (
    <UserProfileProvider>
      <MemoryPairsProvider>
        <MemoryPairsGame />
      </MemoryPairsProvider>
    </UserProfileProvider>
  )
}