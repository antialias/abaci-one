// Type definitions for addition worksheet creator (supports 1-5 digit problems)

import type {
  AdditionConfigV4,
  AdditionConfigV4Smart,
  AdditionConfigV4Manual,
  AdditionConfigV4Mastery,
} from '@/app/create/worksheets/config-schemas'

/**
 * Complete, validated configuration for worksheet generation
 * Extends V4 config with additional derived fields needed for rendering
 *
 * V4 uses discriminated union on 'mode':
 * - Smart mode: Uses displayRules for conditional per-problem scaffolding
 * - Manual mode: Uses boolean flags for uniform display across all problems
 *
 * V4 adds digitRange field to support 1-5 digit problems
 */
export type WorksheetConfig = AdditionConfigV4 & {
  // Problem set - DERIVED state
  total: number // total = problemsPerPage * pages
  rows: number // rows = (problemsPerPage / cols) * pages

  // Personalization
  date: string

  // Problem reproducibility (critical for sharing)
  seed: number
  prngAlgorithm: string

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
 * Based on V4 config with additional derived state
 *
 * V4 supports three modes via discriminated union:
 * - Smart mode: Has displayRules and optional difficultyProfile
 * - Mastery mode: Has displayRules and optional currentStepId
 * - Manual mode: Has boolean display flags and optional manualPreset
 *
 * During editing, mode field may be present to indicate which mode is active.
 * If mode is absent, defaults to 'smart' mode.
 *
 * This type is intentionally permissive during form editing to allow fields from
 * all modes to exist temporarily. Validation will enforce mode consistency.
 *
 * ## Field Categories (Config Persistence)
 *
 * **PRIMARY STATE** (persisted to localStorage/database):
 * - Most fields from AdditionConfigV4 (problemsPerPage, pages, cols, etc.)
 * - seed, prngAlgorithm (critical for reproducibility)
 *
 * **DERIVED STATE** (calculated, never persisted):
 * - `total` = problemsPerPage × pages
 * - `rows` = Math.ceil(problemsPerPage / cols)
 *
 * **EPHEMERAL STATE** (generated fresh, never persisted):
 * - `date` = current date when worksheet is generated
 *
 * See `.claude/WORKSHEET_CONFIG_PERSISTENCE.md` for full architecture.
 */
export type WorksheetFormState = Partial<Omit<AdditionConfigV4Smart, 'version'>> &
  Partial<Omit<AdditionConfigV4Manual, 'version'>> &
  Partial<Omit<AdditionConfigV4Mastery, 'version'>> & {
    // ========================================
    // DERIVED STATE (never persisted)
    // ========================================
    // These are calculated from primary state and excluded from persistence.
    // See extractConfigFields() blacklist for exclusion logic.

    /** Derived: total = problemsPerPage × pages */
    rows?: number

    /** Derived: rows = Math.ceil(problemsPerPage / cols) */
    total?: number

    // ========================================
    // EPHEMERAL STATE (never persisted)
    // ========================================
    // Generated fresh at render time

    /** Ephemeral: Current date when worksheet is generated */
    date?: string

    // ========================================
    // PRIMARY STATE (persisted)
    // ========================================
    // Critical for reproducibility when sharing worksheets

    /** Primary: Random seed for reproducible problem generation */
    seed?: number

    /** Primary: PRNG algorithm (ensures same random sequence across systems) */
    prngAlgorithm?: string
  }

/**
 * Worksheet operator type
 */
export type WorksheetOperator = 'addition' | 'subtraction' | 'mixed'

/**
 * A single addition problem
 */
export interface AdditionProblem {
  a: number
  b: number
  operator: 'add'
}

/**
 * A single subtraction problem
 */
export interface SubtractionProblem {
  minuend: number
  subtrahend: number
  operator: 'sub'
}

/**
 * Unified problem type (addition or subtraction)
 */
export type WorksheetProblem = AdditionProblem | SubtractionProblem

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
