/**
 * Board coordinate calculation utilities
 */

export interface BoardPosition {
  x: number;
  y: number;
}

export interface BoardLayout {
  cellSize: number;
  gap: number;
  padding: number;
}

/**
 * Parse square notation (e.g., "A1", "H8") into file and rank indices
 * @param square - Square notation (e.g., "A1")
 * @returns Object with file (0-7) and rank (1-8)
 */
export function parseSquare(square: string): { file: number; rank: number } {
  const file = square.charCodeAt(0) - 65; // 'A' = 0, 'B' = 1, etc.
  const rank = Number.parseInt(square.slice(1), 10);
  return { file, rank };
}

/**
 * Convert file and rank to row index (0-7, top to bottom)
 * @param rank - Rank number (1-8)
 * @returns Row index (0-7)
 */
export function rankToRow(rank: number): number {
  return 8 - rank;
}

/**
 * Get the center position of a square on the board
 * @param square - Square notation (e.g., "A1")
 * @param layout - Board layout configuration
 * @returns Center position {x, y} in pixels
 */
export function getSquarePosition(
  square: string,
  layout: BoardLayout,
): BoardPosition {
  const { file, rank } = parseSquare(square);
  const row = rankToRow(rank);

  return {
    x:
      layout.padding +
      file * (layout.cellSize + layout.gap) +
      layout.cellSize / 2,
    y:
      layout.padding +
      row * (layout.cellSize + layout.gap) +
      layout.cellSize / 2,
  };
}

/**
 * Get the top-left corner position of a square on the board
 * @param square - Square notation (e.g., "A1")
 * @param layout - Board layout configuration
 * @returns Top-left position {x, y} in pixels
 */
export function getSquareCorner(
  square: string,
  layout: BoardLayout,
): BoardPosition {
  const { file, rank } = parseSquare(square);
  const row = rankToRow(rank);

  return {
    x: layout.padding + file * (layout.cellSize + layout.gap),
    y: layout.padding + row * (layout.cellSize + layout.gap),
  };
}

/**
 * Get the total board dimensions
 * @param layout - Board layout configuration
 * @returns Total width and height in pixels
 */
export function getBoardDimensions(layout: BoardLayout): {
  width: number;
  height: number;
} {
  const boardSize = 8 * layout.cellSize + 7 * layout.gap;
  return {
    width: boardSize + 2 * layout.padding,
    height: boardSize + 2 * layout.padding,
  };
}
