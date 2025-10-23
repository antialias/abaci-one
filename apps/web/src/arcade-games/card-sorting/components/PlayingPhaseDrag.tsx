'use client'

import { css } from '../../../../styled-system/css'
import { useCardSorting } from '../Provider'
import { useState, useEffect, useRef } from 'react'
import { useSpring, animated } from '@react-spring/web'
import type { SortingCard } from '../types'

// Add celebration animations
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `
    @keyframes celebrate {
      0%, 100% {
        transform: scale(1) rotate(0deg);
        background-position: 0% 50%;
      }
      25% {
        transform: scale(1.2) rotate(-10deg);
        background-position: 100% 50%;
      }
      50% {
        transform: scale(1.3) rotate(0deg);
        background-position: 0% 50%;
      }
      75% {
        transform: scale(1.2) rotate(10deg);
        background-position: 100% 50%;
      }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.8; transform: scale(1.1); }
    }
    @keyframes correctArrowGlow {
      0%, 100% {
        filter: brightness(1) drop-shadow(0 0 8px rgba(34, 197, 94, 0.6));
        opacity: 0.9;
      }
      50% {
        filter: brightness(1.3) drop-shadow(0 0 15px rgba(34, 197, 94, 0.9));
        opacity: 1;
      }
    }
    @keyframes correctBadgePulse {
      0%, 100% {
        transform: translate(-50%, -50%) scale(1);
      }
      50% {
        transform: translate(-50%, -50%) scale(1.15);
      }
    }
  `
  document.head.appendChild(style)
}

interface CardState {
  x: number // % of viewport width (0-100)
  y: number // % of viewport height (0-100)
  rotation: number // degrees
  zIndex: number
}

/**
 * Infers the sequence order of cards based on their spatial positions.
 * Uses a horizontal left-to-right ordering with some vertical tolerance.
 *
 * Algorithm:
 * 1. Group cards into horizontal "lanes" (vertical tolerance)
 * 2. Within each lane, sort left-to-right by x position
 * 3. Sort lanes top-to-bottom
 * 4. Flatten to get final sequence
 *
 * Note: Positions are in viewport percentages (0-100)
 */
function inferSequenceFromPositions(
  cardStates: Map<string, CardState>,
  allCards: SortingCard[]
): SortingCard[] {
  const VERTICAL_TOLERANCE = 8 // Cards within 8% of viewport height are in the same "lane"

  // Get all positioned cards
  const positionedCards = allCards
    .map((card) => {
      const state = cardStates.get(card.id)
      if (!state) return null
      return { card, ...state }
    })
    .filter(
      (
        item
      ): item is { card: SortingCard; x: number; y: number; rotation: number; zIndex: number } =>
        item !== null
    )

  if (positionedCards.length === 0) return []

  // Sort by x position first
  const sortedByX = [...positionedCards].sort((a, b) => a.x - b.x)

  // Group into lanes
  const lanes: (typeof positionedCards)[] = []

  for (const item of sortedByX) {
    // Find a lane this card fits into (similar y position)
    const matchingLane = lanes.find((lane) => {
      // Check if card's y is within tolerance of lane's average y
      const laneAvgY = lane.reduce((sum, c) => sum + c.y, 0) / lane.length
      return Math.abs(item.y - laneAvgY) < VERTICAL_TOLERANCE
    })

    if (matchingLane) {
      matchingLane.push(item)
    } else {
      lanes.push([item])
    }
  }

  // Sort lanes top-to-bottom
  lanes.sort((laneA, laneB) => {
    const avgYA = laneA.reduce((sum, c) => sum + c.y, 0) / laneA.length
    const avgYB = laneB.reduce((sum, c) => sum + c.y, 0) / laneB.length
    return avgYA - avgYB
  })

  // Within each lane, sort left-to-right
  for (const lane of lanes) {
    lane.sort((a, b) => a.x - b.x)
  }

  // Flatten to get final sequence
  return lanes.flat().map((item) => item.card)
}

/**
 * Animated arrow component using react-spring for smooth movements
 */
function AnimatedArrow({
  fromCard,
  toCard,
  isCorrect,
  sequenceNumber,
  isDragging,
  isResizing,
  viewportWidth,
  viewportHeight,
}: {
  fromCard: CardState
  toCard: CardState
  isCorrect: boolean
  sequenceNumber: number
  isDragging: boolean
  isResizing: boolean
  viewportWidth: number
  viewportHeight: number
}) {
  // Convert percentage positions to pixels
  const fromPx = {
    x: (fromCard.x / 100) * viewportWidth,
    y: (fromCard.y / 100) * viewportHeight,
  }
  const toPx = {
    x: (toCard.x / 100) * viewportWidth,
    y: (toCard.y / 100) * viewportHeight,
  }

  // Calculate arrow position (from center of current card to center of next card)
  const fromX = fromPx.x + 70 // 70 = half of card width (140px)
  const fromY = fromPx.y + 90 // 90 = half of card height (180px)
  const toX = toPx.x + 70
  const toY = toPx.y + 90

  // Calculate angle and distance
  const dx = toX - fromX
  const dy = toY - fromY
  const angle = Math.atan2(dy, dx) * (180 / Math.PI)
  const distance = Math.sqrt(dx * dx + dy * dy)

  // Use spring animation for arrow position and size
  // Disable animation when dragging or resizing
  const springProps = useSpring({
    fromX,
    fromY,
    distance,
    angle,
    immediate: isDragging || isResizing,
    config: {
      tension: 300,
      friction: 30,
    },
  })

  // Don't draw arrow if cards are too close
  if (distance < 80) return null

  return (
    <animated.div
      style={{
        position: 'absolute',
        left: springProps.fromX.to((val) => `${val}px`),
        top: springProps.fromY.to((val) => `${val}px`),
        width: springProps.distance.to((val) => `${val}px`),
        height: isCorrect ? '4px' : '3px',
        transformOrigin: '0 50%',
        transform: springProps.angle.to((val) => `rotate(${val}deg)`),
        pointerEvents: 'none',
        zIndex: 0,
        animation: isCorrect ? 'correctArrowGlow 1.5s ease-in-out infinite' : 'none',
      }}
    >
      {/* Arrow line */}
      <div
        style={{
          width: '100%',
          height: '100%',
          background: isCorrect
            ? 'linear-gradient(90deg, rgba(34, 197, 94, 0.7) 0%, rgba(34, 197, 94, 0.9) 100%)'
            : 'linear-gradient(90deg, rgba(251, 146, 60, 0.6) 0%, rgba(251, 146, 60, 0.8) 100%)',
          position: 'relative',
        }}
      >
        {/* Arrow head */}
        <div
          style={{
            position: 'absolute',
            right: '-8px',
            top: '50%',
            width: '0',
            height: '0',
            borderLeft: isCorrect
              ? '10px solid rgba(34, 197, 94, 0.9)'
              : '10px solid rgba(251, 146, 60, 0.8)',
            borderTop: '6px solid transparent',
            borderBottom: '6px solid transparent',
            transform: 'translateY(-50%)',
          }}
        />
        {/* Sequence number badge */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            background: isCorrect ? 'rgba(34, 197, 94, 0.95)' : 'rgba(251, 146, 60, 0.95)',
            color: 'white',
            borderRadius: '50%',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 'bold',
            border: '2px solid white',
            boxShadow: isCorrect ? '0 0 12px rgba(34, 197, 94, 0.6)' : '0 2px 4px rgba(0,0,0,0.2)',
            animation: isCorrect ? 'correctBadgePulse 1.5s ease-in-out infinite' : 'none',
          }}
        >
          {sequenceNumber}
        </div>
      </div>
    </animated.div>
  )
}

/**
 * Animated card component using react-spring for smooth movements
 */
function AnimatedCard({
  card,
  cardState,
  isDragging,
  isResizing,
  isSpectating,
  isCorrect,
  viewportWidth,
  viewportHeight,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  card: SortingCard
  cardState: CardState
  isDragging: boolean
  isResizing: boolean
  isSpectating: boolean
  isCorrect: boolean
  viewportWidth: number
  viewportHeight: number
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
}) {
  // Convert percentage position to pixels for rendering
  const pixelPos = {
    x: (cardState.x / 100) * viewportWidth,
    y: (cardState.y / 100) * viewportHeight,
  }

  // Use spring animation for position and rotation
  // Disable animation when:
  // - User is dragging (for immediate response)
  // - Viewport is resizing (for instant repositioning)
  const springProps = useSpring({
    left: pixelPos.x,
    top: pixelPos.y,
    rotation: cardState.rotation,
    immediate: isDragging || isResizing, // Instant updates when dragging or resizing
    config: {
      tension: 300,
      friction: 30,
    },
  })

  return (
    <animated.div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={css({
        position: 'absolute',
        width: '140px',
        height: '180px',
        cursor: isSpectating ? 'default' : 'grab',
        touchAction: 'none',
        userSelect: 'none',
        transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
        borderRadius: '12px',
        overflow: 'hidden',
      })}
      style={{
        left: springProps.left.to((val) => `${val}px`),
        top: springProps.top.to((val) => `${val}px`),
        transform: springProps.rotation.to((val) => `rotate(${val}deg)`),
        zIndex: cardState.zIndex,
        boxShadow: isDragging ? '0 20px 40px rgba(0, 0, 0, 0.3)' : '0 4px 8px rgba(0, 0, 0, 0.15)',
      }}
    >
      <div
        className={css({
          width: '100%',
          height: '100%',
          background: 'white',
          borderRadius: '12px',
          border: isCorrect ? '3px solid #22c55e' : '3px solid #0369a1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          // Clip content to border-box so rounded corners work properly
          backgroundClip: 'border-box',
        })}
        dangerouslySetInnerHTML={{ __html: card.svgContent }}
      />
    </animated.div>
  )
}

export function PlayingPhaseDrag() {
  const {
    state,
    insertCard,
    checkSolution,
    revealNumbers,
    goToSetup,
    updateCardPositions,
    canCheckSolution,
    elapsedTime,
    isSpectating,
  } = useCardSorting()

  const containerRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef<{
    cardId: string
    offsetX: number
    offsetY: number
    startX: number
    startY: number
    initialRotation: number
  } | null>(null)

  // Track card positions and visual states (UI only - not game state)
  const [cardStates, setCardStates] = useState<Map<string, CardState>>(new Map())
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null)
  const [nextZIndex, setNextZIndex] = useState(1)

  // Track viewport dimensions for responsive positioning
  const [viewportDimensions, setViewportDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1000,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  })

  // Track if we're currently resizing to disable spring animations
  const [isResizing, setIsResizing] = useState(false)
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Throttle position updates during drag (every 100ms)
  const lastSyncTimeRef = useRef<number>(0)

  // Track when we're waiting to check solution
  const [waitingToCheck, setWaitingToCheck] = useState(false)
  const cardsToInsertRef = useRef<SortingCard[]>([])
  const currentInsertIndexRef = useRef(0)

  // Handle viewport resize
  useEffect(() => {
    const handleResize = () => {
      // Set resizing flag to disable spring animations
      setIsResizing(true)

      // Update viewport dimensions immediately
      setViewportDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      })

      // Clear any existing timeout
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }

      // After 150ms of no resize events, re-enable spring animations
      resizeTimeoutRef.current = setTimeout(() => {
        setIsResizing(false)
      }, 150)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
    }
  }, [])

  // Initialize card positions when game starts or restarts
  useEffect(() => {
    // Reset when entering playing phase or when cards change
    const allCards = [
      ...state.availableCards,
      ...state.placedCards.filter((c): c is SortingCard => c !== null),
    ]

    // Only initialize if we have cards and either:
    // 1. No card states exist yet, OR
    // 2. The number of cards has changed (new game started)
    const shouldInitialize =
      allCards.length > 0 && (cardStates.size === 0 || cardStates.size !== allCards.length)

    if (!shouldInitialize) return

    const newStates = new Map<string, CardState>()

    // Check if we have server positions to restore from
    const hasServerPositions = state.cardPositions && state.cardPositions.length === allCards.length

    allCards.forEach((card, index) => {
      const serverPos = state.cardPositions?.find((p) => p.cardId === card.id)

      if (hasServerPositions && serverPos) {
        // Restore from server (already in percentages)
        newStates.set(card.id, {
          x: serverPos.x,
          y: serverPos.y,
          rotation: serverPos.rotation,
          zIndex: serverPos.zIndex,
        })
      } else {
        // Generate scattered positions that look like cards thrown on a table
        // Card is ~140px wide on ~1000px viewport = ~14% of width
        // Card is ~180px tall on ~800px viewport = ~22.5% of height
        const xMargin = 5 // 5% margin on sides
        const yMargin = 15 // 15% margin for top UI

        // Create a more natural distribution by using clusters
        // Divide the play area into a rough grid, then add randomness
        const numCards = allCards.length
        const cols = Math.ceil(Math.sqrt(numCards * 1.5)) // Slightly wider grid
        const rows = Math.ceil(numCards / cols)

        const row = Math.floor(index / cols)
        const col = index % cols

        // Available space after margins
        const availableWidth = 100 - 2 * xMargin - 14
        const availableHeight = 100 - yMargin - 22.5

        // Grid cell size
        const cellWidth = availableWidth / cols
        const cellHeight = availableHeight / rows

        // Base position in grid (centered in cell)
        const baseX = xMargin + col * cellWidth + cellWidth / 2 - 7 // -7 to center card
        const baseY = yMargin + row * cellHeight + cellHeight / 2 - 11.25 // -11.25 to center card

        // Add significant randomness to make it look scattered (±40% of cell size)
        const offsetX = (Math.random() - 0.5) * cellWidth * 0.8
        const offsetY = (Math.random() - 0.5) * cellHeight * 0.8

        // Ensure we stay within bounds
        const x = Math.max(xMargin, Math.min(100 - 14 - xMargin, baseX + offsetX))
        const y = Math.max(yMargin, Math.min(100 - 22.5, baseY + offsetY))

        // More varied rotation for natural look
        const rotation = (Math.random() - 0.5) * 40 // -20 to 20 degrees

        // Randomize z-index for natural stacking
        const zIndex = Math.floor(Math.random() * numCards)

        newStates.set(card.id, { x, y, rotation, zIndex })
      }
    })

    setCardStates(newStates)
    setNextZIndex(Math.max(...Array.from(newStates.values()).map((s) => s.zIndex)) + 1)

    // If we generated new positions (not restored from server), send them to server
    if (!hasServerPositions && !isSpectating) {
      const positions = Array.from(newStates.entries()).map(([id, cardState]) => ({
        cardId: id,
        x: cardState.x,
        y: cardState.y,
        rotation: cardState.rotation,
        zIndex: cardState.zIndex,
      }))
      updateCardPositions(positions)
    }
  }, [
    state.availableCards.length,
    state.placedCards.length,
    state.gameStartTime,
    state.cardPositions?.length,
    cardStates.size,
    isSpectating,
    updateCardPositions,
  ])

  // Sync server position updates (for spectators and multi-window sync)
  useEffect(() => {
    if (!state.cardPositions || state.cardPositions.length === 0) return
    if (cardStates.size === 0) return

    // Check if server positions differ from current positions
    let needsUpdate = false
    const newStates = new Map(cardStates)

    for (const serverPos of state.cardPositions) {
      const currentState = cardStates.get(serverPos.cardId)
      if (!currentState) continue

      // Compare percentages directly (tolerance: 0.5%)
      if (
        Math.abs(currentState.x - serverPos.x) > 0.5 ||
        Math.abs(currentState.y - serverPos.y) > 0.5 ||
        Math.abs(currentState.rotation - serverPos.rotation) > 1 ||
        currentState.zIndex !== serverPos.zIndex
      ) {
        needsUpdate = true
        newStates.set(serverPos.cardId, {
          x: serverPos.x,
          y: serverPos.y,
          rotation: serverPos.rotation,
          zIndex: serverPos.zIndex,
        })
      }
    }

    if (needsUpdate && !draggingCardId) {
      // Only apply server updates if not currently dragging
      setCardStates(newStates)
    }
  }, [state.cardPositions, draggingCardId, cardStates])

  // Infer sequence from current positions
  const inferredSequence = inferSequenceFromPositions(cardStates, [
    ...state.availableCards,
    ...state.placedCards.filter((c): c is SortingCard => c !== null),
  ])

  // Format time display
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Handle pointer down (start drag)
  const handlePointerDown = (e: React.PointerEvent, cardId: string) => {
    if (isSpectating) return

    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    // Get current card state to calculate proper offset
    const currentCard = cardStates.get(cardId)
    if (!currentCard) return

    // Calculate offset from card's actual position (in pixels) to pointer
    // This accounts for rotation and prevents position jump
    const cardPixelX = (currentCard.x / 100) * viewportDimensions.width
    const cardPixelY = (currentCard.y / 100) * viewportDimensions.height
    const offsetX = e.clientX - cardPixelX
    const offsetY = e.clientY - cardPixelY

    dragStateRef.current = {
      cardId,
      offsetX,
      offsetY,
      startX: e.clientX,
      startY: e.clientY,
      initialRotation: currentCard.rotation,
    }

    setDraggingCardId(cardId)

    // Bring card to front
    setCardStates((prev) => {
      const newStates = new Map(prev)
      const cardState = newStates.get(cardId)
      if (cardState) {
        newStates.set(cardId, { ...cardState, zIndex: nextZIndex })
      }
      return newStates
    })
    setNextZIndex((prev) => prev + 1)
  }

  // Handle pointer move (dragging)
  const handlePointerMove = (e: React.PointerEvent, cardId: string) => {
    if (!dragStateRef.current || dragStateRef.current.cardId !== cardId) return

    const { offsetX, offsetY } = dragStateRef.current

    // Calculate new position in pixels
    const newXPx = e.clientX - offsetX
    const newYPx = e.clientY - offsetY

    // Convert to percentages
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const newX = (newXPx / viewportWidth) * 100
    const newY = (newYPx / viewportHeight) * 100

    // Calculate rotation based on drag velocity, adding to initial rotation
    const dragDeltaX = e.clientX - dragStateRef.current.startX
    const dragRotation = Math.max(-15, Math.min(15, dragDeltaX * 0.05))
    const rotation = dragStateRef.current.initialRotation + dragRotation

    setCardStates((prev) => {
      const newStates = new Map(prev)
      const cardState = newStates.get(cardId)
      if (cardState) {
        newStates.set(cardId, {
          ...cardState,
          x: newX,
          y: newY,
          rotation,
        })

        // Send real-time position updates (throttled to every 100ms)
        if (!isSpectating) {
          const now = Date.now()
          if (now - lastSyncTimeRef.current > 100) {
            lastSyncTimeRef.current = now
            const positions = Array.from(newStates.entries()).map(([id, state]) => ({
              cardId: id,
              x: state.x,
              y: state.y,
              rotation: state.rotation,
              zIndex: state.zIndex,
            }))
            updateCardPositions(positions)
          }
        }
      }
      return newStates
    })
  }

  // Handle pointer up (end drag)
  const handlePointerUp = (e: React.PointerEvent, cardId: string) => {
    if (!dragStateRef.current || dragStateRef.current.cardId !== cardId) return

    const target = e.currentTarget as HTMLElement
    target.releasePointerCapture(e.pointerId)

    // Reset rotation to slight random tilt
    const updatedStates = new Map(cardStates)
    const cardState = updatedStates.get(cardId)
    if (cardState) {
      updatedStates.set(cardId, {
        ...cardState,
        rotation: Math.random() * 10 - 5,
      })
      setCardStates(updatedStates)

      // Sync positions to server (already in percentages)
      if (!isSpectating) {
        const positions = Array.from(updatedStates.entries()).map(([id, state]) => ({
          cardId: id,
          x: state.x,
          y: state.y,
          rotation: state.rotation,
          zIndex: state.zIndex,
        }))
        updateCardPositions(positions)
      }
    }

    dragStateRef.current = null
    setDraggingCardId(null)
  }

  // For drag mode, check solution is available when we have a valid inferred sequence
  const canCheckSolutionDrag = inferredSequence.length === state.cardCount

  // Real-time check: is the current sequence correct?
  const isSequenceCorrect =
    canCheckSolutionDrag &&
    inferredSequence.every((card, index) => {
      const correctCard = state.correctOrder[index]
      return correctCard && card.id === correctCard.id
    })

  // Watch for server confirmations and insert next card or check solution
  useEffect(() => {
    if (!waitingToCheck) return

    const cardsToInsert = cardsToInsertRef.current
    const currentIndex = currentInsertIndexRef.current

    console.log('[PlayingPhaseDrag] useEffect check:', {
      waitingToCheck,
      currentIndex,
      totalCards: cardsToInsert.length,
      canCheckSolution,
    })

    // If all cards have been sent, wait for server to confirm all are placed
    if (currentIndex >= cardsToInsert.length) {
      if (canCheckSolution) {
        console.log('[PlayingPhaseDrag] ✅ Server confirmed all cards placed, checking solution')
        setWaitingToCheck(false)
        cardsToInsertRef.current = []
        currentInsertIndexRef.current = 0
        checkSolution()
      }
      return
    }

    // Send next card
    const card = cardsToInsert[currentIndex]
    const position = inferredSequence.findIndex((c) => c.id === card.id)
    console.log(
      `[PlayingPhaseDrag] 📥 Inserting card ${currentIndex + 1}/${cardsToInsert.length}: ${card.id} at position ${position}`
    )
    insertCard(card.id, position)
    currentInsertIndexRef.current++
  }, [waitingToCheck, canCheckSolution, checkSolution, insertCard, inferredSequence])

  // Custom check solution that uses the inferred sequence
  const handleCheckSolution = () => {
    if (isSpectating) return
    if (!canCheckSolutionDrag) return

    // Send the complete inferred sequence to the server
    checkSolution(inferredSequence)
  }

  return (
    <div
      className={css({
        width: '100%',
        height: '100%',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      })}
    >
      {/* Floating action buttons */}
      {!isSpectating && (
        <div
          className={css({
            position: 'absolute',
            top: '16px',
            right: '16px',
            display: 'flex',
            gap: '12px',
            zIndex: 10,
          })}
        >
          {/* Reveal Numbers Button */}
          {!state.showNumbers && (
            <button
              type="button"
              onClick={revealNumbers}
              title="Reveal Numbers"
              className={css({
                width: '56px',
                height: '56px',
                background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                border: '3px solid #f59e0b',
                borderRadius: '50%',
                fontSize: '24px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                _hover: {
                  transform: 'scale(1.1)',
                  boxShadow: '0 6px 20px rgba(245, 158, 11, 0.4)',
                },
              })}
            >
              👁️
            </button>
          )}

          {/* Check Solution Button with Label */}
          <div
            className={css({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
            })}
          >
            <button
              type="button"
              onClick={handleCheckSolution}
              disabled={!canCheckSolutionDrag}
              title="Check Solution"
              className={css({
                width: '64px',
                height: '64px',
                background: isSequenceCorrect
                  ? 'linear-gradient(135deg, #fbbf24, #f59e0b, #fbbf24)'
                  : canCheckSolutionDrag
                    ? 'linear-gradient(135deg, #bbf7d0, #86efac)'
                    : 'linear-gradient(135deg, #e5e7eb, #d1d5db)',
                border: '4px solid',
                borderColor: isSequenceCorrect
                  ? '#f59e0b'
                  : canCheckSolutionDrag
                    ? '#22c55e'
                    : '#9ca3af',
                borderRadius: '50%',
                fontSize: '32px',
                cursor: canCheckSolutionDrag ? 'pointer' : 'not-allowed',
                opacity: canCheckSolutionDrag ? 1 : 0.5,
                transition: isSequenceCorrect ? 'none' : 'all 0.2s ease',
                boxShadow: isSequenceCorrect
                  ? '0 0 30px rgba(245, 158, 11, 0.8), 0 0 60px rgba(245, 158, 11, 0.6)'
                  : '0 4px 12px rgba(0, 0, 0, 0.15)',
                animation: isSequenceCorrect ? 'celebrate 0.5s ease-in-out infinite' : 'none',
                backgroundSize: isSequenceCorrect ? '200% 200%' : '100% 100%',
                _hover:
                  canCheckSolutionDrag && !isSequenceCorrect
                    ? {
                        transform: 'scale(1.1)',
                        boxShadow: '0 6px 20px rgba(34, 197, 94, 0.4)',
                      }
                    : {},
              })}
              style={{
                animationName: isSequenceCorrect ? 'celebrate' : undefined,
              }}
            >
              ✓
            </button>
            <div
              className={css({
                fontSize: '13px',
                fontWeight: '700',
                color: isSequenceCorrect ? '#f59e0b' : canCheckSolutionDrag ? '#22c55e' : '#9ca3af',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                textShadow: isSequenceCorrect ? '0 0 10px rgba(245, 158, 11, 0.8)' : 'none',
                animation: isSequenceCorrect ? 'pulse 0.5s ease-in-out infinite' : 'none',
              })}
            >
              {isSequenceCorrect ? 'PERFECT!' : 'Done?'}
            </div>
          </div>
        </div>
      )}

      {/* Timer (minimal, top-left) */}
      <div
        className={css({
          position: 'absolute',
          top: '16px',
          left: '16px',
          padding: '8px 16px',
          background: 'rgba(255, 255, 255, 0.9)',
          border: '2px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '20px',
          fontSize: '16px',
          fontWeight: '600',
          color: '#0c4a6e',
          zIndex: 10,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        })}
      >
        ⏱️ {formatTime(elapsedTime)}
      </div>

      {/* Play area with freely positioned cards - full viewport */}
      <div
        ref={containerRef}
        className={css({
          width: '100vw',
          height: '100vh',
          position: 'absolute',
          top: 0,
          left: 0,
          background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
          overflow: 'hidden',
        })}
      >
        {/* Render arrows between cards in inferred sequence */}
        {inferredSequence.length > 1 &&
          inferredSequence.slice(0, -1).map((card, index) => {
            const currentCard = cardStates.get(card.id)
            const nextCard = cardStates.get(inferredSequence[index + 1].id)

            if (!currentCard || !nextCard) return null

            // Check if this connection is correct
            const isCorrectConnection =
              state.correctOrder[index]?.id === card.id &&
              state.correctOrder[index + 1]?.id === inferredSequence[index + 1].id

            return (
              <AnimatedArrow
                key={`arrow-${card.id}-${inferredSequence[index + 1].id}`}
                fromCard={currentCard}
                toCard={nextCard}
                isCorrect={isCorrectConnection}
                sequenceNumber={index + 1}
                isDragging={!!draggingCardId}
                isResizing={isResizing}
                viewportWidth={viewportDimensions.width}
                viewportHeight={viewportDimensions.height}
              />
            )
          })}

        {/* Render all cards at their positions */}
        {[
          ...state.availableCards,
          ...state.placedCards.filter((c): c is SortingCard => c !== null),
        ].map((card) => {
          const cardState = cardStates.get(card.id)
          if (!cardState) return null

          const isDragging = draggingCardId === card.id

          // Check if this card is in the correct position in the inferred sequence
          const positionInSequence = inferredSequence.findIndex((c) => c.id === card.id)
          const isCorrect =
            positionInSequence >= 0 && state.correctOrder[positionInSequence]?.id === card.id

          return (
            <AnimatedCard
              key={card.id}
              card={card}
              cardState={cardState}
              isDragging={isDragging}
              isResizing={isResizing}
              isSpectating={isSpectating}
              isCorrect={isCorrect}
              viewportWidth={viewportDimensions.width}
              viewportHeight={viewportDimensions.height}
              onPointerDown={(e) => handlePointerDown(e, card.id)}
              onPointerMove={(e) => handlePointerMove(e, card.id)}
              onPointerUp={(e) => handlePointerUp(e, card.id)}
            />
          )
        })}
      </div>
    </div>
  )
}
