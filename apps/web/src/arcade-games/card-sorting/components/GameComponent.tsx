'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { PageWithNav } from '@/components/PageWithNav'
import { css } from '../../../../styled-system/css'
import { StandardGameLayout } from '@/components/StandardGameLayout'
import { useFullscreen } from '@/contexts/FullscreenContext'
import { useCardSorting } from '../Provider'
import { SetupPhase } from './SetupPhase'
import { PlayingPhaseDrag } from './PlayingPhaseDrag'
import { ResultsPhase } from './ResultsPhase'

export function GameComponent() {
  const router = useRouter()
  const { state, exitSession, startGame, goToSetup, isSpectating } = useCardSorting()
  const { setFullscreenElement } = useFullscreen()
  const gameRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Register fullscreen element
    if (gameRef.current) {
      setFullscreenElement(gameRef.current)
    }
  }, [setFullscreenElement])

  return (
    <PageWithNav
      navTitle="Card Sorting"
      navEmoji="🔢"
      emphasizePlayerSelection={state.gamePhase === 'setup'}
      onExitSession={() => {
        exitSession()
        router.push('/arcade')
      }}
      onSetup={
        goToSetup
          ? () => {
              goToSetup()
            }
          : undefined
      }
      onNewGame={() => {
        startGame()
      }}
    >
      <StandardGameLayout>
        <div
          ref={gameRef}
          className={css({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
            // Remove all padding/margins for playing phase
            padding: state.gamePhase === 'playing' ? '0' : { base: '12px', sm: '16px', md: '20px' },
          })}
        >
          {/* Spectator Mode Banner - only show in setup/results */}
          {isSpectating && state.gamePhase !== 'setup' && state.gamePhase !== 'playing' && (
            <div
              className={css({
                width: '100%',
                maxWidth: '1200px',
                background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                borderRadius: { base: '8px', md: '12px' },
                padding: { base: '12px', md: '16px' },
                marginBottom: { base: '12px', md: '16px' },
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: { base: '14px', sm: '16px', md: '18px' },
                fontWeight: 600,
                color: '#92400e',
                textAlign: 'center',
                alignSelf: 'center',
              })}
            >
              <span role="img" aria-label="watching">
                👀
              </span>
              <span>Spectating {state.playerMetadata?.name || 'player'}'s game</span>
            </div>
          )}

          {/* For playing phase, render full viewport. For setup/results, use container */}
          {state.gamePhase === 'playing' ? (
            <PlayingPhaseDrag />
          ) : (
            <main
              className={css({
                width: '100%',
                maxWidth: '1200px',
                background: 'rgba(255,255,255,0.95)',
                borderRadius: { base: '12px', md: '20px' },
                padding: { base: '12px', sm: '16px', md: '24px', lg: '32px' },
                boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                alignSelf: 'center',
              })}
            >
              {state.gamePhase === 'setup' && <SetupPhase />}
              {state.gamePhase === 'results' && <ResultsPhase />}
            </main>
          )}
        </div>
      </StandardGameLayout>
    </PageWithNav>
  )
}
