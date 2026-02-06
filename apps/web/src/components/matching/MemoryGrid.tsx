'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { css } from '../../../styled-system/css'
import { HoverAvatar } from './HoverAvatar'

// Grid calculation utilities
function calculateOptimalGrid(cards: number, aspectRatio: number, config: any) {
  // For consistent grid layout, we need to ensure r×c = totalCards
  // Choose columns based on viewport, then calculate exact rows needed

  let targetColumns
  const width = typeof window !== 'undefined' ? window.innerWidth : 1024

  // Choose column count based on viewport
  if (aspectRatio >= 1.6 && width >= 1200) {
    // Ultra-wide: prefer wider grids
    targetColumns = config.landscapeColumns || config.desktopColumns || 6
  } else if (aspectRatio >= 1.33 && width >= 768) {
    // Desktop/landscape: use desktop columns
    targetColumns = config.desktopColumns || config.landscapeColumns || 6
  } else if (aspectRatio >= 1.0 && width >= 600) {
    // Tablet: use tablet columns
    targetColumns = config.tabletColumns || config.desktopColumns || 4
  } else {
    // Mobile: use mobile columns
    targetColumns = config.mobileColumns || 3
  }

  // Calculate exact rows needed for this column count
  const rows = Math.ceil(cards / targetColumns)

  // If we have leftover cards that would create an uneven bottom row,
  // try to redistribute for a more balanced grid
  const leftoverCards = cards % targetColumns
  if (leftoverCards > 0 && leftoverCards < targetColumns / 2 && targetColumns > 3) {
    // Try one less column for a more balanced grid
    const altColumns = targetColumns - 1
    const altRows = Math.ceil(cards / altColumns)
    const altLeftover = cards % altColumns

    // Use alternative if it creates a more balanced grid
    if (altLeftover === 0 || altLeftover > leftoverCards) {
      return { columns: altColumns, rows: altRows }
    }
  }

  return { columns: targetColumns, rows }
}

// Custom hook to calculate proper grid dimensions for consistent r×c layout
function useGridDimensions(gridConfig: any, totalCards: number) {
  const [gridDimensions, setGridDimensions] = useState(() => {
    // Calculate optimal rows and columns based on total cards and viewport
    if (typeof window !== 'undefined') {
      const aspectRatio = window.innerWidth / window.innerHeight
      return calculateOptimalGrid(totalCards, aspectRatio, gridConfig)
    }
    return {
      columns: gridConfig.mobileColumns || 3,
      rows: Math.ceil(totalCards / (gridConfig.mobileColumns || 3)),
    }
  })

  useEffect(() => {
    const updateGrid = () => {
      if (typeof window === 'undefined') return

      const aspectRatio = window.innerWidth / window.innerHeight
      setGridDimensions(calculateOptimalGrid(totalCards, aspectRatio, gridConfig))
    }

    updateGrid()
    window.addEventListener('resize', updateGrid)
    return () => window.removeEventListener('resize', updateGrid)
  }, [gridConfig, totalCards])

  return gridDimensions
}

// Type definitions
export interface MemoryGridState<TCard = any> {
  gameCards: TCard[]
  flippedCards: TCard[]
  showMismatchFeedback: boolean
  isProcessingMove: boolean
  gameType: string
  playerMetadata?: Record<string, { emoji: string; name: string; color?: string; userId?: string }>
  playerHovers?: Record<string, string | null>
  currentPlayer?: string
}

export interface MemoryGridProps<TCard = any> {
  // Core game state and actions
  state: MemoryGridState<TCard>
  gridConfig: any
  flipCard: (cardId: string) => void

  // Multiplayer presence features (optional)
  enableMultiplayerPresence?: boolean
  hoverCard?: (cardId: string | null) => void
  viewerId?: string | null
  gameMode?: 'single' | 'multiplayer'

  // Card rendering
  renderCard: (props: {
    card: TCard
    isFlipped: boolean
    isMatched: boolean
    onClick: () => void
    disabled: boolean
  }) => ReactNode
}

/**
 * Unified MemoryGrid component that works for both single-player and multiplayer modes.
 * Conditionally enables multiplayer presence features (hover avatars) when configured.
 */
export function MemoryGrid<
  TCard extends { id: string; matched: boolean; type: string; number: number },
>({
  state,
  gridConfig,
  flipCard,
  renderCard,
  enableMultiplayerPresence = false,
  hoverCard,
  viewerId,
  gameMode = 'single',
}: MemoryGridProps<TCard>) {
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map())
  const gridDimensions = useGridDimensions(gridConfig, state.gameCards.length)

  // Check if it's the local player's turn (for multiplayer mode)
  const isMyTurn = useMemo(() => {
    if (!enableMultiplayerPresence || gameMode === 'single') return true

    // In local games, all players belong to current user, so always their turn
    // In room games, check if current player belongs to this user
    const currentPlayerMetadata = state.playerMetadata?.[state.currentPlayer || '']
    return currentPlayerMetadata?.userId === viewerId
  }, [enableMultiplayerPresence, gameMode, state.currentPlayer, state.playerMetadata, viewerId])

  if (!state.gameCards.length) {
    return null
  }

  const handleCardClick = (cardId: string) => {
    flipCard(cardId)
  }

  // Get player metadata for hover avatars
  const getPlayerHoverInfo = (playerId: string) => {
    const player = state.playerMetadata?.[playerId]
    return player
      ? {
          emoji: player.emoji,
          name: player.name,
          color: player.color,
        }
      : null
  }

  // Set card ref callback
  const setCardRef = (cardId: string) => (element: HTMLDivElement | null) => {
    if (element) {
      cardRefs.current.set(cardId, element)
    } else {
      cardRefs.current.delete(cardId)
    }
  }

  return (
    <div
      className={css({
        padding: { base: '12px', sm: '16px', md: '20px' },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: { base: '12px', sm: '16px', md: '20px' },
      })}
    >
      {/* Cards Grid - Consistent r×c Layout */}
      <div
        data-element="matching-grid"
        data-game-idle={
          !state.isProcessingMove && !state.showMismatchFeedback && state.flippedCards.length === 0
            ? 'true'
            : 'false'
        }
        data-game-processing={state.isProcessingMove ? 'true' : 'false'}
        data-game-mismatch-feedback={state.showMismatchFeedback ? 'true' : 'false'}
        data-game-flipped-count={state.flippedCards.length}
        style={{
          display: 'grid',
          gap: '6px',
          justifyContent: 'center',
          maxWidth: '100%',
          margin: '0 auto',
          padding: '0 8px',
          // Consistent grid ensuring all cards fit in r×c layout
          gridTemplateColumns: `repeat(${gridDimensions.columns}, 1fr)`,
          gridTemplateRows: `repeat(${gridDimensions.rows}, 1fr)`,
        }}
      >
        {state.gameCards.map((card) => {
          const isFlipped = state.flippedCards.some((c) => c.id === card.id) || card.matched
          const isMatched = card.matched
          const shouldShake =
            state.showMismatchFeedback && state.flippedCards.some((c) => c.id === card.id)

          // Smart card filtering for abacus-numeral mode
          let isValidForSelection = true
          let isDimmed = false

          if (
            state.gameType === 'abacus-numeral' &&
            state.flippedCards.length === 1 &&
            !isFlipped &&
            !isMatched
          ) {
            const firstFlippedCard = state.flippedCards[0]

            // If first card is abacus, only numeral cards should be clickable
            if (firstFlippedCard.type === 'abacus' && card.type !== 'number') {
              isValidForSelection = false
              isDimmed = true
            }
            // If first card is numeral, only abacus cards should be clickable
            else if (firstFlippedCard.type === 'number' && card.type !== 'abacus') {
              isValidForSelection = false
              isDimmed = true
            }
            // Also check if it's a potential match by number
            else if (
              (firstFlippedCard.type === 'abacus' &&
                card.type === 'number' &&
                card.number !== firstFlippedCard.number) ||
              (firstFlippedCard.type === 'number' &&
                card.type === 'abacus' &&
                card.number !== firstFlippedCard.number)
            ) {
              // Don't completely disable, but could add subtle visual hint for non-matching numbers
              // For now, keep all valid type combinations clickable
            }
          }

          return (
            <div
              key={card.id}
              ref={enableMultiplayerPresence ? setCardRef(card.id) : undefined}
              data-component="matching-card"
              data-card-id={card.id}
              data-card-number={card.number}
              data-card-type={card.type}
              data-card-matched={isMatched ? 'true' : 'false'}
              data-card-flipped={isFlipped ? 'true' : 'false'}
              className={css({
                aspectRatio: '3/4',
                // Fully responsive card sizing - no fixed pixel sizes
                width: '100%',
                minWidth: '100px',
                maxWidth: '200px',
                // Dimming effect for invalid cards
                opacity: isDimmed ? 0.3 : 1,
                transition: 'opacity 0.3s ease',
                filter: isDimmed ? 'grayscale(0.7)' : 'none',
                position: 'relative',
                // Shake animation for mismatched cards
                animation: shouldShake ? 'cardShake 0.5s ease-in-out' : 'none',
              })}
              onMouseEnter={
                enableMultiplayerPresence && hoverCard
                  ? () => {
                      // Only send hover if it's your turn and card is not matched
                      if (!isMatched && isMyTurn) {
                        hoverCard(card.id)
                      }
                    }
                  : undefined
              }
              onMouseLeave={
                enableMultiplayerPresence && hoverCard
                  ? () => {
                      // Clear hover state when mouse leaves card
                      if (!isMatched && isMyTurn) {
                        hoverCard(null)
                      }
                    }
                  : undefined
              }
            >
              {renderCard({
                card,
                isFlipped,
                isMatched,
                onClick: () => (isValidForSelection ? handleCardClick(card.id) : undefined),
                disabled: state.isProcessingMove || !isValidForSelection,
              })}
            </div>
          )
        })}
      </div>

      {/* Processing Overlay */}
      {state.isProcessingMove && (
        <div
          className={css({
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.1)',
            zIndex: 999,
            pointerEvents: 'none',
          })}
        />
      )}

      {/* Animated Hover Avatars (multiplayer only) */}
      {enableMultiplayerPresence &&
        state.playerHovers &&
        Object.entries(state.playerHovers)
          .filter(([playerId]) => {
            // Only show hover avatars for REMOTE players (not the current user's own players)
            // This provides "presence" for opponents without cluttering your own view
            const playerMetadata = state.playerMetadata?.[playerId]
            const isRemotePlayer = playerMetadata?.userId !== viewerId
            // Also ensure it's the current player's turn (so we only show active hovers)
            const isCurrentPlayer = playerId === state.currentPlayer
            return isRemotePlayer && isCurrentPlayer
          })
          .map(([playerId, cardId]) => {
            const playerInfo = getPlayerHoverInfo(playerId)
            // Get card element if player is hovering (cardId might be null)
            const cardElement = cardId ? (cardRefs.current.get(cardId) ?? null) : null
            // Check if it's this player's turn
            const isPlayersTurn = state.currentPlayer === playerId
            // Check if the card being hovered is flipped
            const hoveredCard = cardId ? state.gameCards.find((c) => c.id === cardId) : null
            const isCardFlipped = hoveredCard
              ? state.flippedCards.some((c) => c.id === hoveredCard.id) || hoveredCard.matched
              : false

            if (!playerInfo) return null

            // Render avatar even if no cardElement (it will handle hiding itself)
            return (
              <HoverAvatar
                key={playerId} // Key by playerId keeps component alive across card changes!
                playerId={playerId}
                playerInfo={playerInfo}
                cardElement={cardElement}
                isPlayersTurn={isPlayersTurn}
                isCardFlipped={isCardFlipped}
              />
            )
          })}
    </div>
  )
}

// Add shake animation for mismatched cards
const cardShakeAnimation = `
@keyframes cardShake {
  0%, 100% { transform: translateX(0) rotate(0deg); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-8px) rotate(-2deg); }
  20%, 40%, 60%, 80% { transform: translateX(8px) rotate(2deg); }
}
`

// Inject animation styles
if (typeof document !== 'undefined' && !document.getElementById('memory-grid-animations')) {
  const style = document.createElement('style')
  style.id = 'memory-grid-animations'
  style.textContent = cardShakeAnimation
  document.head.appendChild(style)
}
