/**
 * Number Guesser Game Component
 * Main component that switches between game phases
 */

'use client'

import { useRouter } from 'next/navigation'
import { PageWithNav } from '@/components/PageWithNav'
import { useNumberGuesser } from '../Provider'
import { ChoosingPhase } from './ChoosingPhase'
import { GuessingPhase } from './GuessingPhase'
import { ResultsPhase } from './ResultsPhase'
import { SetupPhase } from './SetupPhase'

export function GameComponent() {
  const router = useRouter()
  const { state, exitSession, goToSetup } = useNumberGuesser()

  return (
    <PageWithNav
      navTitle="Number Guesser"
      navEmoji="🎯"
      emphasizePlayerSelection={state.gamePhase === 'setup'}
      onExitSession={() => {
        exitSession?.()
        router.push('/arcade')
      }}
      onNewGame={() => {
        goToSetup?.()
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #fff7ed, #ffedd5)',
        }}
      >
        {state.gamePhase === 'setup' && <SetupPhase />}
        {state.gamePhase === 'choosing' && <ChoosingPhase />}
        {state.gamePhase === 'guessing' && <GuessingPhase />}
        {state.gamePhase === 'results' && <ResultsPhase />}
      </div>
    </PageWithNav>
  )
}
