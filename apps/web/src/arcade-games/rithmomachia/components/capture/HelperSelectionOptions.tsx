'use client'

import { useState } from 'react'
import type { Piece, RelationKind } from '../../types'
import { getRelationColor, getRelationOperator } from '../../constants/captureRelations'
import { AnimatedHelperPiece } from './AnimatedHelperPiece'

interface HelperSelectionOptionsProps {
  helpers: Array<{ piece: Piece; boardPos: { x: number; y: number } }>
  targetPos: { x: number; y: number }
  cellSize: number
  gap: number
  padding: number
  onSelectHelper: (pieceId: string) => void
  closing?: boolean
  moverPiece: Piece
  targetPiece: Piece
  relation: RelationKind
  useNativeAbacusNumbers?: boolean
}

/**
 * Helper piece selection - pieces fly from board to selection ring
 * Hovering over a helper shows a preview of the number bond
 */
export function HelperSelectionOptions({
  helpers,
  targetPos,
  cellSize,
  gap,
  padding,
  onSelectHelper,
  closing = false,
  moverPiece,
  targetPiece,
  relation,
  useNativeAbacusNumbers = false,
}: HelperSelectionOptionsProps) {
  const [hoveredHelperId, setHoveredHelperId] = useState<string | null>(null)
  const maxRadius = cellSize * 1.2
  const angleStep = helpers.length > 1 ? 360 / helpers.length : 0

  console.log('[HelperSelectionOptions] targetPos:', targetPos)
  console.log('[HelperSelectionOptions] cellSize:', cellSize)
  console.log('[HelperSelectionOptions] maxRadius:', maxRadius)
  console.log('[HelperSelectionOptions] angleStep:', angleStep)
  console.log('[HelperSelectionOptions] helpers.length:', helpers.length)

  // Find the hovered helper and its ring position
  const hoveredHelperData = helpers.find((h) => h.piece.id === hoveredHelperId)
  const hoveredHelperIndex = helpers.findIndex((h) => h.piece.id === hoveredHelperId)
  let hoveredHelperRingPos = null
  if (hoveredHelperIndex !== -1) {
    const angle = hoveredHelperIndex * angleStep
    const rad = (angle * Math.PI) / 180
    hoveredHelperRingPos = {
      x: targetPos.x + Math.cos(rad) * maxRadius,
      y: targetPos.y + Math.sin(rad) * maxRadius,
    }
  }

  const color = getRelationColor(relation)
  const operator = getRelationOperator(relation)

  return (
    <g>
      {helpers.map(({ piece, boardPos }, index) => {
        const angle = index * angleStep
        const rad = (angle * Math.PI) / 180

        // Target position in ring
        const ringX = targetPos.x + Math.cos(rad) * maxRadius
        const ringY = targetPos.y + Math.sin(rad) * maxRadius

        console.log(
          `[HelperSelectionOptions] piece ${piece.id} (${piece.square}): index=${index}, angle=${angle}°, boardPos=(${boardPos.x}, ${boardPos.y}), ringPos=(${ringX}, ${ringY})`
        )

        return (
          <AnimatedHelperPiece
            key={piece.id}
            piece={piece}
            boardPos={boardPos}
            ringX={ringX}
            ringY={ringY}
            cellSize={cellSize}
            onSelectHelper={onSelectHelper}
            closing={closing}
            useNativeAbacusNumbers={useNativeAbacusNumbers}
            onHover={setHoveredHelperId}
          />
        )
      })}

      {/* Show number bond preview when hovering over a helper - draw triangle between actual pieces */}
      {hoveredHelperData && hoveredHelperRingPos && (
        <g>
          {(() => {
            // Use actual positions of all three pieces
            const helperPos = hoveredHelperRingPos // Helper is in the ring
            const moverBoardPos = hoveredHelperData.boardPos // Mover is on the board at its current position
            const targetBoardPos = targetPos // Target is on the board at capture position

            // Calculate positions from square coordinates
            const file = moverPiece.square.charCodeAt(0) - 65
            const rank = Number.parseInt(moverPiece.square.slice(1), 10)
            const row = 8 - rank
            const moverPos = {
              x: padding + file * (cellSize + gap) + cellSize / 2,
              y: padding + row * (cellSize + gap) + cellSize / 2,
            }

            const targetFile = targetPiece.square.charCodeAt(0) - 65
            const targetRank = Number.parseInt(targetPiece.square.slice(1), 10)
            const targetRow = 8 - targetRank
            const targetBoardPosition = {
              x: padding + targetFile * (cellSize + gap) + cellSize / 2,
              y: padding + targetRow * (cellSize + gap) + cellSize / 2,
            }

            return (
              <>
                {/* Triangle connecting lines between actual piece positions */}
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
                    x2={targetBoardPosition.x}
                    y2={targetBoardPosition.y}
                    stroke={color}
                    strokeWidth={4}
                  />
                  <line
                    x1={helperPos.x}
                    y1={helperPos.y}
                    x2={targetBoardPosition.x}
                    y2={targetBoardPosition.y}
                    stroke={color}
                    strokeWidth={4}
                  />
                </g>

                {/* Operator symbol in center of triangle */}
                <text
                  x={(moverPos.x + helperPos.x + targetBoardPosition.x) / 3}
                  y={(moverPos.y + helperPos.y + targetBoardPosition.y) / 3}
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

                {/* No cloned pieces - using actual pieces already on board/ring */}
              </>
            )
          })()}
        </g>
      )}
    </g>
  )
}
