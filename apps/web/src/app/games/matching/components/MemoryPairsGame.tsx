'use client'

import { useEffect, useRef, useState } from 'react'
import { useMemoryPairs } from '../context/MemoryPairsContext'
import { useFullscreen } from '../../../../contexts/FullscreenContext'
import { SetupPhase } from './SetupPhase'
import { GamePhase } from './GamePhase'
import { ResultsPhase } from './ResultsPhase'
import { StandardGameLayout } from '../../../../components/StandardGameLayout'
import { css } from '../../../../../styled-system/css'

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
          overflow: 'auto'
        })}>
        {/* Note: Fullscreen restore prompt removed - client-side navigation preserves fullscreen */}

        <header className={css({
          textAlign: 'center',
          marginBottom: { base: '8px', sm: '12px', md: '16px' },
          px: { base: '4', md: '0' },
          display: { base: 'none', sm: 'block' }
        })}>
          <h1 className={css({
            fontSize: { base: '16px', sm: '20px', md: '24px' },
            fontWeight: 'bold',
            color: 'white',
            textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
            marginBottom: 0
          })}>
            Memory Pairs
          </h1>
        </header>

        <main className={css({
          width: '100%',
          maxWidth: '1200px',
          background: 'rgba(255,255,255,0.95)',
          borderRadius: { base: '12px', md: '20px' },
          padding: { base: '12px', sm: '16px', md: '24px', lg: '32px' },
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        })}>
          {state.gamePhase === 'setup' && <SetupPhase />}
          {state.gamePhase === 'playing' && <GamePhase />}
          {state.gamePhase === 'results' && <ResultsPhase />}
        </main>
      </div>
    </StandardGameLayout>
  )
}