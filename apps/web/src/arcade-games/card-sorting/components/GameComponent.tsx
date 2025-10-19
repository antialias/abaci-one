'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { PageWithNav } from '@/components/PageWithNav'
import { css } from '../../../../styled-system/css'
import { StandardGameLayout } from '@/components/StandardGameLayout'
import { useFullscreen } from '@/contexts/FullscreenContext'
import { useCardSorting } from '../Provider'
import { SetupPhase } from './SetupPhase'
import { PlayingPhase } from './PlayingPhase'
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
            padding: { base: '12px', sm: '16px', md: '20px' },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            overflow: 'auto',
          })}
        >
          {/* Spectator Mode Banner */}
          {isSpectating && state.gamePhase !== 'setup' && (
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
                fontWeight: '600',
                color: '#92400e',
                textAlign: 'center',
              })}
            >
              <span role="img" aria-label="watching">
                👀
              </span>
              <span>Spectating {state.playerMetadata?.name || 'player'}'s game</span>
            </div>
          )}

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
            })}
          >
            {state.gamePhase === 'setup' && <SetupPhase />}
            {state.gamePhase === 'playing' && <PlayingPhase />}
            {state.gamePhase === 'results' && <ResultsPhase />}
          </main>
        </div>
      </StandardGameLayout>
    </PageWithNav>
  )
}
