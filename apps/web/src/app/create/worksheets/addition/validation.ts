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

  // Determine mode (default to 'smart' if not specified)
  const mode = formState.mode ?? 'smart'

  // Shared fields for both modes
  const sharedFields = {
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

    fontSize,
    seed,
  }

  // Build mode-specific config
  let config: WorksheetConfig

  if (mode === 'smart') {
    // Smart mode: Use displayRules for conditional scaffolding
    const displayRules: DisplayRules = formState.displayRules ?? {
      carryBoxes: 'whenRegrouping',
      answerBoxes: 'always',
      placeValueColors: 'always',
      tenFrames: 'whenRegrouping',
      problemNumbers: 'always',
      cellBorders: 'always',
    }

    config = {
      version: 3,
      mode: 'smart',
      displayRules,
      difficultyProfile: formState.difficultyProfile,
      ...sharedFields,
    }
  } else {
    // Manual mode: Use boolean flags for uniform display
    config = {
      version: 3,
      mode: 'manual',
      showCarryBoxes: formState.showCarryBoxes ?? true,
      showAnswerBoxes: formState.showAnswerBoxes ?? true,
      showPlaceValueColors: formState.showPlaceValueColors ?? true,
      showTenFrames: formState.showTenFrames ?? false,
      showProblemNumbers: formState.showProblemNumbers ?? true,
      showCellBorder: formState.showCellBorder ?? true,
      showTenFramesForAll: formState.showTenFramesForAll ?? false,
      manualPreset: formState.manualPreset,
      ...sharedFields,
    }
  }

  return { isValid: true, config }
}
