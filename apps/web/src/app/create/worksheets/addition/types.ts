// Type definitions for double-digit addition worksheet creator

/**
 * Complete, validated configuration for worksheet generation
 * All fields have concrete values (no undefined/null)
 */
export interface WorksheetConfig {
  // Problem set - PRIMARY state
  problemsPerPage: number // Number of problems per page (6, 8, 10, 12, 15, 16, 20)
  cols: number // Column count
  pages: number // Number of pages

  // Problem set - DERIVED state
  total: number // total = problemsPerPage * pages
  rows: number // rows = (problemsPerPage / cols) * pages

  // Personalization
  name: string
  date: string

  // Difficulty controls
  pAnyStart: number // Share of problems requiring any regrouping at start (0-1)
  pAllStart: number // Share requiring both ones and tens regrouping at start (0-1)
  interpolate: boolean // Whether to linearly decay difficulty across sheet

  // Layout
  page: {
    wIn: number
    hIn: number
  }
  margins: {
    left: number
    right: number
    top: number
    bottom: number
  }

  // Display options
  showCarryBoxes: boolean
  showAnswerBoxes: boolean
  showPlaceValueColors: boolean
  showProblemNumbers: boolean
  showCellBorder: boolean
  showTenFrames: boolean // Show empty ten-frames
  showTenFramesForAll: boolean // Show ten-frames for all place values (not just regrouping)
  fontSize: number
  seed: number
}

/**
 * Partial form state - user may be editing, fields optional
 * PRIMARY state: problemsPerPage, cols, pages (what user controls)
 * DERIVED state: rows, total (calculated from primary)
 */
export interface WorksheetFormState {
  // PRIMARY state (what user selects in UI)
  problemsPerPage?: number // 6, 8, 10, 12, 15, 16, 20
  cols?: number // 2, 3, 4, 5 - column count for layout
  pages?: number // 1, 2, 3, 4
  orientation?: 'portrait' | 'landscape'

  // DERIVED state (calculated: rows = (problemsPerPage / cols) * pages, total = problemsPerPage * pages)
  rows?: number
  total?: number

  // Other settings
  name?: string
  date?: string
  pAnyStart?: number
  pAllStart?: number
  interpolate?: boolean
  showCarryBoxes?: boolean
  showAnswerBoxes?: boolean
  showPlaceValueColors?: boolean
  showProblemNumbers?: boolean
  showCellBorder?: boolean
  showTenFrames?: boolean
  showTenFramesForAll?: boolean
  fontSize?: number
  seed?: number
}

/**
 * A single addition problem
 */
export interface AdditionProblem {
  a: number
  b: number
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean
  config?: WorksheetConfig
  errors?: string[]
}

/**
 * Problem category for difficulty control
 */
export type ProblemCategory = 'non' | 'onesOnly' | 'both'
