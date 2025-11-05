// Type definitions for double-digit addition worksheet creator

/**
 * Complete, validated configuration for worksheet generation
 * All fields have concrete values (no undefined/null)
 */
export interface WorksheetConfig {
  // Problem set
  total: number
  cols: number
  rows: number

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
  showCellBorder: boolean
  fontSize: number
  seed: number
}

/**
 * Partial form state - user may be editing, fields optional
 */
export interface WorksheetFormState {
  total?: number
  cols?: number
  rows?: number
  name?: string
  date?: string
  pAnyStart?: number
  pAllStart?: number
  interpolate?: boolean
  showCarryBoxes?: boolean
  showCellBorder?: boolean
  fontSize?: number
  seed?: number
  orientation?: 'portrait' | 'landscape'
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
