import { useMemo } from 'react'
import { BOARD_COLUMNS, BOARD_ROWS } from '../constants/board'
import { getBoardDimensions, getSquarePosition } from '../utils/boardCoordinates'

/**
 * Layout configuration for the game board
 */
export interface BoardLayout {
  cellSize: number
  gap: number
  padding: number
  rows: number
  columns: number
}

/**
 * Hook that provides centralized board layout calculations
 */
export function useBoardLayout(): BoardLayout {
  return useMemo(
    () => ({
      cellSize: 100, // SVG units per cell
      gap: 2, // Gap between cells
      padding: 10, // Padding around board
      rows: BOARD_ROWS,
      columns: BOARD_COLUMNS,
    }),
    []
  )
}

/**
 * Hook that provides layout with derived values
 */
export function useBoardLayoutWithUtils() {
  const layout = useBoardLayout()

  return useMemo(
    () => ({
      ...layout,
      // Derived values
      totalCellSize: layout.cellSize + layout.gap,
      dimensions: getBoardDimensions(layout),
      getSquarePosition: (square: string) => getSquarePosition(square, layout),
    }),
    [layout]
  )
}
