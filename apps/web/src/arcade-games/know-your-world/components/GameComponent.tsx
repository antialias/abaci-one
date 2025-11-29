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

  // Map game mode to nav display
  const baseModeDisplay = {
    cooperative: { label: 'Co-op', emoji: '🤝', color: '#10b981' },
    race: { label: 'Race', emoji: '🏁', color: '#ef4444' },
    'turn-based': { label: 'Turns', emoji: '🔄', color: '#8b5cf6' },
  }[state.gameMode] ?? { label: 'Co-op', emoji: '🤝', color: '#10b981' }

  // Map assistance level to display info
  const assistanceDisplay =
    {
      learning: { label: 'Learning', emoji: '🌱' },
      guided: { label: 'Guided', emoji: '🧭' },
      helpful: { label: 'Helpful', emoji: '💡' },
      standard: { label: 'Standard', emoji: '🎯' },
      none: { label: 'Challenge', emoji: '🏆' },
    }[state.assistanceLevel] ?? null

  // Combine mode and assistance level in the label
  const modeDisplay = {
    ...baseModeDisplay,
    label: assistanceDisplay
      ? `${baseModeDisplay.label} • ${assistanceDisplay.emoji} ${assistanceDisplay.label}`
      : baseModeDisplay.label,
  }

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
      customModeLabel={modeDisplay.label}
      customModeEmoji={modeDisplay.emoji}
      customModeColor={modeDisplay.color}
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
