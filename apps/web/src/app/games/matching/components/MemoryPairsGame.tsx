'use client'

import { useEffect, useRef, useState } from 'react'
import { useMemoryPairs } from '../context/MemoryPairsContext'
import { useFullscreen } from '../../../../contexts/FullscreenContext'
import { SetupPhase } from './SetupPhase'
import { GamePhase } from './GamePhase'
import { ResultsPhase } from './ResultsPhase'
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
    <div
      ref={gameRef}
      className={css({
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: { base: '12px', sm: '16px', md: '20px' },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative'
      })}>
      {/* Note: Fullscreen restore prompt removed - client-side navigation preserves fullscreen */}

      <header className={css({
        textAlign: 'center',
        marginBottom: { base: '16px', sm: '20px', md: '30px' },
        px: { base: '4', md: '0' }
      })}>
        <h1 className={css({
          fontSize: { base: '24px', sm: '32px', md: '40px', lg: '48px' },
          fontWeight: 'bold',
          color: 'white',
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
          marginBottom: { base: '6px', md: '10px' },
          lineHeight: { base: '1.2', md: '1.1' }
        })}>
          Memory Pairs Challenge
        </h1>
        <p className={css({
          fontSize: { base: '14px', sm: '16px', md: '18px' },
          color: 'rgba(255,255,255,0.9)',
          maxWidth: '600px',
          lineHeight: { base: '1.4', md: '1.3' },
          display: { base: 'none', sm: 'block' }
        })}>
          Match pairs of abacus representations with their numerical values, or find complement pairs that add up to 5 or 10!
        </p>
      </header>

      <main className={css({
        width: '100%',
        maxWidth: '1200px',
        background: 'rgba(255,255,255,0.95)',
        borderRadius: { base: '12px', md: '20px' },
        padding: { base: '16px', sm: '24px', md: '32px', lg: '40px' },
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
        minHeight: { base: '60vh', md: '500px' },
        flex: 1,
        display: 'flex',
        flexDirection: 'column'
      })}>
        {state.gamePhase === 'setup' && <SetupPhase />}
        {state.gamePhase === 'playing' && <GamePhase />}
        {state.gamePhase === 'results' && <ResultsPhase />}
      </main>
    </div>
  )
}