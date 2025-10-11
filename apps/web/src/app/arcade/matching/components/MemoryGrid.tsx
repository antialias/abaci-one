'use client'

import { animated, useSpring } from '@react-spring/web'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useViewerId } from '@/hooks/useViewerId'
import { css } from '../../../../../styled-system/css'
import { useMemoryPairs } from '../context/MemoryPairsContext'
import { getGridConfiguration } from '../utils/cardGeneration'
import { GameCard } from './GameCard'

// Helper function to calculate optimal grid dimensions
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

// Animated hover avatar component
function HoverAvatar({
  playerId,
  playerInfo,
  cardElement,
  isPlayersTurn,
  isCardFlipped,
}: {
  playerId: string
  playerInfo: { emoji: string; name: string; color?: string }
  cardElement: HTMLElement | null
  isPlayersTurn: boolean
  isCardFlipped: boolean
}) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const isFirstRender = useRef(true)

  // Update position when card element changes
  useEffect(() => {
    if (cardElement) {
      const rect = cardElement.getBoundingClientRect()
      // Calculate the center of the card for avatar positioning
      const avatarCenterX = rect.left + rect.width / 2
      const avatarCenterY = rect.top + rect.height / 2

      setPosition({
        x: avatarCenterX,
        y: avatarCenterY,
      })
    }
  }, [cardElement])

  // Smooth spring animation for position changes
  const springProps = useSpring({
    x: position?.x ?? 0,
    y: position?.y ?? 0,
    // Hide avatar if: no position, not player's turn, no card element, OR card is flipped
    opacity: position && isPlayersTurn && cardElement && !isCardFlipped ? 1 : 0,
    config: {
      tension: 280,
      friction: 60,
      mass: 1,
    },
    immediate: isFirstRender.current, // Skip animation on first render only
  })

  // Clear first render flag after initial render
  useEffect(() => {
    if (position && isFirstRender.current) {
      isFirstRender.current = false
    }
  }, [position])

  // Don't render until we have a position
  if (!position) return null

  return (
    <animated.div
      style={{
        position: 'fixed',
        // Don't use translate, just position directly at the calculated point
        left: springProps.x.to((x) => `${x}px`),
        top: springProps.y.to((y) => `${y}px`),
        opacity: springProps.opacity,
        width: '80px',
        height: '80px',
        marginLeft: '-40px', // Center horizontally (half of width)
        marginTop: '-40px', // Center vertically (half of height)
        borderRadius: '50%',
        background: playerInfo.color || 'linear-gradient(135deg, #667eea, #764ba2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '48px',
        // 3D elevation effect
        boxShadow:
          '0 12px 30px rgba(0,0,0,0.5), 0 6px 12px rgba(0,0,0,0.4), 0 0 40px rgba(102, 126, 234, 0.8)',
        border: '4px solid white',
        zIndex: 1000,
        pointerEvents: 'none',
        filter: 'drop-shadow(0 0 12px rgba(102, 126, 234, 0.9))',
      }}
      className={css({
        animation: 'hoverFloat 2s ease-in-out infinite',
      })}
      title={`${playerInfo.name} is considering this card`}
    >
      {playerInfo.emoji}
    </animated.div>
  )
}

export function MemoryGrid() {
  const { state, flipCard, hoverCard, gameMode } = useMemoryPairs()
  const { data: viewerId } = useViewerId()

  // Track card element refs for positioning hover avatars
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map())

  // Check if it's the local player's turn
  const isMyTurn = useMemo(() => {
    if (gameMode === 'single') return true // Always your turn in single player

    // In local games, all players belong to current user, so always their turn
    // In room games, check if current player belongs to this user
    const currentPlayerMetadata = state.playerMetadata?.[state.currentPlayer]
    return currentPlayerMetadata?.userId === viewerId
  }, [state.currentPlayer, state.playerMetadata, viewerId, gameMode])

  // Hooks must be called before early return
  const gridConfig = useMemo(() => getGridConfiguration(state.difficulty), [state.difficulty])
  const gridDimensions = useGridDimensions(gridConfig, state.gameCards.length)

  if (!state.gameCards.length) {
    return null
  }

  const handleCardClick = (cardId: string) => {
    flipCard(cardId)
  }

  // Get player metadata for hover avatars
  const getPlayerHoverInfo = (playerId: string) => {
    // Get player info from game state metadata
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
              ref={setCardRef(card.id)}
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
              })}
              onMouseEnter={() => {
                // Only send hover if it's your turn and card is not matched
                if (hoverCard && !isMatched && isMyTurn) {
                  hoverCard(card.id)
                }
              }}
              onMouseLeave={() => {
                // Clear hover state when mouse leaves card
                if (hoverCard && !isMatched && isMyTurn) {
                  hoverCard(null)
                }
              }}
            >
              <GameCard
                card={card}
                isFlipped={isFlipped}
                isMatched={isMatched}
                onClick={() => (isValidForSelection ? handleCardClick(card.id) : undefined)}
                disabled={state.isProcessingMove || !isValidForSelection}
              />
            </div>
          )
        })}
      </div>

      {/* Mismatch Feedback */}
      {state.showMismatchFeedback && (
        <div
          className={css({
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'linear-gradient(135deg, #ff6b6b, #ee5a24)',
            color: 'white',
            padding: '16px 24px',
            borderRadius: '16px',
            fontSize: '18px',
            fontWeight: 'bold',
            boxShadow: '0 8px 25px rgba(255, 107, 107, 0.4)',
            zIndex: 1000,
            animation: 'shake 0.5s ease-in-out',
          })}
        >
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            })}
          >
            <span>❌</span>
            <span>Not a match! Try again.</span>
          </div>
        </div>
      )}

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

      {/* Animated Hover Avatars - Rendered as fixed positioned elements that smoothly transition */}
      {/* Render one avatar per player - key by playerId to keep component alive */}
      {state.playerHovers &&
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
            const cardElement = cardId ? cardRefs.current.get(cardId) : null
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

// Add animations for mismatch feedback and hover avatars
const gridAnimations = `
@keyframes shake {
  0%, 100% { transform: translate(-50%, -50%) translateX(0); }
  25% { transform: translate(-50%, -50%) translateX(-5px); }
  75% { transform: translate(-50%, -50%) translateX(5px); }
}

@keyframes hoverFloat {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-6px);
  }
}
`

// Inject animation styles
if (typeof document !== 'undefined' && !document.getElementById('memory-grid-animations')) {
  const style = document.createElement('style')
  style.id = 'memory-grid-animations'
  style.textContent = gridAnimations
  document.head.appendChild(style)
}
