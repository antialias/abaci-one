'use client'

import { useEffect, useRef } from 'react'
import { PageWithNav } from '@/components/PageWithNav'
import { css } from '../../../../../styled-system/css'
import { StandardGameLayout } from '../../../../components/StandardGameLayout'
import { useFullscreen } from '../../../../contexts/FullscreenContext'
import { useMemoryPairs } from '../context/MemoryPairsContext'
import { GamePhase } from './GamePhase'
import { ResultsPhase } from './ResultsPhase'
import { SetupPhase } from './SetupPhase'

export function MemoryPairsGame() {
  const { state } = useMemoryPairs()
  const { setFullscreenElement } = useFullscreen()
  const gameRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Register this component's main div as the fullscreen element
    if (gameRef.current) {
      console.log('🎯 MemoryPairsGame: Registering fullscreen element:', gameRef.current)
      setFullscreenElement(gameRef.current)
    }
  }, [setFullscreenElement])

  return (
    <PageWithNav
      navTitle="Memory Pairs"
      navEmoji="🧩"
      emphasizeGameContext={state.gamePhase === 'setup'}
      currentPlayerId={state.currentPlayer}
      playerScores={state.scores}
      playerStreaks={state.consecutiveMatches}
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
          {/* Note: Fullscreen restore prompt removed - client-side navigation preserves fullscreen */}

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
            {state.gamePhase === 'playing' && <GamePhase />}
            {state.gamePhase === 'results' && <ResultsPhase />}
          </main>
        </div>
      </StandardGameLayout>
    </PageWithNav>
  )
}
