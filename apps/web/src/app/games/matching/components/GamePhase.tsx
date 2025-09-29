'use client'

import { useMemoryPairs } from '../context/MemoryPairsContext'
import { useGameMode } from '../../../../contexts/GameModeContext'
import { MemoryGrid } from './MemoryGrid'
import { PlayerStatusBar } from './PlayerStatusBar'
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

      {/* Minimal Game Header */}
      <div className={css({
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: { base: '8px 12px', sm: '10px 16px', md: '12px 20px' },
        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.08))',
        borderRadius: '12px',
        marginBottom: { base: '12px', sm: '16px', md: '20px' },
        border: '1px solid rgba(102, 126, 234, 0.15)',
        flexShrink: 0
      })}>

        {/* Game Mode Indicator - Compact */}
        <div className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: { base: '14px', sm: '15px' },
          fontWeight: 'bold',
          color: 'gray.600'
        })}>
          <span className={css({ fontSize: { base: '16px', sm: '18px' } })}>
            {state.gameType === 'abacus-numeral' ? '🧮' : '🤝'}
          </span>
          <span className={css({ display: { base: 'none', sm: 'inline' } })}>
            {state.gameType === 'abacus-numeral' ? 'Abacus Match' : 'Complement Pairs'}
          </span>
          {state.gameMode === 'multiplayer' && (
            <>
              <span className={css({ color: 'gray.400' })}>•</span>
              <span>⚔️ {activePlayers.length}P</span>
            </>
          )}
        </div>

        {/* Game Controls */}
        <div className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        })}>
          {/* New Game Button */}
          <button
            className={css({
              background: 'linear-gradient(135deg, #ffeaa7, #fab1a0)',
              color: '#2d3436',
              border: 'none',
              borderRadius: '10px',
              padding: { base: '8px 12px', sm: '10px 16px' },
              fontSize: { base: '13px', sm: '14px' },
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 6px rgba(255, 234, 167, 0.3)',
              _hover: {
                transform: 'translateY(-1px)',
                boxShadow: '0 3px 8px rgba(255, 234, 167, 0.5)',
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
        </div>
      </div>

      {/* Player Status Bar */}
      <PlayerStatusBar />

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

      {/* Quick Tip - Only show when game is starting and on larger screens */}
      {state.moves === 0 && (
        <div className={css({
          textAlign: 'center',
          marginTop: '12px',
          padding: '8px 16px',
          background: 'rgba(248, 250, 252, 0.7)',
          borderRadius: '8px',
          border: '1px solid rgba(226, 232, 240, 0.6)',
          display: { base: 'none', lg: 'block' },
          flexShrink: 0
        })}>
          <p className={css({
            fontSize: '13px',
            color: 'gray.600',
            margin: 0,
            fontWeight: 'medium'
          })}>
            💡 {state.gameType === 'abacus-numeral'
              ? 'Match abacus beads with numbers'
              : 'Find pairs that add to 5 or 10'
            }
          </p>
        </div>
      )}
    </div>
  )
}