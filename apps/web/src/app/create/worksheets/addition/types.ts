// Type definitions for double-digit addition worksheet creator

import type {
  AdditionConfigV3,
  AdditionConfigV3Smart,
  AdditionConfigV3Manual,
} from '../config-schemas'

/**
 * Complete, validated configuration for worksheet generation
 * Extends V3 config with additional derived fields needed for rendering
 *
 * V3 uses discriminated union on 'mode':
 * - Smart mode: Uses displayRules for conditional per-problem scaffolding
 * - Manual mode: Uses boolean flags for uniform display across all problems
 */
export type WorksheetConfig = AdditionConfigV3 & {
  // Problem set - DERIVED state
  total: number // total = problemsPerPage * pages
  rows: number // rows = (problemsPerPage / cols) * pages

  // Personalization
  date: string
  seed: number

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
}

/**
 * Partial form state - user may be editing, fields optional
 * Based on V3 config with additional derived state
 *
 * V3 supports two modes via discriminated union:
 * - Smart mode: Has displayRules and optional difficultyProfile
 * - Manual mode: Has boolean display flags and optional manualPreset
 *
 * During editing, mode field may be present to indicate which mode is active.
 * If mode is absent, defaults to 'smart' mode.
 *
 * This type is intentionally permissive during form editing to allow fields from
 * both modes to exist temporarily. Validation will enforce mode consistency.
 */
export type WorksheetFormState = Partial<Omit<AdditionConfigV3Smart, 'version'>> &
  Partial<Omit<AdditionConfigV3Manual, 'version'>> & {
    // DERIVED state (calculated from primary state)
    rows?: number
    total?: number
    date?: string
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
