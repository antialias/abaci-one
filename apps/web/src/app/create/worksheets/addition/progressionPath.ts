// Progression path system for guided worksheet configuration
// Maps a 1D slider to discrete steps through 3D space (digit count × regrouping × scaffolding)

import type { WorksheetFormState } from './types'

/**
 * A single step in the mastery progression path
 * Each step represents a complete worksheet configuration
 */
export interface ProgressionStep {
  // Unique ID for this step
  id: string

  // Position in progression (0-based)
  stepNumber: number

  // Which technique is being practiced
  technique:
    | 'basic-addition'
    | 'single-carry'
    | 'multi-carry'
    | 'basic-subtraction'
    | 'single-borrow'
    | 'multi-borrow'

  // Human-readable description
  name: string
  description: string

  // Complete worksheet configuration for this step
  // Uses worksheet config v4 format - no new version!
  config: Partial<WorksheetFormState>

  // Mastery tracking
  masteryThreshold: number // e.g., 0.85 = 85% accuracy required
  minimumAttempts: number // e.g., 15 problems minimum

  // Navigation
  nextStepId: string | null
  previousStepId: string | null
}

/**
 * Complete progression path for single-carry technique
 * This path demonstrates the scaffolding cycle pattern:
 * - Increase complexity (digit count) → reintroduce scaffolding (ten-frames)
 * - Fade scaffolding (remove ten-frames)
 * - Repeat
 */
export const SINGLE_CARRY_PATH: ProgressionStep[] = [
  // ========================================================================
  // PHASE 1: Single-digit carrying
  // ========================================================================

  // Step 0: 1-digit with full scaffolding
  {
    id: 'single-carry-1d-full',
    stepNumber: 0,
    technique: 'single-carry',
    name: 'Single-digit carrying (with support)',
    description: 'Learn carrying with single-digit problems and visual support',
    config: {
      digitRange: { min: 1, max: 1 },
      operator: 'addition',
      pAnyStart: 1.0, // 100% regrouping
      pAllStart: 0,
      displayRules: {
        carryBoxes: 'whenRegrouping',
        answerBoxes: 'always',
        placeValueColors: 'always',
        tenFrames: 'whenRegrouping', // ← FULL SCAFFOLDING
        problemNumbers: 'always',
        cellBorders: 'always',
        borrowNotation: 'never',
        borrowingHints: 'never',
      },
      interpolate: false, // No progressive difficulty in mastery mode
    },
    masteryThreshold: 0.9,
    minimumAttempts: 20,
    nextStepId: 'single-carry-1d-minimal',
    previousStepId: null,
  },

  // Step 1: 1-digit with minimal scaffolding
  {
    id: 'single-carry-1d-minimal',
    stepNumber: 1,
    technique: 'single-carry',
    name: 'Single-digit carrying (independent)',
    description: 'Practice carrying without visual aids',
    config: {
      digitRange: { min: 1, max: 1 },
      operator: 'addition',
      pAnyStart: 1.0,
      pAllStart: 0,
      displayRules: {
        carryBoxes: 'whenRegrouping',
        answerBoxes: 'always',
        placeValueColors: 'always',
        tenFrames: 'never', // ← SCAFFOLDING FADED
        problemNumbers: 'always',
        cellBorders: 'always',
        borrowNotation: 'never',
        borrowingHints: 'never',
      },
      interpolate: false,
    },
    masteryThreshold: 0.9,
    minimumAttempts: 20,
    nextStepId: 'single-carry-2d-full',
    previousStepId: 'single-carry-1d-full',
  },

  // ========================================================================
  // PHASE 2: Two-digit carrying (ones place only)
  // ========================================================================

  // Step 2: 2-digit with full scaffolding (SCAFFOLDING RETURNS!)
  {
    id: 'single-carry-2d-full',
    stepNumber: 2,
    technique: 'single-carry',
    name: 'Two-digit carrying (with support)',
    description: 'Apply carrying to two-digit problems with visual support',
    config: {
      digitRange: { min: 2, max: 2 },
      operator: 'addition',
      pAnyStart: 1.0,
      pAllStart: 0, // Ones place only
      displayRules: {
        carryBoxes: 'whenRegrouping',
        answerBoxes: 'always',
        placeValueColors: 'always',
        tenFrames: 'whenRegrouping', // ← SCAFFOLDING RETURNS for new complexity!
        problemNumbers: 'always',
        cellBorders: 'always',
        borrowNotation: 'never',
        borrowingHints: 'never',
      },
      interpolate: false,
    },
    masteryThreshold: 0.85,
    minimumAttempts: 20,
    nextStepId: 'single-carry-2d-minimal',
    previousStepId: 'single-carry-1d-minimal',
  },

  // Step 3: 2-digit with minimal scaffolding
  {
    id: 'single-carry-2d-minimal',
    stepNumber: 3,
    technique: 'single-carry',
    name: 'Two-digit carrying (independent)',
    description: 'Practice two-digit carrying without visual aids',
    config: {
      digitRange: { min: 2, max: 2 },
      operator: 'addition',
      pAnyStart: 1.0,
      pAllStart: 0,
      displayRules: {
        carryBoxes: 'whenRegrouping',
        answerBoxes: 'always',
        placeValueColors: 'always',
        tenFrames: 'never', // ← SCAFFOLDING FADED
        problemNumbers: 'always',
        cellBorders: 'always',
        borrowNotation: 'never',
        borrowingHints: 'never',
      },
      interpolate: false,
    },
    masteryThreshold: 0.85,
    minimumAttempts: 20,
    nextStepId: 'single-carry-3d-full',
    previousStepId: 'single-carry-2d-full',
  },

  // ========================================================================
  // PHASE 3: Three-digit carrying (ones place only)
  // ========================================================================

  // Step 4: 3-digit with full scaffolding (SCAFFOLDING RETURNS AGAIN!)
  {
    id: 'single-carry-3d-full',
    stepNumber: 4,
    technique: 'single-carry',
    name: 'Three-digit carrying (with support)',
    description: 'Apply carrying to three-digit problems with visual support',
    config: {
      digitRange: { min: 3, max: 3 },
      operator: 'addition',
      pAnyStart: 1.0,
      pAllStart: 0, // Ones place only
      displayRules: {
        carryBoxes: 'whenRegrouping',
        answerBoxes: 'always',
        placeValueColors: 'always',
        tenFrames: 'whenRegrouping', // ← SCAFFOLDING RETURNS for 3-digit!
        problemNumbers: 'always',
        cellBorders: 'always',
        borrowNotation: 'never',
        borrowingHints: 'never',
      },
      interpolate: false,
    },
    masteryThreshold: 0.85,
    minimumAttempts: 20,
    nextStepId: 'single-carry-3d-minimal',
    previousStepId: 'single-carry-2d-minimal',
  },

  // Step 5: 3-digit with minimal scaffolding
  {
    id: 'single-carry-3d-minimal',
    stepNumber: 5,
    technique: 'single-carry',
    name: 'Three-digit carrying (independent)',
    description: 'Practice three-digit carrying without visual aids',
    config: {
      digitRange: { min: 3, max: 3 },
      operator: 'addition',
      pAnyStart: 1.0,
      pAllStart: 0,
      displayRules: {
        carryBoxes: 'whenRegrouping',
        answerBoxes: 'always',
        placeValueColors: 'always',
        tenFrames: 'never', // ← SCAFFOLDING FADED
        problemNumbers: 'always',
        cellBorders: 'always',
        borrowNotation: 'never',
        borrowingHints: 'never',
      },
      interpolate: false,
    },
    masteryThreshold: 0.85,
    minimumAttempts: 20,
    nextStepId: null, // End of single-carry path (for now)
    previousStepId: 'single-carry-3d-full',
  },
]

/**
 * Map slider value (0-100) to progression step
 * @param sliderValue - Value from 0 to 100
 * @param path - Progression path to use
 * @returns The step corresponding to this slider position
 */
export function getStepFromSliderValue(
  sliderValue: number,
  path: ProgressionStep[]
): ProgressionStep {
  // Clamp slider value
  const clampedValue = Math.max(0, Math.min(100, sliderValue))

  // Map to step index
  const stepIndex = Math.round((clampedValue / 100) * (path.length - 1))

  return path[stepIndex]
}

/**
 * Map progression step to slider value (0-100)
 * @param stepNumber - Step number (0-based)
 * @param pathLength - Total number of steps in path
 * @returns Slider value from 0 to 100
 */
export function getSliderValueFromStep(stepNumber: number, pathLength: number): number {
  if (pathLength <= 1) return 0
  return (stepNumber / (pathLength - 1)) * 100
}

/**
 * Find nearest step in path matching given config
 * Useful when user manually changes settings - finds where they are on the path
 * @param config - Current worksheet configuration
 * @param path - Progression path to search
 * @returns The step that best matches the config
 */
export function findNearestStep(
  config: Partial<WorksheetFormState>,
  path: ProgressionStep[]
): ProgressionStep {
  let bestMatch = path[0]
  let bestScore = -Infinity

  for (const step of path) {
    let score = 0

    // Match digit range (most important - 100 points)
    if (
      step.config.digitRange?.min === config.digitRange?.min &&
      step.config.digitRange?.max === config.digitRange?.max
    ) {
      score += 100
    }

    // Match regrouping config (50 points each)
    if (step.config.pAnyStart === config.pAnyStart) score += 50
    if (step.config.pAllStart === config.pAllStart) score += 50

    // Match scaffolding - ten-frames (30 points)
    if (step.config.displayRules?.tenFrames === config.displayRules?.tenFrames) {
      score += 30
    }

    // Match operator (20 points)
    if (step.config.operator === config.operator) score += 20

    if (score > bestScore) {
      bestScore = score
      bestMatch = step
    }
  }

  return bestMatch
}

/**
 * Check if config exactly matches a step
 * @param config - Current worksheet configuration
 * @param step - Step to compare against
 * @returns True if config matches step configuration
 */
export function configMatchesStep(
  config: Partial<WorksheetFormState>,
  step: ProgressionStep
): boolean {
  return (
    config.digitRange?.min === step.config.digitRange?.min &&
    config.digitRange?.max === step.config.digitRange?.max &&
    config.pAnyStart === step.config.pAnyStart &&
    config.pAllStart === step.config.pAllStart &&
    config.displayRules?.tenFrames === step.config.displayRules?.tenFrames &&
    config.operator === step.config.operator
  )
}

/**
 * Get step by ID
 * @param stepId - Step ID to find
 * @param path - Progression path to search
 * @returns The step with matching ID, or undefined
 */
export function getStepById(stepId: string, path: ProgressionStep[]): ProgressionStep | undefined {
  return path.find((step) => step.id === stepId)
}
