import { MemoryPairsProvider } from './context/MemoryPairsContext'
import { UserProfileProvider } from '../../../contexts/UserProfileContext'
import { GameModeProvider } from '../../../contexts/GameModeContext'
import { MemoryPairsGame } from './components/MemoryPairsGame'

export default function MatchingPage() {
  return (
    <UserProfileProvider>
      <GameModeProvider>
        <MemoryPairsProvider>
          <MemoryPairsGame />
        </MemoryPairsProvider>
      </GameModeProvider>
    </UserProfileProvider>
  )
}