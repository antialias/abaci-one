// Validation logic for worksheet configuration

import type { WorksheetFormState, WorksheetConfig, ValidationResult } from './types'
import type { DisplayRules } from './displayRules'

/**
 * Get current date formatted as "Month Day, Year"
 */
function getDefaultDate(): string {
  const now = new Date()
  return now.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Validate and create complete config from partial form state
 */
export function validateWorksheetConfig(formState: WorksheetFormState): ValidationResult {
  const errors: string[] = []

  // Validate total (must be positive, reasonable limit)
  const total = formState.total ?? 20
  if (total < 1 || total > 100) {
    errors.push('Total problems must be between 1 and 100')
  }

  // Validate cols and auto-calculate rows
  const cols = formState.cols ?? 4
  if (cols < 1 || cols > 10) {
    errors.push('Columns must be between 1 and 10')
  }

  // Auto-calculate rows to fit all problems
  const rows = Math.ceil(total / cols)

  // Validate probabilities (0-1 range)
  const pAnyStart = formState.pAnyStart ?? 0.75
  const pAllStart = formState.pAllStart ?? 0.25
  if (pAnyStart < 0 || pAnyStart > 1) {
    errors.push('pAnyStart must be between 0 and 1')
  }
  if (pAllStart < 0 || pAllStart > 1) {
    errors.push('pAllStart must be between 0 and 1')
  }
  if (pAllStart > pAnyStart) {
    errors.push('pAllStart cannot be greater than pAnyStart')
  }

  // Validate fontSize
  const fontSize = formState.fontSize ?? 16
  if (fontSize < 8 || fontSize > 32) {
    errors.push('Font size must be between 8 and 32')
  }

  // Validate seed (must be positive integer)
  const seed = formState.seed ?? Date.now() % 2147483647
  if (!Number.isInteger(seed) || seed < 0) {
    errors.push('Seed must be a non-negative integer')
  }

  if (errors.length > 0) {
    return { isValid: false, errors }
  }

  // Determine orientation based on columns (portrait = 2-3 cols, landscape = 4-5 cols)
  const orientation = formState.orientation || (cols <= 3 ? 'portrait' : 'landscape')

  // Get primary state values
  const problemsPerPage = formState.problemsPerPage ?? total
  const pages = formState.pages ?? 1

  // Handle V2 displayRules or V1 boolean flags
  let displayRules: DisplayRules
  let showCarryBoxes: boolean
  let showAnswerBoxes: boolean
  let showPlaceValueColors: boolean
  let showProblemNumbers: boolean
  let showCellBorder: boolean
  let showTenFrames: boolean

  if (formState.displayRules) {
    // V2: Use displayRules from formState
    displayRules = formState.displayRules
    // Derive V1 compatibility flags (use 'always' as true, anything else as false for now)
    showCarryBoxes = displayRules.carryBoxes === 'always'
    showAnswerBoxes = displayRules.answerBoxes === 'always'
    showPlaceValueColors = displayRules.placeValueColors === 'always'
    showProblemNumbers = displayRules.problemNumbers === 'always'
    showCellBorder = displayRules.cellBorders === 'always'
    showTenFrames = displayRules.tenFrames === 'always'
  } else {
    // V1: Use individual boolean flags, convert to displayRules
    showCarryBoxes = formState.showCarryBoxes ?? true
    showAnswerBoxes = formState.showAnswerBoxes ?? true
    showPlaceValueColors = formState.showPlaceValueColors ?? true
    showProblemNumbers = formState.showProblemNumbers ?? true
    showCellBorder = formState.showCellBorder ?? true
    showTenFrames = formState.showTenFrames ?? false

    displayRules = {
      carryBoxes: showCarryBoxes ? 'always' : 'never',
      answerBoxes: showAnswerBoxes ? 'always' : 'never',
      placeValueColors: showPlaceValueColors ? 'always' : 'never',
      problemNumbers: showProblemNumbers ? 'always' : 'never',
      cellBorders: showCellBorder ? 'always' : 'never',
      tenFrames: showTenFrames ? 'always' : 'never',
    }
  }

  // Build complete config with defaults
  const config: WorksheetConfig = {
    // V2 fields
    version: 2,
    displayRules,
    difficultyProfile: formState.difficultyProfile,

    // Primary state
    problemsPerPage,
    cols,
    pages,
    orientation,

    // Derived state
    total,
    rows,

    // Other fields
    name: formState.name?.trim() || 'Student',
    date: formState.date?.trim() || getDefaultDate(),
    pAnyStart,
    pAllStart,
    interpolate: formState.interpolate ?? true,

    // Layout
    page: {
      wIn: orientation === 'portrait' ? 8.5 : 11,
      hIn: orientation === 'portrait' ? 11 : 8.5,
    },
    margins: {
      left: 0.6,
      right: 0.6,
      top: 1.1,
      bottom: 0.7,
    },

    // V1 compatibility flags (derived from displayRules)
    showCarryBoxes,
    showAnswerBoxes,
    showPlaceValueColors,
    showProblemNumbers,
    showCellBorder,
    showTenFrames,
    showTenFramesForAll: formState.showTenFramesForAll ?? false,

    fontSize,
    seed,
  }

  return { isValid: true, config }
}
