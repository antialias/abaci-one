import { MemoryPairsProvider } from './context/MemoryPairsContext'
import { UserProfileProvider } from '../../../contexts/UserProfileContext'
import { GameModeProvider } from '../../../contexts/GameModeContext'
import { FullscreenProvider } from '../../../contexts/FullscreenContext'
import { MemoryPairsGame } from './components/MemoryPairsGame'

export default function MatchingPage() {
  return (
    <FullscreenProvider>
      <UserProfileProvider>
        <GameModeProvider>
          <MemoryPairsProvider>
            <MemoryPairsGame />
          </MemoryPairsProvider>
        </GameModeProvider>
      </UserProfileProvider>
    </FullscreenProvider>
  )
}