'use client'

import { useRouter } from 'next/navigation'
import { PageWithNav } from '@/components/PageWithNav'
import { useKnowYourWorld } from '../Provider'
import { SetupPhase } from './SetupPhase'
import { StudyPhase } from './StudyPhase'
import { PlayingPhase } from './PlayingPhase'
import { ResultsPhase } from './ResultsPhase'

export function GameComponent() {
  const router = useRouter()
  const { state, exitSession, returnToSetup, endGame } = useKnowYourWorld()

  // Determine current player for turn indicator (if turn-based mode)
  const currentPlayerId =
    state.gamePhase === 'playing' && state.gameMode === 'turn-based'
      ? state.currentPlayer
      : undefined

  return (
    <PageWithNav
      navTitle="Know Your World"
      navEmoji="🌍"
      emphasizePlayerSelection={state.gamePhase === 'setup'}
      currentPlayerId={currentPlayerId}
      playerScores={state.scores}
      onExitSession={() => {
        exitSession()
        router.push('/arcade')
      }}
      onSetup={state.gamePhase !== 'setup' ? returnToSetup : undefined}
      onNewGame={state.gamePhase !== 'setup' && state.gamePhase !== 'results' ? endGame : undefined}
    >
      {state.gamePhase === 'setup' && <SetupPhase />}
      {state.gamePhase === 'studying' && <StudyPhase />}
      {state.gamePhase === 'playing' && <PlayingPhase />}
      {state.gamePhase === 'results' && <ResultsPhase />}
    </PageWithNav>
  )
}
