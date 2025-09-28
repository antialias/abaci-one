'use client'

import { useEffect } from 'react'
import { useMemoryPairs } from '../context/MemoryPairsContext'
import { useFullscreen } from '../../../../contexts/FullscreenContext'
import { SetupPhase } from './SetupPhase'
import { GamePhase } from './GamePhase'
import { ResultsPhase } from './ResultsPhase'
import { css } from '../../../../../styled-system/css'

export function MemoryPairsGame() {
  const { state } = useMemoryPairs()
  const { enterFullscreen } = useFullscreen()

  useEffect(() => {
    // Check if we should enter fullscreen (from URL parameter)
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('fullscreen') === 'true') {
      enterFullscreen()
    }
  }, [enterFullscreen])

  return (
    <div className={css({
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    })}>
      <header className={css({
        textAlign: 'center',
        marginBottom: '30px'
      })}>
        <h1 className={css({
          fontSize: '48px',
          fontWeight: 'bold',
          color: 'white',
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
          marginBottom: '10px'
        })}>
          Memory Pairs Challenge
        </h1>
        <p className={css({
          fontSize: '18px',
          color: 'rgba(255,255,255,0.9)',
          maxWidth: '600px'
        })}>
          Match pairs of abacus representations with their numerical values, or find complement pairs that add up to 5 or 10!
        </p>
      </header>

      <main className={css({
        width: '100%',
        maxWidth: '1200px',
        background: 'rgba(255,255,255,0.95)',
        borderRadius: '20px',
        padding: '40px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
        minHeight: '500px'
      })}>
        {state.gamePhase === 'setup' && <SetupPhase />}
        {state.gamePhase === 'playing' && <GamePhase />}
        {state.gamePhase === 'results' && <ResultsPhase />}
      </main>
    </div>
  )
}