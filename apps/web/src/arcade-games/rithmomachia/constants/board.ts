/**
 * Board layout constants
 */

export const BOARD_ROWS = 8
export const BOARD_COLUMNS = 8

/**
 * Column labels (A-H)
 */
export const COLUMN_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const

/**
 * Row labels (1-8)
 */
export const ROW_LABELS = [1, 2, 3, 4, 5, 6, 7, 8] as const

/**
 * Default board dimensions (can be overridden)
 */
export const DEFAULT_CELL_SIZE = 64
export const DEFAULT_GAP = 4
export const DEFAULT_PADDING = 32
