'use client'

import { useMemo } from 'react'
import { useViewerId } from '@/hooks/useViewerId'
import { MemoryGrid } from '@/components/matching/MemoryGrid'
import { css } from '../../../../styled-system/css'
import { useMatching } from '../Provider'
import { getGridConfiguration } from '../utils/cardGeneration'
import { GameCard } from './GameCard'

export function GamePhase() {
  const { state, flipCard, hoverCard, gameMode } = useMatching()
  const { data: viewerId } = useViewerId()

  const gridConfig = useMemo(() => getGridConfiguration(state.difficulty), [state.difficulty])

  return (
    <div
      className={css({
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      })}
    >
      {/* Game header removed - game type and player info now shown in nav bar */}

      {/* Memory Grid - The main game area */}
      <div
        className={css({
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        })}
      >
        <MemoryGrid
          state={state}
          gridConfig={gridConfig}
          flipCard={flipCard}
          enableMultiplayerPresence={true}
          hoverCard={hoverCard}
          viewerId={viewerId}
          gameMode={gameMode}
          renderCard={({ card, isFlipped, isMatched, onClick, disabled }) => (
            <GameCard
              card={card}
              isFlipped={isFlipped}
              isMatched={isMatched}
              onClick={onClick}
              disabled={disabled}
            />
          )}
        />
      </div>

      {/* Quick Tip - Only show when game is starting and on larger screens */}
      {state.moves === 0 && (
        <div
          className={css({
            textAlign: 'center',
            marginTop: '12px',
            padding: '8px 16px',
            background: 'rgba(248, 250, 252, 0.7)',
            borderRadius: '8px',
            border: '1px solid rgba(226, 232, 240, 0.6)',
            display: { base: 'none', lg: 'block' },
            flexShrink: 0,
          })}
        >
          <p
            className={css({
              fontSize: '13px',
              color: 'gray.600',
              margin: 0,
              fontWeight: 'medium',
            })}
          >
            💡{' '}
            {state.gameType === 'abacus-numeral'
              ? 'Match abacus beads with numbers'
              : 'Find pairs that add to 5 or 10'}
          </p>
        </div>
      )}
    </div>
  )
}
