import { css } from '../../../../styled-system/css'
import { PieceRenderer } from './PieceRenderer'
import type { Color, PieceType } from '../types'

/**
 * Simplified piece for board examples
 */
export interface ExamplePiece {
  square: string // e.g. "A1", "B2"
  type: PieceType
  color: Color
  value: number
}

interface CropArea {
  // Support both naming conventions for backwards compatibility
  minCol?: number // 0-15 (A=0, P=15)
  maxCol?: number // 0-15
  minRow?: number // 1-8
  maxRow?: number // 1-8
  startCol?: number // Alternative: 0-15
  endCol?: number // Alternative: 0-15
  startRow?: number // Alternative: 1-8
  endRow?: number // Alternative: 1-8
}

interface RithmomachiaBoardProps {
  pieces: ExamplePiece[]
  highlightSquares?: string[] // Squares to highlight (e.g. for harmony examples)
  scale?: number // Scale factor for the board size
  showLabels?: boolean // Show rank/file labels
  cropArea?: CropArea // Crop to show only a rectangular subsection
  useNativeAbacusNumbers?: boolean // Display numbers as mini abaci
}

/**
 * Reusable board component for displaying Rithmomachia positions.
 * Used in the guide and for board examples.
 */
export function RithmomachiaBoard({
  pieces,
  highlightSquares = [],
  scale = 0.5,
  showLabels = true, // Default to true for proper board labels
  cropArea,
  useNativeAbacusNumbers = false,
}: RithmomachiaBoardProps) {
  // Board dimensions
  const cellSize = 100 // SVG units per cell
  const gap = 2
  const padding = 10
  const labelMargin = showLabels ? 30 : 0 // Space for row/column labels

  // Determine the area to display (support both naming conventions)
  const minCol = cropArea?.minCol ?? cropArea?.startCol ?? 0
  const maxCol = cropArea?.maxCol ?? cropArea?.endCol ?? 15
  const minRow = cropArea?.minRow ?? cropArea?.startRow ?? 1
  const maxRow = cropArea?.maxRow ?? cropArea?.endRow ?? 8

  const displayCols = maxCol - minCol + 1
  const displayRows = maxRow - minRow + 1

  // Calculate cropped board dimensions (including label margins)
  const boardInnerWidth = displayCols * cellSize + (displayCols - 1) * gap
  const boardInnerHeight = displayRows * cellSize + (displayRows - 1) * gap
  const boardWidth = boardInnerWidth + padding * 2 + labelMargin
  const boardHeight = boardInnerHeight + padding * 2 + labelMargin

  return (
    <div
      data-component="rithmomachia-board-example"
      className={css({
        width: '100%',
        maxWidth: `${boardWidth * scale}px`,
        margin: '0 auto',
      })}
    >
      <svg
        viewBox={`0 0 ${boardWidth} ${boardHeight}`}
        className={css({
          width: '100%',
          height: 'auto',
        })}
      >
        {/* Board background */}
        <rect x={0} y={0} width={boardWidth} height={boardHeight} fill="#d1d5db" rx={8} />

        {/* Board squares */}
        {Array.from({ length: displayRows }, (_, displayRow) => {
          const actualRank = maxRow - displayRow
          return Array.from({ length: displayCols }, (_, displayCol) => {
            const actualCol = minCol + displayCol
            const square = `${String.fromCharCode(65 + actualCol)}${actualRank}`
            const isLight = (actualCol + actualRank) % 2 === 0
            const isHighlighted = highlightSquares.includes(square)

            const x = labelMargin + padding + displayCol * (cellSize + gap)
            const y = padding + displayRow * (cellSize + gap)

            return (
              <g key={square}>
                <rect
                  x={x}
                  y={y}
                  width={cellSize}
                  height={cellSize}
                  fill={isHighlighted ? '#fde047' : isLight ? '#f3f4f6' : '#e5e7eb'}
                  stroke={isHighlighted ? '#f59e0b' : 'none'}
                  strokeWidth={isHighlighted ? 3 : 0}
                />
              </g>
            )
          })
        })}

        {/* Column labels (A-P) at the bottom */}
        {showLabels &&
          Array.from({ length: displayCols }, (_, displayCol) => {
            const actualCol = minCol + displayCol
            const colLabel = String.fromCharCode(65 + actualCol)
            const x = labelMargin + padding + displayCol * (cellSize + gap) + cellSize / 2
            const y = boardHeight - 10

            return (
              <text
                key={`col-${colLabel}`}
                x={x}
                y={y}
                fontSize="20"
                fontWeight="bold"
                fill="#374151"
                fontFamily="sans-serif"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {colLabel}
              </text>
            )
          })}

        {/* Row labels (1-8) on the left */}
        {showLabels &&
          Array.from({ length: displayRows }, (_, displayRow) => {
            const actualRank = maxRow - displayRow
            const x = 15
            const y = padding + displayRow * (cellSize + gap) + cellSize / 2

            return (
              <text
                key={`row-${actualRank}`}
                x={x}
                y={y}
                fontSize="20"
                fontWeight="bold"
                fill="#374151"
                fontFamily="sans-serif"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {actualRank}
              </text>
            )
          })}

        {/* Pieces */}
        {pieces
          .filter((piece) => {
            const file = piece.square.charCodeAt(0) - 65
            const rank = Number.parseInt(piece.square.slice(1), 10)
            return file >= minCol && file <= maxCol && rank >= minRow && rank <= maxRow
          })
          .map((piece, idx) => {
            const file = piece.square.charCodeAt(0) - 65
            const rank = Number.parseInt(piece.square.slice(1), 10)

            // Calculate position relative to the crop area
            const displayCol = file - minCol
            const displayRow = maxRow - rank

            const x = labelMargin + padding + displayCol * (cellSize + gap) + cellSize / 2
            const y = padding + displayRow * (cellSize + gap) + cellSize / 2

            return (
              <g key={`${piece.square}-${idx}`} transform={`translate(${x}, ${y})`}>
                <g transform={`translate(${-cellSize / 2}, ${-cellSize / 2})`}>
                  <PieceRenderer
                    type={piece.type}
                    color={piece.color}
                    value={piece.value}
                    size={cellSize}
                    useNativeAbacusNumbers={useNativeAbacusNumbers}
                  />
                </g>
              </g>
            )
          })}
      </svg>
    </div>
  )
}
