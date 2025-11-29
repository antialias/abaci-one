'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageWithNav } from '@/components/PageWithNav'
import { StandardGameLayout } from '@/components/StandardGameLayout'
import { CROP_MODE_EVENT, type CropModeEventDetail } from '../customCrops'
import { useKnowYourWorld } from '../Provider'
import { SetupPhase } from './SetupPhase'
import { PlayingPhase } from './PlayingPhase'
import { ResultsPhase } from './ResultsPhase'

export function GameComponent() {
  const router = useRouter()
  const { state, exitSession, returnToSetup, endGame } = useKnowYourWorld()

  // Track crop mode to hide nav (dev only)
  const [cropModeActive, setCropModeActive] = useState(false)

  useEffect(() => {
    const handleCropModeChange = (e: Event) => {
      const detail = (e as CustomEvent<CropModeEventDetail>).detail
      setCropModeActive(detail.active)
    }

    window.addEventListener(CROP_MODE_EVENT, handleCropModeChange)
    return () => window.removeEventListener(CROP_MODE_EVENT, handleCropModeChange)
  }, [])

  // Determine current player for turn indicator (if turn-based mode)
  const currentPlayerId =
    state.gamePhase === 'playing' && state.gameMode === 'turn-based'
      ? state.currentPlayer
      : undefined

  // Setup phase renders its own full-screen layout (map behind nav)
  // Playing phase uses StandardGameLayout (respects nav height)
  // Results phase uses normal flow

  // When crop mode is active (dev only), render without nav to allow unobstructed drawing
  if (cropModeActive) {
    return (
      <>
        {state.gamePhase === 'setup' && <SetupPhase />}
        {state.gamePhase === 'playing' && (
          <StandardGameLayout>
            <PlayingPhase />
          </StandardGameLayout>
        )}
        {state.gamePhase === 'results' && <ResultsPhase />}
      </>
    )
  }

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
      {state.gamePhase === 'playing' && (
        <StandardGameLayout>
          <PlayingPhase />
        </StandardGameLayout>
      )}
      {state.gamePhase === 'results' && <ResultsPhase />}
    </PageWithNav>
  )
}
