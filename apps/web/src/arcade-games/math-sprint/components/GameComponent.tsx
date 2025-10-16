/**
 * Math Sprint - Game Component
 *
 * Main wrapper component with navigation and phase routing.
 */

'use client'

import { useRouter } from 'next/navigation'
import { PageWithNav } from '@/components/PageWithNav'
import { useMathSprint } from '../Provider'
import { PlayingPhase } from './PlayingPhase'
import { ResultsPhase } from './ResultsPhase'
import { SetupPhase } from './SetupPhase'

export function GameComponent() {
  const router = useRouter()
  const { state, exitSession, resetGame } = useMathSprint()

  return (
    <PageWithNav
      navTitle="Math Sprint"
      navEmoji="🧮"
      emphasizePlayerSelection={state.gamePhase === 'setup'}
      // No currentPlayerId - free-for-all game, everyone can act simultaneously
      playerScores={state.scores}
      onExitSession={() => {
        exitSession?.()
        router.push('/arcade')
      }}
      onNewGame={() => {
        resetGame()
      }}
    >
      {state.gamePhase === 'setup' && <SetupPhase />}
      {state.gamePhase === 'playing' && <PlayingPhase />}
      {state.gamePhase === 'results' && <ResultsPhase />}
    </PageWithNav>
  )
}
