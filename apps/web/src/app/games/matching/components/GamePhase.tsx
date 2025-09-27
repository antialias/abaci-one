'use client'

import { useMemoryPairs } from '../context/MemoryPairsContext'
import { useUserProfile } from '../../../../contexts/UserProfileContext'
import { MemoryGrid } from './MemoryGrid'
import { css } from '../../../../../styled-system/css'

export function GamePhase() {
  const { state, resetGame } = useMemoryPairs()
  const { profile } = useUserProfile()

  return (
    <div className={css({
      width: '100%',
      minHeight: '600px',
      display: 'flex',
      flexDirection: 'column'
    })}>

      {/* Game Header */}
      <div className={css({
        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1))',
        padding: '20px',
        borderRadius: '16px',
        marginBottom: '20px',
        border: '1px solid rgba(102, 126, 234, 0.2)'
      })}>
        <div className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        })}>

          {/* Game Type & Difficulty Info */}
          <div className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '20px'
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

            {state.gameMode === 'two-player' && (
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
                  Two Players
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

            {/* Timer (if two-player mode) */}
            {state.gameMode === 'two-player' && (
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

        {/* Current Player Indicator (Two-Player Mode) */}
        {state.gameMode === 'two-player' && (
          <div className={css({
            marginTop: '16px',
            textAlign: 'center'
          })}>
            <div className={css({
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 24px',
              background: state.currentPlayer === 1
                ? 'linear-gradient(135deg, #74b9ff, #0984e3)'
                : 'linear-gradient(135deg, #fd79a8, #e84393)',
              color: 'white',
              borderRadius: '20px',
              fontSize: '18px',
              fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            })}>
              <span className={css({ fontSize: '48px' })}>
                {state.currentPlayer === 1 ? profile.player1Emoji : profile.player2Emoji}
              </span>
              <span>Your Turn</span>
              <span className={css({ fontSize: '24px' })}>
                {state.currentPlayer === 1 ? '🎯' : '🎮'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Memory Grid - The main game area */}
      <MemoryGrid />

      {/* Helpful Instructions */}
      <div className={css({
        textAlign: 'center',
        marginTop: '20px',
        padding: '16px',
        background: 'rgba(248, 250, 252, 0.8)',
        borderRadius: '12px',
        border: '1px solid rgba(226, 232, 240, 0.8)'
      })}>
        <p className={css({
          fontSize: '16px',
          color: 'gray.600',
          margin: 0,
          lineHeight: '1.5'
        })}>
          {state.gameType === 'abacus-numeral'
            ? 'Match abacus representations with their numerical values! Look for patterns and remember card positions.'
            : 'Find pairs of numbers that add up to 5 or 10! These are called "complement pairs" or "number friends".'
          }
        </p>

        {state.gameMode === 'two-player' && (
          <p className={css({
            fontSize: '14px',
            color: 'gray.500',
            margin: '8px 0 0 0'
          })}>
            Take turns finding matches. The player with the most pairs wins!
          </p>
        )}
      </div>
    </div>
  )
}