'use client'

import { useCallback, useMemo } from 'react'
import { useViewerId } from '@/hooks/useViewerId'
import { MemoryGrid } from '@/components/matching/MemoryGrid'
import { css } from '../../../../styled-system/css'
import { useMatching } from '../Provider'
import { getGridConfiguration } from '../utils/cardGeneration'
import { GameCard } from './GameCard'
import type { GameCard as GameCardType } from '../types'

// Abacus-specific smart dimming logic (extracted from MemoryGrid)
function shouldDimAbacusCard(card: GameCardType, firstFlippedCard: GameCardType): boolean {
  // If first card is abacus, only numeral cards should be clickable
  if (firstFlippedCard.type === 'abacus' && card.type !== 'number') {
    return true
  }
  // If first card is numeral, only abacus cards should be clickable
  if (firstFlippedCard.type === 'number' && card.type !== 'abacus') {
    return true
  }
  return false
}

export function GamePhase() {
  const { state, flipCard, hoverCard, gameMode } = useMatching()
  const { data: viewerId } = useViewerId()

  const gridConfig = useMemo(() => getGridConfiguration(state.difficulty), [state.difficulty])

  // Only apply dimming for abacus-numeral mode
  const dimCard = useCallback(
    (card: GameCardType, firstFlipped: GameCardType) => {
      if (state.gameType === 'abacus-numeral') {
        return shouldDimAbacusCard(card, firstFlipped)
      }
      return false
    },
    [state.gameType]
  )

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
          enableMultiplayerPresence={gameMode === 'multiplayer'}
          hoverCard={hoverCard}
          viewerId={viewerId}
          gameMode={gameMode}
          shouldDimCard={dimCard}
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
