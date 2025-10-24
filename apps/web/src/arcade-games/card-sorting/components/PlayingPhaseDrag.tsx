'use client'

import { css } from '../../../../styled-system/css'
import { useCardSorting } from '../Provider'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSpring, animated, to } from '@react-spring/web'
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
 * Continuous curved path showing the full sequence of cards
 */
function ContinuousSequencePath({
  cardStates,
  sequence,
  correctOrder,
  viewportWidth,
  viewportHeight,
  spectatorEducationalMode,
  isSpectating,
}: {
  cardStates: Map<string, CardState>
  sequence: SortingCard[]
  correctOrder: SortingCard[]
  viewportWidth: number
  viewportHeight: number
  spectatorEducationalMode: boolean
  isSpectating: boolean
}) {
  if (sequence.length < 2) return null

  // Card dimensions (base size)
  const CARD_WIDTH = 140
  const CARD_HEIGHT = 180
  const CARD_HALF_WIDTH = CARD_WIDTH / 2
  const CARD_HALF_HEIGHT = CARD_HEIGHT / 2

  // Helper to check if a card is part of the correct prefix or suffix (and thus scaled to 50%)
  const isCardCorrect = (card: SortingCard): boolean => {
    const positionInSequence = sequence.findIndex((c) => c.id === card.id)
    if (positionInSequence < 0) return false

    // Check if card is part of correct prefix
    let isInCorrectPrefix = true
    for (let i = 0; i <= positionInSequence; i++) {
      if (sequence[i]?.id !== correctOrder[i]?.id) {
        isInCorrectPrefix = false
        break
      }
    }

    // Check if card is part of correct suffix
    let isInCorrectSuffix = true
    const offsetFromEnd = sequence.length - 1 - positionInSequence
    for (let i = 0; i <= offsetFromEnd; i++) {
      const seqIdx = sequence.length - 1 - i
      const correctIdx = correctOrder.length - 1 - i
      if (sequence[seqIdx]?.id !== correctOrder[correctIdx]?.id) {
        isInCorrectSuffix = false
        break
      }
    }

    const isCorrect = isInCorrectPrefix || isInCorrectSuffix
    return isSpectating ? spectatorEducationalMode && isCorrect : isCorrect
  }

  // Get all card positions (card centers) with scale information
  const cardCenters = sequence
    .map((card) => {
      const state = cardStates.get(card.id)
      if (!state) return null
      const scale = isCardCorrect(card) ? 0.5 : 1
      return {
        x: (state.x / 100) * viewportWidth + CARD_HALF_WIDTH,
        y: (state.y / 100) * viewportHeight + CARD_HALF_HEIGHT,
        cardId: card.id,
        scale,
      }
    })
    .filter((p): p is { x: number; y: number; cardId: string; scale: number } => p !== null)

  if (cardCenters.length < 2) return null

  // Helper function to find intersection of line from center in direction (dx, dy) with card rectangle
  const findCardEdgePoint = (
    centerX: number,
    centerY: number,
    dx: number,
    dy: number,
    scale: number
  ): { x: number; y: number } => {
    // Normalize direction
    const length = Math.sqrt(dx * dx + dy * dy)
    const ndx = dx / length
    const ndy = dy / length

    // Apply scale to card dimensions
    const scaledHalfWidth = CARD_HALF_WIDTH * scale
    const scaledHalfHeight = CARD_HALF_HEIGHT * scale

    // Find which edge we hit first
    const txRight = ndx > 0 ? scaledHalfWidth / ndx : Number.POSITIVE_INFINITY
    const txLeft = ndx < 0 ? -scaledHalfWidth / ndx : Number.POSITIVE_INFINITY
    const tyBottom = ndy > 0 ? scaledHalfHeight / ndy : Number.POSITIVE_INFINITY
    const tyTop = ndy < 0 ? -scaledHalfHeight / ndy : Number.POSITIVE_INFINITY

    const t = Math.min(txRight, txLeft, tyBottom, tyTop)

    return {
      x: centerX + ndx * t,
      y: centerY + ndy * t,
    }
  }

  // Calculate edge points for each card based on direction to next/prev card
  const positions = cardCenters.map((center, i) => {
    if (i === 0) {
      // First card: direction towards next card
      const next = cardCenters[i + 1]
      const dx = next.x - center.x
      const dy = next.y - center.y
      return findCardEdgePoint(center.x, center.y, dx, dy, center.scale)
    }
    if (i === cardCenters.length - 1) {
      // Last card: direction from previous card
      const prev = cardCenters[i - 1]
      const dx = center.x - prev.x
      const dy = center.y - prev.y
      return findCardEdgePoint(center.x, center.y, dx, dy, center.scale)
    }
    // Middle cards: average direction between prev and next
    const prev = cardCenters[i - 1]
    const next = cardCenters[i + 1]
    const dx = next.x - prev.x
    const dy = next.y - prev.y
    return findCardEdgePoint(center.x, center.y, dx, dy, center.scale)
  })

  if (positions.length < 2) return null

  // Build continuous curved path using cubic bezier curves with smooth transitions
  // Use Catmull-Rom style control points for smooth continuous curves
  let pathD = `M ${positions[0].x} ${positions[0].y}`

  for (let i = 0; i < positions.length - 1; i++) {
    const current = positions[i]
    const next = positions[i + 1]

    // Get previous and next-next points for tangent calculation (or use current/next if at edges)
    const prev = i > 0 ? positions[i - 1] : current
    const nextNext = i < positions.length - 2 ? positions[i + 2] : next

    // Calculate tangent vectors for smooth curve
    // Tangent at current point: direction from prev to next
    const tension = 0.3 // Adjust this to control curve tightness (0 = loose, 1 = tight)

    const tangent1X = (next.x - prev.x) * tension
    const tangent1Y = (next.y - prev.y) * tension

    // Tangent at next point: direction from current to nextNext
    const tangent2X = (nextNext.x - current.x) * tension
    const tangent2Y = (nextNext.y - current.y) * tension

    // Control points for cubic bezier
    const cp1X = current.x + tangent1X
    const cp1Y = current.y + tangent1Y
    const cp2X = next.x - tangent2X
    const cp2Y = next.y - tangent2Y

    pathD += ` C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${next.x} ${next.y}`
  }

  // Calculate badge positions along the actual drawn path at arc-length midpoint
  const badges: Array<{ x: number; y: number; number: number; isCorrect: boolean }> = []

  // Helper to evaluate cubic bezier at parameter t
  const evalCubicBezier = (
    p0x: number,
    p0y: number,
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    p1x: number,
    p1y: number,
    t: number
  ) => {
    const mt = 1 - t
    return {
      x: mt * mt * mt * p0x + 3 * mt * mt * t * cp1x + 3 * mt * t * t * cp2x + t * t * t * p1x,
      y: mt * mt * mt * p0y + 3 * mt * mt * t * cp1y + 3 * mt * t * t * cp2y + t * t * t * p1y,
    }
  }

  for (let i = 0; i < positions.length - 1; i++) {
    const current = positions[i]
    const next = positions[i + 1]

    // Use the actual edge-based control points (same as the drawn path)
    const prev = i > 0 ? positions[i - 1] : current
    const nextNext = i < positions.length - 2 ? positions[i + 2] : next
    const tension = 0.3

    const tangent1X = (next.x - prev.x) * tension
    const tangent1Y = (next.y - prev.y) * tension
    const tangent2X = (nextNext.x - current.x) * tension
    const tangent2Y = (nextNext.y - current.y) * tension

    const cp1X = current.x + tangent1X
    const cp1Y = current.y + tangent1Y
    const cp2X = next.x - tangent2X
    const cp2Y = next.y - tangent2Y

    // Sample the curve at many points to calculate arc length
    const samples = 50
    const arcLengths: number[] = [0]
    let prevPoint = { x: current.x, y: current.y }

    for (let j = 1; j <= samples; j++) {
      const t = j / samples
      const point = evalCubicBezier(current.x, current.y, cp1X, cp1Y, cp2X, cp2Y, next.x, next.y, t)
      const segmentLength = Math.sqrt((point.x - prevPoint.x) ** 2 + (point.y - prevPoint.y) ** 2)
      arcLengths.push(arcLengths[arcLengths.length - 1] + segmentLength)
      prevPoint = point
    }

    // Find the t value that corresponds to 50% of arc length
    const totalArcLength = arcLengths[arcLengths.length - 1]
    const targetLength = totalArcLength * 0.5

    let tAtMidArc = 0.5
    for (let j = 0; j < arcLengths.length - 1; j++) {
      if (arcLengths[j] <= targetLength && targetLength <= arcLengths[j + 1]) {
        const ratio = (targetLength - arcLengths[j]) / (arcLengths[j + 1] - arcLengths[j])
        tAtMidArc = (j + ratio) / samples
        break
      }
    }

    // Evaluate curve at the arc-length midpoint
    const midPoint = evalCubicBezier(
      current.x,
      current.y,
      cp1X,
      cp1Y,
      cp2X,
      cp2Y,
      next.x,
      next.y,
      tAtMidArc
    )

    // Calculate tangent at this t for perpendicular offset
    const mt = 1 - tAtMidArc
    const tangentAtMidX =
      3 * mt * mt * (cp1X - current.x) +
      6 * mt * tAtMidArc * (cp2X - cp1X) +
      3 * tAtMidArc * tAtMidArc * (next.x - cp2X)
    const tangentAtMidY =
      3 * mt * mt * (cp1Y - current.y) +
      6 * mt * tAtMidArc * (cp2Y - cp1Y) +
      3 * tAtMidArc * tAtMidArc * (next.y - cp2Y)

    // Small perpendicular offset so badges sit slightly off the curve line
    const perpX = -tangentAtMidY
    const perpY = tangentAtMidX
    const perpLength = Math.sqrt(perpX * perpX + perpY * perpY)
    const offsetDistance = 5 // Small offset

    const finalX = midPoint.x + (perpX / perpLength) * offsetDistance
    const finalY = midPoint.y + (perpY / perpLength) * offsetDistance

    // Check if this connection is correct
    const isCorrect =
      correctOrder[i]?.id === sequence[i].id && correctOrder[i + 1]?.id === sequence[i + 1].id

    badges.push({
      x: finalX,
      y: finalY,
      number: i + 1,
      isCorrect,
    })
  }

  // Check if entire sequence is correct for coloring
  const allCorrect = sequence.every((card, idx) => correctOrder[idx]?.id === card.id)

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <svg
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
        }}
      >
        {/* Continuous curved path */}
        <path
          d={pathD}
          stroke={allCorrect ? 'rgba(34, 197, 94, 0.8)' : 'rgba(251, 146, 60, 0.7)'}
          strokeWidth={allCorrect ? '8' : '6'}
          fill="none"
          style={{
            filter: allCorrect ? 'drop-shadow(0 0 8px rgba(34, 197, 94, 0.6))' : 'none',
          }}
        />

        {/* Arrowhead at the end */}
        {(() => {
          const i = positions.length - 2 // Last segment index
          const current = positions[i]
          const next = positions[i + 1]

          // Recalculate control points for last segment
          const prev = i > 0 ? positions[i - 1] : current
          const nextNext = next // At the end, so nextNext is same as next
          const tension = 0.3

          const tangent1X = (next.x - prev.x) * tension
          const tangent1Y = (next.y - prev.y) * tension
          const tangent2X = (nextNext.x - current.x) * tension
          const tangent2Y = (nextNext.y - current.y) * tension

          const cp1X = current.x + tangent1X
          const cp1Y = current.y + tangent1Y
          const cp2X = next.x - tangent2X
          const cp2Y = next.y - tangent2Y

          // Calculate tangent at t=1 (end of curve) for cubic bezier
          // Derivative: B'(t) = 3(1-t)²(P1-P0) + 6(1-t)t(P2-P1) + 3t²(P3-P2)
          // At t=1: B'(1) = 3(P3-P2)
          const tangentX = 3 * (next.x - cp2X)
          const tangentY = 3 * (next.y - cp2Y)
          const arrowAngle = Math.atan2(tangentY, tangentX)

          // Arrow triangle
          const tipX = next.x
          const tipY = next.y
          const baseX = tipX - Math.cos(arrowAngle) * 10
          const baseY = tipY - Math.sin(arrowAngle) * 10
          const left = `${baseX + Math.cos(arrowAngle + Math.PI / 2) * 6},${baseY + Math.sin(arrowAngle + Math.PI / 2) * 6}`
          const right = `${baseX + Math.cos(arrowAngle - Math.PI / 2) * 6},${baseY + Math.sin(arrowAngle - Math.PI / 2) * 6}`

          return (
            <polygon
              points={`${tipX},${tipY} ${left} ${right}`}
              fill={allCorrect ? 'rgba(34, 197, 94, 0.9)' : 'rgba(251, 146, 60, 0.8)'}
            />
          )
        })()}
      </svg>

      {/* Number badges */}
      {badges.map((badge) => (
        <div
          key={badge.number}
          style={{
            position: 'absolute',
            left: `${badge.x}px`,
            top: `${badge.y}px`,
            transform: 'translate(-50%, -50%)',
            background: badge.isCorrect ? '#22c55e' : '#f97316',
            color: 'white',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            border: '3px solid white',
            boxShadow: badge.isCorrect
              ? '0 0 0 2px #22c55e, 0 4px 8px rgba(0, 0, 0, 0.3)'
              : '0 0 0 2px #f97316, 0 4px 8px rgba(0, 0, 0, 0.3)',
            animation: badge.isCorrect ? 'correctBadgePulse 1.5s ease-in-out infinite' : 'none',
          }}
        >
          {badge.number}
        </div>
      ))}
    </div>
  )
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

  // Calculate control point for bezier curve (perpendicular to line, offset by 30px)
  const midX = (fromX + toX) / 2
  const midY = (fromY + toY) / 2
  const perpAngle = angle + 90 // Perpendicular to the line
  const curveOffset = 30 // How much to curve (in pixels)
  const controlX = midX + Math.cos((perpAngle * Math.PI) / 180) * curveOffset
  const controlY = midY + Math.sin((perpAngle * Math.PI) / 180) * curveOffset

  // Calculate arrowhead position and angle at the end of the curve
  // For a quadratic bezier, the tangent at t=1 is: 2*(P2 - P1)
  const tangentX = toX - controlX
  const tangentY = toY - controlY
  const arrowAngle = Math.atan2(tangentY, tangentX) * (180 / Math.PI)

  return (
    <animated.div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <svg
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
        }}
      >
        {/* Curved line using quadratic bezier */}
        <animated.path
          d={to(
            [springProps.fromX, springProps.fromY, springProps.distance, springProps.angle],
            (fx, fy, dist, ang) => {
              // Recalculate curve with animated values
              const tx = fx + Math.cos((ang * Math.PI) / 180) * dist
              const ty = fy + Math.sin((ang * Math.PI) / 180) * dist
              const mx = (fx + tx) / 2
              const my = (fy + ty) / 2
              const perpAng = ang + 90
              const cx = mx + Math.cos((perpAng * Math.PI) / 180) * curveOffset
              const cy = my + Math.sin((perpAng * Math.PI) / 180) * curveOffset
              return `M ${fx} ${fy} Q ${cx} ${cy} ${tx} ${ty}`
            }
          )}
          stroke={isCorrect ? 'rgba(34, 197, 94, 0.8)' : 'rgba(251, 146, 60, 0.7)'}
          strokeWidth={isCorrect ? '4' : '3'}
          fill="none"
          style={{
            filter: isCorrect ? 'drop-shadow(0 0 8px rgba(34, 197, 94, 0.6))' : 'none',
          }}
        />

        {/* Arrowhead */}
        <animated.polygon
          points={to(
            [springProps.fromX, springProps.fromY, springProps.distance, springProps.angle],
            (fx, fy, dist, ang) => {
              // Recalculate end position and angle
              const tx = fx + Math.cos((ang * Math.PI) / 180) * dist
              const ty = fy + Math.sin((ang * Math.PI) / 180) * dist
              const mx = (fx + tx) / 2
              const my = (fy + ty) / 2
              const perpAng = ang + 90
              const cx = mx + Math.cos((perpAng * Math.PI) / 180) * curveOffset
              const cy = my + Math.sin((perpAng * Math.PI) / 180) * curveOffset
              const tangX = tx - cx
              const tangY = ty - cy
              const aAngle = Math.atan2(tangY, tangX)

              // Arrow points relative to tip
              const tipX = tx
              const tipY = ty
              const baseX = tipX - Math.cos(aAngle) * 10
              const baseY = tipY - Math.sin(aAngle) * 10
              const left = `${baseX + Math.cos(aAngle + Math.PI / 2) * 6},${baseY + Math.sin(aAngle + Math.PI / 2) * 6}`
              const right = `${baseX + Math.cos(aAngle - Math.PI / 2) * 6},${baseY + Math.sin(aAngle - Math.PI / 2) * 6}`
              return `${tipX},${tipY} ${left} ${right}`
            }
          )}
          fill={isCorrect ? 'rgba(34, 197, 94, 0.9)' : 'rgba(251, 146, 60, 0.8)'}
        />
      </svg>

      {/* Sequence number badge */}
      <animated.div
        style={{
          position: 'absolute',
          left: to(
            [springProps.fromX, springProps.fromY, springProps.distance, springProps.angle],
            (fx, fy, dist, ang) => {
              const tx = fx + Math.cos((ang * Math.PI) / 180) * dist
              const mx = (fx + tx) / 2
              const perpAng = ang + 90
              const cx = mx + Math.cos((perpAng * Math.PI) / 180) * curveOffset
              return `${cx}px`
            }
          ),
          top: to(
            [springProps.fromX, springProps.fromY, springProps.distance, springProps.angle],
            (fx, fy, dist, ang) => {
              const tx = fx + Math.cos((ang * Math.PI) / 180) * dist
              const ty = fy + Math.sin((ang * Math.PI) / 180) * dist
              const my = (fy + ty) / 2
              const perpAng = ang + 90
              const cy = my + Math.sin((perpAng * Math.PI) / 180) * curveOffset
              return `${cy}px`
            }
          ),
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
      </animated.div>
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
  draggedByPlayerId,
  localPlayerId,
  players,
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
  draggedByPlayerId?: string
  localPlayerId?: string
  players: Map<string, { id: string; name: string; emoji: string }>
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
    immediate: isDragging || isResizing,
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
        transition: 'box-shadow 0.2s ease',
        borderRadius: '12px',
        overflow: 'hidden',
      })}
      style={{
        left: springProps.left.to((val) => `${val}px`),
        top: springProps.top.to((val) => `${val}px`),
        transform: springProps.rotation.to((r) => `rotate(${r}deg)`),
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

      {/* Player emoji overlay when card is being dragged by ANOTHER player */}
      {draggedByPlayerId &&
        draggedByPlayerId !== localPlayerId &&
        (() => {
          const player = players.get(draggedByPlayerId)
          if (!player) return null

          return (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: '12px',
                background: 'rgba(59, 130, 246, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '120px',
                zIndex: 10,
                pointerEvents: 'none',
                opacity: 0.3,
              }}
            >
              {player.emoji}
            </div>
          )
        })()}
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
    localPlayerId,
    players,
  } = useCardSorting()

  // Spectator educational mode (show correctness indicators)
  const [spectatorEducationalMode, setSpectatorEducationalMode] = useState(false)
  // Spectator stats sidebar collapsed state
  const [spectatorStatsCollapsed, setSpectatorStatsCollapsed] = useState(false)

  // Activity feed notifications
  interface ActivityNotification {
    id: string
    playerId: string
    playerEmoji: string
    playerName: string
    action: string
    timestamp: number
  }
  const [activityFeed, setActivityFeed] = useState<ActivityNotification[]>([])
  const activityIdCounter = useRef(0)

  // Perfect sequence countdown (auto-submit after 3-2-1)
  const [perfectCountdown, setPerfectCountdown] = useState<number | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef<{
    cardId: string
    offsetX: number
    offsetY: number
    startX: number
    startY: number
    initialRotation: number
  } | null>(null)

  // Track timestamp of last position update we sent to avoid re-applying our own updates
  const lastPositionUpdateRef = useRef<number>(0)

  // Track card positions and visual states (UI only - not game state)
  const [cardStates, setCardStates] = useState<Map<string, CardState>>(new Map())
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null)
  const [nextZIndex, setNextZIndex] = useState(1)

  // Track viewport dimensions for responsive positioning
  // For spectators, reduce dimensions to account for panels
  const getEffectiveViewportWidth = () => {
    if (typeof window === 'undefined') return 1000
    const baseWidth = window.innerWidth
    if (isSpectating && !spectatorStatsCollapsed) {
      return baseWidth - 280 // Subtract stats sidebar width
    }
    return baseWidth
  }

  const getEffectiveViewportHeight = () => {
    if (typeof window === 'undefined') return 800
    const baseHeight = window.innerHeight
    if (isSpectating) {
      return baseHeight - 56 // Subtract banner height
    }
    return baseHeight
  }

  const [viewportDimensions, setViewportDimensions] = useState({
    width: getEffectiveViewportWidth(),
    height: getEffectiveViewportHeight(),
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

  // Helper to add activity notifications (only in collaborative mode)
  const addActivityNotification = useCallback(
    (playerId: string, action: string) => {
      if (state.gameMode !== 'collaborative') return
      if (playerId === localPlayerId) return // Don't show notifications for own actions

      const player = players.get(playerId)
      if (!player) return

      const notification: ActivityNotification = {
        id: `activity-${activityIdCounter.current++}`,
        playerId,
        playerEmoji: player.emoji,
        playerName: player.name,
        action,
        timestamp: Date.now(),
      }

      setActivityFeed((prev) => [...prev, notification])
    },
    [state.gameMode, localPlayerId, players]
  )

  // Auto-dismiss notifications after 3 seconds
  useEffect(() => {
    if (activityFeed.length === 0) return

    const timeout = setTimeout(() => {
      const now = Date.now()
      setActivityFeed((prev) => prev.filter((n) => now - n.timestamp < 3000))
    }, 100) // Check every 100ms for smooth removal

    return () => clearTimeout(timeout)
  }, [activityFeed])

  // Track previous state for detecting changes
  const prevNumbersRevealedRef = useRef(state.numbersRevealed)
  const prevDraggingPlayersRef = useRef<Set<string>>(new Set())

  // Detect state changes and generate activity notifications
  useEffect(() => {
    // Only track in collaborative mode
    if (state.gameMode !== 'collaborative') return
    if (!state.cardPositions) return

    // Detect who is currently dragging cards
    const currentlyDragging = new Set<string>()
    for (const pos of state.cardPositions) {
      if (pos.draggedByPlayerId && pos.draggedByPlayerId !== localPlayerId) {
        currentlyDragging.add(pos.draggedByPlayerId)
      }
    }

    // Detect new players starting to drag (activity notification)
    for (const playerId of currentlyDragging) {
      if (!prevDraggingPlayersRef.current.has(playerId)) {
        addActivityNotification(playerId, 'is moving cards')
      }
    }

    prevDraggingPlayersRef.current = currentlyDragging

    // Detect revealed numbers
    if (state.numbersRevealed && !prevNumbersRevealedRef.current) {
      // We don't know who revealed them without player metadata in state
      // Skip for now
    }

    prevNumbersRevealedRef.current = state.numbersRevealed
  }, [
    state.cardPositions,
    state.numbersRevealed,
    state.gameMode,
    localPlayerId,
    addActivityNotification,
  ])

  // Handle viewport resize
  useEffect(() => {
    const handleResize = () => {
      // Set resizing flag to disable spring animations
      setIsResizing(true)

      // Update viewport dimensions immediately (accounting for spectator panels)
      setViewportDimensions({
        width: getEffectiveViewportWidth(),
        height: getEffectiveViewportHeight(),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update viewport dimensions when spectator panels change
  useEffect(() => {
    setViewportDimensions({
      width: getEffectiveViewportWidth(),
      height: getEffectiveViewportHeight(),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpectating, spectatorStatsCollapsed])

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

    // Ignore server updates for 500ms after we send our own update
    // This prevents replaying our own movements when they bounce back from server
    const timeSinceOurUpdate = Date.now() - lastPositionUpdateRef.current
    if (timeSinceOurUpdate < 500) return

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

  // Infer sequence from card positions
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
            lastPositionUpdateRef.current = now
            const positions = Array.from(newStates.entries()).map(([id, state]) => ({
              cardId: id,
              x: state.x,
              y: state.y,
              rotation: state.rotation,
              zIndex: state.zIndex,
              // Mark this card as being dragged by local player
              draggedByPlayerId: id === cardId ? localPlayerId : undefined,
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
          // Clear draggedByPlayerId when drag ends
          draggedByPlayerId: undefined,
        }))
        lastPositionUpdateRef.current = Date.now()
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

  // Start countdown when sequence is perfect
  useEffect(() => {
    if (isSequenceCorrect && !isSpectating) {
      // Start countdown from 3
      setPerfectCountdown(3)
    } else {
      // Reset countdown if sequence is no longer perfect
      setPerfectCountdown(null)
    }
  }, [isSequenceCorrect, isSpectating])

  // Countdown timer effect
  useEffect(() => {
    if (perfectCountdown === null) return
    if (perfectCountdown <= 0) {
      // Auto-submit when countdown reaches 0
      handleCheckSolution()
      setPerfectCountdown(null)
      return
    }

    // Decrement every 1.5 seconds
    const timer = setTimeout(() => {
      setPerfectCountdown((prev) => (prev !== null ? prev - 1 : null))
    }, 1500)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfectCountdown])

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
      {/* Spectator Banner */}
      {isSpectating && (
        <div
          className={css({
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '56px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            zIndex: 100,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            gap: '16px',
          })}
        >
          {/* Player info */}
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '16px',
              fontWeight: '600',
            })}
          >
            <span>👀 Spectating:</span>
            <span>
              {state.playerMetadata.emoji} {state.playerMetadata.name}
            </span>
          </div>

          {/* Progress */}
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              fontSize: '14px',
            })}
          >
            <div
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              })}
            >
              <span>Progress:</span>
              <span className={css({ fontWeight: '600', fontSize: '16px' })}>
                {state.placedCards.filter((c) => c !== null).length}/{state.cardCount}
              </span>
              <span>cards</span>
            </div>

            {/* Educational Mode Toggle */}
            <button
              type="button"
              onClick={() => setSpectatorEducationalMode(!spectatorEducationalMode)}
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '20px',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                background: spectatorEducationalMode
                  ? 'rgba(255, 255, 255, 0.2)'
                  : 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s',
                _hover: {
                  background: 'rgba(255, 255, 255, 0.25)',
                  borderColor: 'rgba(255, 255, 255, 0.5)',
                },
              })}
            >
              <span>{spectatorEducationalMode ? '✅' : '📚'}</span>
              <span>Educational Mode</span>
            </button>
          </div>
        </div>
      )}

      {/* Spectator Stats Sidebar */}
      {isSpectating && (
        <div
          className={css({
            position: 'fixed',
            top: '56px', // Below banner
            right: spectatorStatsCollapsed ? '-280px' : '0',
            width: '280px',
            height: 'calc(100vh - 56px)',
            background: 'rgba(255, 255, 255, 0.95)',
            boxShadow: '-2px 0 12px rgba(0, 0, 0, 0.1)',
            transition: 'right 0.3s ease',
            zIndex: 90,
            display: 'flex',
            flexDirection: 'column',
          })}
        >
          {/* Collapse/Expand Toggle */}
          <button
            type="button"
            onClick={() => setSpectatorStatsCollapsed(!spectatorStatsCollapsed)}
            className={css({
              position: 'absolute',
              left: '-40px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '40px',
              height: '80px',
              background: 'rgba(255, 255, 255, 0.95)',
              border: 'none',
              borderRadius: '8px 0 0 8px',
              boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.1)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              transition: 'all 0.2s',
              _hover: {
                background: 'rgba(255, 255, 255, 1)',
                width: '44px',
              },
            })}
          >
            {spectatorStatsCollapsed ? '◀' : '▶'}
          </button>

          {/* Stats Content */}
          <div
            className={css({
              padding: '24px',
              overflowY: 'auto',
              flex: 1,
            })}
          >
            <h3
              className={css({
                fontSize: '18px',
                fontWeight: '700',
                marginBottom: '20px',
                color: '#1e293b',
                borderBottom: '2px solid #e2e8f0',
                paddingBottom: '8px',
              })}
            >
              📊 Live Stats
            </h3>

            {/* Time Elapsed */}
            <div
              className={css({
                marginBottom: '16px',
                padding: '12px',
                background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
                borderRadius: '8px',
                border: '1px solid #93c5fd',
              })}
            >
              <div className={css({ fontSize: '12px', color: '#1e40af', marginBottom: '4px' })}>
                ⏱️ Time Elapsed
              </div>
              <div className={css({ fontSize: '24px', fontWeight: '700', color: '#1e3a8a' })}>
                {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
              </div>
            </div>

            {/* Cards Placed */}
            <div
              className={css({
                marginBottom: '16px',
                padding: '12px',
                background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)',
                borderRadius: '8px',
                border: '1px solid #86efac',
              })}
            >
              <div className={css({ fontSize: '12px', color: '#15803d', marginBottom: '4px' })}>
                🎯 Cards Placed
              </div>
              <div className={css({ fontSize: '24px', fontWeight: '700', color: '#14532d' })}>
                {state.placedCards.filter((c) => c !== null).length} / {state.cardCount}
              </div>
              <div className={css({ fontSize: '11px', color: '#15803d', marginTop: '4px' })}>
                {Math.round(
                  (state.placedCards.filter((c) => c !== null).length / state.cardCount) * 100
                )}
                % complete
              </div>
            </div>

            {/* Current Accuracy */}
            <div
              className={css({
                marginBottom: '16px',
                padding: '12px',
                background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                borderRadius: '8px',
                border: '1px solid #fbbf24',
              })}
            >
              <div className={css({ fontSize: '12px', color: '#92400e', marginBottom: '4px' })}>
                ✨ Current Accuracy
              </div>
              <div className={css({ fontSize: '24px', fontWeight: '700', color: '#78350f' })}>
                {(() => {
                  const placedCards = state.placedCards.filter((c): c is SortingCard => c !== null)
                  if (placedCards.length === 0) return '0%'
                  const correctCount = placedCards.filter(
                    (c, i) => state.correctOrder[i]?.id === c.id
                  ).length
                  return `${Math.round((correctCount / placedCards.length) * 100)}%`
                })()}
              </div>
              <div className={css({ fontSize: '11px', color: '#92400e', marginTop: '4px' })}>
                Cards in correct position
              </div>
            </div>

            {/* Numbers Revealed */}
            <div
              className={css({
                marginBottom: '16px',
                padding: '12px',
                background: state.numbersRevealed
                  ? 'linear-gradient(135deg, #fce7f3, #fbcfe8)'
                  : 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: state.numbersRevealed ? '#f9a8d4' : '#cbd5e1',
              })}
            >
              <div
                className={css({
                  fontSize: '12px',
                  color: state.numbersRevealed ? '#9f1239' : '#475569',
                  marginBottom: '4px',
                })}
              >
                👁️ Numbers Revealed
              </div>
              <div
                className={css({
                  fontSize: '20px',
                  fontWeight: '600',
                  color: state.numbersRevealed ? '#9f1239' : '#475569',
                })}
              >
                {state.numbersRevealed ? '✓ Yes' : '✗ No'}
              </div>
            </div>
          </div>
        </div>
      )}

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
              {perfectCountdown !== null && perfectCountdown > 0 ? perfectCountdown : '✓'}
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

      {/* Timer (minimal, top-left) - hidden for spectators since banner shows time */}
      {!isSpectating && (
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
      )}

      {/* Play area with freely positioned cards - adjust for spectator panels */}
      <div
        ref={containerRef}
        className={css({
          width: isSpectating && !spectatorStatsCollapsed ? 'calc(100vw - 280px)' : '100vw',
          height: isSpectating ? 'calc(100vh - 56px)' : '100vh',
          position: 'absolute',
          top: isSpectating ? '56px' : 0,
          left: 0,
          background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
          overflow: 'hidden',
          transition: 'width 0.3s ease, height 0.3s ease, top 0.3s ease',
        })}
      >
        {/* Render continuous curved path through the entire sequence */}
        {inferredSequence.length > 1 && (
          <ContinuousSequencePath
            cardStates={cardStates}
            sequence={inferredSequence}
            correctOrder={state.correctOrder}
            viewportWidth={viewportDimensions.width}
            viewportHeight={viewportDimensions.height}
            spectatorEducationalMode={spectatorEducationalMode}
            isSpectating={isSpectating}
          />
        )}

        {/* Render all cards at their positions */}
        {[
          ...state.availableCards,
          ...state.placedCards.filter((c): c is SortingCard => c !== null),
        ].map((card) => {
          const cardState = cardStates.get(card.id)
          if (!cardState) return null

          const isDragging = draggingCardId === card.id

          // Cards don't show correctness indicators during play
          const isCorrect = false

          // Get draggedByPlayerId from server state
          const serverPosition = state.cardPositions.find((p) => p.cardId === card.id)
          const draggedByPlayerId = serverPosition?.draggedByPlayerId

          return (
            <AnimatedCard
              key={card.id}
              card={card}
              cardState={cardState}
              isDragging={isDragging}
              isResizing={isResizing}
              isSpectating={isSpectating}
              isCorrect={isCorrect}
              draggedByPlayerId={draggedByPlayerId}
              localPlayerId={localPlayerId}
              players={players}
              viewportWidth={viewportDimensions.width}
              viewportHeight={viewportDimensions.height}
              onPointerDown={(e) => handlePointerDown(e, card.id)}
              onPointerMove={(e) => handlePointerMove(e, card.id)}
              onPointerUp={(e) => handlePointerUp(e, card.id)}
            />
          )
        })}
      </div>

      {/* Activity Feed (collaborative mode only) */}
      {state.gameMode === 'collaborative' && activityFeed.length > 0 && (
        <div
          className={css({
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 150,
            maxWidth: '320px',
          })}
        >
          {activityFeed.map((notification) => {
            const age = Date.now() - notification.timestamp
            const opacity = Math.max(0, 1 - age / 3000) // Fade out over 3 seconds

            return (
              <div
                key={notification.id}
                className={css({
                  padding: '12px 16px',
                  background: 'rgba(255, 255, 255, 0.95)',
                  border: '2px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#1f2937',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.3s ease',
                })}
                style={{
                  opacity,
                  transform: `translateY(${(1 - opacity) * 20}px)`,
                }}
              >
                <span style={{ fontSize: '20px' }}>{notification.playerEmoji}</span>
                <span>
                  <strong>{notification.playerName}</strong> {notification.action}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
