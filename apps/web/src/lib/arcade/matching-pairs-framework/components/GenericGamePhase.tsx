'use client'

import { useMemo } from 'react'
import { useUserId } from '@/hooks/useUserId'
import { MemoryGrid } from '@/components/matching/MemoryGrid'
import { css } from '../../../../../styled-system/css'
import { FlipCard } from './FlipCard'
import type {
  BaseMatchingCard,
  BaseMatchingConfig,
  MatchingPairsContextValue,
  MatchingPairsVariant,
} from '../types'
import { useGameMode } from '@/contexts/GameModeContext'

export interface GenericGamePhaseProps<
  TCard extends BaseMatchingCard,
  TConfig extends BaseMatchingConfig,
> {
  ctx: MatchingPairsContextValue<TCard, TConfig>
  variant: MatchingPairsVariant<TCard, TConfig>
}

export function GenericGamePhase<
  TCard extends BaseMatchingCard,
  TConfig extends BaseMatchingConfig,
>({ ctx, variant }: GenericGamePhaseProps<TCard, TConfig>) {
  const { state, flipCard, hoverCard, gameMode } = ctx
  const { data: viewerId } = useUserId()
  const { players: playerMap, activePlayers: activePlayerIds } = useGameMode()

  const config = state as unknown as TConfig
  const gridConfig = useMemo(() => variant.getGridConfig(config), [variant, config])

  // Build active players array for FlipCard
  const activePlayers = useMemo(
    () =>
      Array.from(activePlayerIds)
        .map((id) => playerMap.get(id))
        .filter((p): p is NonNullable<typeof p> => p !== undefined)
        .map((p) => ({ id: p.id, emoji: p.emoji })),
    [activePlayerIds, playerMap]
  )

  const CardFront = variant.CardFront
  const quickTip = variant.getQuickTip?.(config)

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
          shouldDimCard={variant.shouldDimCard}
          renderCard={({ card, isFlipped, isMatched, onClick, disabled }) => {
            const backStyle = variant.getCardBackStyle(card, isMatched)

            // Determine player-specific matched card style
            let matchedCardStyle: { gradient: string } | null = null
            if (isMatched && card.matchedBy) {
              const playerIndex = activePlayers.findIndex((p) => p.id === card.matchedBy)
              if (playerIndex === 0) {
                matchedCardStyle = { gradient: 'linear-gradient(135deg, #74b9ff, #0984e3)' }
              } else if (playerIndex === 1) {
                matchedCardStyle = { gradient: 'linear-gradient(135deg, #fd79a8, #e84393)' }
              }
            }

            return (
              <FlipCard
                card={card}
                isFlipped={isFlipped}
                isMatched={isMatched}
                onClick={onClick}
                disabled={disabled}
                renderFront={() => <CardFront card={card} />}
                cardBackStyle={backStyle}
                matchedCardStyle={matchedCardStyle}
                activePlayers={activePlayers}
              />
            )
          }}
        />
      </div>

      {/* Quick Tip */}
      {state.moves === 0 && quickTip && (
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
            💡 {quickTip}
          </p>
        </div>
      )}
    </div>
  )
}
