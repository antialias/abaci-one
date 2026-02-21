'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
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

// Orientation rotation utilities

export function normalizeAngleDelta(from: number, to: number): 90 | -90 | 180 {
  const delta = (((to - from) % 360) + 540) % 360 - 180
  if (delta === 90) return 90
  if (delta === -90) return -90
  return 180
}

/** Counter-clockwise rotation (counters CW device rotation): (c, r) → (cols-1-c)*rows + r */
export function rotateCCW<T>(items: T[], cols: number, rows: number): T[] {
  const result = new Array<T>(items.length)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const srcIdx = r * cols + c
      const dstIdx = (cols - 1 - c) * rows + r
      result[dstIdx] = items[srcIdx]
    }
  }
  return result
}

/** Clockwise rotation (counters CCW device rotation): (c, r) → c*rows + (rows-1-r) */
export function rotateCW<T>(items: T[], cols: number, rows: number): T[] {
  const result = new Array<T>(items.length)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const srcIdx = r * cols + c
      const dstIdx = c * rows + (rows - 1 - r)
      result[dstIdx] = items[srcIdx]
    }
  }
  return result
}

/** 180° rotation: reverse the array */
export function rotate180<T>(items: T[]): T[] {
  return [...items].reverse()
}

// FLIP animation hook for smooth card position transitions
function useFlipAnimation(
  cardRefs: React.RefObject<Map<string, HTMLElement>>,
  triggerKey: number
) {
  const positionsRef = useRef<Map<string, DOMRect>>(new Map())

  const capturePositions = useCallback(() => {
    const positions = new Map<string, DOMRect>()
    cardRefs.current?.forEach((el, id) => {
      positions.set(id, el.getBoundingClientRect())
    })
    positionsRef.current = positions
  }, [cardRefs])

  // Play FLIP animation after state update causes re-render
  useLayoutEffect(() => {
    if (triggerKey === 0) return // Skip initial render
    const oldPositions = positionsRef.current
    if (oldPositions.size === 0) return

    cardRefs.current?.forEach((el, id) => {
      const oldRect = oldPositions.get(id)
      if (!oldRect) return

      const newRect = el.getBoundingClientRect()
      const dx = oldRect.left - newRect.left
      const dy = oldRect.top - newRect.top

      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return

      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: 'translate(0, 0)' },
        ],
        { duration: 400, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' }
      )
    })
  }, [triggerKey, cardRefs])

  return { capturePositions }
}

// Custom hook to calculate proper grid dimensions for consistent r×c layout
function useGridDimensions(gridConfig: any, totalCards: number, locked: boolean) {
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
    if (locked) return // Don't recalculate during gameplay

    const updateGrid = () => {
      if (typeof window === 'undefined') return

      const aspectRatio = window.innerWidth / window.innerHeight
      setGridDimensions(calculateOptimalGrid(totalCards, aspectRatio, gridConfig))
    }

    updateGrid()
    window.addEventListener('resize', updateGrid)
    return () => window.removeEventListener('resize', updateGrid)
  }, [gridConfig, totalCards, locked])

  return gridDimensions
}

// Type definitions
export interface MemoryGridState<TCard = any> {
  gameCards: TCard[]
  flippedCards: TCard[]
  showMismatchFeedback: boolean
  isProcessingMove: boolean
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

  // Smart dimming (optional) — externalizes game-specific dimming logic
  shouldDimCard?: (card: TCard, firstFlippedCard: TCard) => boolean

  /** Lock grid dimensions to prevent reshuffle during gameplay (default: true) */
  isLocked?: boolean

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
export function MemoryGrid<TCard extends { id: string; matched: boolean }>({
  state,
  gridConfig,
  flipCard,
  renderCard,
  enableMultiplayerPresence = false,
  hoverCard,
  viewerId,
  gameMode = 'single',
  shouldDimCard,
  isLocked,
}: MemoryGridProps<TCard>) {
  const locked = isLocked ?? true
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map())
  const gridDimensions = useGridDimensions(gridConfig, state.gameCards.length, locked)

  // --- Orientation-aware grid rotation state ---
  const [orientationState, setOrientationState] = useState<{
    cardOrder: (string | null)[] // Card IDs (null = empty cell spacer)
    cols: number
    rows: number
  } | null>(null)
  const [rotationCount, setRotationCount] = useState(0)
  const isOrientationChangeRef = useRef(false)
  const prevAngleRef = useRef<number | null>(null)

  // FLIP animation
  const { capturePositions } = useFlipAnimation(cardRefs, rotationCount)

  // --- Scale-to-fit state ---
  const [scaleFactor, setScaleFactor] = useState(1)
  const gridContainerRef = useRef<HTMLDivElement>(null)
  const outerContainerRef = useRef<HTMLDivElement>(null)
  const naturalSizeRef = useRef<{ w: number; h: number } | null>(null)

  // Check if it's the local player's turn (for multiplayer mode)
  const isMyTurn = useMemo(() => {
    if (!enableMultiplayerPresence || gameMode === 'single') return true
    const currentPlayerMetadata = state.playerMetadata?.[state.currentPlayer || '']
    return currentPlayerMetadata?.userId === viewerId
  }, [enableMultiplayerPresence, gameMode, state.currentPlayer, state.playerMetadata, viewerId])

  // Build card ID → card lookup for rendering orientation-reordered cards
  const cardById = useMemo(() => {
    const map = new Map<string, TCard>()
    for (const card of state.gameCards) {
      map.set(card.id, card)
    }
    return map
  }, [state.gameCards])

  // Effective grid dimensions and card order
  const effectiveCols = orientationState?.cols ?? gridDimensions.columns
  const effectiveRows = orientationState?.rows ?? gridDimensions.rows
  const displayOrder: (string | null)[] = useMemo(() => {
    if (orientationState) return orientationState.cardOrder
    // Pad with nulls for uneven grids
    const totalCells = gridDimensions.columns * gridDimensions.rows
    const order: (string | null)[] = state.gameCards.map((c) => c.id)
    while (order.length < totalCells) order.push(null)
    return order
  }, [orientationState, gridDimensions.columns, gridDimensions.rows, state.gameCards])

  // --- Orientation change listener ---
  useEffect(() => {
    if (!locked) return
    if (typeof screen === 'undefined' || !screen.orientation) return

    const handleOrientationChange = () => {
      const newAngle = screen.orientation.angle
      const prevAngle = prevAngleRef.current
      if (prevAngle === null) {
        prevAngleRef.current = newAngle
        return
      }
      prevAngleRef.current = newAngle

      const delta = normalizeAngleDelta(prevAngle, newAngle)

      // Suppress scale-to-fit during orientation animation
      isOrientationChangeRef.current = true
      // Reset natural size so it recaptures after rotation renders
      naturalSizeRef.current = null
      setScaleFactor(1)
      setTimeout(() => {
        isOrientationChangeRef.current = false
      }, 500)

      // Capture current card positions for FLIP
      capturePositions()

      setOrientationState((prev) => {
        const currentCols = prev?.cols ?? gridDimensions.columns
        const currentRows = prev?.rows ?? gridDimensions.rows
        const totalCells = currentCols * currentRows
        const currentOrder: (string | null)[] =
          prev?.cardOrder ?? (() => {
            const order: (string | null)[] = state.gameCards.map((c) => c.id)
            while (order.length < totalCells) order.push(null)
            return order
          })()

        let newOrder: (string | null)[]
        let newCols: number
        let newRows: number

        if (delta === 90) {
          // Device rotated CW → counter-rotate CCW
          newOrder = rotateCCW(currentOrder, currentCols, currentRows)
          newCols = currentRows
          newRows = currentCols
        } else if (delta === -90) {
          // Device rotated CCW → counter-rotate CW
          newOrder = rotateCW(currentOrder, currentCols, currentRows)
          newCols = currentRows
          newRows = currentCols
        } else {
          // 180°
          newOrder = rotate180(currentOrder)
          newCols = currentCols
          newRows = currentRows
        }

        return { cardOrder: newOrder, cols: newCols, rows: newRows }
      })

      setRotationCount((c) => c + 1)
    }

    // Initialize angle tracking
    prevAngleRef.current = screen.orientation.angle

    screen.orientation.addEventListener('change', handleOrientationChange)
    return () => {
      screen.orientation.removeEventListener('change', handleOrientationChange)
    }
  }, [locked, gridDimensions.columns, gridDimensions.rows, state.gameCards, capturePositions])

  // Reset orientation state when unlocked (game reset)
  useEffect(() => {
    if (!locked) {
      setOrientationState(null)
      setRotationCount(0)
      setScaleFactor(1)
    }
  }, [locked])

  // Capture the grid's natural size when it first renders locked
  useLayoutEffect(() => {
    if (!locked) {
      naturalSizeRef.current = null
      return
    }
    const grid = gridContainerRef.current
    if (!grid || naturalSizeRef.current) return
    naturalSizeRef.current = { w: grid.scrollWidth, h: grid.scrollHeight }
  }, [locked, effectiveCols, effectiveRows])

  // --- Scale-to-fit on window resize (not orientation change) ---
  useEffect(() => {
    if (!locked) {
      setScaleFactor(1)
      return
    }

    const outer = outerContainerRef.current
    if (!outer) return

    let debounceTimer: ReturnType<typeof setTimeout>

    const computeScale = () => {
      if (isOrientationChangeRef.current) return
      const natural = naturalSizeRef.current
      if (!natural) return

      const availW = outer.clientWidth
      const availH = outer.clientHeight

      const factor = Math.min(availW / natural.w, availH / natural.h, 1.0)
      setScaleFactor(factor)
    }

    const observer = new ResizeObserver(() => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(computeScale, 50)
    })

    observer.observe(outer)
    return () => {
      clearTimeout(debounceTimer)
      observer.disconnect()
    }
  }, [locked])

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

  // Set card ref callback — always populate for FLIP animation
  const setCardRef = (cardId: string) => (element: HTMLDivElement | null) => {
    if (element) {
      cardRefs.current.set(cardId, element)
    } else {
      cardRefs.current.delete(cardId)
    }
  }

  return (
    <div
      ref={outerContainerRef}
      className={css({
        padding: { base: '12px', sm: '16px', md: '20px' },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: { base: '12px', sm: '16px', md: '20px' },
        // Fill parent so ResizeObserver tracks available space on viewport resize
        flex: 1,
        minHeight: 0,
        width: '100%',
        overflow: 'hidden',
      })}
    >
      {/* Cards Grid - Consistent r×c Layout */}
      <div
        ref={gridContainerRef}
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
          gridTemplateColumns: `repeat(${effectiveCols}, 1fr)`,
          gridTemplateRows: `repeat(${effectiveRows}, 1fr)`,
          transform: scaleFactor < 1 ? `scale(${scaleFactor})` : undefined,
          transformOrigin: 'top center',
        }}
      >
        {displayOrder.map((cardId, idx) => {
          if (cardId === null) {
            // Invisible spacer for uneven grid rotation
            return <div key={`spacer-${idx}`} style={{ visibility: 'hidden' }} />
          }

          const card = cardById.get(cardId)
          if (!card) return null

          const isFlipped = state.flippedCards.some((c) => c.id === card.id) || card.matched
          const isMatched = card.matched
          const shouldShake =
            state.showMismatchFeedback && state.flippedCards.some((c) => c.id === card.id)

          // Smart card filtering via shouldDimCard prop
          let isValidForSelection = true
          let isDimmed = false

          if (shouldDimCard && state.flippedCards.length === 1 && !isFlipped && !isMatched) {
            const firstFlippedCard = state.flippedCards[0]
            isDimmed = shouldDimCard(card, firstFlippedCard)
            isValidForSelection = !isDimmed
          }

          return (
            <div
              key={card.id}
              ref={setCardRef(card.id)}
              data-component="matching-card"
              data-card-id={card.id}
              data-card-number={(card as any).number}
              data-card-type={(card as any).type}
              data-card-matched={isMatched ? 'true' : 'false'}
              data-card-flipped={isFlipped ? 'true' : 'false'}
              className={css({
                aspectRatio: '3/4',
                width: '100%',
                minWidth: '100px',
                maxWidth: '200px',
                opacity: isDimmed ? 0.3 : 1,
                transition: 'opacity 0.3s ease',
                filter: isDimmed ? 'grayscale(0.7)' : 'none',
                position: 'relative',
                animation: shouldShake ? 'cardShake 0.5s ease-in-out' : 'none',
              })}
              onMouseEnter={
                enableMultiplayerPresence && hoverCard
                  ? () => {
                      if (!isMatched && isMyTurn) {
                        hoverCard(card.id)
                      }
                    }
                  : undefined
              }
              onMouseLeave={
                enableMultiplayerPresence && hoverCard
                  ? () => {
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
            const playerMetadata = state.playerMetadata?.[playerId]
            const isRemotePlayer = playerMetadata?.userId !== viewerId
            const isCurrentPlayer = playerId === state.currentPlayer
            return isRemotePlayer && isCurrentPlayer
          })
          .map(([playerId, cardId]) => {
            const playerInfo = getPlayerHoverInfo(playerId)
            const cardElement = cardId ? (cardRefs.current.get(cardId) ?? null) : null
            const isPlayersTurn = state.currentPlayer === playerId
            const hoveredCard = cardId ? state.gameCards.find((c) => c.id === cardId) : null
            const isCardFlipped = hoveredCard
              ? state.flippedCards.some((c) => c.id === hoveredCard.id) || hoveredCard.matched
              : false

            if (!playerInfo) return null

            return (
              <HoverAvatar
                key={playerId}
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
