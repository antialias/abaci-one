'use client'

import * as Tooltip from '@radix-ui/react-tooltip'
import { animated, useSpring } from '@react-spring/web'
import { useEffect, useState } from 'react'
import { getRelationColor, getRelationOperator } from '../../constants/captureRelations'
import type { Piece, RelationKind } from '../../types'
import { getSquarePosition } from '../../utils/boardCoordinates'
import { getEffectiveValue } from '../../utils/pieceSetup'

interface CaptureRelationOptionsProps {
  targetPos: { x: number; y: number }
  cellSize: number
  gap: number
  padding: number
  onSelectRelation: (relation: RelationKind) => void
  closing?: boolean
  availableRelations: RelationKind[]
  moverPiece: Piece
  targetPiece: Piece
  allPieces: Piece[]
  findValidHelpers: (moverValue: number, targetValue: number, relation: RelationKind) => Piece[]
}

/**
 * Animated floating capture relation options with number bond preview on hover
 */
export function CaptureRelationOptions({
  targetPos,
  cellSize,
  gap,
  padding,
  onSelectRelation,
  closing = false,
  availableRelations,
  moverPiece,
  targetPiece,
  allPieces,
  findValidHelpers,
}: CaptureRelationOptionsProps) {
  const [hoveredRelation, setHoveredRelation] = useState<RelationKind | null>(null)
  const [currentHelperIndex, setCurrentHelperIndex] = useState(0)

  // Cycle through valid helpers every 1.5 seconds when hovering
  useEffect(() => {
    if (!hoveredRelation) {
      setCurrentHelperIndex(0)
      return
    }

    const moverValue = getEffectiveValue(moverPiece)
    const targetValue = getEffectiveValue(targetPiece)

    if (
      moverValue === undefined ||
      moverValue === null ||
      targetValue === undefined ||
      targetValue === null
    ) {
      return
    }

    const validHelpers = findValidHelpers(moverValue, targetValue, hoveredRelation)
    if (validHelpers.length <= 1) {
      // No need to cycle if only one or zero helpers
      setCurrentHelperIndex(0)
      return
    }

    // Cycle through helpers every 1.5 seconds
    const interval = setInterval(() => {
      setCurrentHelperIndex((prev) => (prev + 1) % validHelpers.length)
    }, 1500)

    return () => clearInterval(interval)
  }, [hoveredRelation, moverPiece, targetPiece, findValidHelpers])

  // Generate tooltip text with actual numbers for the currently displayed helper
  const getTooltipText = (relation: RelationKind): string => {
    if (relation !== hoveredRelation) {
      // Not hovered, use generic text
      const genericMap: Record<RelationKind, string> = {
        EQUAL: 'Equality: a = b',
        MULTIPLE: 'Multiple: b is multiple of a',
        DIVISOR: 'Divisor: a divides b',
        SUM: 'Sum: a + h = b (helper)',
        DIFF: 'Difference: |a - h| = b (helper)',
        PRODUCT: 'Product: a × h = b (helper)',
        RATIO: 'Ratio: a/h = b/h (helper)',
      }
      return genericMap[relation] || relation
    }

    const moverValue = getEffectiveValue(moverPiece)
    const targetValue = getEffectiveValue(targetPiece)

    if (
      moverValue === undefined ||
      moverValue === null ||
      targetValue === undefined ||
      targetValue === null
    ) {
      return relation
    }

    // Relations that don't need helpers - show equation with just mover and target
    const helperRelations: RelationKind[] = ['SUM', 'DIFF', 'PRODUCT', 'RATIO']
    const needsHelper = helperRelations.includes(relation)

    if (!needsHelper) {
      // Generate equation with just mover and target values
      switch (relation) {
        case 'EQUAL':
          return `${moverValue} = ${targetValue}`
        case 'MULTIPLE':
          return `${targetValue} is multiple of ${moverValue}`
        case 'DIVISOR':
          return `${moverValue} divides ${targetValue}`
        default:
          return relation
      }
    }

    // Relations that need helpers
    const validHelpers = findValidHelpers(moverValue, targetValue, relation)
    if (validHelpers.length === 0) {
      return `${relation}: No valid helpers`
    }

    const currentHelper = validHelpers[currentHelperIndex]
    const helperValue = getEffectiveValue(currentHelper)

    if (helperValue === undefined || helperValue === null) {
      return relation
    }

    // Generate equation with actual numbers including helper
    switch (relation) {
      case 'SUM':
        return `${moverValue} + ${helperValue} = ${targetValue}`
      case 'DIFF':
        return `|${moverValue} - ${helperValue}| = ${targetValue}`
      case 'PRODUCT':
        return `${moverValue} × ${helperValue} = ${targetValue}`
      case 'RATIO':
        return `${moverValue}/${helperValue} = ${targetValue}/${helperValue}`
      default:
        return relation
    }
  }

  const allRelations = [
    { relation: 'EQUAL', label: '=', angle: 0, color: '#8b5cf6' },
    {
      relation: 'MULTIPLE',
      label: '×n',
      angle: 51.4,
      color: '#a855f7',
    },
    {
      relation: 'DIVISOR',
      label: '÷',
      angle: 102.8,
      color: '#c084fc',
    },
    {
      relation: 'SUM',
      label: '+',
      angle: 154.3,
      color: '#3b82f6',
    },
    {
      relation: 'DIFF',
      label: '−',
      angle: 205.7,
      color: '#06b6d4',
    },
    {
      relation: 'PRODUCT',
      label: '×',
      angle: 257.1,
      color: '#10b981',
    },
    {
      relation: 'RATIO',
      label: '÷÷',
      angle: 308.6,
      color: '#f59e0b',
    },
  ]

  // Filter to only available relations and redistribute angles evenly
  const availableRelationDefs = allRelations.filter((r) =>
    availableRelations.includes(r.relation as RelationKind)
  )
  const angleStep = availableRelationDefs.length > 1 ? 360 / availableRelationDefs.length : 0
  const relations = availableRelationDefs.map((r, index) => ({
    ...r,
    angle: index * angleStep,
  }))

  const maxRadius = cellSize * 1.2
  const buttonSize = 64

  // Animate all buttons simultaneously - reverse animation when closing
  const spring = useSpring({
    from: { radius: 0, opacity: 0 },
    radius: closing ? 0 : maxRadius,
    opacity: closing ? 0 : 0.85,
    config: { tension: 280, friction: 20 },
  })

  return (
    <Tooltip.Provider delayDuration={0} disableHoverableContent>
      <g>
        {relations.map(({ relation, label, angle, color }) => {
          const rad = (angle * Math.PI) / 180

          return (
            <animated.g
              key={relation}
              transform={spring.radius.to(
                (r) =>
                  `translate(${targetPos.x + Math.cos(rad) * r}, ${targetPos.y + Math.sin(rad) * r})`
              )}
            >
              <foreignObject
                x={-buttonSize / 2}
                y={-buttonSize / 2}
                width={buttonSize}
                height={buttonSize}
                style={{ overflow: 'visible' }}
              >
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <animated.button
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectRelation(relation as RelationKind)
                      }}
                      style={{
                        width: buttonSize,
                        height: buttonSize,
                        borderRadius: '50%',
                        border: '3px solid rgba(255, 255, 255, 0.9)',
                        backgroundColor: color,
                        color: 'white',
                        fontSize: '28px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: spring.opacity,
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                        textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.15)'
                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.4)'
                        setHoveredRelation(relation as RelationKind)
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'
                        setHoveredRelation(null)
                      }}
                    >
                      {label}
                    </animated.button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content asChild sideOffset={8}>
                      <div
                        style={{
                          background: 'rgba(0,0,0,0.95)',
                          color: 'white',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 600,
                          maxWidth: '240px',
                          zIndex: 10000,
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                          pointerEvents: 'none',
                        }}
                      >
                        {getTooltipText(relation as RelationKind)}
                        <Tooltip.Arrow
                          style={{
                            fill: 'rgba(0,0,0,0.95)',
                          }}
                        />
                      </div>
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </foreignObject>
            </animated.g>
          )
        })}

        {/* Number bond preview when hovering over a relation - cycle through valid helpers */}
        {hoveredRelation &&
          (() => {
            const moverValue = getEffectiveValue(moverPiece)
            const targetValue = getEffectiveValue(targetPiece)

            if (
              moverValue === undefined ||
              moverValue === null ||
              targetValue === undefined ||
              targetValue === null
            ) {
              return null
            }

            const validHelpers = findValidHelpers(moverValue, targetValue, hoveredRelation)

            if (validHelpers.length === 0) {
              return null
            }

            // Show only the current helper
            const currentHelper = validHelpers[currentHelperIndex]

            const color = getRelationColor(hoveredRelation)
            const operator = getRelationOperator(hoveredRelation)

            // Calculate piece positions on board
            const layout = { cellSize, gap, padding }
            const moverPos = getSquarePosition(moverPiece.square, layout)
            const targetBoardPos = getSquarePosition(targetPiece.square, layout)
            const helperPos = getSquarePosition(currentHelper.square, layout)

            return (
              <g key={currentHelper.id}>
                {/* Triangle connecting lines */}
                <g opacity={0.5}>
                  <line
                    x1={moverPos.x}
                    y1={moverPos.y}
                    x2={helperPos.x}
                    y2={helperPos.y}
                    stroke={color}
                    strokeWidth={4}
                  />
                  <line
                    x1={moverPos.x}
                    y1={moverPos.y}
                    x2={targetBoardPos.x}
                    y2={targetBoardPos.y}
                    stroke={color}
                    strokeWidth={4}
                  />
                  <line
                    x1={helperPos.x}
                    y1={helperPos.y}
                    x2={targetBoardPos.x}
                    y2={targetBoardPos.y}
                    stroke={color}
                    strokeWidth={4}
                  />
                </g>

                {/* Operator symbol - smart placement to avoid collinear collapse */}
                {(() => {
                  // Calculate center of triangle
                  const centerX = (moverPos.x + helperPos.x + targetBoardPos.x) / 3
                  const centerY = (moverPos.y + helperPos.y + targetBoardPos.y) / 3

                  // Check if pieces are nearly collinear using cross product
                  // Vector from mover to helper
                  const v1x = helperPos.x - moverPos.x
                  const v1y = helperPos.y - moverPos.y
                  // Vector from mover to target
                  const v2x = targetBoardPos.x - moverPos.x
                  const v2y = targetBoardPos.y - moverPos.y

                  // Cross product magnitude (2D)
                  const crossProduct = Math.abs(v1x * v2y - v1y * v2x)

                  // If cross product is small, pieces are nearly collinear
                  const minTriangleArea = cellSize * cellSize * 0.5 // Minimum triangle area threshold
                  const isCollinear = crossProduct < minTriangleArea

                  let operatorX = centerX
                  let operatorY = centerY

                  if (isCollinear) {
                    // Find the line connecting the three points (use mover to target as reference)
                    const lineLength = Math.sqrt(v2x * v2x + v2y * v2y)

                    if (lineLength > 0) {
                      // Perpendicular direction (rotate 90 degrees)
                      const perpX = -v2y / lineLength
                      const perpY = v2x / lineLength

                      // Offset operator perpendicular to the line
                      const offsetDistance = cellSize * 0.8
                      operatorX = centerX + perpX * offsetDistance
                      operatorY = centerY + perpY * offsetDistance
                    }
                  }

                  return (
                    <text
                      x={operatorX}
                      y={operatorY}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={color}
                      fontSize={cellSize * 0.8}
                      fontWeight="900"
                      fontFamily="Georgia, 'Times New Roman', serif"
                      opacity={0.9}
                    >
                      {operator}
                    </text>
                  )
                })()}
              </g>
            )
          })()}
      </g>
    </Tooltip.Provider>
  )
}
