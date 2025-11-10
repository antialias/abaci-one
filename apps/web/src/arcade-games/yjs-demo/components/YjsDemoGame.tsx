'use client'

import { useRouter } from 'next/navigation'
import { PageWithNav } from '@/components/PageWithNav'
import { useYjsDemo } from '../Provider'
import { SetupPhase } from './SetupPhase'
import { PlayingPhase } from './PlayingPhase'
import { ResultsPhase } from './ResultsPhase'

export function YjsDemoGame() {
  const router = useRouter()
  const { state, exitSession, goToSetup } = useYjsDemo()

  return (
    <PageWithNav
      navTitle="Yjs Demo"
      navEmoji="🔄"
      emphasizePlayerSelection={state.gamePhase === 'setup'}
      playerScores={state.playerScores}
      onExitSession={() => {
        exitSession()
        router.push('/arcade')
      }}
      onSetup={state.gamePhase !== 'setup' ? () => goToSetup() : undefined}
    >
      {state.gamePhase === 'setup' && <SetupPhase />}
      {state.gamePhase === 'playing' && <PlayingPhase />}
      {state.gamePhase === 'results' && <ResultsPhase />}
    </PageWithNav>
  )
}
