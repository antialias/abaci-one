'use client'

import { useRouter } from 'next/navigation'
import { PageWithNav } from '@/components/PageWithNav'
import { StandardGameLayout } from '@/components/StandardGameLayout'
import { useKnowYourWorld } from '../Provider'
import { SetupPhase } from './SetupPhase'
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

  // Use StandardGameLayout only for playing phase
  const content = (
    <>
      {state.gamePhase === 'setup' && <SetupPhase />}
      {state.gamePhase === 'playing' && <PlayingPhase />}
      {state.gamePhase === 'results' && <ResultsPhase />}
    </>
  )

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
      {state.gamePhase === 'playing' ? <StandardGameLayout>{content}</StandardGameLayout> : content}
    </PageWithNav>
  )
}
