'use client'

import { useMemoryPairs } from '../context/MemoryPairsContext'
import { useGameMode } from '../../../../contexts/GameModeContext'
import { MemoryGrid } from './MemoryGrid'
import { css } from '../../../../../styled-system/css'

export function GamePhase() {
  const { state, resetGame, activePlayers } = useMemoryPairs()
  const { players } = useGameMode()

  // Get the current player from the arena champions
  const currentPlayerData = players.find(p => p.id === state.currentPlayer)
  const activePlayerData = players.filter(p => activePlayers.includes(p.id))

  return (
    <div className={css({
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    })}>

      {/* Game Header - Compact on mobile */}
      <div className={css({
        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1))',
        padding: { base: '8px 12px', sm: '12px 16px', md: '16px 20px' },
        borderRadius: { base: '8px', md: '12px' },
        marginBottom: { base: '8px', sm: '12px', md: '16px' },
        border: '1px solid rgba(102, 126, 234, 0.2)',
        flexShrink: 0
      })}>
        <div className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: { base: '8px', sm: '12px', md: '16px' }
        })}>

          {/* Game Type & Difficulty Info - Hidden on mobile */}
          <div className={css({
            display: { base: 'none', sm: 'flex' },
            alignItems: 'center',
            gap: { base: '8px', md: '16px' }
          })}>
            <div className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            })}>
              <span className={css({ fontSize: '20px' })}>
                {state.gameType === 'abacus-numeral' ? '🧮🔢' : '🤝➕'}
              </span>
              <span className={css({ fontWeight: 'bold', color: 'gray.700' })}>
                {state.gameType === 'abacus-numeral' ? 'Abacus-Numeral' : 'Complement Pairs'}
              </span>
            </div>

            <div className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            })}>
              <span className={css({ fontSize: '20px' })}>
                {state.difficulty === 6 ? '🌱' : state.difficulty === 8 ? '⚡' : state.difficulty === 12 ? '🔥' : '💀'}
              </span>
              <span className={css({ fontWeight: 'bold', color: 'gray.700' })}>
                {state.difficulty} pairs
              </span>
            </div>

            {state.gameMode === 'multiplayer' && (
              <div className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              })}>
                <span className={css({ fontSize: '20px' })}>⚔️</span>
                <span className={css({ fontWeight: 'bold', color: 'gray.700' })}>
                  {activePlayers.length} Players
                </span>
              </div>
            )}
          </div>

          {/* Game Controls */}
          <div className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          })}>

            {/* Restart Button */}
            <button
              className={css({
                background: 'linear-gradient(135deg, #ffeaa7, #fab1a0)',
                color: '#2d3436',
                border: 'none',
                borderRadius: '12px',
                padding: '10px 16px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(255, 234, 167, 0.4)',
                _hover: {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 12px rgba(255, 234, 167, 0.6)',
                  background: 'linear-gradient(135deg, #fdcb6e, #e17055)'
                }
              })}
              onClick={resetGame}
            >
              <div className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              })}>
                <span>🔄</span>
                <span>New Game</span>
              </div>
            </button>

            {/* Timer (if multiplayer mode) */}
            {state.gameMode === 'multiplayer' && (
              <div className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              })}>
                <span className={css({ fontSize: '16px' })}>⏰</span>
                <span className={css({ fontWeight: 'bold', color: 'gray.700' })}>
                  {state.turnTimer}s per turn
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Current Player Indicator (Multiplayer Mode) - Compact on mobile */}
        {state.gameMode === 'multiplayer' && currentPlayerData && (
          <div className={css({
            marginTop: { base: '8px', md: '12px' },
            textAlign: 'center'
          })}>
            <div className={css({
              display: 'inline-flex',
              alignItems: 'center',
              gap: { base: '6px', sm: '8px', md: '12px' },
              padding: { base: '6px 12px', sm: '8px 16px', md: '12px 24px' },
              background: `linear-gradient(135deg, ${currentPlayerData.color}, ${currentPlayerData.color}dd)`,
              color: 'white',
              borderRadius: { base: '12px', md: '20px' },
              fontSize: { base: '12px', sm: '14px', md: '16px' },
              fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            })}>
              <span className={css({ fontSize: { base: '20px', sm: '28px', md: '36px' } })}>
                {currentPlayerData.emoji}
              </span>
              <span className={css({ display: { base: 'none', sm: 'inline' } })}>{currentPlayerData.name}'s Turn</span>
              <span className={css({ display: { base: 'inline', sm: 'none' } })}>Turn</span>
              <span className={css({ fontSize: { base: '16px', sm: '20px', md: '24px' } })}>
                🎯
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Memory Grid - The main game area */}
      <div className={css({
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden'
      })}>
        <MemoryGrid />
      </div>

      {/* Helpful Instructions - Hidden on mobile */}
      <div className={css({
        textAlign: 'center',
        marginTop: { base: '8px', md: '16px' },
        padding: { base: '8px', md: '12px' },
        background: 'rgba(248, 250, 252, 0.8)',
        borderRadius: '8px',
        border: '1px solid rgba(226, 232, 240, 0.8)',
        display: { base: 'none', md: 'block' },
        flexShrink: 0
      })}>
        <p className={css({
          fontSize: '14px',
          color: 'gray.600',
          margin: 0,
          lineHeight: '1.4'
        })}>
          {state.gameType === 'abacus-numeral'
            ? 'Match abacus representations with their numerical values! Look for patterns and remember card positions.'
            : 'Find pairs of numbers that add up to 5 or 10! These are called "complement pairs" or "number friends".'
          }
        </p>

        {state.gameMode === 'multiplayer' && (
          <p className={css({
            fontSize: '12px',
            color: 'gray.500',
            margin: '6px 0 0 0'
          })}>
            Take turns finding matches. The player with the most pairs wins!
          </p>
        )}
      </div>
    </div>
  )
}