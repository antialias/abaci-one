// Shared TypeScript types for Typst generation

export interface DisplayOptions {
  showCarryBoxes: boolean
  showAnswerBoxes: boolean
  showPlaceValueColors: boolean
  showProblemNumbers: boolean
  showCellBorder: boolean
  showTenFrames: boolean
  showTenFramesForAll: boolean
  fontSize: number
}

export interface CellDimensions {
  cellSize: number // in inches
  cellSizeIn: string // formatted for Typst (e.g., "0.55in")
  cellSizePt: number // in points (for font sizing)
}

export interface TypstConstants {
  CELL_STROKE_WIDTH: number
  TEN_FRAME_STROKE_WIDTH: number
  TEN_FRAME_CELL_STROKE_WIDTH: number
  ARROW_STROKE_WIDTH: number

  // Positioning offsets for borrowing hint arrows
  ARROW_START_DX: number
  ARROW_START_DY: number
  ARROWHEAD_DX: number
  ARROWHEAD_DY: number

  // Sizing factors
  HINT_TEXT_SIZE_FACTOR: number
  ARROWHEAD_SIZE_FACTOR: number
}

export const TYPST_CONSTANTS: TypstConstants = {
  CELL_STROKE_WIDTH: 0.5,
  TEN_FRAME_STROKE_WIDTH: 0.8,
  TEN_FRAME_CELL_STROKE_WIDTH: 0.4,
  ARROW_STROKE_WIDTH: 1.5,

  ARROW_START_DX: 0.9,
  ARROW_START_DY: 0.15,
  ARROWHEAD_DX: 0.96,
  ARROWHEAD_DY: 0.62,

  HINT_TEXT_SIZE_FACTOR: 0.25,
  ARROWHEAD_SIZE_FACTOR: 0.35,
} as const
