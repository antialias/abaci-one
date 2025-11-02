'use client'

import { animated, to, useSpring } from '@react-spring/web'
import { useEffect, useState } from 'react'
import { getRelationColor, getRelationOperator } from '../../constants/captureRelations'
import type { Piece, RelationKind } from '../../types'
import { getSquarePosition } from '../../utils/boardCoordinates'
import { getEffectiveValue } from '../../utils/pieceSetup'
import { PieceRenderer } from '../PieceRenderer'

interface NumberBondVisualizationProps {
  moverPiece: Piece
  helperPiece: Piece
  targetPiece: Piece
  relation: RelationKind
  targetPos: { x: number; y: number }
  cellSize: number
  onConfirm: () => void
  closing?: boolean
  autoAnimate?: boolean
  moverStartPos: { x: number; y: number }
  helperStartPos: { x: number; y: number }
  useNativeAbacusNumbers?: boolean
  padding: number
  gap: number
}

/**
 * Number Bond Visualization - uses actual piece positions for smooth rotation/collapse
 * Pieces start at their actual positions (mover on board, helper in ring, target on board)
 * Animation: Rotate and collapse to target position, only mover remains
 */
export function NumberBondVisualization({
  moverPiece,
  helperPiece,
  targetPiece,
  relation,
  targetPos,
  cellSize,
  onConfirm,
  closing = false,
  autoAnimate = true,
  moverStartPos,
  helperStartPos,
  padding,
  gap,
  useNativeAbacusNumbers = false,
}: NumberBondVisualizationProps) {
  const [animating, setAnimating] = useState(false)

  // Auto-trigger animation immediately when component mounts (after helper selection)
  useEffect(() => {
    if (!autoAnimate) return
    const timer = setTimeout(() => {
      setAnimating(true)
    }, 300) // Short delay to show the triangle briefly
    return () => clearTimeout(timer)
  }, [autoAnimate])

  const color = getRelationColor(relation)
  const operator = getRelationOperator(relation)

  // Calculate actual board position for target
  const targetBoardPos = getSquarePosition(targetPiece.square, { cellSize, gap, padding })

  // Animation: Rotate and collapse from actual positions to target
  const captureAnimation = useSpring({
    from: { rotation: 0, progress: 0, opacity: 1 },
    rotation: animating ? Math.PI * 20 : 0, // 10 full rotations
    progress: animating ? 1 : 0, // 0 = at start positions, 1 = at target position
    opacity: animating ? 0 : 1,
    config: animating ? { duration: 2500 } : { tension: 280, friction: 20 },
    onRest: () => {
      if (animating) {
        onConfirm()
      }
    },
  })

  // Get piece values
  const getMoverValue = () => getEffectiveValue(moverPiece)
  const getHelperValue = () => getEffectiveValue(helperPiece)
  const getTargetValue = () => getEffectiveValue(targetPiece)

  return (
    <g>
      {/* Triangle connecting lines between actual piece positions - fade during animation */}
      <animated.g opacity={to([captureAnimation.opacity], (op) => (animating ? op * 0.5 : 0.5))}>
        <line
          x1={moverStartPos.x}
          y1={moverStartPos.y}
          x2={helperStartPos.x}
          y2={helperStartPos.y}
          stroke={color}
          strokeWidth={4}
        />
        <line
          x1={moverStartPos.x}
          y1={moverStartPos.y}
          x2={targetBoardPos.x}
          y2={targetBoardPos.y}
          stroke={color}
          strokeWidth={4}
        />
        <line
          x1={helperStartPos.x}
          y1={helperStartPos.y}
          x2={targetBoardPos.x}
          y2={targetBoardPos.y}
          stroke={color}
          strokeWidth={4}
        />
      </animated.g>

      {/* Operator symbol in center of triangle - fade during animation */}
      <animated.text
        x={(moverStartPos.x + helperStartPos.x + targetBoardPos.x) / 3}
        y={(moverStartPos.y + helperStartPos.y + targetBoardPos.y) / 3}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={cellSize * 0.8}
        fontWeight="900"
        fontFamily="Georgia, 'Times New Roman', serif"
        opacity={to([captureAnimation.opacity], (op) => (animating ? op * 0.9 : 0.9))}
      >
        {operator}
      </animated.text>

      {/* Mover piece - starts at board position, spirals to target, STAYS VISIBLE */}
      <animated.g
        transform={to([captureAnimation.rotation, captureAnimation.progress], (rot, prog) => {
          // Interpolate from start position to target position
          const x = moverStartPos.x + (targetBoardPos.x - moverStartPos.x) * prog
          const y = moverStartPos.y + (targetBoardPos.y - moverStartPos.y) * prog

          // Add spiral rotation around the interpolated center
          const spiralRadius = (1 - prog) * cellSize * 0.5
          const spiralX = x + Math.cos(rot) * spiralRadius
          const spiralY = y + Math.sin(rot) * spiralRadius

          return `translate(${spiralX}, ${spiralY})`
        })}
        opacity={1} // Mover stays fully visible
      >
        <g transform={`translate(${-cellSize / 2}, ${-cellSize / 2})`}>
          <PieceRenderer
            type={moverPiece.type}
            color={moverPiece.color}
            value={getMoverValue() || 0}
            size={cellSize}
            useNativeAbacusNumbers={useNativeAbacusNumbers}
          />
        </g>
      </animated.g>

      {/* Helper piece - starts in ring, spirals to target, FADES OUT */}
      <animated.g
        transform={to([captureAnimation.rotation, captureAnimation.progress], (rot, prog) => {
          const x = helperStartPos.x + (targetBoardPos.x - helperStartPos.x) * prog
          const y = helperStartPos.y + (targetBoardPos.y - helperStartPos.y) * prog

          const spiralRadius = (1 - prog) * cellSize * 0.5
          const angle = rot + (Math.PI * 2) / 3 // Offset by 120°
          const spiralX = x + Math.cos(angle) * spiralRadius
          const spiralY = y + Math.sin(angle) * spiralRadius

          return `translate(${spiralX}, ${spiralY})`
        })}
        opacity={to([captureAnimation.opacity], (op) => (animating ? op : 1))}
      >
        <g transform={`translate(${-cellSize / 2}, ${-cellSize / 2})`}>
          <PieceRenderer
            type={helperPiece.type}
            color={helperPiece.color}
            value={getHelperValue() || 0}
            size={cellSize}
            useNativeAbacusNumbers={useNativeAbacusNumbers}
          />
        </g>
      </animated.g>

      {/* Target piece - stays at board position, spirals in place, FADES OUT */}
      <animated.g
        transform={to([captureAnimation.rotation, captureAnimation.progress], (rot, prog) => {
          const x = targetBoardPos.x
          const y = targetBoardPos.y

          const spiralRadius = (1 - prog) * cellSize * 0.5
          const angle = rot + (Math.PI * 4) / 3 // Offset by 240°
          const spiralX = x + Math.cos(angle) * spiralRadius
          const spiralY = y + Math.sin(angle) * spiralRadius

          return `translate(${spiralX}, ${spiralY})`
        })}
        opacity={to([captureAnimation.opacity], (op) => (animating ? op : 1))}
      >
        <g transform={`translate(${-cellSize / 2}, ${-cellSize / 2})`}>
          <PieceRenderer
            type={targetPiece.type}
            useNativeAbacusNumbers={useNativeAbacusNumbers}
            color={targetPiece.color}
            value={getTargetValue() || 0}
            size={cellSize}
          />
        </g>
      </animated.g>
    </g>
  )
}
